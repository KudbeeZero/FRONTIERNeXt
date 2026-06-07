import type { Express, Request, Response } from "express";
import path from "path";
import { getBattleReplay, recordSubParcelWorldEvent, recordArchetypeWorldEvent } from "./services/redis";
import { createServer, type Server } from "http";
import algosdk from "algosdk";
import { storage } from "./storage";
import { mineActionSchema, upgradeActionSchema, attackActionSchema, buildActionSchema, purchaseActionSchema, collectActionSchema, claimFrontierActionSchema, mintAvatarActionSchema, specialAttackActionSchema, deployDroneActionSchema, deploySatelliteActionSchema, SlimGameState, createTradeOrderSchema, placeBetSchema, createMarketSchema, resolveMarketSchema, terraformActionSchema } from "@shared/schema";
import { z } from "zod";
import { db, withDbRetry, getPoolStats } from "./db";
import { parcels as parcelsTable, plotNfts as plotNftsTable, players as playersTable, mintIdempotency as mintIdempotencyTable, battles as battlesTable, gameEvents as gameEventsTable, gameMeta, tradeOrders as tradeOrdersTable, subParcels as subParcelsTable, orbitalEvents as orbitalEventsTable, commanderNfts as commanderNftsTable, commanderMintIdempotency as commanderMintIdempotencyTable } from "./db-schema";
import { eq, sql, desc } from "drizzle-orm";
import { recommendTerraform, type TerraformGoal } from "./engine/narrative/advisor";
import rateLimit from "express-rate-limit";
import { registerHealthRoutes } from "./routes/health";
import { registerAuthRoutes } from "./routes/auth";
import { registerBlockchainRoutes } from "./routes/blockchain";
import { registerNftRoutes } from "./routes/nft";
import { registerActionRoutes } from "./routes/actions";
import { registerGameRoutes } from "./routes/game";
import { registerTradeRoutes } from "./routes/trade";
import { registerMarketRoutes } from "./routes/markets";
import { registerSubparcelRoutes } from "./routes/subparcels";
import { registerAdminRoutes } from "./routes/admin";
import type { RouteContext } from "./routes/context";

// Per-IP limiter for the terraform advice endpoint — bounds cost when the LLM
// advisor path (ANTHROPIC_API_KEY) is enabled. The heuristic path is cheap.
const adviceLimiter = rateLimit({
  windowMs: 60_000,
  limit: Math.max(1, Number(process.env.ADVICE_RATE_LIMIT) || 30),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many advice requests — try again shortly." },
});
import { broadcastGameState, broadcastRaw, markDirty } from "./wsServer";
import { appendWorldEvent, listWorldEvents, getRecentWorldEvents } from "./worldEventStore";

// ── Chain Service ─────────────────────────────────────────────────────────────
// All algosdk usage is now isolated in server/services/chain/*.
// Routes import ONLY from the service layer — never from algosdk directly.
import { getFrontierAsaId, getOrCreateFrontierAsa, isAddressOptedIn, setFrontierAsaId, batchedTransferFrontierAsa, clawbackFrontierAsa } from "./services/chain/asa";
import { enqueueFrontierTransfer } from "./services/chain/transferQueue";
import { getAdminAddress, getAdminBalance, getAlgodClient, getIndexerClient } from "./services/chain/client";
import { mintLandNft, transferLandNft, attemptDelivery } from "./services/chain/land";
import { recordUpgradeOnChain } from "./services/chain/upgrades";
import { mintCommanderNft, transferCommanderNft, forwardLiquiditySplit, verifyAlgoPayment, attemptCommanderDelivery } from "./services/chain/commander";
import {
  bootstrapFactionIdentities,
  getAllFactionAsaIds,
  getFactionAsaId,
  FACTION_DEFINITIONS,
} from "./services/chain/factions";
import { fromMicroFRNTR } from "./storage/game-rules";
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
} from "../shared/economy-config";
import { getAlgoUsdPrice, usdToMicroAlgo } from "./services/priceOracle";
import { requireAdminKey, enumerationLimiter, authLimiter, clampLimit } from "./security";
import {
  getAuth,
  isWalletAuthRequired,
  issueNonce,
  verifyAuthAndNonce,
  signSession,
  setSessionCookie,
  clearSessionCookie,
} from "./auth";
import { scopeGameStateFor } from "./stateScope";
import { assessWelcomeBonusEligibility } from "./services/chain/eligibility";

