/**
 * server/idempotencyGuard.spec.ts
 *
 * Proves the TWO-PHASE action idempotency guard (claim → record/release →
 * replay): a fresh action claims its nonce, a duplicate of a COMPLETED action
 * replays the original response (no re-apply), a duplicate of an IN-FLIGHT action
 * is rejected (retry), a FAILED action releases its nonce so a retry can proceed,
 * and missing/malformed nonces fail closed with safe, generic reasons. Scoping by
 * player + action + target is preserved (no cross-collision).
 *
 * Tests the REAL guard against a fake store with real claim-once + response
 * persistence (mirrors the `key` PRIMARY KEY + `response_json` column) and the
 * storeless dev/mem fallback. No HTTP mount.
 *
 * Attacker/UX model: one accepted action, re-submitted (double-click / transparent
 * retry / replayed request) — must not double-apply, and a transparent retry of a
 * completed action should get the original result, not an error.
 */
import { describe, it, expect } from "vitest";
import {
  createActionIdempotencyGuard,
  actionNonceKey,
  type ActionNonceStore,
  type ActionNonceRecord,
} from "./idempotencyGuard";

const NONCE = "550e8400-e29b-41d4-a716-446655440000"; // UUID-shaped, valid

/** In-memory store mirroring the `key` PK + `response_json` column semantics. */
function fakeStore(): ActionNonceStore & { rows: Map<string, { rec: ActionNonceRecord; response: string | null }> } {
  const rows = new Map<string, { rec: ActionNonceRecord; response: string | null }>();
  return {
    rows,
    async claim(key, rec) {
      const existing = rows.get(key);
      if (existing) return { inserted: false, response: existing.response };
      rows.set(key, { rec, response: null });
      return { inserted: true };
    },
    async complete(key, responseJson) {
      const row = rows.get(key);
      if (row) row.response = responseJson;
    },
    async remove(key) {
      rows.delete(key);
    },
  };
}

const CLAIM = { playerId: "alice", action: "claim-frontier" };
const BODY = JSON.stringify({ success: true, claimed: { amount: 42 } });

