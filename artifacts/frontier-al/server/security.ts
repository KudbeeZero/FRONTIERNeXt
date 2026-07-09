// ── Centralized security helpers ─────────────────────────────────────────────
//
// This module concentrates the server's access-control and anti-scraping
// primitives so they are consistent and auditable in one place:
//
//   • requireAdminKey   — gate for privileged /api/admin/* + game-mutation ops
//   • enumerationLimiter — strict per-IP limiter for ID/address-enumerable reads
//   • apiReadLimiter     — coarse per-IP ceiling across the whole /api surface
//   • clampLimit         — bound caller-supplied `limit` params (anti-dump)
//
// Threat model addressed here: an unauthenticated client (or a "spreadsheet"
// bot) walking sequential plot/player IDs or addresses to harvest off-chain
// game-economy intelligence — e.g. which parcels hold the most resources, who
// holds the largest balances. On-chain data (treasury, wallet balances) is
// public on Algorand by design and cannot be hidden via the API; the off-chain
// game state in Postgres is what these guards protect.

import rateLimit from "express-rate-limit";
import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import algosdk from "algosdk";
import { RedisStore } from "./rateLimitStore";

const isProd = (): boolean => process.env.NODE_ENV === "production";

/**
 * Constant-time string comparison. Avoids leaking the admin key length/prefix
 * through response-timing side channels. Returns false on any length mismatch.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Gate for privileged endpoints.
 *
 * Hardening vs. the previous inline check:
 *   • FAILS CLOSED in production. Previously a missing ADMIN_KEY returned `true`
 *     (open access) — meaning a deploy that forgot to set the key silently
 *     exposed reset/season/market/admin endpoints to the public internet.
 *   • Header-only in production. The key is no longer accepted from the query
 *     string in prod, where it would be captured by access logs / proxies /
 *     browser history. `?adminKey=` is still honoured in dev for convenience.
 *   • Constant-time comparison.
 *
 * Returns true if the caller is authorized; otherwise writes a 403/503 and
 * returns false (caller should `return` immediately).
 */
export function requireAdminKey(req: Request, res: Response): boolean {
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    if (isProd()) {
      // Misconfiguration — refuse rather than expose privileged operations.
      res.status(503).json({ error: "Admin interface unavailable" });
      return false;
    }
    // Dev convenience only.
    return true;
  }

  const headerKey = req.headers["x-admin-key"];
  const queryKey = isProd() ? undefined : (req.query?.adminKey as string | undefined);
  const provided = (typeof headerKey === "string" ? headerKey : undefined) ?? queryKey ?? "";

  if (!provided || !safeEqual(provided, adminKey)) {
    res.status(403).json({ error: "Forbidden: invalid admin key" });
    return false;
  }
  return true;
}

/**
 * SOFT admin check: true when ADMIN_KEY is configured AND the caller presented
 * the correct x-admin-key header. Unlike requireAdminKey it never writes a
 * 403/503 — use it to additively unlock admin-only fields on otherwise-public
 * endpoints. Header-only (no dev query fallback) and constant-time, using the
 * same comparison as requireAdminKey.
 */
export function isAdminRequest(req: Request): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return false;
  const headerKey = req.headers["x-admin-key"];
  return typeof headerKey === "string" && safeEqual(headerKey, adminKey);
}

/**
 * Coarse per-IP ceiling applied across the entire /api surface. This is a
 * blunt anti-DoS / anti-bulk-scrape backstop, deliberately generous so it
 * never interferes with a single legitimate player session. Tune via
 * API_RATE_LIMIT (requests per minute per IP).
 */
export const apiReadLimiter = rateLimit({
  windowMs: 60_000,
  limit: Math.max(1, Number(process.env.API_RATE_LIMIT) || 1000),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests — slow down and try again shortly." },
});

/**
 * Strict per-IP limiter for read endpoints that are *enumerable* by a
 * sequential/guessable identifier (plotId, playerId, wallet address). A real
 * client hits any one of these occasionally (detail views); a scraper walking
 * the keyspace hammers them. This is the primary defense against harvesting
 * off-chain economic intelligence ("which plots hold the most tokens").
 * Tune via ENUMERATION_RATE_LIMIT (requests per minute per IP).
 */
