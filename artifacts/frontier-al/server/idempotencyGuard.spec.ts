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

// ─────────────────────────────────────────────────────────────────────────────
// Extend: build & upgrade actions (target-scoped).
//
// build/upgrade spend ASCEND and mutate a base, so a double-submit/replay must
// not double-spend or double-build/-upgrade. The route scopes the claim by
// player + action + target (`${parcelId}:${type}`), so the SAME nonce is claimed
// independently per plot/facility, never collides across players or actions, and
// a missing/malformed nonce fails closed. Same attacker model, same real guard.
// ─────────────────────────────────────────────────────────────────────────────
describe("createActionIdempotencyGuard — build/upgrade target scoping", () => {
  const BUILD = (target: string) => ({ playerId: "alice", action: "build", target });
  const UPGRADE = (target: string) => ({ playerId: "alice", action: "upgrade", target });
  const BUILD_TARGET = "plot-42:turret";
  const UPGRADE_TARGET = "plot-42:defense";

  it("1. a valid first build action with a nonce succeeds", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim(BUILD(BUILD_TARGET), NONCE)).toEqual({ ok: true });
  });

  it("2. a duplicate build nonce is blocked (no double-spend / double-build)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const scope = BUILD(BUILD_TARGET);
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: true });
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: false, reason: "already_processed" });
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: false, reason: "already_processed" });
  });

  it("3. a valid first upgrade action with a nonce succeeds", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim(UPGRADE(UPGRADE_TARGET), NONCE)).toEqual({ ok: true });
  });

  it("4. a duplicate upgrade nonce is blocked (no double-spend / double-upgrade)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const scope = UPGRADE(UPGRADE_TARGET);
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: true });
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: false, reason: "already_processed" });
  });

  it("5. the same nonce from a different player does NOT collide (build)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim({ playerId: "alice", action: "build", target: BUILD_TARGET }, NONCE)).toEqual({ ok: true });
    // Different player, same action+target+nonce → distinct key → allowed.
    expect(await guard.claim({ playerId: "bob", action: "build", target: BUILD_TARGET }, NONCE)).toEqual({ ok: true });
  });

  it("6. the same nonce across different action types does NOT collide", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    // Same player, same nonce, build vs upgrade → distinct key → both allowed.
    expect(await guard.claim(BUILD(BUILD_TARGET), NONCE)).toEqual({ ok: true });
    expect(await guard.claim(UPGRADE(UPGRADE_TARGET), NONCE)).toEqual({ ok: true });
    // And claim-frontier with the same nonce is still independent.
    expect(await guard.claim({ playerId: "alice", action: "claim-frontier" }, NONCE)).toEqual({ ok: true });
  });

  it("6b. the same nonce on a DIFFERENT target (other plot) does NOT collide", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim(BUILD("plot-1:turret"), NONCE)).toEqual({ ok: true });
    // Same player+action+nonce, different plot → distinct key → allowed.
    expect(await guard.claim(BUILD("plot-2:turret"), NONCE)).toEqual({ ok: true });
    // Same plot, different facility → also distinct → allowed.
    expect(await guard.claim(BUILD("plot-1:radar"), NONCE)).toEqual({ ok: true });
    // Re-submitting the FIRST exact target → blocked.
    expect(await guard.claim(BUILD("plot-1:turret"), NONCE)).toEqual({ ok: false, reason: "already_processed" });
  });

  it("7. a missing nonce is rejected (build & upgrade)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim(BUILD(BUILD_TARGET), undefined)).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(UPGRADE(UPGRADE_TARGET), null)).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(BUILD(BUILD_TARGET), "")).toEqual({ ok: false, reason: "invalid_nonce" });
  });

  it("8. a malformed nonce is rejected (build)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const scope = BUILD(BUILD_TARGET);
    expect(await guard.claim(scope, "short")).toEqual({ ok: false, reason: "invalid_nonce" }); // < 8
    expect(await guard.claim(scope, "has spaces and !!")).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(scope, 12345 as unknown)).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(scope, "x".repeat(129))).toEqual({ ok: false, reason: "invalid_nonce" }); // > 128
  });

  it("9. rejection reasons are safe enums (no internals) and the store fails CLOSED (upgrade)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const scope = UPGRADE(UPGRADE_TARGET);
    await guard.claim(scope, NONCE);
    const dup = await guard.claim(scope, NONCE);
    if (dup.ok) throw new Error("expected rejection");
    expect(["invalid_nonce", "already_processed", "store_unavailable"]).toContain(dup.reason);
    // Never echoes player id, nonce, action, or target.
    expect(dup.reason).not.toMatch(/alice|550e8400|upgrade|plot-42|defense/);

    // Fail closed: a broken store must reject, never silently allow a double-apply.
    const brokenGuard = createActionIdempotencyGuard({
      async tryInsert() {
        throw new Error("db down");
      },
    });
    expect(await brokenGuard.claim(BUILD(BUILD_TARGET), NONCE)).toEqual({ ok: false, reason: "store_unavailable" });
  });

  it("builds a deterministic, target-scoped key (distinct from the target-less key)", () => {
    expect(actionNonceKey("build", "alice", NONCE, BUILD_TARGET)).toBe(`build:alice:${BUILD_TARGET}:${NONCE}`);
    // Target-less stays backward-compatible (claim-frontier unaffected).
    expect(actionNonceKey("build", "alice", NONCE)).toBe(`build:alice:${NONCE}`);
    // Different target → different key.
    expect(actionNonceKey("build", "alice", NONCE, "plot-1:turret"))
      .not.toBe(actionNonceKey("build", "alice", NONCE, "plot-2:turret"));
  });
});
