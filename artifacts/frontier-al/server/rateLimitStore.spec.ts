import { describe, it, expect, beforeEach } from "vitest";
import type { Options } from "express-rate-limit";
import { RedisStore } from "./rateLimitStore";

// No UPSTASH_* env in the test environment → isRedisEnabled() is false, so the
// store transparently uses its internal MemoryStore. These tests verify that
// fallback path behaves like a correct express-rate-limit store.

function makeStore(windowMs = 60_000): RedisStore {
  const store = new RedisStore("rl:test:");
  // express-rate-limit calls init(options) with at least windowMs.
  store.init({ windowMs } as Options);
  return store;
}

describe("RedisStore (memory fallback when Redis is absent)", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("increments totalHits and returns a future resetTime", async () => {
    const store = makeStore(60_000);
    const k = `key-${Math.random()}`;

    const a = await store.increment(k);
    expect(a.totalHits).toBe(1);
    expect(a.resetTime).toBeInstanceOf(Date);
    expect(a.resetTime!.getTime()).toBeGreaterThan(Date.now());

    const b = await store.increment(k);
    expect(b.totalHits).toBe(2);

    const c = await store.increment(k);
    expect(c.totalHits).toBe(3);
  });

  it("tracks distinct keys independently", async () => {
    const store = makeStore();
    const h1 = await store.increment("alice");
    const h2 = await store.increment("bob");
    expect(h1.totalHits).toBe(1);
    expect(h2.totalHits).toBe(1);
  });

  it("resetKey clears the counter", async () => {
    const store = makeStore();
    const k = "reset-me";
    await store.increment(k);
    await store.increment(k);
    await store.resetKey(k);
    const after = await store.increment(k);
    expect(after.totalHits).toBe(1);
  });

  it("decrement reduces the counter", async () => {
    const store = makeStore();
    const k = "dec";
    await store.increment(k); // 1
    await store.increment(k); // 2
    await store.decrement(k); // 1
    const after = await store.increment(k); // 2
    expect(after.totalHits).toBe(2);
  });
});