// API route timing diagnostics now live in ./routes/_timing.ts (shared with the
// admin metrics route). Re-exported here so existing importers keep working.
export { logApiRouteStats } from "./routes/_timing";

const algodClient    = getAlgodClient();
const indexerClient  = getIndexerClient();

/**
 * Fire-and-forget on-chain FRONTIER burn via clawback.
 * Only fires for real wallets (not AI, not placeholder addresses).
 * Game action is never blocked if this fails — DB is source of truth.
 */
function fireBurn(walletAddress: string, amount: number, note: string): void {
  const asaId = getFrontierAsaId();
  const isRealWallet =
    walletAddress &&
    walletAddress !== 'PLAYER_WALLET' &&
    !walletAddress.startsWith('AI_') &&
    algosdk.isValidAddress(walletAddress);

  if (!asaId || !isRealWallet || amount <= 0) return;

  clawbackFrontierAsa(walletAddress, amount, note)
    .then(txId => { if (txId) console.log(`[burn] ${amount} FRONTIER from ${walletAddress} txId=${txId}`); })
    .catch(err => console.error('[burn] clawback failed:', err));
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Blockchain Initialization (via Chain Service) ──────────────────────────
  let blockchainReady = false;
  (async () => {
    try {
      const forceNew = process.env.FORCE_NEW_FRONTIER_ASA === "true" || process.env.FORCE_NEW_ASA === "true";
      const asaId    = await getOrCreateFrontierAsa({ forceNew });
      setFrontierAsaId(asaId);
      blockchainReady = true;
      const adminAddr = getAdminAddress();
      const balance   = await getAdminBalance();
      console.log(`[routes] Blockchain ready: ASA=${asaId}, Admin=${adminAddr}, ALGO=${balance.algo}`);

      // Bootstrap faction identity ASAs (idempotent — safe on every restart)
      const factionBaseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
      if (!factionBaseUrl) throw new Error("[faction seed] PUBLIC_BASE_URL must be set — cannot seed faction metadata without a valid public URL");
      bootstrapFactionIdentities(factionBaseUrl).catch((err) =>
        console.error("[routes] Faction identity bootstrap failed:", err)
      );
    } catch (err) {
      console.error("[routes] Blockchain init failed:", err);
    }
  })();

  /**
   * Verifies the playerId in req.body exists in the DB and is not an AI player.
   * Returns the verified playerId or null (response already sent on failure).
   */
  async function assertPlayerOwnership(
    req: Request,
    res: Response,
    bodyPlayerId?: string
  ): Promise<string | null> {
    const auth = getAuth(req);

    // When wallet auth is enforced, a verified session is mandatory and the
    // session's player is authoritative — a client-supplied id can no longer be
    // used to act on behalf of someone else.
    if (isWalletAuthRequired() && !auth) {
      res.status(401).json({ error: "Authentication required — connect your wallet" });
      return null;
    }

    const claimedId = bodyPlayerId ?? req.body?.playerId;
    if (auth && claimedId && claimedId !== auth.playerId) {
      res.status(403).json({ error: "Forbidden — session does not own this player" });
      return null;
    }

    const targetId = auth?.playerId ?? claimedId;
    if (!targetId || typeof targetId !== "string") {
      res.status(401).json({ error: "Player ID required" });
      return null;
    }

    const player = await storage.getPlayer(targetId).catch(() => null);
    if (!player) {
      res.status(404).json({ error: "Player not found" });
      return null;
    }
    if (player.isAI) {
      res.status(403).json({ error: "Forbidden" });
      return null;
    }

    return targetId;
  }

  /**
   * Grant the 500 FRONTIER welcome bonus once, gated by on-chain Sybil
   * heuristics (minimum ALGO balance). Safe to call on every login: it no-ops
   * if the bonus was already received or the wallet is ineligible, so the bonus
   * is effectively granted on the first *eligible* login.
   */
  async function maybeGrantWelcomeBonus(
    playerId: string,
    address: string,
  ): Promise<{ granted: boolean; reason?: string }> {
    const p = await storage.getPlayer(playerId).catch(() => null);
    if (!p || p.welcomeBonusReceived) return { granted: false };
    // Internal AI players never reach here, but guard anyway.
    if (!address || address.startsWith("AI_")) return { granted: false };

    const elig = await assessWelcomeBonusEligibility(address);
    if (!elig.eligible) return { granted: false, reason: elig.reason };

    await storage.grantWelcomeBonus(playerId);
    // Enqueue regardless of asaId / opt-in state; the worker retries.
    enqueueFrontierTransfer({
      recipientAddress: address,
      recipientPlayerId: playerId,
      amount: 500,
      reason: "welcome_bonus",
    }).catch((err) => console.error("Welcome bonus enqueue failed:", err));
    return { granted: true };
  }

  // ── Anti-scraping: strict per-IP throttle on enumerable read endpoints ───────
  // These endpoints are keyed by a sequential/guessable identifier (plotId,
  // playerId, wallet address) and individually return off-chain game-economy
  // intelligence. A real client hits any one occasionally; a bot walking the
  // keyspace to harvest "which plots hold the most resources" hammers them.
  // Mounted via app.use (not as a per-route arg) so it never perturbs the
  // typed route-param inference of the handlers below. GET-only paths, so
  // matching all methods on these exact paths is harmless.
  for (const p of [
    "/api/blockchain/opt-in-check/:address",
    "/api/nft/plot/:plotId",
    "/api/nft/commander/:commanderId",
    "/api/game/parcel/:id",
    "/api/game/player/:id",
    "/api/game/player-by-address/:address",
    "/api/parcels/attackable",
    "/api/markets/player/:playerId",
    "/api/plots/:plotId/sub-parcels",
  ]) {
    app.use(p, enumerationLimiter);
  }

  // ── Wallet-signature authentication endpoints ────────────────────────────────
  // Sign-In With Algorand: prove control of the wallet, receive a session token.
  // Tight, Redis-backed per-IP limiter blunts nonce/verify spam across instances.
  app.use("/api/auth", authLimiter);


  // ── Shared context handed to every domain router ─────────────────────────────
  // These were closures / module helpers in this file; the route handlers now
  // live in server/routes/*.ts and receive them via this object. No behavior
  // change — same functions, same module-level state (blockchainReady is read
  // live via the getter so the async chain-init still flips it after boot).
  const ctx: RouteContext = {
    assertPlayerOwnership,
    maybeGrantWelcomeBonus,
    getBlockchainReady: () => blockchainReady,
    fireBurn,
    adviceLimiter,
    algodClient,
    indexerClient,
  };

  // Liveness/readiness probes — public, unguarded (SECURITY LUT §6.3).
  registerHealthRoutes(app);

  // Auth routes mount BEFORE the global mutation guard (they must not be guarded).
  registerAuthRoutes(app, ctx);

  // ── Global ownership guard for mutating game endpoints ───────────────────────
  // Single chokepoint: every state-changing game route requires a verified
  // wallet session (when enforced), and any player-identity field in the body
  // MUST match the session's player. This is what makes acting on behalf of
  // another player impossible — a client can no longer just supply someone
  // else's playerId. Registered before the routes below so it runs first.
  const MUTATION_PATH_RE = /^\/api\/(actions|trade|markets|plots|sub-parcels|factions)\b/;
  const OWNER_ID_FIELDS = ["playerId", "attackerId", "sellerId", "buyerId"] as const;
  app.use((req, res, next) => {
    if (req.method !== "POST" && req.method !== "DELETE" && req.method !== "PUT") return next();
    if (!MUTATION_PATH_RE.test(req.path)) return next();

    const auth = getAuth(req);
    if (isWalletAuthRequired() && !auth) {
      return res.status(401).json({ error: "Authentication required — connect your wallet" });
    }
    if (auth) {
      req.auth = auth;
      const bodyId = OWNER_ID_FIELDS
        .map((f) => req.body?.[f])
        .find((v) => typeof v === "string" && v.length > 0);
      if (bodyId && bodyId !== auth.playerId) {
        return res.status(403).json({ error: "Forbidden — session does not own this player" });
      }
    }
    next();
  });

  // ── Domain routers (mounted after the mutation guard above) ──────────────────
  registerBlockchainRoutes(app, ctx);
  registerNftRoutes(app, ctx);
  registerActionRoutes(app, ctx);
  registerGameRoutes(app, ctx);
  registerTradeRoutes(app, ctx);
  registerMarketRoutes(app, ctx);
  registerSubparcelRoutes(app, ctx);
  registerAdminRoutes(app, ctx);

  return httpServer;
}
