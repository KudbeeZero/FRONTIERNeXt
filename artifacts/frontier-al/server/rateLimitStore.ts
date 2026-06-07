// ── Redis-backed express-rate-limit store (multi-instance) ───────────────────
//
// Shares rate-limit counters across instances via the existing Upstash client
// so a limit means the same thing regardless of which node a request lands on.
// Used only for the security-sensitive limiters (anti-scrape enumeration +
// /api/auth/*) — the coarse high-volume limiters stay on per-instance memory to
// avoid a Redis round-trip on routine traffic.
//
// Fail-SAFE, not fail-open: if Redis is absent or a call fails, it transparently
// falls back to an internal MemoryStore, so per-instance protection still works
// during a Redis outage.

import { MemoryStore, type Store, type Options, type ClientRateLimitInfo } from "express-rate-limit";
import { isRedisEnabled, rlIncr, rlDecr, rlDelete } from "./services/redis";

export class RedisStore implements Store {
  /** Distinct per-limiter key namespace, e.g. "rl:enum:" / "rl:auth:". */
  private readonly keyPrefix: string;
  private windowMs = 60_000;
  private readonly memory = new MemoryStore();
  private warnedDegraded = false;

  constructor(keyPrefix: string) {
    this.keyPrefix = keyPrefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.memory.init(options);
  }

  private key(key: string): string {
    return `frontier:${this.keyPrefix}${key}`;
  }

  private noteDegraded(): void {
    if (this.warnedDegraded) return;
    this.warnedDegraded = true;
    console.warn(
      `[rateLimitStore] Redis unavailable for "${this.keyPrefix}" — falling back to ` +
      `per-instance memory (rate limits no longer shared across instances).`,
    );
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    if (isRedisEnabled()) {
      const res = await rlIncr(this.key(key), this.windowMs);
      if (res) {
        return { totalHits: res.count, resetTime: new Date(Date.now() + res.ttlMs) };
      }
      this.noteDegraded();
    }
    return this.memory.increment(key);
  }

  async decrement(key: string): Promise<void> {
    if (isRedisEnabled()) {
      await rlDecr(this.key(key));
      return;
    }
    return this.memory.decrement(key);
  }

  async resetKey(key: string): Promise<void> {
    if (isRedisEnabled()) {
      await rlDelete(this.key(key));
      return;
    }
    return this.memory.resetKey(key);
  }
}
