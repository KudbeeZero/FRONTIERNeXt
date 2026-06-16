import type { Express, Request, Response } from "express";
import path from "path";
import { getBattleReplay, recordSubParcelWorldEvent, recordArchetypeWorldEvent } from "./services/redis";
import { createServer, type Server } from "http";
import algosdk from "algosdk";
import { storage } from "./storage";
import { mineActionSchema, upgradeActionSchema, attackActionSchema, buildActionSchema, purchaseActionSchema, collectActionSchema, claimAscendActionSchema, mintAvatarActionSchema, specialAttackActionSchema, deployDroneActionSchema, deploySatelliteActionSchema, SlimGameState, createTradeOrderSchema, placeBetSchema, createMarketSchema, terraformActionSchema } from "@shared/schema";
import { z } from "zod";
import { db, withDbRetry, getPoolStats } from "./db";
import { parcels as parcelsTable, plotNfts as plotNftsTable, players as playersTable, mintIdempotency as mintIdempotencyTable, battles as battlesTable, gameEvents as gameEventsTable, gameMeta, tradeOrders as tradeOrdersTable, subParcels as subParcelsTable, orbitalEvents as orbitalEventsTable, commanderNfts as commanderNftsTable, commanderMintIdempotency as commanderMintIdempotencyTable } from "./db-schema";
import { eq, sql, desc } from "drizzle-orm";
import { eq, sql, desc, lt } from "drizzle-orm";
import { recommendTerraform, type TerraformGoal } from "./engine/narrative/advisor";
import rateLimit from "express-rate-limit";

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
import * as weaponService from "./weapons/service";
import { engagementStore } from "./weapons/engagementStore";
import { mintWeaponNft, attemptWeaponDelivery } from "./services/chain/weapon";
import {
  buildWeaponProfileActionSchema,
  unlockWeaponActionSchema,
  setLoadoutActionSchema,
  fireWeaponActionSchema,
  deployDefenseActionSchema,
  upgradeWeaponActionSchema,
  mintWeaponNftActionSchema,
  getWeapon as getWeaponSpec,
} from "@shared/weapons";
import { appendWorldEvent, listWorldEvents, getRecentWorldEvents } from "./worldEventStore";

// ── Chain Service ─────────────────────────────────────────────────────────────
// All algosdk usage is now isolated in server/services/chain/*.
// Routes import ONLY from the service layer — never from algosdk directly.
import { getAscendAsaId, getOrCreateAscendAsa, isAddressOptedIn, setAscendAsaId, batchedTransferAscendAsa, clawbackAscendAsa } from "./services/chain/asa";
import { enqueueAscendTransfer } from "./services/chain/transferQueue";
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
import { fromMicroASCEND } from "./storage/game-rules";
import {
  ECONOMY_MODE,
  LAND_DAILY_ASCEND_RATE,
  LAND_DAILY_ASCEND_RATE_TEST,
  LAND_DAILY_ASCEND_RATE_PROD,
  EMISSION_CHECK_PARCEL_COUNTS,
  projectedDailyEmissions,
  COMMANDER_MINT_ASCEND_ACTIVE,
  COMMANDER_ALGO_NETWORK_FEE,
  COMMANDER_ALGO_PRICE_ACTIVE,
  LAND_PURCHASE_ALGO_ACTIVE,
  TESTING_ECONOMY_SUMMARY,
} from "../shared/economy-config";
import { getAlgoUsdPrice, usdToMicroAlgo } from "./services/priceOracle";
import { requireAdminKey, enumerationLimiter, authLimiter, clampLimit, evaluateNftDeliveryClaim, createPaymentReplayGuard, type PaymentRedemption } from "./security";
import { redeemedPayments as redeemedPaymentsTable, actionNonces as actionNoncesTable } from "./db-schema";
import { evaluateOwnership } from "./routeOwnership";
import { createActionIdempotencyGuard } from "./idempotencyGuard";

// One ALGO payment txid buys exactly one thing. Backed by the
// redeemed_payments table (tx_id PRIMARY KEY) so the first claim wins
// atomically across instances; falls back to an in-process Set only when the
// DB is unavailable (dev/mem mode). See createPaymentReplayGuard for the
// claim → mutate → release-on-failure contract.
const paymentReplayGuard = createPaymentReplayGuard(
  db
    ? {
        async tryInsert(txId: string, meta: PaymentRedemption): Promise<boolean> {
          const inserted = await db
            .insert(redeemedPaymentsTable)
            .values({ txId, purpose: meta.purpose, refId: meta.refId, playerId: meta.playerId, redeemedAt: Date.now() })
            .onConflictDoNothing()
            .returning({ txId: redeemedPaymentsTable.txId });
          return inserted.length > 0;
        },
        async remove(txId: string): Promise<void> {
          await db.delete(redeemedPaymentsTable).where(eq(redeemedPaymentsTable.txId, txId));
        },
      }
    : null
);

// Action idempotency guard — blocks double-submit/replay of mutating actions and
// REPLAYS the original success response on a duplicate (two-phase claim → record/
// release). DB-backed (action_nonces, key PRIMARY KEY) for cross-instance
// atomicity; falls back to an in-process map only when the DB is unavailable
// (dev/mem mode).
const actionIdempotencyGuard = createActionIdempotencyGuard(
  db
    ? {
        async claim(key, rec) {
          const inserted = await db
            .insert(actionNoncesTable)
            .values({ key, playerId: rec.playerId, action: rec.action, createdAt: Date.now() })
            .onConflictDoNothing()
            .returning({ key: actionNoncesTable.key });
          if (inserted.length > 0) return { inserted: true };
          // Key already claimed — surface the persisted response (NULL = in-flight).
          const [row] = await db
            .select({ response: actionNoncesTable.responseJson })
            .from(actionNoncesTable)
            .where(eq(actionNoncesTable.key, key));
          return { inserted: false, response: row?.response ?? null };
        },
        async complete(key, responseJson) {
          await db
            .update(actionNoncesTable)
            .set({ responseJson, completedAt: Date.now() })
            .where(eq(actionNoncesTable.key, key));
        },
        async remove(key) {
          await db.delete(actionNoncesTable).where(eq(actionNoncesTable.key, key));
        },
        async prune(olderThanMs) {
          const cutoff = Date.now() - olderThanMs;
          const deleted = await db
            .delete(actionNoncesTable)
            .where(lt(actionNoncesTable.createdAt, cutoff))
            .returning({ key: actionNoncesTable.key });
          return deleted.length;
        },
      }
    : null
);

// ID-004: TTL + periodic prune for `action_nonces`. Since 0007 the guard persists
// `response_json` on every completed action, so the table grows with traffic;
// completed rows and crash-orphaned in-flight rows are reaped by created_at age.
// The TTL must comfortably exceed the legitimate retry window — after it elapses a
// nonce is forgotten (replay protection lasts the TTL; normal play uses a fresh
// nonce per action, never one older than the TTL). Both knobs are env-tunable.
//
// The TTL floor is deliberately well above any possible in-flight request duration
// (the synchronous claim→mutation→record window is sub-second; the on-chain
// ASCEND transfer is enqueued fire-and-forget, not awaited). This guarantees the
// prune can never reap a still-running claim out from under it and let a concurrent
// duplicate re-claim and double-apply — even at the most aggressive configuration.
export const ACTION_NONCE_TTL_MS = Math.max(
  600_000, // floor: 10 min — far above max request duration (see note above)
  Number(process.env.ACTION_NONCE_TTL_MS) || 24 * 60 * 60 * 1000, // 24h default
);
export const ACTION_NONCE_PRUNE_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.ACTION_NONCE_PRUNE_INTERVAL_MS) || 60 * 60 * 1000, // hourly default
);

// Reap action_nonces older than `olderThanMs` (defaults to the TTL). Best-effort:
// the underlying guard swallows store errors and returns 0, so a prune failure
// never affects request handling. Returns the number of rows removed.
export function pruneActionNonces(olderThanMs: number = ACTION_NONCE_TTL_MS): Promise<number> {
  return actionIdempotencyGuard.prune(olderThanMs);
}

// Map an idempotency-guard rejection to a safe HTTP status + generic message.
// Never echoes the nonce/key/playerId (fail-closed, no internals leaked).
function idempotencyRejection(reason: "invalid_nonce" | "in_progress" | "store_unavailable"): {
  status: number;
  error: string;
} {
  switch (reason) {
    case "in_progress":
      return { status: 409, error: "Duplicate request — still being processed, please retry" };
    case "store_unavailable":
      return { status: 503, error: "Service temporarily unavailable" };
    default:
      return { status: 400, error: "Missing or invalid idempotency key" };
  }
}

// Shared claim/replay/reject step for the nonce-guarded routes. Returns true if a
// response was already sent (a 200 REPLAY of the original body, or a 400/409/503
// rejection) and the handler must stop; false if it should run the mutation, then
// `actionIdempotencyGuard.record(...)` on success / `.release(...)` on failure.
async function guardClaimOrRespond(
  res: Response,
  scope: { playerId: string; action: string; target?: string },
  nonce: unknown,
): Promise<boolean> {
  const idem = await actionIdempotencyGuard.claim(scope, nonce);
  if (!idem.ok) {
    const { status, error } = idempotencyRejection(idem.reason);
    res.status(status).json({ error });
    return true;
  }
  if (idem.replay) {
    res.json(JSON.parse(idem.response));
    return true;
  }
  return false;
}
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

// ── API Route Timing Diagnostics ──────────────────────────────────────────────
const _apiRouteTimings: Record<string, { count: number; totalTimeMs: number; maxTimeMs: number; slowCount: number }> = {};
const SLOW_API_THRESHOLD_MS = 1000; // Log warnings for routes taking >1s

/**
 * Wrap an async route handler with timing diagnostics.
 * Logs slow requests and tracks aggregate stats per route.
 */
function withTiming(
  routeName: string,
  handler: (req: Request, res: Response) => Promise<void | Response>
): (req: Request, res: Response) => Promise<void | Response> {
  if (!_apiRouteTimings[routeName]) {
    _apiRouteTimings[routeName] = { count: 0, totalTimeMs: 0, maxTimeMs: 0, slowCount: 0 };
  }

  return async (req: Request, res: Response) => {
    const start = Date.now();
    _apiRouteTimings[routeName].count++;

    try {
      const result = await handler(req, res);
      const duration = Date.now() - start;
      _apiRouteTimings[routeName].totalTimeMs += duration;
      if (duration > _apiRouteTimings[routeName].maxTimeMs) {
        _apiRouteTimings[routeName].maxTimeMs = duration;
      }

      // Log slow requests
      if (duration > SLOW_API_THRESHOLD_MS) {
        _apiRouteTimings[routeName].slowCount++;
        console.warn(
          `[api] SLOW: ${req.method} ${routeName} took ${duration}ms ` +
          `(avg: ${(_apiRouteTimings[routeName].totalTimeMs / _apiRouteTimings[routeName].count).toFixed(0)}ms, ` +
          `max: ${_apiRouteTimings[routeName].maxTimeMs}ms, slow: ${_apiRouteTimings[routeName].slowCount})`
        );
      }

      return result;
    } catch (err) {
      const duration = Date.now() - start;
      _apiRouteTimings[routeName].totalTimeMs += duration;
      console.error(`[api] ERROR: ${req.method} ${routeName} failed after ${duration}ms:`, err instanceof Error ? err.message : err);
      throw err;
    }
  };
}

