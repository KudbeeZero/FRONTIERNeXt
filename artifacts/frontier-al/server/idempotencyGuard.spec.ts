/**
 * server/idempotencyGuard.spec.ts
 *
 * Proves the action idempotency / replay guard: a duplicate submission of the
 * same scoped action cannot double-apply, a different player with the same nonce
 * does not collide, and a missing/malformed nonce is rejected — all with safe,
 * generic rejection reasons.
 *
 * Tests the REAL guard (`createActionIdempotencyGuard`) against both a fake
 * store with real claim-once semantics (mirrors the `key` PRIMARY KEY) and the
 * storeless dev/mem fallback. No HTTP mount.
 *
 * Attacker model: one accepted action, re-submitted (double-click / replayed
 * request) to credit ASCEND or enqueue an on-chain transfer more than once.
 */
import { describe, it, expect } from "vitest";
import {
  createActionIdempotencyGuard,
  actionNonceKey,
  type ActionNonceStore,
  type ActionNonceRecord,
} from "./idempotencyGuard";

const NONCE = "550e8400-e29b-41d4-a716-446655440000"; // UUID-shaped, valid

/** In-memory store with real claim-once semantics (mirrors the key PRIMARY KEY). */
function fakeStore(): ActionNonceStore & { rows: Map<string, ActionNonceRecord> } {
  const rows = new Map<string, ActionNonceRecord>();
  return {
    rows,
    async tryInsert(key, rec) {
      if (rows.has(key)) return false;
      rows.set(key, rec);
      return true;
    },
  };
}

describe("createActionIdempotencyGuard", () => {
  it("1. a valid first action with a nonce succeeds", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim({ playerId: "alice", action: "claim-frontier" }, NONCE)).toEqual({ ok: true });
  });

  it("2. a duplicate same-player same-action nonce is blocked (no double-apply)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const scope = { playerId: "alice", action: "claim-frontier" };
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: true });
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: false, reason: "already_processed" });
    // …and again — still blocked.
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: false, reason: "already_processed" });
  });

  it("3. the same nonce from a different player does NOT collide", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim({ playerId: "alice", action: "claim-frontier" }, NONCE)).toEqual({ ok: true });
    // Different player, same nonce string → distinct key → allowed.
    expect(await guard.claim({ playerId: "bob", action: "claim-frontier" }, NONCE)).toEqual({ ok: true });
    // Different action, same player+nonce → also distinct → allowed.
    expect(await guard.claim({ playerId: "alice", action: "mint-avatar" }, NONCE)).toEqual({ ok: true });
  });

  it("4. a missing nonce is rejected", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const scope = { playerId: "alice", action: "claim-frontier" };
    expect(await guard.claim(scope, undefined)).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(scope, null)).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(scope, "")).toEqual({ ok: false, reason: "invalid_nonce" });
  });

  it("5. a malformed nonce is rejected (too short, bad charset, non-string, oversized)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const scope = { playerId: "alice", action: "claim-frontier" };
    expect(await guard.claim(scope, "short")).toEqual({ ok: false, reason: "invalid_nonce" }); // < 8
    expect(await guard.claim(scope, "has spaces and !!")).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(scope, 12345 as unknown)).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(scope, "x".repeat(129))).toEqual({ ok: false, reason: "invalid_nonce" }); // > 128
  });

  it("6. rejection reasons are safe enums (no internals/secrets) and the store fails CLOSED", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const scope = { playerId: "alice", action: "claim-frontier" };
    await guard.claim(scope, NONCE);
    const dup = await guard.claim(scope, NONCE);
    if (dup.ok) throw new Error("expected rejection");
    expect(["invalid_nonce", "already_processed", "store_unavailable"]).toContain(dup.reason);
    // The reason never echoes the player id, nonce, or key.
    expect(dup.reason).not.toMatch(/alice|550e8400|claim-frontier/);

    // Fail closed: a broken store must reject, never silently allow a double-apply.
    const brokenGuard = createActionIdempotencyGuard({
      async tryInsert() {
        throw new Error("db down");
      },
    });
    expect(await brokenGuard.claim(scope, NONCE)).toEqual({ ok: false, reason: "store_unavailable" });
  });

  it("storeless (dev/mem) mode still enforces claim-once within the process", async () => {
    const guard = createActionIdempotencyGuard(null);
    const scope = { playerId: "alice", action: "claim-frontier" };
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: true });
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: false, reason: "already_processed" });
    // Different player still independent in storeless mode.
    expect(await guard.claim({ playerId: "carol", action: "claim-frontier" }, NONCE)).toEqual({ ok: true });
  });

  it("builds a deterministic, collision-scoped key", () => {
    expect(actionNonceKey("claim-frontier", "alice", NONCE)).toBe(`claim-frontier:alice:${NONCE}`);
    expect(actionNonceKey("claim-frontier", "alice", NONCE)).not.toBe(actionNonceKey("claim-frontier", "bob", NONCE));
  });
});
