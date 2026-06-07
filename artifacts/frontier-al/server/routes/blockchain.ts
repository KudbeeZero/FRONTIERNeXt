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

export function registerBlockchainRoutes(app: Express, ctx: RouteContext): void {
  const { assertPlayerOwnership, maybeGrantWelcomeBonus, fireBurn, adviceLimiter, algodClient, indexerClient } = ctx;

  app.get("/api/blockchain/status", async (req, res) => {
    try {
      const asaId      = getFrontierAsaId();
      const adminAddress = getAdminAddress();
      const forceNew   = process.env.FORCE_NEW_FRONTIER_ASA === "true" || process.env.FORCE_NEW_ASA === "true";
      const network    = process.env.ALGORAND_NETWORK ?? "testnet";
      const factionAsaIds = getAllFactionAsaIds();

      const body: Record<string, unknown> = {
        ready: ctx.getBlockchainReady(),
        frontierAsaId: asaId,
        adminAddress, // payment target — clients need this; it is public on-chain anyway
        network,
        forceNewAsaEnabled: forceNew,
        factionIdentities: factionAsaIds,
      };

      // The admin wallet's live balances are operational treasury intelligence.
      // They are queryable on-chain, but we do not hand them to anonymous API
      // callers — surface them only to an authenticated admin (no 403 written
      // here; this is an additive field on an otherwise-public endpoint).
      if (process.env.ADMIN_KEY) {
        const headerKey = req.headers["x-admin-key"];
        if (typeof headerKey === "string" && headerKey === process.env.ADMIN_KEY) {
          const balance = await getAdminBalance();
          body.adminAlgoBalance = balance.algo;
          body.adminFrontierBalance = balance.frontierAsa;
        }
      }

      res.json(body);
    } catch (error) {
      res.json({ ready: false, frontierAsaId: null, adminAddress: null });
    }
  });

  app.get("/api/economics", async (_req, res) => {
    try {
      const asaId = getFrontierAsaId();
      const adminAddr = getAdminAddress();
      const ASA_DECIMALS = 6;
      const divisor = Math.pow(10, ASA_DECIMALS);

      if (!asaId || !adminAddr) {
        return res.status(503).json({ error: "Blockchain not initialized yet" });
      }

      const [assetLookup, adminAccountInfo] = await Promise.all([
        indexerClient.lookupAssetByID(asaId).do() as Promise<any>,
        algodClient.accountInformation(adminAddr).do() as Promise<any>,
      ]);

      const assetParams = assetLookup?.asset?.params ?? assetLookup?.params ?? assetLookup;
      const rawTotal: number = Number(assetParams.total ?? assetParams["total"] ?? 0);
      const totalSupply = rawTotal / divisor;

      // Use only the held-assets array — "created-assets" has a different shape
      // (no `amount` field) and would silently report treasury=0 if used here.
      const assets: any[] = (adminAccountInfo as any).assets ?? [];
      if (!Array.isArray(assets)) {
        console.error("[/api/economics] Unexpected admin accountInfo shape — 'assets' is not an array. Keys:", Object.keys(adminAccountInfo as any ?? {}));
      }
      const adminAsset = Array.isArray(assets)
        ? assets.find((a: any) => Number(a.assetId ?? a["asset-id"] ?? a.assetIndex) === asaId)
        : undefined;

      if (Array.isArray(assets) && adminAsset === undefined) {
        // Admin account holds the ASA but it wasn't found in the assets array.
        // This most likely means the admin has not yet opted in, or the algod
        // response key names changed. Treasury will be reported as 0, which is
        // misleading — log explicitly so it surfaces in monitoring.
        console.warn(
          `[/api/economics] asaId=${asaId} not found in admin account's 'assets' array ` +
            `(${assets.length} entries). Treasury will be reported as 0. ` +
            "Verify admin account is opted in to the FRONTIER ASA."
        );
      }

      const rawAdminBalance: number = Number(adminAsset?.amount ?? 0);
      const treasury = rawAdminBalance / divisor;

      const circulating = Math.round((totalSupply - treasury) * 100) / 100;

      // Query in-game token metrics from DB so the panel reflects actual
      // player balances regardless of whether on-chain transfers have settled.
      let totalBurned = 0;
      let inGameCirculating = 0;
      let ownedParcelCount  = 0;
      try {
        const [metrics] = await db
          .select({
            burned:  sql<number>`COALESCE(SUM(${playersTable.totalFrontierBurned}), 0)`,
            balanceMicro: sql<number>`COALESCE(SUM(${playersTable.frntrBalanceMicro}), 0)`,
          })
          .from(playersTable);
        totalBurned       = Math.round(Number(metrics?.burned       ?? 0) * 100) / 100;
        inGameCirculating = Math.round(Number(metrics?.balanceMicro ?? 0) / divisor * 100) / 100;

        const [{ cnt }] = await db
          .select({ cnt: sql<number>`COUNT(*)` })
          .from(parcelsTable)
          .where(sql`${parcelsTable.ownerId} IS NOT NULL AND ${parcelsTable.ownerType} = 'player'`);
        ownedParcelCount = Number(cnt ?? 0);
      } catch (_dbErr) {
        // Non-fatal — fall back to on-chain circulating
        inGameCirculating = circulating;
      }

      // Treasury ledger balance from DB (protocol fees collected)
      let protocolTreasuryUnsettled = 0;
      let protocolTreasuryTotal     = 0;
      try {
        const bal = await storage.getTreasuryBalance();
        protocolTreasuryUnsettled = Math.round(fromMicroFRNTR(bal.unsettledMicro) * 100) / 100;
        protocolTreasuryTotal     = Math.round(fromMicroFRNTR(bal.totalMicro)     * 100) / 100;
      } catch (_e) { /* non-fatal */ }

      // ── Payout safety: projected daily emissions vs admin FRNTR balance ──────
      const projections = Object.fromEntries(
        EMISSION_CHECK_PARCEL_COUNTS.map(n => [n, projectedDailyEmissions(n)])
      ) as Record<number, number>;

      const currentDailyDemand = projectedDailyEmissions(ownedParcelCount);

      // Warn when current demand (base rate only) exceeds 10% of admin FRNTR balance per day
      if (treasury > 0 && currentDailyDemand > treasury * 0.1) {
        console.warn(
          `[/api/economics] ⚠ Payout warning: current daily base emission demand ` +
          `(${currentDailyDemand.toFixed(0)} FRNTR/day for ${ownedParcelCount} parcels) ` +
          `exceeds 10% of admin treasury balance (${treasury.toFixed(0)} FRNTR). ` +
          `At this rate the treasury covers ~${(treasury / Math.max(currentDailyDemand, 1)).toFixed(1)} days.`
        );
      }

      res.json({
        asaId,
        adminAddress: adminAddr,
        totalSupply,
        treasury: Math.round(treasury * 100) / 100,
        circulating,
        totalBurned,
        inGameCirculating,
        protocolTreasuryUnsettled,
        protocolTreasuryTotal,
        network: "Algorand TestNet",
        unitName: "FRNTR",
        assetName: "FRONTIER",
        decimals: ASA_DECIMALS,
        // ── Emission config (centralized from shared/economy-config.ts) ──────
        economyMode: ECONOMY_MODE,
        emissionRatePerDay: LAND_DAILY_FRNTR_RATE,
        emissionRateTest:   LAND_DAILY_FRNTR_RATE_TEST,
        emissionRateProd:   LAND_DAILY_FRNTR_RATE_PROD,
        // ── Payout projections (base rate × parcel count) ────────────────────
        ownedParcelCount,
        currentDailyBaseEmission: Math.round(currentDailyDemand * 100) / 100,
        projectedEmissions: projections,
        // ── Testing economy pricing (for UI clarity) ─────────────────────────
        testingPrices: TESTING_ECONOMY_SUMMARY,
      });
    } catch (error) {
      console.error("Economics fetch error:", error);
      res.status(500).json({ error: "Failed to fetch economics data" });
    }
  });

  app.get("/api/blockchain/opt-in-check/:address", async (req, res) => {
    try {
      const queryAsaId = req.query.assetId ? Number(req.query.assetId) : undefined;
      const optedIn = await isAddressOptedIn(req.params.address, queryAsaId);
      res.json({ optedIn, asaId: getFrontierAsaId() });
    } catch (error) {
      res.json({ optedIn: false, asaId: getFrontierAsaId() });
    }
  });

  // ── Faction Identity Metadata ────────────────────────────────────────────────
  // ARC-3 style metadata for each AI faction identity ASA.
  // Referenced as assetURL on the on-chain ASA — permanent, do not change path.
}