export const enumerationLimiter = rateLimit({
  windowMs: 60_000,
  limit: Math.max(1, Number(process.env.ENUMERATION_RATE_LIMIT) || 90),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Redis-backed so the anti-scrape budget is shared across instances (a scraper
  // can't multiply its allowance by hitting different nodes). Falls back to
  // per-instance memory when Redis is unavailable.
  store: new RedisStore("rl:enum:"),
  message: { error: "Too many lookups — slow down and try again shortly." },
});

/**
 * Tight per-IP limiter for the authentication endpoints (/api/auth/*). Blunts
 * nonce/verify spam and signature-guessing. Redis-backed for cross-instance
 * enforcement. Tune via AUTH_RATE_LIMIT (requests per minute per IP).
 */
export const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: Math.max(1, Number(process.env.AUTH_RATE_LIMIT) || 20),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: new RedisStore("rl:auth:"),
  message: { error: "Too many authentication attempts — try again shortly." },
});

/**
 * Per-IP fixed window over /api/actions/* (mine, attack, purchase, build, …).
 * Read-only routes are unaffected; server-internal AI/scheduler paths do not hit
 * /api/actions. DB-level cooldowns/constraints remain the primary guard — this
 * adds a cheap spam / treasury-drain ceiling. Tune via ACTIONS_RATE_LIMIT.
 */
export const actionsLimiter = rateLimit({
  windowMs: 60_000,
  limit: Math.max(1, Number(process.env.ACTIONS_RATE_LIMIT) || 60),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many actions — slow down and try again shortly." },
});

/**
 * Per-IP fixed window over write-heavy route groups: /api/trade/*,
 * /api/markets/*, /api/weapons/*, /api/sub-parcels/*, /api/factions/*.
 * These surfaces currently rely only on the coarse apiReadLimiter (1000/min).
 * strictLimiter adds a per-surface 60/min ceiling to blunt abuse of trade
 * order creation, market position changes, weapon operations, sub-parcel
 * mutations, and faction joins. Tune via STRICT_RATE_LIMIT.
 */
export const strictLimiter = rateLimit({
  windowMs: 60_000,
  limit: Math.max(1, Number(process.env.STRICT_RATE_LIMIT) || 60),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests — slow down and try again shortly." },
});

/**
 * Per-IP limiter for the terraform advice endpoint — bounds cost when the LLM
 * advisor path (ANTHROPIC_API_KEY) is enabled. The heuristic path is cheap.
 * Tune via ADVICE_RATE_LIMIT.
 */
export const adviceLimiter = rateLimit({
  windowMs: 60_000,
  limit: Math.max(1, Number(process.env.ADVICE_RATE_LIMIT) || 30),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many advice requests — try again shortly." },
});

/**
 * Per-IP limiter for the optional waitlist signup on the faction-select gate.
 * Tune via WAITLIST_RATE_LIMIT.
 */
export const waitlistLimiter = rateLimit({
  windowMs: 60_000,
  limit: Math.max(1, Number(process.env.WAITLIST_RATE_LIMIT) || 12),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many signups — try again shortly." },
});

// ── "Real human wallet" predicates ───────────────────────────────────────────
//
// The game uses placeholder identities alongside real Algorand addresses:
// "PLAYER_WALLET" (unconnected default) and "AI_*" (faction bots). Many code
// paths must distinguish a real, player-connected wallet from these
// placeholders. Two variants exist because some call sites additionally
// require the address to be a syntactically valid Algorand address (before an
// on-chain interaction) while others deliberately do not.

/**
 * True when `addr` is present and is neither the "PLAYER_WALLET" placeholder
 * nor an AI faction identity ("AI_*"). Does NOT check Algorand address
 * validity — use isRealVerifiedWallet for that.
 */
export function isRealWallet(addr: string | null | undefined): addr is string {
  return !!addr && addr !== "PLAYER_WALLET" && !addr.startsWith("AI_");
}

/**
 * isRealWallet + syntactic Algorand address validity. Use before any on-chain
 * interaction with the address.
 */
export function isRealVerifiedWallet(addr: string | null | undefined): addr is string {
  return isRealWallet(addr) && algosdk.isValidAddress(addr);
}

/**
 * Decide whether a caller-supplied delivery address is entitled to receive a
 * custody-held NFT.
 *
 * The public delivery endpoints (/api/nft/deliver/:plotId,
 * /api/nft/deliver-commander/:commanderId) previously transferred the asset to
 * ANY address that had opted into the ASA — custody + opt-in were the only
 * guards, and both are satisfiable by an attacker (opt-in is permissionless).
 * A 1-of-1 plot/commander NFT could therefore be stolen out of admin custody
 * before the paying buyer opted in.
 *
 * Rule: the asset may only be delivered to the EXACT wallet address registered
 * for the in-game owner of the plot/commander. Placeholder identities
 * ("PLAYER_WALLET", AI_* bots, unowned parcels) can never take delivery.
 *
 * Pure decision function — no DB, no chain. Callers resolve `ownerAddress`
 * (parcels.ownerId → players.address, or commanders JSONB → players.address)
 * and must run this BEFORE any on-chain interaction.
 */
