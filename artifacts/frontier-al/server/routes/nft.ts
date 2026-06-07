// AUTO-SPLIT from server/routes.ts (feat/routes-refactor, MASTER A2).
// Mechanical domain extraction — handler bodies are verbatim, zero logic change.

import type { Express, Request, Response } from "express";
import path from "path";
import { getBattleReplay, recordSubParcelWorldEvent, recordArchetypeWorldEvent } from "../services/redis";
import algosdk from "algosdk";
import { storage } from "../storage";
import { mineActionSchema, upgradeActionSchema, attackActionSchema, buildActionSchema, purchaseActionSchema, collectActionSchema, claimFrontierActionSchema, mintAvatarActionSchema, specialAttackActionSchema, deployDroneActionSchema, deploySatelliteActionSchema, SlimGameState, createTradeOrderSchema, placeBetSchema, createMarketSchema, resolveMarketSchema, terraformActionSchema } from "@shared/schema";
import { z } from "zod";
import { db, withDbRetry, getPoolStats } from "../db";
import { parcels as parcelsTable, plotNfts as plotNftsTable, players as playersTable, mintIdempotency as mintIdempotencyTable, battles as battlesTable, gameEvents as gameEventsTable, gameMeta, tradeOrders as tradeOrdersTable, subParcels as subParcelsTable, orbitalEvents as orbitalEventsTable, commanderNfts as commanderNftsTable, commanderMintIdempotency as commanderMintIdempotencyTable } from "../db-schema";
import { eq, sql, desc } from "drizzle-orm";
import { recommendTerraform, type TerraformGoal } from "../engine/narrative/advisor";
import { broadcastGameState, broadcastRaw, markDirty } from "../wsServer";
import { appendWorldEvent, listWorldEvents, getRecentWorldEvents } from "../worldEventStore";

// ── Chain Service ─────────────────────────────────────────────────────────────
// All algosdk usage is now isolated in server/services/chain/*.
// Routes import ONLY from the service layer — never from algosdk directly.
import { getFrontierAsaId, getOrCreateFrontierAsa, isAddressOptedIn, setFrontierAsaId, batchedTransferFrontierAsa, clawbackFrontierAsa } from "../services/chain/asa";
import { enqueueFrontierTransfer } from "../services/chain/transferQueue";
import { getAdminAddress, getAdminBalance, getAlgodClient, getIndexerClient } from "../services/chain/client";
import { mintLandNft, transferLandNft, attemptDelivery } from "../services/chain/land";
import { recordUpgradeOnChain } from "../services/chain/upgrades";
import { mintCommanderNft, transferCommanderNft, forwardLiquiditySplit, verifyAlgoPayment, attemptCommanderDelivery } from "../services/chain/commander";
import {
  bootstrapFactionIdentities,
  getAllFactionAsaIds,
  getFactionAsaId,
  FACTION_DEFINITIONS,
} from "../services/chain/factions";
import { fromMicroFRNTR } from "../storage/game-rules";
import {
  ECONOMY_MODE,
  LAND_DAILY_FRNTR_RATE,
  LAND_DAILY_FRNTR_RATE_TEST,
  LAND_DAILY_FRNTR_RATE_PROD,
  EMISSION_CHECK_PARCEL_COUNTS,
  projectedDailyEmissions,
  COMMANDER_MINT_FRNTR_ACTIVE,
  COMMANDER_ALGO_NETWORK_FEE,
  COMMANDER_ALGO_PRICE_ACTIVE,
  LAND_PURCHASE_ALGO_ACTIVE,
  TESTING_ECONOMY_SUMMARY,
} from "../../shared/economy-config";
import { getAlgoUsdPrice, usdToMicroAlgo } from "../services/priceOracle";
import { requireAdminKey, enumerationLimiter, authLimiter, clampLimit } from "../security";
import {
  getAuth,
  isWalletAuthRequired,
  issueNonce,
  verifyAuthAndNonce,
  signSession,
  setSessionCookie,
  clearSessionCookie,
} from "../auth";
import { scopeGameStateFor } from "../stateScope";
import { assessWelcomeBonusEligibility } from "../services/chain/eligibility";
import type { RouteContext } from "./context";