/**
 * Log aggregate API route timing stats. Call periodically.
 */
export function logApiRouteStats(): void {
  const entries = Object.entries(_apiRouteTimings).filter(([, stats]) => stats.count > 0);
  if (entries.length === 0) return;

  console.log("[api] Route timing stats:");
  for (const [route, stats] of entries) {
    const avg = stats.totalTimeMs / stats.count;
    console.log(
      `  ${route}: calls=${stats.count}, avg=${avg.toFixed(0)}ms, ` +
      `max=${stats.maxTimeMs}ms, slow=${stats.slowCount}`
    );
  }
}

// Log API stats every 120 seconds
setInterval(() => {
  logApiRouteStats();
}, 120_000);

const algodClient    = getAlgodClient();
const indexerClient  = getIndexerClient();

/**
 * Fire-and-forget on-chain FRONTIER burn via clawback.
 * Only fires for real wallets (not AI, not placeholder addresses).
 * Game action is never blocked if this fails — DB is source of truth.
 */
function fireBurn(walletAddress: string, amount: number, note: string): void {
  const asaId = getAscendAsaId();
  const isRealWallet =
    walletAddress &&
    walletAddress !== 'PLAYER_WALLET' &&
    !walletAddress.startsWith('AI_') &&
    algosdk.isValidAddress(walletAddress);

  if (!asaId || !isRealWallet || amount <= 0) return;

  clawbackAscendAsa(walletAddress, amount, note)
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
      const asaId    = await getOrCreateAscendAsa({ forceNew });
      setAscendAsaId(asaId);
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
    // used to act on behalf of someone else. Shared decision (see routeOwnership).
    const claimedId = bodyPlayerId ?? req.body?.playerId;
    const verdict = evaluateOwnership({
      authRequired: isWalletAuthRequired(),
      auth,
      ownerId: claimedId,
    });
    if (!verdict.ok) {
      res.status(verdict.status).json({ error: verdict.error });
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
   * Grant the 500 ASCEND welcome bonus once, gated by on-chain Sybil
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
    enqueueAscendTransfer({
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
    const ownerId = OWNER_ID_FIELDS
      .map((f) => req.body?.[f])
      .find((v) => typeof v === "string" && v.length > 0) ?? null;
    const verdict = evaluateOwnership({
      authRequired: isWalletAuthRequired(),
      auth,
      ownerId,
    });
    if (!verdict.ok) {
      return res.status(verdict.status).json({ error: verdict.error });
    }
    if (auth) req.auth = auth;
    next();
  });

  app.get("/api/blockchain/status", async (req, res) => {
    try {
      const asaId      = getAscendAsaId();
      const adminAddress = getAdminAddress();
      const forceNew   = process.env.FORCE_NEW_FRONTIER_ASA === "true" || process.env.FORCE_NEW_ASA === "true";
      const network    = process.env.ALGORAND_NETWORK ?? "testnet";
      const factionAsaIds = getAllFactionAsaIds();

      const body: Record<string, unknown> = {
        ready: blockchainReady,
        ascendAsaId: asaId,
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
          body.adminAscendBalance = balance.ascendAsa;
        }
      }

      res.json(body);
    } catch (error) {
      res.json({ ready: false, ascendAsaId: null, adminAddress: null });
    }
  });

  app.get("/api/economics", async (_req, res) => {
    try {
      const asaId = getAscendAsaId();
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
            burned:  sql<number>`COALESCE(SUM(${playersTable.totalAscendBurned}), 0)`,
            balanceMicro: sql<number>`COALESCE(SUM(${playersTable.ascendBalanceMicro}), 0)`,
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
        protocolTreasuryUnsettled = Math.round(fromMicroASCEND(bal.unsettledMicro) * 100) / 100;
        protocolTreasuryTotal     = Math.round(fromMicroASCEND(bal.totalMicro)     * 100) / 100;
      } catch (_e) { /* non-fatal */ }

      // ── Payout safety: projected daily emissions vs admin ASCEND balance ──────
      const projections = Object.fromEntries(
        EMISSION_CHECK_PARCEL_COUNTS.map(n => [n, projectedDailyEmissions(n)])
      ) as Record<number, number>;

      const currentDailyDemand = projectedDailyEmissions(ownedParcelCount);

      // Warn when current demand (base rate only) exceeds 10% of admin ASCEND balance per day
      if (treasury > 0 && currentDailyDemand > treasury * 0.1) {
        console.warn(
          `[/api/economics] ⚠ Payout warning: current daily base emission demand ` +
          `(${currentDailyDemand.toFixed(0)} ASCEND/day for ${ownedParcelCount} parcels) ` +
          `exceeds 10% of admin treasury balance (${treasury.toFixed(0)} ASCEND). ` +
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
        unitName: "ASCEND",
        assetName: "ASCEND",
        decimals: ASA_DECIMALS,
        // ── Emission config (centralized from shared/economy-config.ts) ──────
        economyMode: ECONOMY_MODE,
        emissionRatePerDay: LAND_DAILY_ASCEND_RATE,
        emissionRateTest:   LAND_DAILY_ASCEND_RATE_TEST,
        emissionRateProd:   LAND_DAILY_ASCEND_RATE_PROD,
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
      res.json({ optedIn, asaId: getAscendAsaId() });
    } catch (error) {
      res.json({ optedIn: false, asaId: getAscendAsaId() });
    }
  });

  // ── Faction Identity Metadata ────────────────────────────────────────────────
  // ARC-3 style metadata for each AI faction identity ASA.
  // Referenced as assetURL on the on-chain ASA — permanent, do not change path.
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

      // ── Ownership gate ────────────────────────────────────────────────────
      // Custody + opt-in alone are attacker-satisfiable (opt-in is
      // permissionless), so the NFT may only ever go to the registered wallet
      // of the parcel's current in-game owner.
      const [parcelRow] = await db
        .select({ ownerId: parcelsTable.ownerId })
        .from(parcelsTable)
        .where(eq(parcelsTable.plotId, plotId));
      const ownerId = parcelRow?.ownerId ?? null;
      const [ownerRow] = ownerId
        ? await db.select({ address: playersTable.address }).from(playersTable).where(eq(playersTable.id, ownerId))
        : [];
      const claim = evaluateNftDeliveryClaim({ ownerAddress: ownerRow?.address ?? null, requestedAddress: address });
      if (!claim.allow) {
        console.warn(`[nft/deliver] DENIED plotId=${plotId} assetId=${assetId} requested=${address} reason=${claim.reason}`);
        return res.status(403).json({ error: "Delivery address does not match the plot owner's registered wallet", reason: claim.reason });
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
  // Returns the ASCEND cost and minimal ALGO network fee for commander minting.
  // In testing mode: ASCEND costs are low, ALGO is network fee only (~0.001).
  // In production mode: ASCEND costs are standard, same minimal ALGO network fee.
  app.get("/api/nft/commander-price/:tier", (req, res) => {
    const { tier } = req.params;
    const ascendCost = COMMANDER_MINT_ASCEND_ACTIVE[tier];
    if (ascendCost === undefined) return res.status(400).json({ error: "Unknown tier" });

    const adminAddress = getAdminAddress();

    const algoGamePrice = COMMANDER_ALGO_PRICE_ACTIVE[tier] ?? 0.5;
    res.json({
      tier,
      ascendCost,
      algoGamePrice,
      algoNetworkFee: COMMANDER_ALGO_NETWORK_FEE,
      algoTotal: algoGamePrice + COMMANDER_ALGO_NETWORK_FEE,
      adminAddress,
      economyMode: ECONOMY_MODE,
      currency: "ASCEND+ALGO",
      note: ECONOMY_MODE === "testing"
        ? `Testing mode: ${ascendCost} ASCEND + ${algoGamePrice} ALGO to mint.`
        : `${ascendCost} ASCEND + ${algoGamePrice} ALGO to mint.`,
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
    if (!commanderId) return res.status(400).json({ error: "commanderId required" });
    // Bind the retry to the caller's verified session: this mint spends the
    // admin wallet's ALGO, so only the owning (human) player may trigger it —
    // not anyone who can guess a (playerId, commanderId) pair.
    const playerId = await assertPlayerOwnership(req, res);
    if (!playerId) return;
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

      // ── Ownership gate ────────────────────────────────────────────────────
      // Same rule as plot delivery: only the registered wallet of the player
      // who owns this commander may take delivery (opt-in is permissionless,
      // so it is not an ownership proof).
      const [cmdrOwnerRow] = await db
        .select({ address: playersTable.address })
        .from(playersTable)
        .where(sql`${playersTable.commanders} @> ${JSON.stringify([{ id: commanderId }])}::jsonb`);
      const claim = evaluateNftDeliveryClaim({ ownerAddress: cmdrOwnerRow?.address ?? null, requestedAddress: address });
      if (!claim.allow) {
        console.warn(`[nft/deliver-commander] DENIED commanderId=${commanderId} assetId=${assetId} requested=${address} reason=${claim.reason}`);
        return res.status(403).json({ error: "Delivery address does not match the commander owner's registered wallet", reason: claim.reason });
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
        console.log(`Welcome bonus of 500 ASCEND granted to player ${player.name} (${address})`);

        // SEV2 #7 fix: enqueue regardless of asaId / opt-in state; worker retries.
        if (address && !address.startsWith("AI_")) {
          enqueueAscendTransfer({
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

  app.get("/api/game/state", async (req, res) => {
    try {
      const gameState = await withDbRetry(() => storage.getGameState(), "getGameState");
      // Scope to the requesting viewer (fog of war / EPI). Anonymous → fully
      // redacted. The WS broadcast below re-scopes per connection.
      const auth = getAuth(req);
      res.json(scopeGameStateFor(gameState, auth?.playerId ?? null));
      broadcastGameState(gameState);
    } catch (error) {
      console.error("Error fetching game state:", error);
      res.status(500).json({ error: "Failed to fetch game state" });
    }
  });

  app.get("/api/game/slim-state", async (req, res) => {
    try {
      const slimState = await withDbRetry(() => storage.getSlimGameState(), "getSlimGameState");
      res.json(slimState);
    } catch (error) {
      console.error("Error fetching slim game state:", error);
      res.status(500).json({ error: "Failed to fetch game state" });
    }
  });

  app.get("/api/game/parcel/:id", async (req, res) => {
    try {
      const parcel = await storage.getParcel(req.params.id);
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      res.json(parcel);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parcel" });
    }
  });

  app.get("/api/game/player/:id", async (req, res) => {
    try {
      const player = await storage.getPlayer(req.params.id);
      if (!player) return res.status(404).json({ error: "Player not found" });
      res.json(player);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch player" });
    }
  });

  /**
   * Wallet-based player lookup / auto-creation.
   * Called by the client immediately after a wallet connects.
   * Returns the existing player for that address, or creates a fresh one.
   * Also grants the 500 ASCEND welcome bonus on first login.
   */
  app.get("/api/game/player-by-address/:address", async (req, res) => {
    try {
      const { address } = req.params;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ error: "Address is required" });
      }

      const player = await storage.getOrCreatePlayerByAddress(address);
      const wb = await maybeGrantWelcomeBonus(player.id, address);

      // Return fresh player data (welcomeBonusReceived reflects any grant)
      const fresh = await storage.getPlayer(player.id);
      res.json({ ...fresh, welcomeBonus: wb.granted, welcomeBonusReason: wb.reason });
    } catch (error) {
      console.error("player-by-address error:", error);
      res.status(500).json({ error: "Failed to get or create player" });
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

  app.get("/api/testnet/progress/:address", async (req, res) => {
    // Testnet-only debug surface — never expose on mainnet (writes/reads mission
    // progress without auth). 404 hides its existence in production.
    if (process.env.ALGORAND_NETWORK === "mainnet") return res.sendStatus(404);
    try {
      const { address } = req.params;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ error: "Address is required" });
      }
      const player = await storage.getOrCreatePlayerByAddress(address);
      res.json({
        playerId: player.id,
        completedMissions: player.testnetProgress || [],
        stats: {
          territories: player.ownedParcels.length,
          totalIronMined: player.totalIronMined,
          totalFuelMined: player.totalFuelMined,
          totalCrystalMined: player.totalCrystalMined,
          totalAscendEarned: player.totalAscendEarned,
          attacksWon: player.attacksWon,
          attacksLost: player.attacksLost,
          hasCommander: player.commanders.length > 0,
          hasDrones: player.drones.length > 0,
          welcomeBonusReceived: player.welcomeBonusReceived,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch testnet progress" });
    }
  });

  app.post("/api/testnet/progress", async (req, res) => {
    // Testnet-only debug surface — never expose on mainnet (writes mission
    // progress without auth). 404 hides its existence in production.
    if (process.env.ALGORAND_NETWORK === "mainnet") return res.sendStatus(404);
    try {
      const { address, completedMissions } = req.body;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ error: "Address is required" });
      }
      if (!Array.isArray(completedMissions)) {
        return res.status(400).json({ error: "completedMissions must be an array" });
      }
      const player = await storage.getOrCreatePlayerByAddress(address);
      await storage.updateTestnetProgress(player.id, completedMissions);
      res.json({ success: true, completedMissions });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update progress" });
    }
  });

  // Returns all faction identity records for the game UI, enriched with live stats
  app.get("/api/factions", async (_req, res) => {
    try {
      const factionAsaIds = getAllFactionAsaIds();

      // Aggregate member counts and territory counts from DB
      const [allHumanPlayers, allParcels, allAiPlayers] = await Promise.all([
        db.select({
          id: playersTable.id,
          playerFactionId: playersTable.playerFactionId,
        }).from(playersTable).where(eq(playersTable.isAi, false)),
        db.select({
          ownerId: parcelsTable.ownerId,
        }).from(parcelsTable),
        db.select({
          id: playersTable.id,
          name: playersTable.name,
          iron: playersTable.iron,
          fuel: playersTable.fuel,
          crystal: playersTable.crystal,
          treasury: playersTable.treasury,
        }).from(playersTable).where(eq(playersTable.isAi, true)),
      ]);

      const memberCounts: Record<string, number> = {};
      for (const p of allHumanPlayers) {
        if (p.playerFactionId) {
          memberCounts[p.playerFactionId] = (memberCounts[p.playerFactionId] ?? 0) + 1;
        }
      }

      const territoryCounts: Record<string, number> = {};
      for (const parcel of allParcels) {
        if (parcel.ownerId) {
          territoryCounts[parcel.ownerId] = (territoryCounts[parcel.ownerId] ?? 0) + 1;
        }
      }

      // Map AI player IDs to faction names
      const aiPlayerByName: Record<string, { id: string; iron: number; fuel: number; crystal: number; treasury: number }> = {};
      for (const ai of allAiPlayers) {
        aiPlayerByName[ai.name] = {
          id: ai.id,
          iron: ai.iron,
          fuel: ai.fuel,
          crystal: ai.crystal ?? 0,
          treasury: ai.treasury ?? 0,
        };
      }

      const factions = FACTION_DEFINITIONS.map((f) => {
        const aiPlayer = aiPlayerByName[f.name];
        const aiTerritoryCount = aiPlayer ? (territoryCounts[aiPlayer.id] ?? 0) : 0;
        return {
          name:            f.name,
          unitName:        f.unitName,
          assetName:       f.assetName,
          behavior:        f.behavior,
          lore:            f.lore,
          totalSupply:     f.totalSupply,
          assetId:         factionAsaIds[f.name] ?? null,
          explorerUrl:     factionAsaIds[f.name]
            ? `https://allo.info/asset/${factionAsaIds[f.name]}`
            : null,
          onChain:         factionAsaIds[f.name] != null,
          // Live stats
          memberCount:     memberCounts[f.name] ?? 0,
          territoryCount:  aiTerritoryCount,
          iron:            aiPlayer?.iron ?? 0,
          fuel:            aiPlayer?.fuel ?? 0,
          crystal:         aiPlayer?.crystal ?? 0,
          treasury:        aiPlayer?.treasury ?? 0,
        };
      });
      res.json({ factions });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch faction data" });
    }
  });

  // Join (or switch) faction alignment for the current player
  app.post("/api/factions/:name/join", async (req, res) => {
    try {
      const factionName = decodeURIComponent(req.params.name);
      const { playerId } = req.body as { playerId?: string };

      if (!playerId) return res.status(400).json({ error: "playerId required" });

      const def = FACTION_DEFINITIONS.find((f) => f.name === factionName);
      if (!def) return res.status(404).json({ error: "Faction not found" });

      // Ensure this is a human player
      const [playerRow] = await db
        .select({ id: playersTable.id, isAi: playersTable.isAi, playerFactionId: playersTable.playerFactionId, factionJoinedAt: playersTable.factionJoinedAt })
        .from(playersTable)
        .where(eq(playersTable.id, playerId));

      if (!playerRow) return res.status(404).json({ error: "Player not found" });
      if (playerRow.isAi) return res.status(400).json({ error: "AI players cannot join factions" });

      // Enforce 24h cooldown on faction switching (first-time joins are always allowed)
      const COOLDOWN_MS = 24 * 60 * 60 * 1000;
      if (playerRow.playerFactionId && playerRow.playerFactionId !== factionName) {
        const joinedAt = playerRow.factionJoinedAt ? Number(playerRow.factionJoinedAt) : 0;
        const elapsed = Date.now() - joinedAt;
        if (elapsed < COOLDOWN_MS) {
          return res.status(400).json({
            error: "Faction switch cooldown active",
            cooldownEndsAt: joinedAt + COOLDOWN_MS,
          });
        }
      }

      await db
        .update(playersTable)
        .set({
          playerFactionId: factionName,
          factionJoinedAt: Date.now(),
        })
        .where(eq(playersTable.id, playerId));

      markDirty();
      res.json({ success: true, factionName, previousFaction: playerRow.playerFactionId ?? null });
    } catch (err) {
      res.status(500).json({ error: "Failed to join faction" });
    }
  });

  // Leave faction (set to unaligned)
  app.post("/api/factions/leave", async (req, res) => {
    try {
      const { playerId } = req.body as { playerId?: string };
      if (!playerId) return res.status(400).json({ error: "playerId required" });

      const [playerRow] = await db
        .select({ id: playersTable.id, playerFactionId: playersTable.playerFactionId })
        .from(playersTable)
        .where(eq(playersTable.id, playerId));

      if (!playerRow) return res.status(404).json({ error: "Player not found" });

      await db
        .update(playersTable)
        .set({ playerFactionId: null, factionJoinedAt: null })
        .where(eq(playersTable.id, playerId));

      markDirty();
      res.json({ success: true, previousFaction: playerRow.playerFactionId ?? null });
    } catch (err) {
      res.status(500).json({ error: "Failed to leave faction" });
    }
  });

  // Get members for a specific faction
  app.get("/api/factions/:name/members", async (req, res) => {
    try {
      const factionName = decodeURIComponent(req.params.name);
      const def = FACTION_DEFINITIONS.find((f) => f.name === factionName);
      if (!def) return res.status(404).json({ error: "Faction not found" });

      const members = await db
        .select({
          id: playersTable.id,
          name: playersTable.name,
          factionJoinedAt: playersTable.factionJoinedAt,
          territoriesCaptured: playersTable.territoriesCaptured,
          attacksWon: playersTable.attacksWon,
        })
        .from(playersTable)
        .where(eq(playersTable.playerFactionId as any, factionName));

      res.json({
        factionName,
        members: members.map((m) => ({
          id: m.id,
          name: m.name,
          joinedAt: m.factionJoinedAt ? Number(m.factionJoinedAt) : null,
          territoriesCaptured: m.territoriesCaptured,
          attacksWon: m.attacksWon,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch faction members" });
    }
  });

  app.get("/api/game/leaderboard", async (req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
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

      // Idempotency (two-phase): claim a per-(player, action, target, nonce) key
      // BEFORE the upgrade so a double-submit/replay cannot double-spend ASCEND or
      // double-level the base; a duplicate REPLAYS the original 200, an in-flight
      // duplicate gets 409, a missing/malformed nonce 400 (fail closed). Target =
      // plot + upgrade type (parcelId escaped to avoid delimiter ambiguity).
      // playerId is auth-verified by the global mutation middleware.
      const scope = { playerId: action.playerId, action: "upgrade", target: `${encodeURIComponent(action.parcelId)}:${action.upgradeType}` };
      const nonce = action.idempotencyKey ?? req.header("x-idempotency-key");
      if (await guardClaimOrRespond(res, scope, nonce)) return;

      try {
        const parcel = await storage.upgradeBase(action);
        const body = { success: true, parcel };
        await actionIdempotencyGuard.record(scope, nonce, JSON.stringify(body));
        res.json(body);
        markDirty();
      } catch (mutErr) {
        await actionIdempotencyGuard.release(scope, nonce); // failed → allow retry
        throw mutErr;
      }
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

      // Idempotency (two-phase): claim a per-(player, action, target, nonce) key
      // BEFORE the build so a double-submit/replay cannot double-spend ASCEND or
      // build the same improvement twice; a duplicate REPLAYS the original 200, an
      // in-flight duplicate gets 409, a missing/malformed nonce 400 (fail closed).
      // Target = plot + improvement type (parcelId escaped to avoid delimiter
      // ambiguity). playerId is auth-verified (assertPlayerOwnership + global mw).
      const scope = { playerId: action.playerId, action: "build", target: `${encodeURIComponent(action.parcelId)}:${action.improvementType}` };
      const nonce = action.idempotencyKey ?? req.header("x-idempotency-key");
      if (await guardClaimOrRespond(res, scope, nonce)) return;

      try {
        const parcel = await storage.buildImprovement(action);
        const buildPlayer = await storage.getPlayer(action.playerId);
        if (buildPlayer) {
          const { FACILITY_INFO } = await import('@shared/schema');
          const info = FACILITY_INFO[action.improvementType as keyof typeof FACILITY_INFO];
          const built = parcel.improvements?.find((i: any) => i.type === action.improvementType);
          const level = built?.level ?? 1;
          const cost = info?.costAscend?.[level - 1] ?? 0;
          if (cost > 0) fireBurn(buildPlayer.address, cost, `Build improvement plotId=${parcel.plotId}`);
        }
        const body = { success: true, parcel };
        await actionIdempotencyGuard.record(scope, nonce, JSON.stringify(body));
        res.json(body);
        markDirty();
      } catch (mutErr) {
        await actionIdempotencyGuard.release(scope, nonce); // failed → allow retry
        throw mutErr;
      }
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

      // ── Replay protection ────────────────────────────────────────────────
      // The verification above is a stateless indexer read; claim the txid
      // atomically so the same payment can never buy a second plot.
      const paymentClaim = await paymentReplayGuard.claim(action.algoPaymentTxId, {
        purpose:  "plot_purchase",
        refId:    String(action.parcelId),
        playerId: action.playerId,
      });
      if (!paymentClaim.ok) {
        if (paymentClaim.reason === "already_redeemed") {
          console.warn(`[purchase] REPLAY DENIED txId=${action.algoPaymentTxId} parcelId=${action.parcelId} player=${action.playerId}`);
          return res.status(409).json({ error: "This payment transaction has already been redeemed." });
        }
        return res.status(503).json({ error: "Payment ledger unavailable — purchase refused. Your ALGO was not consumed; try again shortly." });
      }

      const buyerAddress = player.address;
      let parcel;
      try {
        parcel = await storage.purchaseLand(action);
      } catch (purchaseErr) {
        // The purchase did not happen — give the buyer their payment back
        // for a retry instead of leaving the txid burned.
        await paymentReplayGuard.release(action.algoPaymentTxId);
        throw purchaseErr;
      }
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
      const action = claimAscendActionSchema.parse(req.body);

      // Idempotency (two-phase): claim a per-(player, action, nonce) key BEFORE
      // crediting so a double-submit/replay cannot double-credit ASCEND or
      // double-enqueue the on-chain transfer; a duplicate REPLAYS the original
      // 200, an in-flight duplicate gets 409, a missing/malformed nonce 400 (fail
      // closed). Scoped by playerId (auth-verified upstream). Only a successful
      // credit is recorded for replay — every no-credit path releases the nonce so
      // it stays retryable.
      const scope = { playerId: action.playerId, action: "claim-frontier" };
      const nonce = action.idempotencyKey ?? req.header("x-idempotency-key");
      if (await guardClaimOrRespond(res, scope, nonce)) return;

      try {
        const player = await storage.getPlayer(action.playerId);
        if (!player) {
          await actionIdempotencyGuard.release(scope, nonce);
          return res.status(404).json({ error: "Player not found" });
        }

        const walletAddress = player.address;
        const isRealWallet =
          walletAddress &&
          walletAddress !== "PLAYER_WALLET" &&
          !walletAddress.startsWith("AI_");

        // Step 1: Check opt-in BEFORE crediting the DB balance.
        // We only gate on opt-in when the ASA ID is known; if it's null (race condition
        // on startup / re-mint), we proceed and let the queue handle it (SEV2 #6 fix).
        const asaId = getAscendAsaId();
        if (asaId && isRealWallet) {
          const optedIn = await isAddressOptedIn(walletAddress);
          if (!optedIn) {
            // No credit happened — release so the player can retry after opting in.
            await actionIdempotencyGuard.release(scope, nonce);
            return res.json({ success: false, reason: "wallet_not_opted_in" });
          }
        }

        // Step 2: Credit the DB balance.
        const result = await storage.claimAscend(action.playerId);

        // Step 3: Enqueue on-chain transfer (SEV2 #6 fix: no asaId guard — worker resolves
        // the id lazily at drain time so a null asaId at request time is not a silent drop).
        if (result.amount > 0 && isRealWallet) {
          enqueueAscendTransfer({
            recipientAddress:  walletAddress,
            recipientPlayerId: action.playerId,
            amount:            result.amount,
            reason:            "claim_ascend",
          }).catch((err) =>
            console.error("claim-frontier enqueue failed (in-game balance preserved):", err)
          );
        }

        const body = { success: true, claimed: result, asaId };
        await actionIdempotencyGuard.record(scope, nonce, JSON.stringify(body));
        res.json(body);
        markDirty();
      } catch (mutErr) {
        await actionIdempotencyGuard.release(scope, nonce); // failed → allow retry
        throw mutErr;
      }
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

      // ── ASCEND cost check ───────────────────────────────────────────────────
      // Commander minting is now ASCEND-based. ALGO is NOT charged at game level.
      // The minimal Algorand network fee for the NFT mint transaction is handled
      // automatically by the admin wallet during the post-response fire-and-forget.
      const { COMMANDER_INFO } = await import('@shared/schema');
      const ascendCost = COMMANDER_INFO[action.tier as keyof typeof COMMANDER_INFO]?.mintCostAscend ?? 0;

      if (ascendCost > 0 && isHumanPlayer) {
        const playerAscend = mintPlayer.ascend ?? 0;
        if (playerAscend < ascendCost) {
          return res.status(402).json({
            error: `Insufficient ASCEND. Required: ${ascendCost} ASCEND, you have: ${playerAscend.toFixed(2)} ASCEND.`,
            ascendRequired: ascendCost,
            ascendAvailable: playerAscend,
            currency: "ASCEND",
          });
        }
      }

      // ── Replay protection ──────────────────────────────────────────────────
      // Claim the payment txid atomically before mutating state — the same
      // payment must never mint a second commander (or anything else).
      if (isHumanPlayer && action.algoPaymentTxId) {
        const paymentClaim = await paymentReplayGuard.claim(action.algoPaymentTxId, {
          purpose:  "commander_mint",
          refId:    action.tier,
          playerId: action.playerId,
        });
        if (!paymentClaim.ok) {
          if (paymentClaim.reason === "already_redeemed") {
            console.warn(`[mint-avatar] REPLAY DENIED txId=${action.algoPaymentTxId} tier=${action.tier} player=${action.playerId}`);
            return res.status(409).json({ error: "This payment transaction has already been redeemed." });
          }
          return res.status(503).json({ error: "Payment ledger unavailable — mint refused. Your ALGO was not consumed; try again shortly." });
        }
      }

      // ── Mint in-game avatar ────────────────────────────────────────────────
      let avatar;
      try {
        avatar = await storage.mintAvatar(action);
      } catch (mintErr) {
        // The mint did not happen — release the claim so the buyer's payment
        // is not burned by a failed mint.
        if (isHumanPlayer && action.algoPaymentTxId) {
          await paymentReplayGuard.release(action.algoPaymentTxId);
        }
        throw mintErr;
      }

      // ── Deduct ASCEND cost via on-chain clawback (fire-and-forget) ─────────
      if (ascendCost > 0 && mintPlayer.address) {
        fireBurn(mintPlayer.address, ascendCost, `Commander mint tier=${action.tier}`);
      }

      res.json({
        success: true,
        avatar,
        ascendCost,
        currency: "ASCEND",
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

  // ── Weapon System ──────────────────────────────────────────────────────────
  // Per-weapon mint lock: the check-then-mint-then-record sequence below spans a
  // multi-second on-chain call, so concurrent mint requests for the same weapon
  // could each pass the nftAssetId guard and mint duplicate 1-of-1 ASAs (draining
  // admin ALGO). The server is single-process, so an in-process claim suffices.
  const weaponMintInFlight = new Set<string>();

  // Reap faded engagements so the runtime store can't grow unbounded if play goes
  // quiet (launch() also prunes opportunistically). unref() so it never holds the
  // process open (tests / graceful shutdown).
  setInterval(() => engagementStore.prune(), 30_000).unref();

  // Read a player's armory: full catalog annotated with unlock/own state + costs.
  app.get("/api/weapons/catalog", async (req, res) => {
    try {
      const queryId = typeof req.query.playerId === "string" ? req.query.playerId : undefined;
      const playerId = await assertPlayerOwnership(req, res, queryId);
      if (!playerId) return;
      const result = await weaponService.getCatalog(storage, playerId);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Catalog failed" });
    }
  });

  // Set the attribute build (validated against budget + tradeoff curve).
  app.post("/api/weapons/build", async (req, res) => {
    try {
      const playerId = await assertPlayerOwnership(req, res);
      if (!playerId) return;
      const action = buildWeaponProfileActionSchema.parse(req.body);
      const profile = await weaponService.buildProfile(storage, playerId, action.attributes);
      res.json({ success: true, profile });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Build failed" });
    }
  });

  // Acquire an unlocked weapon into the armory (spends ASCEND).
  app.post("/api/weapons/unlock", async (req, res) => {
    try {
      const playerId = await assertPlayerOwnership(req, res);
      if (!playerId) return;
      const action = unlockWeaponActionSchema.parse(req.body);
      const profile = await weaponService.unlockWeapon(storage, playerId, action.specId);
      res.json({ success: true, profile });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Unlock failed" });
    }
  });

  // Set the equipped loadout (the active "sub-shots").
  app.post("/api/weapons/loadout", async (req, res) => {
    try {
      const playerId = await assertPlayerOwnership(req, res);
      if (!playerId) return;
      const action = setLoadoutActionSchema.parse(req.body);
      const profile = await weaponService.setLoadout(storage, playerId, action.loadout);
      res.json({ success: true, profile });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Loadout failed" });
    }
  });

  // Fire a weapon at a target parcel: spends ASCEND, creates a runtime engagement
  // (with layered interception resolved), and streams it to the live globe.
  app.post("/api/weapons/fire", async (req, res) => {
    try {
      const playerId = await assertPlayerOwnership(req, res);
      if (!playerId) return;
      const action = fireWeaponActionSchema.parse(req.body);
      const engagement = await weaponService.fireWeapon(storage, engagementStore, {
        playerId,
        specId: action.specId,
        sourceParcelId: action.sourceParcelId,
        targetParcelId: action.targetParcelId,
      });
      res.json({ success: true, engagement });
      // Post-response side effects must never re-enter the error path (would try
      // to set headers on an already-sent response).
      try {
        broadcastRaw({ type: "weapon_engagement", payload: engagement });
        markDirty();
      } catch { /* broadcast best-effort */ }
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Fire failed" });
    }
  });

  // Deploy a defensive battery onto an owned parcel (spends ASCEND).
  app.post("/api/weapons/deploy-defense", async (req, res) => {
    try {
      const playerId = await assertPlayerOwnership(req, res);
      if (!playerId) return;
      const action = deployDefenseActionSchema.parse(req.body);
      const battery = await weaponService.deployDefense(storage, engagementStore, {
        playerId,
        specId: action.specId,
        parcelId: action.parcelId,
      });
      // NOTE: intentionally NOT broadcast — a deployed battery is concealed intel
      // (position / type / ammo). Other players only learn of it when it actually
      // intercepts, which is revealed via the weapon_engagement event. Broadcasting
      // it here would bypass the game's fog-of-war / EPI model (see stateScope.ts).
      res.json({ success: true, battery });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Deploy failed" });
    }
  });

  // Upgrade an owned weapon instance one tier (spends ASCEND).
  app.post("/api/weapons/upgrade", async (req, res) => {
    try {
      const playerId = await assertPlayerOwnership(req, res);
      if (!playerId) return;
      const action = upgradeWeaponActionSchema.parse(req.body);
      const profile = await weaponService.upgradeWeapon(storage, playerId, action.ownedWeaponId);
      res.json({ success: true, profile });
      markDirty();
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Upgrade failed" });
    }
  });

  // Mint an owned weapon as a 1-of-1 Algorand NFT (custody model, mirrors commander).
  app.post("/api/weapons/mint-nft", async (req, res) => {
    try {
      const playerId = await assertPlayerOwnership(req, res);
      if (!playerId) return;
      const action = mintWeaponNftActionSchema.parse(req.body);

      const profile = await storage.getWeaponProfile(playerId);
      const owned = profile.ownedWeapons.find((w) => w.id === action.ownedWeaponId);
      if (!owned) return res.status(404).json({ error: "Weapon not in your armory" });
      if (owned.nftAssetId) return res.status(409).json({ error: "Weapon already minted", assetId: owned.nftAssetId });

      const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
      if (!baseUrl) return res.status(503).json({ error: "PUBLIC_BASE_URL not configured — cannot mint" });

      // Claim the weapon for minting; reject concurrent duplicate requests.
      if (weaponMintInFlight.has(owned.id)) {
        return res.status(409).json({ error: "Mint already in progress for this weapon" });
      }
      weaponMintInFlight.add(owned.id);
      try {
        const mint = await mintWeaponNft({
          ownedWeaponId: owned.id,
          specId: owned.specId,
          receiverAddress: action.receiverAddress,
          metadataBaseUrl: baseUrl,
        });
        await weaponService.recordWeaponNft(storage, playerId, owned.id, mint.assetId);
        const delivery = await attemptWeaponDelivery(mint.assetId, action.receiverAddress, owned.id);
        res.json({ success: true, assetId: mint.assetId, createTxId: mint.createTxId, delivered: delivery.delivered, reason: delivery.reason });
        markDirty();
      } finally {
        weaponMintInFlight.delete(owned.id);
      }
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid request data" });
      res.status(400).json({ error: error instanceof Error ? error.message : "Mint failed" });
    }
  });

  // ARC-3 metadata for a minted Weapon NFT.
  app.get("/nft/metadata/weapon/:ownedWeaponId", async (req, res) => {
    const { ownedWeaponId } = req.params;
    if (!ownedWeaponId || ownedWeaponId.length < 8) {
      return res.status(400).json({ error: "Invalid ownedWeaponId" });
    }
    if (!db) return res.status(503).json({ error: "Database not available" });
    try {
      const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
      if (!baseUrl) return res.status(503).json({ error: "PUBLIC_BASE_URL not configured" });

      const players = await db
        .select({ weaponProfile: playersTable.weaponProfile })
        .from(playersTable);
      let owned: any = null;
      for (const p of players) {
        const wp = p.weaponProfile as any;
        const found = wp?.ownedWeapons?.find((w: any) => w.id === ownedWeaponId);
        if (found) { owned = found; break; }
      }
      if (!owned) return res.status(404).json({ error: "Weapon not found" });

      const spec = getWeaponSpec(owned.specId);
      if (!spec) return res.status(404).json({ error: "Weapon spec not found" });

      const displayId = owned.nftAssetId ?? owned.id.slice(0, 8);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.json({
        name: `Frontier ${spec.name} #${displayId}`,
        description: `${spec.name} — a tier-${spec.tier} ${spec.category.replace(/_/g, " ")} weapon (ref: ${spec.realWorldRef}).`,
        image: `${baseUrl}/images/weapons/${spec.category}.png`,
        external_url: `${baseUrl}/weapon/${owned.nftAssetId ?? owned.id}`,
        properties: {
          nftId: owned.nftAssetId ?? null,
          ownedWeaponId: owned.id,
          specId: spec.id,
          category: spec.category,
          tier: spec.tier,
          upgradeTier: owned.upgradeTier,
          rangeKm: spec.rangeKm,
          damage: spec.damage,
          realWorldRef: spec.realWorldRef,
          version: 1,
        },
      });
    } catch (error) {
      console.error("[/nft/metadata/weapon] error:", error);
      res.status(500).json({ error: "Failed to fetch Weapon NFT metadata" });
    }
  });

  app.post("/api/actions/deploy-drone", async (req, res) => {
    try {
      const action = deployDroneActionSchema.parse(req.body);
      const drone = await storage.deployDrone(action);
      const dronePlayer = await storage.getPlayer(action.playerId);
      if (dronePlayer) {
        const { DRONE_MINT_COST_ASCEND } = await import('@shared/schema');
        fireBurn(dronePlayer.address, DRONE_MINT_COST_ASCEND, `Drone deploy`);
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
        const { SATELLITE_DEPLOY_COST_ASCEND } = await import('@shared/schema');
        fireBurn(satPlayer.address, SATELLITE_DEPLOY_COST_ASCEND, `Satellite deploy`);
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
  app.get("/api/parcels/attackable", async (req, res) => {
    try {
      const { session } = req as any;
      const playerId = (session?.playerId as string) ?? "";
      const biomeFilter = req.query.biome as string | undefined;

      const rows = await withDbRetry(
        () =>
          db
            .select({
              id:             parcelsTable.id,
              plotId:         parcelsTable.plotId,
              biome:          parcelsTable.biome,
              ownerId:        parcelsTable.ownerId,
              defenseLevel:   parcelsTable.defenseLevel,
              lat:            parcelsTable.lat,
              lng:            parcelsTable.lng,
              ironStored:     parcelsTable.ironStored,
              fuelStored:     parcelsTable.fuelStored,
              crystalStored:  parcelsTable.crystalStored,
              activeBattleId: parcelsTable.activeBattleId,
            })
            .from(parcelsTable)
            .where(
              sql`
                ${parcelsTable.ownerId} IS NOT NULL
                AND ${parcelsTable.ownerId} != ${playerId}
                AND ${parcelsTable.activeBattleId} IS NULL
                ${biomeFilter ? sql`AND ${parcelsTable.biome} = ${biomeFilter}` : sql``}
              `
            )
            .orderBy(
              sql`(${parcelsTable.ironStored} + ${parcelsTable.fuelStored} + ${parcelsTable.crystalStored}) DESC`
            )
            .limit(50),
        "getAttackableParcels"
      );

      res.json({ parcels: rows });
    } catch (err) {
      console.error("[/api/parcels/attackable]", err);
      res.status(500).json({ error: "Failed to fetch attackable parcels" });
    }
  });

  // ── Admin key guard (used for internal/admin endpoints) ───────────────────
  // NOTE: requireAdminKey is now imported from ./security — it fails CLOSED in
  // production (a missing ADMIN_KEY no longer grants access) and only accepts
  // the key via the x-admin-key header in prod (never the query string, which
  // would be captured by access logs).

  app.post("/api/game/resolve-battles", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const resolved = await storage.resolveBattles();
      res.json({ success: true, resolved });
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve battles" });
    }
  });

  app.post("/api/game/ai-turn", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const events = await storage.runAITurn();
      res.json({ success: true, events });
    } catch (error) {
      res.status(500).json({ error: "Failed to run AI turn" });
    }
  });

  // ── Testnet Reset ─────────────────────────────────────────────────────────
  // Wipe all game data and re-seed from scratch. Testnet only.
  app.post("/api/game/reset", async (_req, res) => {
    if (!requireAdminKey(_req, res)) return;
    try {
      console.log("[RESET] Wiping game data for testnet reset…");
      // Clear all tables in dependency order
      await db.delete(subParcelsTable);
      await db.delete(tradeOrdersTable);
      await db.delete(orbitalEventsTable);
      await db.delete(gameEventsTable);
      await db.delete(battlesTable);
      await db.delete(plotNftsTable);
      await db.delete(mintIdempotencyTable);
      await db.delete(parcelsTable);
      await db.delete(playersTable);
      // Reset game_meta so seeder runs on next init
      await db.update(gameMeta).set({ initialized: false, currentTurn: 1, lastUpdateTs: 0 }).where(eq(gameMeta.id, 1));
      console.log("[RESET] All tables cleared. Re-seeding…");

      // Reset the storage init state and re-seed
      storage.resetInitState();
      await storage.initialize();

      // Broadcast fresh state
      const freshState = await storage.getGameState();
      broadcastGameState(freshState);

      console.log("[RESET] Testnet reset complete.");
      res.json({ success: true, message: "Game reset and re-seeded successfully", totalParcels: freshState.parcels.length });
    } catch (error) {
      console.error("[RESET] Error:", error);
      res.status(500).json({ error: "Failed to reset game" });
    }
  });

  // ── Orbital Event Engine API ──────────────────────────────────────────────

  /** GET /api/orbital/active — return all live gameplay-affecting impact events */
  app.get("/api/orbital/active", async (_req, res) => {
    try {
      const events = await storage.getActiveOrbitalEvents();
      res.json({ events });
    } catch (error) {
      console.error("[ORBITAL-DEBUG] getActiveOrbitalEvents error:", error);
      res.status(500).json({ error: "Failed to fetch orbital events" });
    }
  });

  /** POST /api/orbital/trigger — server rolls for an impact event (called by interval) */
  app.post("/api/orbital/trigger", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const event = await storage.triggerOrbitalCheck();
      if (event) {
        console.log(`[ORBITAL-DEBUG] POST /api/orbital/trigger | NEW IMPACT | id: ${event.id} | type: ${event.type}`);
      }
      res.json({ event: event ?? null });
    } catch (error) {
      console.error("[ORBITAL-DEBUG] triggerOrbitalCheck error:", error);
      res.status(500).json({ error: "Failed to trigger orbital check" });
    }
  });

  /** POST /api/orbital/resolve/:id — mark an impact event resolved + apply effects */
  app.post("/api/orbital/resolve/:id", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      await storage.resolveOrbitalEvent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("[ORBITAL-DEBUG] resolveOrbitalEvent error:", error);
      res.status(500).json({ error: "Failed to resolve orbital event" });
    }
  });

  // World Intel API endpoints
  app.get("/api/world/events", async (req, res) => {
    try {
      const { start, end, types, limit } = req.query;
      const filters: import("@shared/worldEvents").WorldEventFilters = {};
      if (start)  filters.start  = Number(start);
      if (end)    filters.end    = Number(end);
      // Always clamp — an unbounded `limit` lets a caller dump the entire event
      // log in one request (off-chain activity-intelligence scrape).
      filters.limit = clampLimit(limit, 100, 200);
      if (types)  filters.types  = String(types).split(",") as import("@shared/worldEvents").WorldEventType[];
      res.json(listWorldEvents(filters));
    } catch { res.status(500).json({ error: "Failed to fetch world events" }); }
  });

  app.get("/api/world/events/recent", (_req, res) => {
    try { res.json(getRecentWorldEvents()); }
    catch { res.status(500).json({ error: "Failed to fetch recent events" }); }
  });

  // Battle replay — returns the stored replay record for a resolved battle.
  // Available for 24 hours after resolution. Returns 404 after expiry.
  app.get("/api/battle/replay/:battleId", async (req, res) => {
    try {
      const { battleId } = req.params;
      if (!battleId || typeof battleId !== "string") {
        return res.status(400).json({ error: "battleId is required" });
      }
      const replay = await getBattleReplay(battleId);
      if (!replay) {
        return res.status(404).json({
          error: "Replay not available",
          reason: "Battle replay expires after 24 hours or Redis is not configured"
        });
      }
      res.json(replay);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch battle replay" });
    }
  });


  // Staggered background tasks — avoids hammering Neon with simultaneous queries
  setInterval(async () => {
    try {
      const resolved = await withDbRetry(() => storage.resolveBattles(), "resolveBattles");
      if (resolved.length > 0) {
        for (const battle of resolved) {
          try {
            const parcel = await storage.getParcel(battle.targetParcelId);
            if (parcel) {
              const resolvedAttacker = await storage.getPlayer(battle.attackerId).catch(() => undefined);
              const [defenderRow] = battle.defenderId
                ? await db.select({ name: playersTable.name }).from(playersTable).where(eq(playersTable.id, battle.defenderId))
                : [undefined];

              const nowTs = Date.now();
              appendWorldEvent({
                type: "battle_resolved",
                timestamp: nowTs,
                lat: parcel.lat,
                lng: parcel.lng,
                plotId: parcel.plotId,
                playerId: battle.attackerId,
                severity: battle.outcome === "attacker_wins" ? "high" : "medium",
                metadata: {
                  battleId: battle.id,
                  outcome: battle.outcome,
                  attacker: resolvedAttacker?.name ?? "Unknown",
                }
              });

              // ── Rich WS broadcast so clients can render a live outcome card ──
              broadcastRaw({
                type:          "battle:resolved",
                battleId:      battle.id,
                outcome:       battle.outcome,
                plotId:        parcel.plotId,
                lat:           parcel.lat,
                lng:           parcel.lng,
                biome:         parcel.biome,
                attackerName:  resolvedAttacker?.name ?? "Unknown",
                defenderName:  defenderRow?.name ?? "Unclaimed",
                attackerPower: Math.round(battle.attackerPower ?? 0),
                defenderPower: Math.round(battle.defenderPower ?? 0),
                randFactor:    battle.randFactor ?? 0,
                timestamp:     nowTs,
              });
            }
          } catch { /* non-critical */ }
        }
        markDirty();
      }

      // ── Clear expired EMP / Sabotage debuffs ─────────────────────────────
      try {
        const nowDebuff = Date.now();
        await db.update(parcelsTable)
          .set({ defenseLevel: sql`LEAST(${parcelsTable.defenseLevel} + 2, 10)`, empDebuffUntil: null } as any)
          .where(sql`${parcelsTable.empDebuffUntil} IS NOT NULL AND ${parcelsTable.empDebuffUntil} < ${nowDebuff}`);
        await db.update(parcelsTable)
          .set({ yieldMultiplier: sql`LEAST(${parcelsTable.yieldMultiplier} * 2, 2.0)`, sabotageDebuffUntil: null } as any)
          .where(sql`${parcelsTable.sabotageDebuffUntil} IS NOT NULL AND ${parcelsTable.sabotageDebuffUntil} < ${nowDebuff}`);
      } catch { /* non-critical */ }
    } catch (error) {
      console.warn("Background task (battles):", error instanceof Error ? error.message : error);
    }
  }, 15000);

  setInterval(async () => {
    try {
      if (process.env.AI_ENABLED === "true") {
        const aiEvents = await withDbRetry(() => storage.runAITurn(), "runAITurn");
        if (aiEvents && aiEvents.length > 0) markDirty();
      }
    } catch (error) {
      console.warn("Background task (AI):", error instanceof Error ? error.message : error);
    }
  }, 20000);

  // Orbital check every 5 minutes
  setInterval(async () => {
    try {
      const event = await withDbRetry(() => storage.triggerOrbitalCheck(), "triggerOrbitalCheck");
      if (event) {
        console.log(`[ORBITAL] new impact id=${event.id} type=${event.type}`);
        markDirty();
      }
    } catch (error) {
      console.warn("[ORBITAL] background check:", error instanceof Error ? error.message : error);
    }
  }, 5 * 60 * 1000);

  // ── Trade Station ────────────────────────────────────────────────────────────

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

  // Background resolver (every 60s): close expired markets, then DERIVE outcomes for
  // any market whose deterministic resolution condition is now met. No human in the loop.
  setInterval(async () => {
    try {
      await withDbRetry(() => storage.resolveExpiredMarkets(), "resolveExpiredMarkets");
    } catch (err) {
      console.warn("[markets] resolveExpiredMarkets:", err instanceof Error ? err.message : err);
    }
    try {
      await withDbRetry(() => storage.resolveReadyMarkets(), "resolveReadyMarkets");
    } catch (err) {
      console.warn("[markets] resolveReadyMarkets:", err instanceof Error ? err.message : err);
    }
  }, 60_000);

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

  // Public verification: anyone can fetch how a market resolved and re-run the
  // computation themselves. Before resolution it returns the immutable source so
  // players can see up front exactly what the market resolves from.
  app.get("/api/markets/:id/proof", async (req, res) => {
    try {
      const market = await withDbRetry(() => storage.getMarket(req.params.id), "getMarket");
      if (!market) return res.status(404).json({ error: "Market not found" });
      res.json({
        marketId: market.id,
        resolutionSource: market.resolutionSource,   // what it resolves from (immutable)
        resolutionCutoffTs: market.resolutionCutoffTs,
        status: market.status,
        resolved: market.status === "resolved",
        outcome: market.winningOutcome,
        resolvedInputs: market.resolvedInputs,        // exact public facts read
        resolutionHash: market.resolutionHash,        // sha256 they can recompute
        resolvedAt: market.resolvedAt,
      });
    } catch (err) {
      console.error("[markets] proof error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin-only routes
  app.post("/api/admin/markets", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const parsed = createMarketSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const market = await withDbRetry(() => storage.createMarket(parsed.data, "admin"), "createMarket");
      res.json(market);
    } catch (err) {
      console.error("[markets] createMarket error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Trigger-only resolution. There is NO winningOutcome parameter — the outcome is
  // always DERIVED from the market's immutable source. Admin can nudge the timer but
  // cannot choose a winner. Returns "Not yet resolvable" until the fact is knowable.
  app.post("/api/admin/markets/:id/resolve", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const result = await withDbRetry(() => storage.resolveMarketTrustlessly(req.params.id), "resolveMarketTrustlessly");
      if ("error" in result) return res.status(400).json({ error: result.error });
      res.json(result);
    } catch (err) {
      console.error("[markets] resolveMarketTrustlessly error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/mint-status/:plotId", async (req, res) => {
    if (!requireAdminKey(req, res)) return;

    const plotId = parseInt(req.params.plotId, 10);
    if (isNaN(plotId)) {
      return res.status(400).json({ error: "Invalid plotId" });
    }

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    try {
      const [nftRecord] = await db
        .select()
        .from(plotNftsTable)
        .where(eq(plotNftsTable.plotId, plotId));

      const idmpKey = `mint-plot-${plotId}`;
      const [idempotencyKey] = await db
        .select()
        .from(mintIdempotencyTable)
        .where(eq(mintIdempotencyTable.key, idmpKey));

      if (!nftRecord && !idempotencyKey) {
        return res.status(404).json({ error: "No mint record found for this plot" });
      }

      res.json({
        plotId,
        nftRecord: nftRecord || null,
        idempotencyKey: idempotencyKey || null,
      });
    } catch (error) {
      console.error(`[admin] mint-status error plotId=${plotId}`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Sub-Parcel Endpoints ───────────────────────────────────────────────────

  /** GET /api/plots/:plotId/sub-parcels — list sub-parcels for a macro-plot */
  app.get("/api/plots/:plotId/sub-parcels", async (req, res) => {
    const plotId = parseInt(req.params.plotId);
    if (!plotId || isNaN(plotId)) return res.status(400).json({ error: "Invalid plotId" });
    try {
      const subParcels = await storage.getSubParcels(plotId);
      res.json({ plotId, subParcels, isSubdivided: subParcels.length > 0 });
    } catch (err) {
      console.error("[sub-parcels] getSubParcels error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/plots/:plotId/subdivide — subdivide a macro-plot into 9 sub-parcels */
  app.post("/api/plots/:plotId/subdivide", async (req, res) => {
    const plotId = parseInt(req.params.plotId);
    const { playerId } = req.body;
    if (!plotId || isNaN(plotId)) return res.status(400).json({ error: "Invalid plotId" });
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    try {
      const result = await storage.subdivideParcel(plotId, playerId);
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();
      res.json({ success: true, subParcels: result.subParcels });
    } catch (err) {
      console.error("[sub-parcels] subdivideParcel error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/plots/:plotId/terraform — apply a terraform action to an owned plot */
  app.post("/api/plots/:plotId/terraform", async (req, res) => {
    const plotId = parseInt(req.params.plotId);
    if (!plotId || isNaN(plotId)) return res.status(400).json({ error: "Invalid plotId" });
    const parsed = terraformActionSchema.safeParse({ ...req.body, plotId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    try {
      const result = await storage.terraformParcel(plotId, parsed.data.playerId, parsed.data.action);
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();
      res.json({ success: true, parcel: result.parcel });
    } catch (err) {
      console.error("[terraform] error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/plots/:plotId/terraform-advice?goal=defense|yield|balanced
   * Read-only terraforming recommendation for a plot. Uses the deterministic
   * heuristic by default; upgrades to a Claude recommendation when
   * ANTHROPIC_API_KEY is configured (falls back to the heuristic on any error).
   */
  app.get("/api/plots/:plotId/terraform-advice", adviceLimiter, async (req, res) => {
    const plotId = parseInt(String(req.params.plotId), 10);
    if (!plotId || isNaN(plotId)) return res.status(400).json({ error: "Invalid plotId" });
    const goalParam = String(req.query.goal ?? "balanced");
    const goal: TerraformGoal = (["defense", "yield", "balanced"].includes(goalParam) ? goalParam : "balanced") as TerraformGoal;
    if (!db) return res.status(503).json({ error: "Database not available" });
    try {
      const [parcel] = await db
        .select({
          biome:           parcelsTable.biome,
          stability:       parcelsTable.stability,
          hazardLevel:     parcelsTable.hazardLevel,
          yieldMultiplier: parcelsTable.yieldMultiplier,
        })
        .from(parcelsTable)
        .where(eq(parcelsTable.plotId, plotId))
        .limit(1);
      if (!parcel) return res.status(404).json({ error: "Plot not found" });

      const advice = await recommendTerraform({
        biome:           parcel.biome as import("@shared/schema").BiomeType,
        stability:       parcel.stability ?? 100,
        hazardLevel:     parcel.hazardLevel ?? 0,
        yieldMultiplier: parcel.yieldMultiplier ?? 1,
        goal,
      });
      res.json(advice);
    } catch (err) {
      console.error("[terraform-advice] error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/sub-parcels/:subParcelId/purchase — buy an unowned sub-parcel */
  app.post("/api/sub-parcels/:subParcelId/purchase", async (req, res) => {
    const { subParcelId } = req.params;
    const { playerId } = req.body;
    if (!subParcelId) return res.status(400).json({ error: "Invalid subParcelId" });
    if (!playerId)    return res.status(400).json({ error: "playerId required" });
    try {
      const result = await storage.purchaseSubParcel(subParcelId, playerId);
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();

      const sp = result.subParcel;
      // Broadcast real-time label update to all connected clients
      broadcastRaw({
        type:        "sub_parcel_purchased",
        subParcelId: sp.id,
        parentPlotId: sp.parentPlotId,
        subIndex:    sp.subIndex,
        ownerId:     playerId,
      });

      // Persist to Upstash world event stream (fire-and-forget)
      storage.getParcelBiomeByPlotId(sp.parentPlotId).then(biome => {
        recordSubParcelWorldEvent({
          type:     "sub_parcel_purchased",
          plotId:   sp.parentPlotId,
          subIndex: sp.subIndex,
          biome,
          playerId,
          price:    sp.purchasePriceAscend,
        }).catch(() => {});
      }).catch(() => {});

      res.json({ success: true, subParcel: sp });
    } catch (err) {
      console.error("[sub-parcels] purchaseSubParcel error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/sub-parcels/:subParcelId/build — build or upgrade an improvement on an owned sub-parcel */
  app.post("/api/sub-parcels/:subParcelId/build", async (req, res) => {
    const { subParcelId } = req.params;
    const { playerId, improvementType } = req.body;
    if (!subParcelId)     return res.status(400).json({ error: "Invalid subParcelId" });
    if (!playerId)        return res.status(400).json({ error: "playerId required" });
    if (!improvementType) return res.status(400).json({ error: "improvementType required" });
    try {
      const result = await storage.buildSubParcelImprovement(subParcelId, playerId, improvementType);
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();

      const sp = result.subParcel;
      const imp = sp.improvements?.find(i => i.type === improvementType);
      const newLevel = imp?.level ?? 1;

      // Broadcast real-time label update to all connected clients
      broadcastRaw({
        type:           "sub_parcel_upgraded",
        subParcelId:    sp.id,
        parentPlotId:   sp.parentPlotId,
        subIndex:       sp.subIndex,
        improvementType,
        level:          newLevel,
        ownerId:        playerId,
      });

      // Persist to Upstash world event stream (fire-and-forget)
      storage.getParcelBiomeByPlotId(sp.parentPlotId).then(biome => {
        recordSubParcelWorldEvent({
          type:           "sub_parcel_upgraded",
          plotId:         sp.parentPlotId,
          subIndex:       sp.subIndex,
          biome,
          playerId,
          improvementType,
          level:          newLevel,
        }).catch(() => {});
        recordUpgradeOnChain({
          plotId:         sp.parentPlotId,
          subIndex:       sp.subIndex,
          biome,
          improvementType,
          level:          newLevel,
          playerId,
        }).catch(() => {});
      }).catch(() => {});

      res.json({ success: true, subParcel: sp });
    } catch (err) {
      console.error("[sub-parcels] buildSubParcelImprovement error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Sub-Parcel Archetype Assignment ───────────────────────────────────────

  /** POST /api/sub-parcels/:subParcelId/archetype — assign a strategic archetype */
  app.post("/api/sub-parcels/:subParcelId/archetype", async (req, res) => {
    const { subParcelId } = req.params;
    const { playerId, archetype, archetypeLevel = 1, energyAlignment } = req.body;
    if (!subParcelId) return res.status(400).json({ error: "subParcelId required" });
    if (!playerId)    return res.status(400).json({ error: "playerId required" });
    if (!archetype)   return res.status(400).json({ error: "archetype required" });
    try {
      const result = await storage.assignSubParcelArchetype(
        subParcelId, playerId, archetype, archetypeLevel, energyAlignment
      );
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();

      const sp = result.subParcel;

      broadcastRaw({
        type:            "sub_parcel_archetype_set",
        subParcelId:     sp.id,
        parentPlotId:    sp.parentPlotId,
        subIndex:        sp.subIndex,
        archetype:       sp.archetype,
        archetypeLevel:  sp.archetypeLevel,
        energyAlignment: sp.energyAlignment,
        ownerId:         playerId,
        factionBonus:    result.factionBonus,
      });

      storage.getParcelBiomeByPlotId(sp.parentPlotId).then(biome => {
        recordArchetypeWorldEvent({
          plotId:          sp.parentPlotId,
          subIndex:        sp.subIndex,
          biome,
          archetype:       sp.archetype!,
          archetypeLevel:  sp.archetypeLevel,
          energyAlignment: sp.energyAlignment ?? undefined,
          playerId,
          factionBonus:    result.factionBonus,
        }).catch(() => {});
      }).catch(() => {});

      res.json({ success: true, subParcel: sp, factionBonus: result.factionBonus });
    } catch (err) {
      console.error("[sub-parcels] assignSubParcelArchetype error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Sub-Parcel Battle ──────────────────────────────────────────────────────

  /** POST /api/sub-parcels/:subParcelId/attack — immediate sub-parcel battle */
  app.post("/api/sub-parcels/:subParcelId/attack", async (req, res) => {
    const { subParcelId } = req.params;
    const { attackerParcelId, commanderId, troops, iron, fuel, crystal, attackerId } = req.body;
    if (!subParcelId)     return res.status(400).json({ error: "subParcelId required" });
    if (!attackerId)      return res.status(400).json({ error: "attackerId required" });
    if (!attackerParcelId) return res.status(400).json({ error: "attackerParcelId required" });
    try {
      const result = await storage.attackSubParcel(subParcelId, attackerId, {
        attackerParcelId,
        commanderId: commanderId ?? undefined,
        troops: Math.max(1, parseInt(troops ?? "1") || 1),
        iron:    Math.max(0, parseInt(iron ?? "0") || 0),
        fuel:    Math.max(0, parseInt(fuel ?? "0") || 0),
        crystal: Math.max(0, parseInt(crystal ?? "0") || 0),
      });
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();
      if (result.outcome === "attacker_wins") {
        const sp = await storage.getSubParcel(subParcelId);
        broadcastRaw({ type: "sub_parcel_battle_resolved", subParcelId, outcome: result.outcome, newOwnerId: attackerId });
        // World event with real biome
        if (sp) {
          storage.getParcelBiomeByPlotId(sp.parentPlotId).then(biome => {
            recordSubParcelWorldEvent({ type: "sub_parcel_purchased", plotId: sp.parentPlotId, subIndex: sp.subIndex, biome, playerId: attackerId }).catch(() => {});
          }).catch(() => {});
        }
      }
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("[sub-parcels] attackSubParcel error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Sub-Parcel Listings ────────────────────────────────────────────────────

  /** GET /api/sub-parcels/listings — all open listings */
  app.get("/api/sub-parcels/listings", async (_req, res) => {
    try {
      const listings = await storage.getOpenSubParcelListings();
      res.json({ listings });
    } catch (err) {
      console.error("[listings] getOpenSubParcelListings error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/sub-parcels/listings — create a listing */
  app.post("/api/sub-parcels/listings", async (req, res) => {
    const { sellerId, subParcelId, askPriceAscend } = req.body;
    if (!sellerId)         return res.status(400).json({ error: "sellerId required" });
    if (!subParcelId)      return res.status(400).json({ error: "subParcelId required" });
    if (!askPriceAscend) return res.status(400).json({ error: "askPriceAscend required" });
    try {
      const result = await storage.createSubParcelListing(sellerId, subParcelId, Number(askPriceAscend));
      if (result.error) return res.status(400).json({ error: result.error });
      broadcastRaw({ type: "sub_parcel_listed", listing: result.listing });
      res.json({ success: true, listing: result.listing });
    } catch (err) {
      console.error("[listings] createSubParcelListing error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** DELETE /api/sub-parcels/listings/:id — cancel a listing */
  app.delete("/api/sub-parcels/listings/:id", async (req, res) => {
    const { id } = req.params;
    const { sellerId } = req.body;
    if (!sellerId) return res.status(400).json({ error: "sellerId required" });
    try {
      const result = await storage.cancelSubParcelListing(sellerId, id);
      if (result.error) return res.status(400).json({ error: result.error });
      broadcastRaw({ type: "sub_parcel_listing_cancelled", listingId: id });
      res.json({ success: true });
    } catch (err) {
      console.error("[listings] cancelSubParcelListing error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/sub-parcels/listings/:id/buy — purchase a listed sub-parcel */
  app.post("/api/sub-parcels/listings/:id/buy", async (req, res) => {
    const { id } = req.params;
    const { buyerId } = req.body;
    if (!buyerId) return res.status(400).json({ error: "buyerId required" });
    try {
      const result = await storage.buySubParcelListing(buyerId, id);
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();
      broadcastRaw({ type: "sub_parcel_sold", listing: result.listing });
      res.json({ success: true, listing: result.listing });
    } catch (err) {
      console.error("[listings] buySubParcelListing error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Season Endpoints ───────────────────────────────────────────────────────

  /** GET /api/season/current — get the active season info */
  app.get("/api/season/current", async (_req, res) => {
    try {
      const season = await storage.getCurrentSeason();
      res.json({ season });
    } catch (err) {
      console.error("[season] getCurrentSeason error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /api/season/history — get all past seasons */
  app.get("/api/season/history", async (_req, res) => {
    try {
      const seasons = await storage.getSeasonHistory();
      res.json({ seasons });
    } catch (err) {
      console.error("[season] getSeasonHistory error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /api/battles/history — paginated battle log with optional filters */
  app.get("/api/battles/history", async (req, res) => {
    try {
      const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit  ?? "20"), 10)));
      const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"),  10));
      const outcome = req.query.outcome as string | undefined;
      const player  = req.query.player  as string | undefined;

      // Fetch resolved battles from DB, newest first
      const allResolved = await db.select()
        .from(battlesTable)
        .where(eq(battlesTable.status, "resolved"))
        .orderBy(desc(battlesTable.resolveTs));

      // Pre-load player names for lookup
      const playerIds = new Set<string>();
      for (const b of allResolved) {
        playerIds.add(b.attackerId);
        if (b.defenderId) playerIds.add(b.defenderId);
      }
      const playerRows = playerIds.size > 0
        ? await db.select({ id: playersTable.id, name: playersTable.name })
            .from(playersTable)
            .where(sql`${playersTable.id} = ANY(ARRAY[${sql.raw([...playerIds].map(id => `'${id}'`).join(","))}]::text[])`)
        : [];
      const nameById = new Map(playerRows.map(p => [p.id, p.name]));

      // Pre-load parcel plotIds
      const parcelIds = [...new Set(allResolved.map(b => b.targetParcelId))];
      const parcelRows = parcelIds.length > 0
        ? await db.select({ id: parcelsTable.id, plotId: parcelsTable.plotId, biome: parcelsTable.biome })
            .from(parcelsTable)
            .where(sql`${parcelsTable.id} = ANY(ARRAY[${sql.raw(parcelIds.map(id => `'${id}'`).join(","))}]::text[])`)
        : [];
      const parcelById = new Map(parcelRows.map(p => [p.id, p]));

      // Build enriched records and apply filters
      let records = allResolved.map(b => {
        const attackerName = nameById.get(b.attackerId) ?? "Unknown";
        const defenderName = b.defenderId ? (nameById.get(b.defenderId) ?? "Unclaimed") : "Unclaimed";
        const parcel       = parcelById.get(b.targetParcelId);
        return {
          id:            b.id,
          attackerName,
          defenderName,
          plotId:        parcel?.plotId ?? 0,
          biome:         parcel?.biome  ?? "plains",
          outcome:       b.outcome,
          attackerPower: b.attackerPower,
          defenderPower: b.defenderPower,
          randFactor:    b.randFactor   ?? 0,
          pillagedIron:  0,
          pillagedFuel:  0,
          pillagedCrystal: 0,
          resolvedAt:    b.resolveTs,
          startTs:       b.startTs,
          resolveTs:     b.resolveTs,
        };
      });

      if (outcome) records = records.filter(r => r.outcome === outcome);
      if (player)  records = records.filter(r =>
        r.attackerName.toLowerCase().includes(player.toLowerCase()) ||
        r.defenderName.toLowerCase().includes(player.toLowerCase())
      );

      const total   = records.length;
      const paged   = records.slice(offset, offset + limit);
      res.json({ battles: paged, total, hasMore: offset + limit < total });
    } catch (err) {
      console.error("[battles/history]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /api/admin/metrics — per-route timing diagnostics (admin-gated) */
  app.get("/api/admin/metrics", (req, res) => {
    if (!requireAdminKey(req, res)) return;
    const routes = Object.entries(_apiRouteTimings)
      .filter(([, s]) => s.count > 0)
      .map(([route, s]) => ({
        route,
        count: s.count,
        avgMs: Math.round(s.totalTimeMs / s.count),
        maxMs: s.maxTimeMs,
        slowCount: s.slowCount,
      }))
      .sort((a, b) => b.count - a.count);
    res.json({ slowThresholdMs: SLOW_API_THRESHOLD_MS, routes });
  });

  /** GET /api/admin/battles-live — currently pending battles */
  app.get("/api/admin/battles-live", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const pending = await db.select()
        .from(battlesTable)
        .where(eq(battlesTable.status, "pending"))
        .orderBy(battlesTable.resolveTs);

      const playerIds = [...new Set([...pending.map(b => b.attackerId), ...pending.filter(b => b.defenderId).map(b => b.defenderId!)])];
      const playerRows = playerIds.length > 0
        ? await db.select({ id: playersTable.id, name: playersTable.name })
            .from(playersTable)
            .where(sql`${playersTable.id} = ANY(ARRAY[${sql.raw(playerIds.map(id => `'${id}'`).join(","))}]::text[])`)
        : [];
      const nameById = new Map(playerRows.map(p => [p.id, p.name]));

      const parcelRows = pending.length > 0
        ? await db.select({ id: parcelsTable.id, plotId: parcelsTable.plotId })
            .from(parcelsTable)
            .where(sql`${parcelsTable.id} = ANY(ARRAY[${sql.raw(pending.map(b => `'${b.targetParcelId}'`).join(","))}]::text[])`)
        : [];
      const plotIdById = new Map(parcelRows.map(p => [p.id, p.plotId]));

      res.json(pending.map(b => ({
        id:           b.id,
        attackerName: nameById.get(b.attackerId) ?? "Unknown",
        defenderName: b.defenderId ? (nameById.get(b.defenderId) ?? "Unclaimed") : "Unclaimed",
        plotId:       plotIdById.get(b.targetParcelId) ?? 0,
        startTs:      b.startTs,
        resolveTs:    b.resolveTs,
      })));
    } catch (err) {
      console.error("[admin/battles-live]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /api/admin/ai-activity — AI faction status + last action per faction */
  app.get("/api/admin/ai-activity", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const factionRows = await db
        .select()
        .from(playersTable)
        .where(eq(playersTable.isAi, true));

      const result = await Promise.all(
        factionRows.map(async (f) => {
          const [lastEvent] = await db
            .select()
            .from(gameEventsTable)
            .where(eq(gameEventsTable.playerId, f.id))
            .orderBy(desc(gameEventsTable.ts))
            .limit(1);

          const [{ count }] = await db
            .select({ count: sql<number>`cast(count(*) as int)` })
            .from(parcelsTable)
            .where(eq(parcelsTable.ownerId, f.id));

          const recentMs = 5 * 60 * 1000;
          const isActive = lastEvent && (Date.now() - lastEvent.ts) < recentMs;

          return {
            name: f.name,
            behavior: f.aiBehavior ?? "expansionist",
            iron: f.iron,
            fuel: f.fuel,
            crystal: f.crystal,
            plotCount: count ?? 0,
            status: isActive ? "ACTIVE" : "MONITORING",
            lastAction: lastEvent
              ? { description: lastEvent.description, timestamp: lastEvent.ts }
              : null,
          };
        })
      );

      res.json({
        factions: result,
        aiEnabled: process.env.AI_ENABLED === "true",
        tickIntervalSecs: 20,
      });
    } catch (err) {
      console.error("[admin/ai-activity]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/admin/season/start — start a new season (admin only) */
  app.post("/api/admin/season/start", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    const { name, daysLen } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    try {
      const season = await storage.startSeason(name, daysLen ?? 90);
      markDirty();
      res.json({ success: true, season });
    } catch (err: any) {
      console.error("[season] startSeason error", err);
      res.status(400).json({ error: err.message ?? "Failed to start season" });
    }
  });

  /** POST /api/admin/season/settle — settle the current season */
  app.post("/api/admin/season/settle", async (_req, res) => {
    if (!requireAdminKey(_req, res)) return;
    try {
      const season = await storage.settleCurrentSeason();
      if (!season) return res.status(404).json({ error: "No active season to settle" });
      markDirty();
      res.json({ success: true, season });
    } catch (err) {
      console.error("[season] settleCurrentSeason error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/admin/status
   * Health + readiness probe for monitoring tools and deployment health checks.
   * Returns Algorand chain connectivity, DB pool stats, and AI faction state.
   * Protected by ADMIN_KEY when set; open otherwise (useful for deploy probes).
   */
  app.get("/api/admin/status", async (_req, res) => {
    if (!requireAdminKey(_req, res)) return;

    const startedAt = process.hrtime.bigint();

    // ── Algorand chain probe ───────────────────────────────────────────────────
    let algorand: Record<string, unknown> = { connected: false, network: process.env.ALGORAND_NETWORK ?? "testnet" };
    try {
      const algodProbeStart = Date.now();
      const algod = getAlgodClient();
      const nodeStatus = await algod.status().do() as unknown as Record<string, unknown>;
      const latencyMs = Date.now() - algodProbeStart;
      const toNum = (v: unknown) => (typeof v === "bigint" ? Number(v) : v);
      algorand = {
        connected: true,
        network: process.env.ALGORAND_NETWORK ?? "testnet",
        latencyMs,
        lastRound: toNum(nodeStatus["last-round"] ?? nodeStatus.lastRound) ?? null,
        catchupTime: toNum(nodeStatus["catchup-time"]) ?? null,
      };
    } catch (algodErr) {
      algorand = {
        connected: false,
        network: process.env.ALGORAND_NETWORK ?? "testnet",
        error: algodErr instanceof Error ? algodErr.message : String(algodErr),
      };
    }

    // ── DB pool stats ──────────────────────────────────────────────────────────
    const dbPool = getPoolStats();

    // ── DB ping ───────────────────────────────────────────────────────────────
    let dbPingMs: number | null = null;
    let dbConnected = false;
    try {
      const dbPingStart = Date.now();
      await withDbRetry(() => db.execute(sql`SELECT 1`), "admin-status-ping", 1);
      dbPingMs = Date.now() - dbPingStart;
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    // ── AI faction summary ────────────────────────────────────────────────────
    const aiEnabled = process.env.AI_ENABLED === "true";
    let aiFactions: unknown[] = [];
    try {
      const aiFactionRows = await withDbRetry(
        () => db.select({ id: playersTable.id, name: playersTable.name, isAi: playersTable.isAi, aiBehavior: playersTable.aiBehavior, iron: playersTable.iron, fuel: playersTable.fuel, crystal: playersTable.crystal })
          .from(playersTable)
          .where(eq(playersTable.isAi, true)),
        "admin-status-ai-factions",
        1
      );
      aiFactions = aiFactionRows.map(f => ({
        name: f.name,
        behavior: f.aiBehavior ?? "expansionist",
        resources: { iron: f.iron, fuel: f.fuel, crystal: f.crystal },
      }));
    } catch {
      aiFactions = [];
    }

    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    res.json({
      ok: algorand.connected && dbConnected,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      probeLatencyMs: Math.round(elapsedMs),
      algorand,
      db: {
        connected: dbConnected,
        pingMs: dbPingMs,
        pool: dbPool,
      },
      ai: {
        enabled: aiEnabled,
        factionCount: aiFactions.length,
        factions: aiFactions,
      },
      env: {
        nodeEnv: process.env.NODE_ENV ?? "development",
        network: process.env.ALGORAND_NETWORK ?? "testnet",
        asaId: getAscendAsaId() ?? null,
      },
    });
  });

  return httpServer;
}
