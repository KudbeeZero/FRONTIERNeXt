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
  message: { error: "Too many lookups — slow down and try again shortly." },
});

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
