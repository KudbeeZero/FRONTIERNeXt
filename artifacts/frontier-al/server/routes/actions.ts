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

export function registerActionRoutes(app: Express, ctx: RouteContext): void {
  const { assertPlayerOwnership, maybeGrantWelcomeBonus, fireBurn, adviceLimiter, algodClient, indexerClient } = ctx;

  app.post("/api/actions/connect-wallet", async (req, res) => {
    try {
      const { playerId, address } = req.body;
      if (!playerId || !address) {
        return res.status(400).json({ error: "playerId and address are required" });
      }
      if (!address || !algosdk.isValidAddress(address)) {
        return res.status(400).json({ error: "Invalid Algorand address" });
      }
      await storage.updatePlayerAddress(playerId, address);

      const player = await storage.getPlayer(playerId);
      let welcomeBonus = false;
      if (player && !player.welcomeBonusReceived) {
        await storage.grantWelcomeBonus(playerId);
        welcomeBonus = true;
        console.log(`Welcome bonus of 500 FRONTIER granted to player ${player.name} (${address})`);

        // SEV2 #7 fix: enqueue regardless of asaId / opt-in state; worker retries.
        if (address && !address.startsWith("AI_")) {
          enqueueFrontierTransfer({
            recipientAddress:  address,
            recipientPlayerId: playerId,
            amount:            500,
            reason:            "welcome_bonus",
          }).catch((err) =>
            console.error("Welcome bonus enqueue failed (in-game balance still granted):", err)
          );
        }
      }

      res.json({ success: true, welcomeBonus });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to connect wallet" });
    }
  });

  app.post("/api/actions/set-name", async (req, res) => {
    try {
      const { playerId, name, address } = req.body;
      if (!playerId || !name || !address) {
        return res.status(400).json({ error: "playerId, name, and address are required" });
      }
      const player = await storage.getPlayer(playerId);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      if (player.address.toLowerCase() !== address.trim().toLowerCase()) {
        return res.status(403).json({ error: "Address does not match player" });
      }
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 20) {
        return res.status(400).json({ error: "Name must be 2-20 characters" });
      }
      if (!/^[a-zA-Z0-9_\-. ]+$/.test(trimmed)) {
        return res.status(400).json({ error: "Name can only contain letters, numbers, spaces, dashes, dots, and underscores" });
      }
      await storage.updatePlayerName(playerId, trimmed);
      res.json({ success: true, name: trimmed });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to set name" });
    }
  });

  app.post("/api/actions/mine", async (req, res) => {
    try {
      const verifiedId = await assertPlayerOwnership(req, res);
      if (!verifiedId) return;
      const action = mineActionSchema.parse(req.body);
      const result = await storage.mineResources(action);
      res.json({ success: true, yield: result });
      markDirty();
      try {
        const minedParcel = await storage.getParcel(action.parcelId);
        if (minedParcel) {
          appendWorldEvent({
            type: "resource_pulse",
            timestamp: Date.now(),
            lat: minedParcel.lat,
            lng: minedParcel.lng,
            plotId: minedParcel.plotId,
            playerId: action.playerId,
            severity: "low",
            metadata: {
              iron: result.iron,
              fuel: result.fuel,
              crystal: result.crystal,
              biome: minedParcel.biome,
            }
          });
        }
      } catch { /* non-critical */ }
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Mining failed" });
    }
  });

  app.post("/api/actions/upgrade", async (req, res) => {
    try {
      const action = upgradeActionSchema.parse(req.body);
      const parcel = await storage.upgradeBase(action);
      res.json({ success: true, parcel });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Upgrade failed" });
    }
  });

  app.post("/api/actions/attack", async (req, res) => {
    try {
      const verifiedId = await assertPlayerOwnership(req, res, req.body?.attackerId);
      if (!verifiedId) return;
      const action = attackActionSchema.parse(req.body);
      const battle = await storage.deployAttack(action);
      if (action.crystalBurned && action.crystalBurned > 0) {
        const attackPlayer = await storage.getPlayer(action.attackerId);
        if (attackPlayer) fireBurn(attackPlayer.address, action.crystalBurned, `Crystal burn battleId=${battle.id}`);
      }
      res.json({ success: true, battle });
      markDirty();
      // Log world event
      try {
        const targetParcelEvt = await storage.getParcel(action.targetParcelId);
        const attackerEvt = await storage.getPlayer(action.attackerId).catch(() => undefined);
        if (targetParcelEvt) {
          const defenderName = targetParcelEvt.ownerId
            ? (await storage.getPlayer(targetParcelEvt.ownerId).catch(() => undefined))?.name ?? "Unclaimed"
            : "Unclaimed";
          appendWorldEvent({
            type: "battle_started",
            timestamp: Date.now(),
            lat: targetParcelEvt.lat,
            lng: targetParcelEvt.lng,
            plotId: targetParcelEvt.plotId,
            defenderPlotId: targetParcelEvt.plotId,
            playerId: action.attackerId,
            severity: "high",
            metadata: {
              battleId: battle.id,
              attacker: attackerEvt?.name ?? "Unknown",
              defender: defenderName,
              biome: targetParcelEvt.biome,
            }
          });
        }
      } catch { /* non-critical */ }
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Attack failed" });
    }
  });

  app.post("/api/actions/build", async (req, res) => {
    try {
      const verifiedId = await assertPlayerOwnership(req, res);
      if (!verifiedId) return;
      const action = buildActionSchema.parse(req.body);
      const parcel = await storage.buildImprovement(action);
      const buildPlayer = await storage.getPlayer(action.playerId);
      if (buildPlayer) {
        const { FACILITY_INFO } = await import('@shared/schema');
        const info = FACILITY_INFO[action.improvementType as keyof typeof FACILITY_INFO];
        const built = parcel.improvements?.find((i: any) => i.type === action.improvementType);
        const level = built?.level ?? 1;
        const cost = info?.costFrontier?.[level - 1] ?? 0;
        if (cost > 0) fireBurn(buildPlayer.address, cost, `Build improvement plotId=${parcel.plotId}`);
      }
      res.json({ success: true, parcel });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Build failed" });
    }
  });

  app.post("/api/actions/purchase", async (req, res) => {
    try {
      const action = purchaseActionSchema.parse(req.body);

      // Validate player and wallet BEFORE executing the purchase.
      const player = await storage.getPlayer(action.playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });

      // All purchases require a connected Algorand wallet.
      if (
        !player.address ||
        player.address === "PLAYER_WALLET" ||
        player.address.startsWith("AI_") ||
        !algosdk.isValidAddress(player.address)
      ) {
        return res.status(403).json({ error: "A connected Algorand wallet is required to purchase territory." });
      }

      // ── ALGO payment verification ─────────────────────────────────────────────
      // Every purchase requires a verified on-chain ALGO payment.
      if (!action.algoPaymentTxId) {
        return res.status(400).json({ error: "algoPaymentTxId is required for territory purchases." });
      }

      // Fetch the parcel to determine the expected ALGO amount.
      const selectedParcel = await storage.getParcel(action.parcelId);
      if (!selectedParcel) return res.status(404).json({ error: "Parcel not found" });

      const expectedMicroAlgos = Math.round((selectedParcel.purchasePriceAlgo ?? 0) * 1_000_000);

      try {
        await verifyAlgoPayment({
          txId:           action.algoPaymentTxId,
          expectedSender: player.address,
          minMicroAlgo:   expectedMicroAlgos,
        });
        console.log(`[purchase] ALGO payment verified txId=${action.algoPaymentTxId} microAlgos=${expectedMicroAlgos} buyer=${player.address}`);
      } catch (payErr) {
        console.warn(`[purchase] ALGO payment verification failed txId=${action.algoPaymentTxId} err=${(payErr as Error).message}`);
        return res.status(402).json({ error: "Algo payment not verified" });
      }
      // ─────────────────────────────────────────────────────────────────────────

      const buyerAddress = player.address;
      const parcel = await storage.purchaseLand(action);
      // Log the payment txId for audit trail (no dedicated column on parcels table).
      if (action.algoPaymentTxId) {
        console.log(`[purchase-audit] plotId=${parcel.plotId} buyer=${buyerAddress} algoPaymentTxId=${action.algoPaymentTxId}`);
      }
      console.log(`[mint-audit] purchase ok plotId=${parcel.plotId} buyer=${buyerAddress}`);
      const buyerForEvent = await storage.getPlayer(action.playerId).catch(() => null);
      appendWorldEvent({
        type: "land_claimed",
        timestamp: Date.now(),
        lat: parcel.lat,
        lng: parcel.lng,
        plotId: parcel.plotId,
        playerId: action.playerId,
        severity: "medium",
        metadata: { plotId: parcel.plotId, playerName: buyerForEvent?.name ?? "Unknown", biome: parcel.biome }
      });

      // Mint a Plot NFT (Algorand ASA) for human players with connected wallets.
      // First-plot free claims may not have a valid wallet yet — skip NFT for those.
      let nftAssetId: number | null = null;
      const isHumanBuyer =
        buyerAddress &&
        !buyerAddress.startsWith("AI_") &&
        buyerAddress !== "PLAYER_WALLET" &&
        algosdk.isValidAddress(buyerAddress);

      if (isHumanBuyer && db) {
        // ── Idempotency guard ────────────────────────────────────────────────
        // Key: "mint:{playerId}:{plotId}" — prevents double-mint on rapid clicks.
        const idempotencyKey = `mint:${action.playerId}:${parcel.plotId}`;
        const now = Date.now();

        const [existingKey] = await db
          .select()
          .from(mintIdempotencyTable)
          .where(eq(mintIdempotencyTable.key, idempotencyKey));

        console.log(`[mint-audit] idempotency check plotId=${parcel.plotId} status=${existingKey?.status ?? 'new'}`);

        if (existingKey && (existingKey.status === "confirmed" || existingKey.status === "pending")) {
          nftAssetId = existingKey.assetId ?? null;
          console.log(
            `[purchase] plotId=${parcel.plotId} idempotency hit status=${existingKey.status} assetId=${nftAssetId}`
          );
        } else {
          // Mark pending before async work to prevent concurrent duplicates
          if (!existingKey) {
            await db.insert(mintIdempotencyTable).values({
              key: idempotencyKey,
              status: "pending",
              assetId: null,
              txId: null,
              createdAt: now,
              updatedAt: now,
            }).onConflictDoNothing();
          }

          // Resolve the public base URL, stripping any trailing slash.
          // Falls back to REPLIT_DOMAINS (available in all Replit deployments) so
          // NFT metadata is always hosted at a reachable URL.
          const rawBase =
            process.env.PUBLIC_BASE_URL ||
            (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "");
          const PUBLIC_BASE_URL = rawBase.replace(/\/+$/, "");

          if (PUBLIC_BASE_URL) {
            // Fire-and-forget: mint in background, don't block response
            mintLandNft({ plotId: parcel.plotId, receiverAddress: buyerAddress, metadataBaseUrl: PUBLIC_BASE_URL })
              .then(async (result) => {
                console.log(`[mint-audit] minted plotId=${parcel.plotId} asaId=${result.assetId} txId=${result.createTxId}`);
                // Persist to plot_nfts (upsert)
                await db.insert(plotNftsTable).values({
                  plotId: parcel.plotId,
                  assetId: result.assetId,
                  mintedToAddress: result.mintedToAddress,
                  mintedAt: Date.now(),
                }).onConflictDoUpdate({
                  target: plotNftsTable.plotId,
                  set: { assetId: result.assetId, mintedToAddress: result.mintedToAddress, mintedAt: Date.now() },
                });
                // Mark idempotency confirmed
                await db.update(mintIdempotencyTable)
                  .set({ status: "confirmed", assetId: result.assetId, txId: result.createTxId, updatedAt: Date.now() })
                  .where(eq(mintIdempotencyTable.key, idempotencyKey));
                console.log(`[purchase] plotId=${parcel.plotId} NFT minted assetId=${result.assetId}`);

                // ── Attempt immediate delivery (universal pattern) ──────────────
                // Mirrors the free-claim flow: verify opt-in → transfer NFT → update DB.
                // If the buyer hasn't opted in yet they can still call /api/nft/deliver/:plotId later.
                const delivery = await attemptDelivery(result.assetId, buyerAddress, parcel.plotId);
                if (delivery.delivered) {
                  await db!.update(plotNftsTable)
                    .set({ mintedToAddress: buyerAddress })
                    .where(eq(plotNftsTable.plotId, parcel.plotId));
                  console.log(`[purchase] plotId=${parcel.plotId} NFT auto-delivered to ${buyerAddress}`);
                } else if (delivery.reason === "transfer_failed") {
                  // CRITICAL: payment received and NFT minted but delivery failed — flag for admin review
                  console.error(`[CRITICAL] plotId=${parcel.plotId} NFT delivery failed after payment. assetId=${result.assetId} buyer=${buyerAddress} reason=${delivery.reason}`);
                } else {
                  console.log(`[purchase] plotId=${parcel.plotId} NFT in custody (${delivery.reason}) — buyer must opt-in then call /api/nft/deliver/${parcel.plotId}`);
                }
              })
              .catch(async (err) => {
                console.error(`[mint-audit] FAIL plotId=${parcel.plotId}`, err);
                await db.update(mintIdempotencyTable)
                  .set({ status: "failed", updatedAt: Date.now() })
                  .where(eq(mintIdempotencyTable.key, idempotencyKey));
                console.error(`[purchase] NFT minting failed for plotId=${parcel.plotId}:`, err instanceof Error ? err.message : err);
              });
          } else {
            console.warn(`[purchase] PUBLIC_BASE_URL not set — skipping NFT mint for plotId=${parcel.plotId}`);
            await db.update(mintIdempotencyTable)
              .set({ status: "failed", updatedAt: Date.now() })
              .where(eq(mintIdempotencyTable.key, idempotencyKey));
          }
        }
      }

      res.json({
        success: true,
        parcel,
        nft: {
          status: "minting",
          message: "Your Plot NFT is being minted. Add it to your Pera wallet once you receive the asset ID."
        }
      });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Purchase failed" });
    }
  });

  app.post("/api/actions/collect", async (req, res) => {
    try {
      const verifiedId = await assertPlayerOwnership(req, res);
      if (!verifiedId) return;
      const action = collectActionSchema.parse(req.body);
      const result = await storage.collectAll(action.playerId);
      res.json({ success: true, collected: result });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Collection failed" });
    }
  });

  app.post("/api/actions/claim-frontier", async (req, res) => {
    try {
      const action = claimFrontierActionSchema.parse(req.body);

      const player = await storage.getPlayer(action.playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });

      const walletAddress = player.address;
      const isRealWallet =
        walletAddress &&
        walletAddress !== "PLAYER_WALLET" &&
        !walletAddress.startsWith("AI_");

      // Step 1: Check opt-in BEFORE crediting the DB balance.
      // We only gate on opt-in when the ASA ID is known; if it's null (race condition
      // on startup / re-mint), we proceed and let the queue handle it (SEV2 #6 fix).
      const asaId = getFrontierAsaId();
      if (asaId && isRealWallet) {
        const optedIn = await isAddressOptedIn(walletAddress);
        if (!optedIn) {
          return res.json({ success: false, reason: "wallet_not_opted_in" });
        }
      }

      // Step 2: Credit the DB balance.
      const result = await storage.claimFrontier(action.playerId);

      // Step 3: Enqueue on-chain transfer (SEV2 #6 fix: no asaId guard — worker resolves
      // the id lazily at drain time so a null asaId at request time is not a silent drop).
      if (result.amount > 0 && isRealWallet) {
        enqueueFrontierTransfer({
          recipientAddress:  walletAddress,
          recipientPlayerId: action.playerId,
          amount:            result.amount,
          reason:            "claim_frontier",
        }).catch((err) =>
          console.error("claim-frontier enqueue failed (in-game balance preserved):", err)
        );
      }

      res.json({ success: true, claimed: result, asaId });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Claim failed" });
    }
  });

  app.post("/api/actions/mint-avatar", async (req, res) => {
    try {
      const verifiedId = await assertPlayerOwnership(req, res);
      if (!verifiedId) return;
      const action = mintAvatarActionSchema.parse(req.body);

      const mintPlayer = await storage.getPlayer(action.playerId);
      if (!mintPlayer) return res.status(404).json({ error: "Player not found" });

      const isHumanPlayer =
        mintPlayer.address &&
        !mintPlayer.address.startsWith("AI_") &&
        mintPlayer.address !== "PLAYER_WALLET" &&
        algosdk.isValidAddress(mintPlayer.address);

      // ── ALGO payment verification (universal pattern) ──────────────────────
      // Human players must send ALGO to the admin wallet before commander minting.
      // Testnet price: 0.5 ALGO per tier. Production: tiered by rarity.
      const commanderAlgoPrice = COMMANDER_ALGO_PRICE_ACTIVE[action.tier] ?? 0.5;
      if (isHumanPlayer) {
        if (!action.algoPaymentTxId) {
          return res.status(400).json({
            error: `algoPaymentTxId is required. Send ${commanderAlgoPrice} ALGO to the admin wallet before minting.`,
            algoRequired: commanderAlgoPrice,
            adminAddress: getAdminAddress(),
          });
        }
        try {
          await verifyAlgoPayment({
            txId:           action.algoPaymentTxId,
            expectedSender: mintPlayer.address!,
            minMicroAlgo:   Math.round(commanderAlgoPrice * 1_000_000),
          });
          console.log(`[mint-avatar] ALGO payment verified txId=${action.algoPaymentTxId} tier=${action.tier} price=${commanderAlgoPrice} buyer=${mintPlayer.address}`);
        } catch (payErr) {
          console.warn(`[mint-avatar] ALGO payment verification failed txId=${action.algoPaymentTxId} err=${(payErr as Error).message}`);
          return res.status(402).json({
            error: `ALGO payment not verified: ${(payErr as Error).message}`,
            algoRequired: commanderAlgoPrice,
            adminAddress: getAdminAddress(),
          });
        }
      }

      // ── FRNTR cost check ───────────────────────────────────────────────────
      // Commander minting is now FRNTR-based. ALGO is NOT charged at game level.
      // The minimal Algorand network fee for the NFT mint transaction is handled
      // automatically by the admin wallet during the post-response fire-and-forget.
      const { COMMANDER_INFO } = await import('@shared/schema');
      const frntrCost = COMMANDER_INFO[action.tier as keyof typeof COMMANDER_INFO]?.mintCostFrontier ?? 0;

      if (frntrCost > 0 && isHumanPlayer) {
        const playerFrntr = mintPlayer.frontier ?? 0;
        if (playerFrntr < frntrCost) {
          return res.status(402).json({
            error: `Insufficient FRNTR. Required: ${frntrCost} FRNTR, you have: ${playerFrntr.toFixed(2)} FRNTR.`,
            frntrRequired: frntrCost,
            frntrAvailable: playerFrntr,
            currency: "FRNTR",
          });
        }
      }

      // ── Mint in-game avatar ────────────────────────────────────────────────
      const avatar = await storage.mintAvatar(action);

      // ── Deduct FRNTR cost via on-chain clawback (fire-and-forget) ─────────
      if (frntrCost > 0 && mintPlayer.address) {
        fireBurn(mintPlayer.address, frntrCost, `Commander mint tier=${action.tier}`);
      }

      res.json({
        success: true,
        avatar,
        frntrCost,
        currency: "FRNTR",
        nft: isHumanPlayer && db
          ? { status: "minting", message: "Your Commander NFT is being minted. Check back shortly for the on-chain asset ID." }
          : undefined,
      });

      // ── Post-response: NFT mint (fire-and-forget) ─────────────────────────
      // No ALGO game payment. The on-chain NFT mint uses the admin wallet which
      // covers its own network fee internally. No liquidity split required.
      if (isHumanPlayer && db) {
        // ── Idempotency guard for NFT mint ──────────────────────────────────
        const idempotencyKey = `cmdr:mint:${action.playerId}:${avatar.id}`;
        const now = Date.now();

        const [existingKey] = await db
          .select()
          .from(commanderMintIdempotencyTable)
          .where(eq(commanderMintIdempotencyTable.key, idempotencyKey));

        if (!existingKey) {
          await db.insert(commanderMintIdempotencyTable).values({
            key: idempotencyKey,
            status: "pending",
            assetId: null,
            txId: null,
            createdAt: now,
            updatedAt: now,
          }).onConflictDoNothing();
        }

        if (!existingKey || existingKey.status === "failed") {
          const rawBase =
            process.env.PUBLIC_BASE_URL ||
            (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "");
          const PUBLIC_BASE_URL = rawBase.replace(/\/+$/, "");

          if (PUBLIC_BASE_URL) {
            mintCommanderNft({
              commanderId:     avatar.id,
              tier:            avatar.tier as "sentinel" | "phantom" | "reaper",
              receiverAddress: mintPlayer.address,
              metadataBaseUrl: PUBLIC_BASE_URL,
            })
              .then(async (result) => {
                await db!.insert(commanderNftsTable).values({
                  commanderId:     avatar.id,
                  assetId:         result.assetId,
                  mintedToAddress: result.mintedToAddress,
                  mintedAt:        Date.now(),
                  algoPaymentTxId: null,
                }).onConflictDoUpdate({
                  target: commanderNftsTable.commanderId,
                  set: {
                    assetId:         result.assetId,
                    mintedToAddress: result.mintedToAddress,
                    mintedAt:        Date.now(),
                    algoPaymentTxId: null,
                  },
                });
                await db!.update(commanderMintIdempotencyTable)
                  .set({ status: "confirmed", assetId: result.assetId, txId: result.createTxId, updatedAt: Date.now() })
                  .where(eq(commanderMintIdempotencyTable.key, idempotencyKey));
                // Also record algoPaymentTxId now that it's verified
                if (action.algoPaymentTxId) {
                  await db!.update(commanderNftsTable)
                    .set({ algoPaymentTxId: action.algoPaymentTxId })
                    .where(eq(commanderNftsTable.commanderId, avatar.id));
                }
                console.log(`[mint-avatar] Commander NFT minted commanderId=${avatar.id} assetId=${result.assetId}`);

                // ── Attempt immediate delivery (universal pattern) ──────────────
                const receiverAddr = mintPlayer.address!;
                const delivery = await attemptCommanderDelivery(result.assetId, receiverAddr, avatar.id);
                if (delivery.delivered) {
                  await db!.update(commanderNftsTable)
                    .set({ mintedToAddress: receiverAddr })
                    .where(eq(commanderNftsTable.commanderId, avatar.id));
                  console.log(`[mint-avatar] Commander NFT auto-delivered commanderId=${avatar.id} to ${receiverAddr}`);
                } else if (delivery.reason === "transfer_failed") {
                  // CRITICAL: payment received and NFT minted but delivery failed — flag for admin review
                  console.error(`[CRITICAL] Commander NFT delivery failed after payment. commanderId=${avatar.id} assetId=${result.assetId} buyer=${receiverAddr} reason=${delivery.reason}`);
                } else {
                  console.log(`[mint-avatar] Commander NFT in custody (${delivery.reason}) commanderId=${avatar.id} — buyer must opt-in then call /api/nft/deliver-commander/${avatar.id}`);
                }
              })
              .catch(async (err) => {
                await db!.update(commanderMintIdempotencyTable)
                  .set({ status: "failed", updatedAt: Date.now() })
                  .where(eq(commanderMintIdempotencyTable.key, idempotencyKey));
                console.error(`[mint-avatar] Commander NFT mint failed commanderId=${avatar.id}:`, err instanceof Error ? err.message : err);
              });
          } else {
            console.warn(`[mint-avatar] PUBLIC_BASE_URL not set — skipping Commander NFT mint for commanderId=${avatar.id}`);
          }
        }
      }

      try {
        const mintPlayerEvt = await storage.getPlayer(action.playerId).catch(() => undefined);
        if (mintPlayerEvt) {
          appendWorldEvent({
            type: "commander_deployed",
            timestamp: Date.now(),
            lat: 0, lng: 0,
            playerId: action.playerId,
            severity: "medium",
            metadata: {
              playerName: mintPlayerEvt.name,
              tier: action.tier,
              commanderName: avatar.name,
            }
          });
        }
      } catch { /* non-critical */ }
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Mint failed" });
    }
  });

  app.post("/api/actions/switch-commander", async (req, res) => {
    try {
      const verifiedId = await assertPlayerOwnership(req, res);
      if (!verifiedId) return;
      const { playerId, commanderIndex } = req.body;
      if (!playerId || commanderIndex === undefined) return res.status(400).json({ error: "playerId and commanderIndex required" });
      const activeCommander = await storage.switchCommander(playerId, commanderIndex);
      res.json({ success: true, activeCommander });
      markDirty();
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Switch failed" });
    }
  });

  app.post("/api/actions/special-attack", async (req, res) => {
    try {
      const action = specialAttackActionSchema.parse(req.body);
      const result = await storage.executeSpecialAttack(action);
      res.json({ success: true, result });
      markDirty();
      try {
        const saParcel = await storage.getParcel(action.targetParcelId).catch(() => undefined);
        const saPlayer = await storage.getPlayer(action.playerId).catch(() => undefined);
        if (saParcel) {
          appendWorldEvent({
            type: "battle_started",
            timestamp: Date.now(),
            lat: saParcel.lat,
            lng: saParcel.lng,
            plotId: saParcel.plotId,
            playerId: action.playerId,
            severity: "high",
            metadata: {
              attackType: action.attackType,
              attacker: saPlayer?.name ?? "Unknown",
              defender: saParcel.ownerId
                ? (await storage.getPlayer(saParcel.ownerId).catch(() => undefined))?.name ?? "Unclaimed"
                : "Unclaimed",
              special: true,
            }
          });
        }
      } catch { /* non-critical */ }
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Special attack failed" });
    }
  });

  app.post("/api/actions/deploy-drone", async (req, res) => {
    try {
      const action = deployDroneActionSchema.parse(req.body);
      const drone = await storage.deployDrone(action);
      const dronePlayer = await storage.getPlayer(action.playerId);
      if (dronePlayer) {
        const { DRONE_MINT_COST_FRONTIER } = await import('@shared/schema');
        fireBurn(dronePlayer.address, DRONE_MINT_COST_FRONTIER, `Drone deploy`);
      }
      try {
        const dronePlayerEvt = await storage.getPlayer(action.playerId).catch(() => null);
        if (dronePlayerEvt) {
          appendWorldEvent({
            type: "scan_ping",
            timestamp: Date.now(),
            endTimestamp: Date.now() + 30 * 60_000,
            lat: 0, lng: 0,
            playerId: action.playerId,
            severity: "low",
            metadata: { playerName: dronePlayerEvt.name, source: "drone" }
          });
        }
      } catch { /* non-critical */ }
      res.json({ success: true, drone });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Drone deployment failed" });
    }
  });

  app.post("/api/actions/deploy-satellite", async (req, res) => {
    try {
      const action = deploySatelliteActionSchema.parse(req.body);
      const satellite = await storage.deploySatellite(action);
      const satPlayer = await storage.getPlayer(action.playerId);
      if (satPlayer) {
        const { SATELLITE_DEPLOY_COST_FRONTIER } = await import('@shared/schema');
        fireBurn(satPlayer.address, SATELLITE_DEPLOY_COST_FRONTIER, `Satellite deploy`);
      }
      res.json({ success: true, satellite });
      try {
        const satPlayerEvt = await storage.getPlayer(action.playerId).catch(() => undefined);
        appendWorldEvent({
          type: "scan_ping",
          timestamp: Date.now(),
          endTimestamp: Date.now() + 60 * 60_000,
          lat: 0,
          lng: 0,
          playerId: action.playerId,
          severity: "low",
          metadata: {
            playerName: satPlayerEvt?.name ?? "Unknown",
            source: "satellite",
          }
        });
      } catch { /* non-critical */ }
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Satellite deployment failed" });
    }
  });

  // ── GET /api/parcels/attackable ─────────────────────────────────────────────
  // Returns up to 50 parcels owned by other players, not under active battle,
  // sorted by total stored resources descending.
  // Optional query param: ?biome=forest
}
