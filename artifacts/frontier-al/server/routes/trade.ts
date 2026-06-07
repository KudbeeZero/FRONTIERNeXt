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

export function registerTradeRoutes(app: Express, ctx: RouteContext): void {
  const { assertPlayerOwnership, maybeGrantWelcomeBonus, fireBurn, adviceLimiter, algodClient, indexerClient } = ctx;

  app.get("/api/trade/history", async (_req, res) => {
    try {
      const history = await withDbRetry(() => storage.getTradeHistory(50), "getTradeHistory");
      res.json(history);
    } catch (err) {
      console.error("[trade] getTradeHistory error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/trade/leaderboard", async (_req, res) => {
    try {
      const board = await withDbRetry(() => storage.getTradeLeaderboard(), "getTradeLeaderboard");
      res.json(board);
    } catch (err) {
      console.error("[trade] getTradeLeaderboard error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/trade/orders", async (_req, res) => {
    try {
      const orders = await withDbRetry(() => storage.getOpenTradeOrders(), "getOpenTradeOrders");
      res.json(orders);
    } catch (err) {
      console.error("[trade] getOpenTradeOrders error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/trade/orders", async (req, res) => {
    try {
      const { playerId } = req.body;
      if (!playerId) return res.status(400).json({ error: "playerId required" });

      const player = await storage.getPlayer(playerId);
      if (!player) return res.status(404).json({ error: "Player not found" });

      const parsed = createTradeOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
      }
      const { giveResource, giveAmount, wantResource, wantAmount } = parsed.data;

      const order = await withDbRetry(() => storage.createTradeOrder({
        id:           crypto.randomUUID(),
        offererId:    playerId,
        offererName:  player.name,
        giveResource,
        giveAmount,
        wantResource,
        wantAmount,
        status:       "open",
        createdAt:    Date.now(),
        filledById:   null,
        filledAt:     null,
      }), "createTradeOrder");

      res.json(order);
    } catch (err) {
      console.error("[trade] createTradeOrder error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/trade/orders/:id", async (req, res) => {
    try {
      const { playerId } = req.body;
      if (!playerId) return res.status(400).json({ error: "playerId required" });

      const result = await withDbRetry(
        () => storage.cancelTradeOrder(req.params.id, playerId),
        "cancelTradeOrder",
      );
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ success: true });
    } catch (err) {
      console.error("[trade] cancelTradeOrder error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/trade/orders/:id/fill", async (req, res) => {
    try {
      const { playerId } = req.body;
      if (!playerId) return res.status(400).json({ error: "playerId required" });

      const fillerPlayer = await storage.getPlayer(playerId);
      if (!fillerPlayer) return res.status(404).json({ error: "Player not found" });

      const result = await withDbRetry(
        () => storage.fillTradeOrder(req.params.id, playerId),
        "fillTradeOrder",
      );
      if (!result.success) return res.status(400).json({ error: result.error });

      // Broadcast TRADE_FILLED to all connected clients
      const trade = result.trade!;
      broadcastRaw({
        type:         "TRADE_FILLED",
        offererName:  trade.offererName,
        fillerName:   fillerPlayer.name,
        giveResource: trade.giveResource,
        giveAmount:   trade.giveAmount,
        wantResource: trade.wantResource,
        wantAmount:   trade.wantAmount,
      });

      markDirty();
      res.json({ success: true, trade });
    } catch (err) {
      console.error("[trade] fillTradeOrder error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Prediction Markets ────────────────────────────────────────────────────

  // Background resolver: close expired open markets every 60 seconds
  setInterval(async () => {
    try {
      await withDbRetry(() => storage.resolveExpiredMarkets(), "resolveExpiredMarkets");
    } catch (err) {
      console.warn("[markets] resolveExpiredMarkets:", err instanceof Error ? err.message : err);
    }
  }, 60_000);

}