export function evaluateNftDeliveryClaim(params: {
  /** Registered wallet of the in-game owner; null/undefined when unresolvable. */
  ownerAddress: string | null | undefined;
  /** Address the caller asked us to deliver to. */
  requestedAddress: string;
}): { allow: true } | { allow: false; reason: "no_registered_owner" | "not_owner" } {
  const { ownerAddress, requestedAddress } = params;

  if (!isRealWallet(ownerAddress)) {
    return { allow: false, reason: "no_registered_owner" };
  }
  if (!safeEqual(requestedAddress, ownerAddress)) {
    return { allow: false, reason: "not_owner" };
  }
  return { allow: true };
}

// ── Payment replay protection ────────────────────────────────────────────────

export interface PaymentRedemption {
  purpose: "plot_purchase" | "commander_mint";
  /** What the payment bought (parcelId, commander tier, …) — audit only. */
  refId: string;
  playerId: string;
}

/**
 * Persistence behind the replay guard. The production implementation is an
 * INSERT … ON CONFLICT DO NOTHING against redeemed_payments (tx_id PRIMARY
 * KEY), so "tryInsert returns false" === "txid already redeemed", atomically,
 * across all server instances.
 */
export interface PaymentRedemptionStore {
  /** Atomically record txId as redeemed. Returns false if it already was. */
  tryInsert(txId: string, meta: PaymentRedemption): Promise<boolean>;
  /** Forget a claim (used when the purchase fails AFTER claiming). */
  remove(txId: string): Promise<void>;
}

export type PaymentClaimResult =
  | { ok: true }
  | { ok: false; reason: "already_redeemed" | "store_unavailable" };

/**
 * Replay guard for on-chain ALGO payments.
 *
 * verifyAlgoPayment() proves "this confirmed txn paid the admin enough" but is
 * a stateless indexer read — without this guard the SAME payment txid can be
 * redeemed for unlimited plots/commanders (sequentially or concurrently).
 *
 * Usage contract (both purchase routes):
 *   1. verify the payment on-chain,
 *   2. claim() the txid — reject with 409 unless { ok: true },
 *   3. run the state mutation; if it throws, release() the claim so the
 *      buyer's payment is not burned by a failed purchase.
 *
 * Failure policy is CLOSED: if the store errors we refuse the purchase rather
 * than risk a replay. The in-memory fallback exists only for store-less
 * dev/mem deployments (single process — a Set is sufficient there).
 */
export function createPaymentReplayGuard(store: PaymentRedemptionStore | null) {
  const memRedeemed = new Set<string>();

  return {
    async claim(txId: string, meta: PaymentRedemption): Promise<PaymentClaimResult> {
      if (!store) {
        if (memRedeemed.has(txId)) return { ok: false, reason: "already_redeemed" };
        memRedeemed.add(txId);
        return { ok: true };
      }
      try {
        const inserted = await store.tryInsert(txId, meta);
        return inserted ? { ok: true } : { ok: false, reason: "already_redeemed" };
      } catch (err) {
        console.error(`[payments] replay-guard claim failed txId=${txId} — refusing purchase (fail closed):`, err instanceof Error ? err.message : err);
        return { ok: false, reason: "store_unavailable" };
      }
    },

    async release(txId: string): Promise<void> {
      if (!store) {
        memRedeemed.delete(txId);
        return;
      }
      try {
        await store.remove(txId);
      } catch (err) {
        // Worst case the txid stays redeemed and the buyer needs admin help —
        // strictly safer than the reverse. Log loudly for follow-up.
        console.error(`[payments] CRITICAL: failed to release claim txId=${txId} after failed purchase — manual row delete needed:`, err instanceof Error ? err.message : err);
      }
    },
  };
}

/**
 * Bound a caller-supplied `limit` query parameter so an attacker cannot turn a
 * paginated feed into a full-table dump with `?limit=999999`.
 *
 * @param raw  the raw query value (unknown type from req.query)
 * @param def  default when absent/invalid
 * @param max  hard ceiling
 */
export function clampLimit(raw: unknown, def: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}
