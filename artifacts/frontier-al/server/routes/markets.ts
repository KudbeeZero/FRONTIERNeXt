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

export function registerMarketRoutes(app: Express, ctx: RouteContext): void {
  const { assertPlayerOwnership, maybeGrantWelcomeBonus, fireBurn, adviceLimiter, algodClient, indexerClient } = ctx;

  app.get("/api/markets", async (_req, res) => {
    try {
      const markets = await withDbRetry(() => storage.getOpenMarkets(), "getOpenMarkets");
      res.json(markets);
    } catch (err) {
      console.error("[markets] getOpenMarkets error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/markets/history", async (_req, res) => {
    try {
      const markets = await withDbRetry(() => storage.getAllMarkets(50), "getAllMarkets");
      res.json(markets);
    } catch (err) {
      console.error("[markets] getAllMarkets error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/markets/player/:playerId", async (req, res) => {
    const { playerId } = req.params;
    try {
      const positions = await withDbRetry(() => storage.getPlayerPositions(playerId), "getPlayerPositions");
      res.json(positions);
    } catch (err) {
      console.error("[markets] getPlayerPositions error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/markets/:id", async (req, res) => {
    try {
      const market = await withDbRetry(() => storage.getMarket(req.params.id), "getMarket");
      if (!market) return res.status(404).json({ error: "Market not found" });
      res.json(market);
    } catch (err) {
      console.error("[markets] getMarket error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/markets/:id/bet", async (req, res) => {
    try {
      const parsed = placeBetSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const { playerId, outcome, amount } = parsed.data;
      const result = await withDbRetry(() => storage.placeBet(req.params.id, playerId, outcome, amount), "placeBet");
      if ("error" in result) return res.status(400).json({ error: result.error });
      markDirty();
      res.json(result);
    } catch (err) {
      console.error("[markets] placeBet error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/markets/:id/claim", async (req, res) => {
    try {
      const { playerId } = req.body;
      if (!playerId) return res.status(400).json({ error: "playerId required" });
      const result = await withDbRetry(() => storage.claimWinnings(req.params.id, playerId), "claimWinnings");
      if ("error" in result) return res.status(400).json({ error: result.error });
      markDirty();
      res.json(result);
    } catch (err) {
      console.error("[markets] claimWinnings error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin-only routes
}