describe("createActionIdempotencyGuard — two-phase claim/record/release/replay", () => {
  it("1. a fresh claim succeeds (replay:false)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim(CLAIM, NONCE)).toEqual({ ok: true, replay: false });
  });

  it("2. after record, a duplicate REPLAYS the original response (200, no re-apply)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const first = await guard.claim(CLAIM, NONCE);
    expect(first).toEqual({ ok: true, replay: false });
    await guard.record(CLAIM, NONCE, BODY);
    // Every later duplicate of the same nonce replays the stored body.
    expect(await guard.claim(CLAIM, NONCE)).toEqual({ ok: true, replay: true, response: BODY });
    expect(await guard.claim(CLAIM, NONCE)).toEqual({ ok: true, replay: true, response: BODY });
  });

  it("3. a duplicate while the first is IN-FLIGHT (not yet recorded) → in_progress", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim(CLAIM, NONCE)).toEqual({ ok: true, replay: false });
    // No record() yet — the first request is still running.
    expect(await guard.claim(CLAIM, NONCE)).toEqual({ ok: false, reason: "in_progress" });
  });

  it("4. release() after a FAILED mutation lets the same nonce be claimed again", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim(CLAIM, NONCE)).toEqual({ ok: true, replay: false });
    await guard.release(CLAIM, NONCE); // mutation threw → drop the claim
    // A genuine retry of the same nonce is now fresh again (not locked out).
    expect(await guard.claim(CLAIM, NONCE)).toEqual({ ok: true, replay: false });
  });

  it("5. a missing nonce is rejected (invalid_nonce)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim(CLAIM, undefined)).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(CLAIM, null)).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(CLAIM, "")).toEqual({ ok: false, reason: "invalid_nonce" });
  });

  it("6. a malformed nonce is rejected (too short / bad charset / non-string / oversized)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim(CLAIM, "short")).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(CLAIM, "has spaces !!")).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(CLAIM, 12345 as unknown)).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(CLAIM, "x".repeat(129))).toEqual({ ok: false, reason: "invalid_nonce" });
  });

  it("7. a broken store fails CLOSED (store_unavailable), never silently double-applies", async () => {
    const brokenGuard = createActionIdempotencyGuard({
      async claim() { throw new Error("db down"); },
      async complete() { throw new Error("db down"); },
      async remove() { throw new Error("db down"); },
    });
    expect(await brokenGuard.claim(CLAIM, NONCE)).toEqual({ ok: false, reason: "store_unavailable" });
  });

  it("8. record()/release() are best-effort — a store error does not throw to the caller", async () => {
    const guard = createActionIdempotencyGuard({
      async claim() { return { inserted: true }; },
      async complete() { throw new Error("db down"); },
      async remove() { throw new Error("db down"); },
    });
    // Neither rejects, even though the underlying store throws.
    await expect(guard.record(CLAIM, NONCE, BODY)).resolves.toBeUndefined();
    await expect(guard.release(CLAIM, NONCE)).resolves.toBeUndefined();
  });

  it("9. rejection reasons are safe enums (no player/nonce/key echo)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    await guard.claim(CLAIM, NONCE);
    const dup = await guard.claim(CLAIM, NONCE);
    if (dup.ok) throw new Error("expected rejection");
    expect(["invalid_nonce", "in_progress", "store_unavailable"]).toContain(dup.reason);
    expect(dup.reason).not.toMatch(/alice|550e8400|claim-frontier/);
  });

  it("storeless (dev/mem) mode mirrors claim → record → replay and release", async () => {
    const guard = createActionIdempotencyGuard(null);
    expect(await guard.claim(CLAIM, NONCE)).toEqual({ ok: true, replay: false });
    expect(await guard.claim(CLAIM, NONCE)).toEqual({ ok: false, reason: "in_progress" });
    await guard.record(CLAIM, NONCE, BODY);
    expect(await guard.claim(CLAIM, NONCE)).toEqual({ ok: true, replay: true, response: BODY });
    await guard.release(CLAIM, NONCE);
    expect(await guard.claim(CLAIM, NONCE)).toEqual({ ok: true, replay: false });
  });

  it("builds a deterministic, collision-scoped key", () => {
    expect(actionNonceKey("claim-frontier", "alice", NONCE)).toBe(`claim-frontier:alice:${NONCE}`);
    expect(actionNonceKey("claim-frontier", "alice", NONCE)).not.toBe(actionNonceKey("claim-frontier", "bob", NONCE));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// build & upgrade — target-scoped, two-phase.
// ─────────────────────────────────────────────────────────────────────────────
describe("createActionIdempotencyGuard — build/upgrade target scoping (two-phase)", () => {
  const BUILD = (target: string) => ({ playerId: "alice", action: "build", target });
  const UPGRADE = (target: string) => ({ playerId: "alice", action: "upgrade", target });
  const BUILD_TARGET = "plot-42:turret";
  const UPGRADE_TARGET = "plot-42:defense";
  const PARCEL_BODY = JSON.stringify({ success: true, parcel: { plotId: 42 } });

  it("1. a fresh build claim succeeds", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim(BUILD(BUILD_TARGET), NONCE)).toEqual({ ok: true, replay: false });
  });

  it("2. a duplicate build replays the original response after record (no double-build)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const scope = BUILD(BUILD_TARGET);
    await guard.claim(scope, NONCE);
    await guard.record(scope, NONCE, PARCEL_BODY);
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: true, replay: true, response: PARCEL_BODY });
  });

  it("2b. a duplicate build while in-flight → in_progress (no double-spend)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const scope = BUILD(BUILD_TARGET);
    await guard.claim(scope, NONCE);
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: false, reason: "in_progress" });
  });

  it("3. a fresh upgrade claim succeeds; duplicate replays after record", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const scope = UPGRADE(UPGRADE_TARGET);
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: true, replay: false });
    await guard.record(scope, NONCE, PARCEL_BODY);
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: true, replay: true, response: PARCEL_BODY });
  });

  it("4. failed build releases → re-claim is fresh", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const scope = BUILD(BUILD_TARGET);
    await guard.claim(scope, NONCE);
    await guard.release(scope, NONCE);
    expect(await guard.claim(scope, NONCE)).toEqual({ ok: true, replay: false });
  });

  it("5. same nonce, different player → no collision (build)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim({ playerId: "alice", action: "build", target: BUILD_TARGET }, NONCE)).toEqual({ ok: true, replay: false });
    expect(await guard.claim({ playerId: "bob", action: "build", target: BUILD_TARGET }, NONCE)).toEqual({ ok: true, replay: false });
  });

  it("6. same nonce across different action types → no collision", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim(BUILD(BUILD_TARGET), NONCE)).toEqual({ ok: true, replay: false });
    expect(await guard.claim(UPGRADE(UPGRADE_TARGET), NONCE)).toEqual({ ok: true, replay: false });
    expect(await guard.claim({ playerId: "alice", action: "claim-frontier" }, NONCE)).toEqual({ ok: true, replay: false });
  });

  it("6b. same nonce on a different target → no collision; same target in-flight → in_progress", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim(BUILD("plot-1:turret"), NONCE)).toEqual({ ok: true, replay: false });
    expect(await guard.claim(BUILD("plot-2:turret"), NONCE)).toEqual({ ok: true, replay: false });
    expect(await guard.claim(BUILD("plot-1:radar"), NONCE)).toEqual({ ok: true, replay: false });
    expect(await guard.claim(BUILD("plot-1:turret"), NONCE)).toEqual({ ok: false, reason: "in_progress" });
  });

  it("7. missing nonce rejected (build & upgrade)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    expect(await guard.claim(BUILD(BUILD_TARGET), undefined)).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(UPGRADE(UPGRADE_TARGET), null)).toEqual({ ok: false, reason: "invalid_nonce" });
  });

  it("8. malformed nonce rejected (build)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const scope = BUILD(BUILD_TARGET);
    expect(await guard.claim(scope, "short")).toEqual({ ok: false, reason: "invalid_nonce" });
    expect(await guard.claim(scope, "x".repeat(129))).toEqual({ ok: false, reason: "invalid_nonce" });
  });

  it("9. safe reasons (no internals) on an in-flight upgrade duplicate", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const scope = UPGRADE(UPGRADE_TARGET);
    await guard.claim(scope, NONCE);
    const dup = await guard.claim(scope, NONCE);
    if (dup.ok) throw new Error("expected rejection");
    expect(dup.reason).toBe("in_progress");
    expect(dup.reason).not.toMatch(/alice|550e8400|upgrade|plot-42|defense/);
  });

  it("builds a deterministic, target-scoped key (distinct from target-less)", () => {
    expect(actionNonceKey("build", "alice", NONCE, BUILD_TARGET)).toBe(`build:alice:${BUILD_TARGET}:${NONCE}`);
    expect(actionNonceKey("build", "alice", NONCE)).toBe(`build:alice:${NONCE}`);
    expect(actionNonceKey("build", "alice", NONCE, "plot-1:turret"))
      .not.toBe(actionNonceKey("build", "alice", NONCE, "plot-2:turret"));
  });
});
