/**
 * server/waitlistStore.ts
 *
 * Persistence for the optional early-access waitlist captured on the
 * faction-select entry gate. Redis-backed (shared across instances, durable)
 * when Upstash is configured; otherwise a per-instance in-memory Map — mirroring
 * the nonce store's graceful-degradation pattern. Stores NO funds and no secrets:
 * just {faction, address?, email?} + a commit counter ("the more you play, the
 * higher your tier"). The on-chain reward that tier maps to is a separate, gated
 * unit — this module never touches ASA/transfer code.
 */
import { isRedisEnabled, redisRecordWaitlist } from "./services/redis.js";
import { commitTier, type NormalizedWaitlistSignup } from "../shared/waitlist.js";

interface MemEntry { payload: NormalizedWaitlistSignup; count: number }
const _mem = new Map<string, MemEntry>();

export interface WaitlistResult {
  /** How many times this signup has been recorded (engagement). */
  commitCount: number;
  /** Cosmetic engagement-tier label derived from commitCount. */
  tier: string;
}

/**
 * Record (or refresh) a waitlist signup under its stable key, bumping the commit
 * counter. Never throws — on any backend failure it still returns a sane result
 * so signup never blocks entering the game.
 */
export async function recordWaitlistSignup(
  key: string,
  payload: NormalizedWaitlistSignup,
): Promise<WaitlistResult> {
  if (isRedisEnabled()) {
    const n = await redisRecordWaitlist(key, payload);
    if (n != null) return { commitCount: n, tier: commitTier(n) };
  }
  const prev = _mem.get(key);
  const count = (prev?.count ?? 0) + 1;
  _mem.set(key, { payload, count });
  return { commitCount: count, tier: commitTier(count) };
}

/** Test/diagnostic helper — number of distinct in-memory signups. */
export function _memWaitlistSize(): number {
  return _mem.size;
}
