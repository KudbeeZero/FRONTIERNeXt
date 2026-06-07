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

export function registerAuthRoutes(app: Express, ctx: RouteContext): void {
  const { assertPlayerOwnership, maybeGrantWelcomeBonus, fireBurn, adviceLimiter, algodClient, indexerClient } = ctx;

  app.post("/api/auth/nonce", async (req, res) => {
    try {
      const { address } = req.body ?? {};
      if (!address || typeof address !== "string" || !algosdk.isValidAddress(address)) {
        return res.status(400).json({ error: "Valid Algorand address required" });
      }
      const { nonce, expiresAt } = await issueNonce(address);
      // `message` is the exact note the wallet must sign into the auth txn.
      res.json({ nonce, expiresAt, message: `FRONTIER-AUTH:v1:${nonce}` });
    } catch {
      res.status(500).json({ error: "Failed to issue nonce" });
    }
  });

  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { address, signedTxn, nonce } = req.body ?? {};
      if (!address || !signedTxn || !nonce) {
        return res.status(400).json({ error: "address, signedTxn and nonce are required" });
      }
      if (!algosdk.isValidAddress(address)) {
        return res.status(400).json({ error: "Invalid Algorand address" });
      }
      if (!(await verifyAuthAndNonce(address, signedTxn, nonce))) {
        return res.status(401).json({ error: "Signature verification failed" });
      }

      // Ownership proven — resolve (or create) the player bound to this address.
      const player = await storage.getOrCreatePlayerByAddress(address);
      const wb = await maybeGrantWelcomeBonus(player.id, address);

      const token = signSession({ address, playerId: player.id });
      setSessionCookie(res, token);
      const fresh = await storage.getPlayer(player.id);
      res.json({ success: true, token, welcomeBonus: wb.granted, welcomeBonusReason: wb.reason, player: fresh });
    } catch (error) {
      console.error("[auth/verify] error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ authenticated: false });
    const player = await storage.getPlayer(auth.playerId).catch(() => null);
    res.json({ authenticated: true, address: auth.address, player });
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    res.json({ success: true });
  });
}