export function registerNftRoutes(app: Express, ctx: RouteContext): void {
  const { assertPlayerOwnership, maybeGrantWelcomeBonus, fireBurn, adviceLimiter, algodClient, indexerClient } = ctx;

  app.get("/faction/:name", (req, res) => {
    const factionName = decodeURIComponent(req.params.name);
    const def = FACTION_DEFINITIONS.find((f) => f.name === factionName);
    if (!def) return res.status(404).json({ error: "Faction not found" });

    const asaId       = getFactionAsaId(factionName);
    // PUBLIC_BASE_URL must come from env only — never the request Host header
    // (this JSON is referenced as a permanent on-chain assetURL; a host-header
    // fallback would let a spoofed Host poison the metadata URLs). Mirror the
    // /nft/metadata endpoints: 503 when unset rather than serve invalid URLs.
    const baseUrl     = process.env.PUBLIC_BASE_URL ? process.env.PUBLIC_BASE_URL.replace(/\/+$/, "") : null;
    if (!baseUrl) {
      console.error("[/faction/:name] PUBLIC_BASE_URL is not set — faction metadata URLs would be invalid. Set PUBLIC_BASE_URL env var.");
      return res.status(503).json({ error: "PUBLIC_BASE_URL not configured — faction metadata URLs would be invalid. Set PUBLIC_BASE_URL env var." });
    }
    const explorerUrl = asaId ? `https://allo.info/asset/${asaId}` : null;

    res.json({
      name:        def.assetName,
      description: def.lore,
      image:       `${baseUrl}/faction/images/${encodeURIComponent(factionName)}.svg`,
      external_url: `${baseUrl}/faction/${encodeURIComponent(factionName)}`,
      properties: {
        factionName: def.name,
        unitName:    def.unitName,
        behavior:    def.behavior,
        assetId:     asaId,
        explorerUrl,
        totalSupply: def.totalSupply,
        game:        "FRONTIER",
        version:     1,
      },
    });
  });

  // ── NFT Metadata (ARC-3) ────────────────────────────────────────────────────
  // Public endpoint used by Algorand NFT marketplaces and wallets.
  // Intentionally DYNAMIC: biome + terraform state (stability/hazard/yield) reflect
  // the live parcel, so terraforming a plot updates its metadata + biome image.
  // The ASA identity is preserved (no burn/remint); metadataVersion + a short
  // Cache-Control let wallets/indexers pick up changes.
  // BASE_URL must come from the PUBLIC_BASE_URL env var in production.
  app.get("/nft/metadata/:plotId", async (req, res) => {
    // Reject non-integer plotId values early.
    const plotId = parseInt(req.params.plotId, 10);
    if (isNaN(plotId) || plotId < 1) {
      return res.status(400).json({ error: "plotId must be a positive integer" });
    }

    // This endpoint requires a real DB (not MemStorage).
    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    try {
      // Derive base URL: env var (production) → request origin (non-localhost).
      // LOCAL DEVELOPMENT: set PUBLIC_BASE_URL in .env so metadata served at
      // /nft/metadata/:plotId returns a real public URL rather than localhost.
      // Without it, NFT image links in metadata JSON will be broken for anyone
      // not running the server locally.
      const rawBaseUrl = process.env.PUBLIC_BASE_URL || null;
      const baseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, "") : null;
      if (!baseUrl) {
        // Metadata would contain localhost URLs — log and return a 503 so the
        // caller knows the data is unreliable rather than silently serving bad URLs.
        console.error("[/nft/metadata] PUBLIC_BASE_URL is not set and request is from localhost. Set PUBLIC_BASE_URL for NFT metadata to work correctly.");
        return res.status(503).json({ error: "PUBLIC_BASE_URL not configured — NFT metadata URLs would be invalid. Set PUBLIC_BASE_URL env var." });
      }

      // Select columns needed for ARC-3 metadata including live terraform state.
      const [parcel] = await db
        .select({
          plotId:              (parcelsTable as any).plotId,
          biome:               (parcelsTable as any).biome,
          lat:                 (parcelsTable as any).lat,
          lng:                 (parcelsTable as any).lng,
          richness:            (parcelsTable as any).richness,
          purchasePriceAlgo:   (parcelsTable as any).purchasePriceAlgo,
          hazardLevel:         (parcelsTable as any).hazardLevel,
          stability:           (parcelsTable as any).stability,
          terraformStatus:     (parcelsTable as any).terraformStatus,
          terraformedAt:       (parcelsTable as any).terraformedAt,
          terraformLevel:      (parcelsTable as any).terraformLevel,
          terraformType:       (parcelsTable as any).terraformType,
          metadataVersion:     (parcelsTable as any).metadataVersion,
          visualStateRevision: (parcelsTable as any).visualStateRevision,
        })
        .from(parcelsTable)
        .where(eq((parcelsTable as any).plotId, plotId));

      if (!parcel) {
        return res.status(404).json({ error: "Plot not found" });
      }

      const terraformStatus    = parcel.terraformStatus ?? "none";
      const metadataVersion    = parcel.metadataVersion ?? 1;
      const visualRevision     = parcel.visualStateRevision ?? 0;
      const isTerraformed      = terraformStatus !== "none";

      // ARC-3 style metadata — biome and terraform state update dynamically.
      // Cache-Control is short (1h) so wallets/indexers pick up terraform changes.
      // The same ASA identity is preserved — no burn/remint on terraform.
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.json({
        name:         `Frontier Plot #${parcel.plotId}`,
        description:  `A ${parcel.biome} land parcel on the Frontier globe. Richness: ${parcel.richness}%.${isTerraformed ? ` Terraformed to ${parcel.biome} (level ${parcel.terraformLevel ?? 0}).` : ""} Own, mine, upgrade, and battle for territory on the Algorand blockchain.`,
        image:        `${baseUrl}/nft/biomes/${parcel.biome}.png`,
        external_url: `${baseUrl}/plot/${parcel.plotId}`,
        properties: {
          plotId:              parcel.plotId,
          biome:               parcel.biome,
          lat:                 parcel.lat,
          lng:                 parcel.lng,
          richness:            parcel.richness,
          purchasePriceAlgo:   parcel.purchasePriceAlgo,
          hazardLevel:         parcel.hazardLevel ?? 0,
          stability:           parcel.stability ?? 100,
          terraformStatus,
          terraformedAt:       parcel.terraformedAt ?? null,
          terraformLevel:      parcel.terraformLevel ?? 0,
          terraformType:       parcel.terraformType ?? null,
          metadataVersion,
          visualStateRevision: visualRevision,
          // version is the metadata schema version (static); metadataVersion tracks content changes.
          version:             2,
        },
      });
    } catch (error) {
      console.error("NFT metadata error:", error);
      res.status(500).json({ error: "Failed to fetch NFT metadata" });
    }
  });

  // ── Plot NFT on-chain record lookup ────────────────────────────────────────
  // Returns the plot_nfts row for a given plotId.
  // Useful for checking if a plot has been minted and retrieving its assetId.
  app.get("/api/nft/plot/:plotId", async (req, res) => {
    const plotId = parseInt(req.params.plotId, 10);
    if (isNaN(plotId) || plotId < 1) {
      return res.status(400).json({ error: "plotId must be a positive integer" });
    }
    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }
    try {
      const [row] = await db
        .select()
        .from(plotNftsTable)
        .where(eq(plotNftsTable.plotId, plotId));

      if (!row) {
        return res.status(404).json({ error: "No NFT record for this plot" });
      }

      res.json({
        plotId: row.plotId,
        assetId: row.assetId ? Number(row.assetId) : null,
        mintedToAddress: row.mintedToAddress,
        mintedAt: row.mintedAt ? Number(row.mintedAt) : null,
        explorerUrl: row.assetId
          ? `https://allo.info/asset/${row.assetId}` // algoexplorer.io shut down; allo.info is current
          : null,
      });
    } catch (error) {
      console.error("NFT plot lookup error:", error);
      res.status(500).json({ error: "Failed to fetch NFT record" });
    }
  });

  // Deliver a custody-held Plot NFT to its owner after they have opted in.
  // POST /api/nft/deliver/:plotId  body: { address: string }
  app.post("/api/nft/deliver/:plotId", async (req, res) => {
    const plotId = parseInt(req.params.plotId, 10);
    if (isNaN(plotId) || plotId < 1) {
      return res.status(400).json({ error: "plotId must be a positive integer" });
    }
    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    const { address } = req.body;
    if (!address || !algosdk.isValidAddress(address)) {
      return res.status(400).json({ error: "Valid Algorand address required in body.address" });
    }

    try {
      const [row] = await db.select().from(plotNftsTable).where(eq(plotNftsTable.plotId, plotId));

      if (!row) return res.status(404).json({ error: "No NFT record for this plot — not yet minted" });

      const assetId = row.assetId ? Number(row.assetId) : null;
      if (!assetId) return res.status(404).json({ error: "NFT not yet minted for this plot" });

      const adminAddr = getAdminAddress();
      if (row.mintedToAddress !== adminAddr) {
        return res.json({ success: false, reason: "not_in_custody", message: "NFT already delivered to buyer", assetId });
      }

      // Verify the caller's wallet has opted into this specific plot NFT ASA
      const optedIn = await isAddressOptedIn(address, assetId);
      if (!optedIn) {
        return res.json({
          success: false,
          reason: "not_opted_in",
          message: `Add asset ${assetId} to your Pera wallet to receive your Plot NFT. Your land ownership is already recorded.`,
          assetId,
          hint: "opt_in_required"
        });
      }

      // Transfer the NFT from admin to the buyer
      const { txId } = await transferLandNft({ assetId, toAddress: address });

      // Update the holder address in plot_nfts
      await db.update(plotNftsTable)
        .set({ mintedToAddress: address })
        .where(eq(plotNftsTable.plotId, plotId));

      console.log(`[nft/deliver] plotId=${plotId} assetId=${assetId} delivered to ${address} txId=${txId}`);
      res.json({ success: true, plotId, assetId, txId, explorerUrl: `https://allo.info/asset/${assetId}` });
    } catch (error) {
      console.error(`[nft/deliver] plotId=${plotId} error:`, error instanceof Error ? error.message : error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Delivery failed" });
    }
  });

  // ── Commander NFT Image Serving ─────────────────────────────────────────────
  // Serves Commander tier PNGs as stable public URLs baked into on-chain ASA metadata.
  const VALID_COMMANDER_TIERS = new Set(["sentinel", "phantom", "reaper"]);

  const serveCommanderImage = (req: any, res: any) => {
    const tier = req.params.tier?.replace(/\.png$/, "");
    if (!tier || !VALID_COMMANDER_TIERS.has(tier)) return res.status(404).json({ error: "Unknown commander tier" });
    const filePath = path.resolve(process.cwd(), "client", "public", "nft", "commanders", `${tier}.png`);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(filePath, (err: any) => {
      if (err && !res.headersSent) res.status(404).json({ error: "Image not found" });
    });
  };
  

  app.get("/nft/images/commander/:tier", serveCommanderImage);
  app.get("/nft/commanders/:tier", serveCommanderImage);

  // ── Commander NFT Metadata (ARC-3) ──────────────────────────────────────────
  // GET /nft/metadata/commander/:commanderId
  app.get("/nft/metadata/commander/:commanderId", async (req, res) => {
    const { commanderId } = req.params;
    if (!commanderId || commanderId.length < 8) {
      return res.status(400).json({ error: "Invalid commanderId" });
    }
    if (!db) return res.status(503).json({ error: "Database not available" });

    try {
      const rawBaseUrl = process.env.PUBLIC_BASE_URL || null;
      const baseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, "") : null;
      if (!baseUrl) {
        return res.status(503).json({ error: "PUBLIC_BASE_URL not configured — NFT metadata URLs would be invalid." });
      }

      // Look up the player whose commanders array contains this commanderId
      const { COMMANDER_INFO } = await import("@shared/schema");
      const [players, nftRows] = await Promise.all([
        db.select({ id: playersTable.id, commanders: playersTable.commanders }).from(playersTable),
        db.select({ assetId: commanderNftsTable.assetId }).from(commanderNftsTable).where(eq(commanderNftsTable.commanderId, commanderId)),
      ]);
      let avatar: any = null;
      for (const p of players) {
        const cmds = (p.commanders as any[]) ?? [];
        const found = cmds.find((c: any) => c.id === commanderId);
        if (found) { avatar = found; break; }
      }

      if (!avatar) return res.status(404).json({ error: "Commander not found" });

      const onChainAssetId = nftRows[0]?.assetId ? Number(nftRows[0].assetId) : null;

      // Use ASA ID in the display name when available (like land parcels use plotId)
      const tierLabel = (avatar.tier as string).charAt(0).toUpperCase() + (avatar.tier as string).slice(1);
      const displayId = onChainAssetId ?? avatar.id.slice(0, 8);
      const nftName = `Frontier ${tierLabel} #${displayId}`;

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.json({
        name:         nftName,
        description:  COMMANDER_INFO[avatar.tier as keyof typeof COMMANDER_INFO]?.description ?? `A ${avatar.tier} commander on the Frontier globe.`,
        image:        `${baseUrl}/nft/commanders/${avatar.tier}.png`,
        external_url: `${baseUrl}/commander/${onChainAssetId ?? avatar.id}`,
        properties: {
          nftId:          onChainAssetId,
          commanderId:    avatar.id,
          tier:           avatar.tier,
          attackBonus:    avatar.attackBonus,
          defenseBonus:   avatar.defenseBonus,
          specialAbility: avatar.specialAbility,
          mintedAt:       avatar.mintedAt,
          version:        1,
        },
      });
    } catch (error) {
      console.error("[/nft/metadata/commander] error:", error);
      res.status(500).json({ error: "Failed to fetch Commander NFT metadata" });
    }
  });

  // ── Commander NFT Price ─────────────────────────────────────────────────────
  // GET /api/nft/commander-price/:tier
  // Returns the FRNTR cost and minimal ALGO network fee for commander minting.
  // In testing mode: FRNTR costs are low, ALGO is network fee only (~0.001).
  // In production mode: FRNTR costs are standard, same minimal ALGO network fee.
  app.get("/api/nft/commander-price/:tier", (req, res) => {
    const { tier } = req.params;
    const frntrCost = COMMANDER_MINT_FRNTR_ACTIVE[tier];
    if (frntrCost === undefined) return res.status(400).json({ error: "Unknown tier" });

    const adminAddress = getAdminAddress();

    const algoGamePrice = COMMANDER_ALGO_PRICE_ACTIVE[tier] ?? 0.5;
    res.json({
      tier,
      frntrCost,
      algoGamePrice,
      algoNetworkFee: COMMANDER_ALGO_NETWORK_FEE,
      algoTotal: algoGamePrice + COMMANDER_ALGO_NETWORK_FEE,
      adminAddress,
      economyMode: ECONOMY_MODE,
      currency: "FRNTR+ALGO",
      note: ECONOMY_MODE === "testing"
        ? `Testing mode: ${frntrCost} FRNTR + ${algoGamePrice} ALGO to mint.`
        : `${frntrCost} FRNTR + ${algoGamePrice} ALGO to mint.`,
    });
  });

  // ── Commander NFT on-chain record lookup ────────────────────────────────────
  // GET /api/nft/commander/:commanderId
  // Returns { exists, status, assetId, ... }
  // status: "minting" | "minted" (in custody) | "delivered" (in buyer's wallet) | "failed" (mint error)
  app.get("/api/nft/commander/:commanderId", async (req, res) => {
    const { commanderId } = req.params;
    if (!commanderId) return res.status(400).json({ error: "commanderId required" });
    if (!db) return res.status(503).json({ error: "Database not available" });

    try {
      const [row] = await db.select().from(commanderNftsTable).where(eq(commanderNftsTable.commanderId, commanderId));

      if (!row) {
        // Check idempotency table for pending or failed state
        const [idempotencyRow] = await db
          .select()
          .from(commanderMintIdempotencyTable)
          .where(sql`${commanderMintIdempotencyTable.key} LIKE ${'%:' + commanderId}`)
          .limit(1);
        if (idempotencyRow?.status === "pending") {
          return res.json({ exists: true, status: "minting", assetId: null, commanderId });
        }
        if (idempotencyRow?.status === "failed") {
          return res.json({ exists: true, status: "failed", assetId: null, commanderId });
        }
        return res.status(404).json({ error: "No NFT record for this commander" });
      }

      const adminAddr = getAdminAddress();
      const status = row.mintedToAddress === adminAddr ? "minted" : "delivered";

      res.json({
        exists:          true,
        status,
        commanderId:     row.commanderId,
        assetId:         row.assetId ? Number(row.assetId) : null,
        mintedToAddress: row.mintedToAddress,
        mintedAt:        row.mintedAt ? Number(row.mintedAt) : null,
        explorerUrl:     row.assetId ? `https://allo.info/asset/${row.assetId}` : null,
      });
    } catch (error) {
      console.error("[api/nft/commander] lookup error:", error);
      res.status(500).json({ error: "Failed to fetch Commander NFT record" });
    }
  });

  // ── Commander NFT Retry Mint ────────────────────────────────────────────────
  // POST /api/nft/retry-commander/:commanderId  body: { playerId: string }
  // Triggers a fresh on-chain mint for a commander whose previous mint failed.
  app.post("/api/nft/retry-commander/:commanderId", async (req, res) => {
    const { commanderId } = req.params;
    const { playerId } = req.body;
    if (!commanderId || !playerId) return res.status(400).json({ error: "commanderId and playerId required" });
    if (!db) return res.status(503).json({ error: "Database not available" });

    try {
      // Verify player owns this commander
      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });
      const avatar = (player.commanders as any[])?.find((c: any) => c.id === commanderId);
      if (!avatar) return res.status(404).json({ error: "Commander not found for this player" });

      // Check no NFT already exists
      const [existingNft] = await db.select().from(commanderNftsTable).where(eq(commanderNftsTable.commanderId, commanderId));
      if (existingNft?.assetId) {
        return res.json({ success: false, reason: "already_minted", assetId: Number(existingNft.assetId) });
      }

      // Reset idempotency key to "failed" so the mint fires again
      const idempotencyKey = `cmdr:mint:${playerId}:${commanderId}`;
      await db.delete(commanderMintIdempotencyTable).where(eq(commanderMintIdempotencyTable.key, idempotencyKey));

      const now = Date.now();
      const rawBase = process.env.PUBLIC_BASE_URL ||
        (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "");
      const PUBLIC_BASE_URL = rawBase.replace(/\/+$/, "");

      if (!PUBLIC_BASE_URL) {
        return res.status(503).json({ error: "PUBLIC_BASE_URL not configured" });
      }

      // Insert fresh pending key
      await db.insert(commanderMintIdempotencyTable).values({
        key: idempotencyKey, status: "pending", assetId: null, txId: null, createdAt: now, updatedAt: now,
      }).onConflictDoNothing();

      // Fire async mint
      mintCommanderNft({
        commanderId,
        tier: avatar.tier as "sentinel" | "phantom" | "reaper",
        receiverAddress: player.address!,
        metadataBaseUrl: PUBLIC_BASE_URL,
      }).then(async (result) => {
        await db!.insert(commanderNftsTable).values({
          commanderId, assetId: result.assetId, mintedToAddress: result.mintedToAddress,
          mintedAt: Date.now(), algoPaymentTxId: null,
        }).onConflictDoUpdate({
          target: commanderNftsTable.commanderId,
          set: { assetId: result.assetId, mintedToAddress: result.mintedToAddress, mintedAt: Date.now(), algoPaymentTxId: null },
        });
        await db!.update(commanderMintIdempotencyTable)
          .set({ status: "confirmed", assetId: result.assetId, txId: result.createTxId, updatedAt: Date.now() })
          .where(eq(commanderMintIdempotencyTable.key, idempotencyKey));
        console.log(`[retry-commander] commanderId=${commanderId} assetId=${result.assetId} minted`);
      }).catch(async (err) => {
        await db!.update(commanderMintIdempotencyTable)
          .set({ status: "failed", updatedAt: Date.now() })
          .where(eq(commanderMintIdempotencyTable.key, idempotencyKey));
        console.error(`[retry-commander] commanderId=${commanderId} mint failed:`, err instanceof Error ? err.message : err);
      });

      res.json({ success: true, status: "minting", commanderId, message: "NFT mint restarted — check the badge for updates." });
    } catch (error) {
      console.error("[retry-commander] error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Retry failed" });
    }
  });

  // ── Commander NFT Delivery ──────────────────────────────────────────────────
  // POST /api/nft/deliver-commander/:commanderId  body: { address: string }
  app.post("/api/nft/deliver-commander/:commanderId", async (req, res) => {
    const { commanderId } = req.params;
    if (!commanderId) return res.status(400).json({ error: "commanderId required" });
    if (!db) return res.status(503).json({ error: "Database not available" });

    const { address } = req.body;
    if (!address || !algosdk.isValidAddress(address)) {
      return res.status(400).json({ error: "Valid Algorand address required in body.address" });
    }

    try {
      const [row] = await db.select().from(commanderNftsTable).where(eq(commanderNftsTable.commanderId, commanderId));
      if (!row) return res.status(404).json({ error: "No NFT record for this commander — not yet minted" });

      const assetId = row.assetId ? Number(row.assetId) : null;
      if (!assetId) return res.status(404).json({ error: "Commander NFT not yet minted" });

      const adminAddr = getAdminAddress();
      if (row.mintedToAddress !== adminAddr) {
        return res.json({ success: false, reason: "not_in_custody", message: "NFT already delivered to buyer", assetId });
      }

      const optedIn = await isAddressOptedIn(address, assetId);
      if (!optedIn) {
        return res.json({
          success:  false,
          reason:   "not_opted_in",
          message:  `Add asset ${assetId} to your Pera wallet to receive your Commander NFT.`,
          assetId,
          hint:     "opt_in_required",
        });
      }

      const { txId } = await transferCommanderNft({ assetId, toAddress: address });
      await db.update(commanderNftsTable)
        .set({ mintedToAddress: address })
        .where(eq(commanderNftsTable.commanderId, commanderId));

      console.log(`[nft/deliver-commander] commanderId=${commanderId} assetId=${assetId} delivered to ${address} txId=${txId}`);
      res.json({ success: true, commanderId, assetId, txId, explorerUrl: `https://allo.info/asset/${assetId}` });
    } catch (error) {
      console.error(`[nft/deliver-commander] commanderId=${commanderId} error:`, error instanceof Error ? error.message : error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Delivery failed" });
    }
  });

}
