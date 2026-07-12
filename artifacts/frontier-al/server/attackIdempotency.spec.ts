/**
 * server/attackIdempotency.spec.ts
 *
 * Phase 4A unit coverage for the plot-attack idempotency contract:
 *  - attackPayloadFingerprint is deterministic and changes when ANY committed
 *    field (target / troops / iron / fuel / crystal / commander / source) changes;
 *  - attackIdempotencyScope keys on the actor only (no target in the key);
 *  - the claim → record → replay dance yields EXACTLY ONE battle for a
 *    duplicate (same key + same fingerprint), a 409 conflict for a same-key /
 *    different-fingerprint replay, and a 409 in_progress for an in-flight dup.
 *
 * Exercises the REAL guard (createActionIdempotencyGuard) with the same
 * fakeStore used by idempotencyGuard.spec.ts. No HTTP / DB mount.
 */
import { describe, it, expect, vi } from "vitest";
import {
  createActionIdempotencyGuard,
  type ActionNonceStore,
  type ActionNonceRecord,
} from "./idempotencyGuard";
import { attackPayloadFingerprint, attackIdempotencyScope } from "./attackIdempotency";
import type { AttackAction } from "@shared/schema";

const NONCE = "550e8400-e29b-41d4-a716-446655440000";

function fakeStore(): ActionNonceStore & {
  rows: Map<string, { rec: ActionNonceRecord; response: string | null; fingerprint: string | null; createdAt: number }>;
} {
  const rows = new Map<string, { rec: ActionNonceRecord; response: string | null; fingerprint: string | null; createdAt: number }>();
  return {
    rows,
    async claim(key, rec) {
      const existing = rows.get(key);
      if (existing) return { inserted: false, response: existing.response, fingerprint: existing.fingerprint };
      rows.set(key, { rec, response: null, fingerprint: rec.fingerprint ?? null, createdAt: Date.now() });
      return { inserted: true };
    },
    async complete(key, responseJson, fingerprint?: string) {
      const row = rows.get(key);
      if (row) { row.response = responseJson; if (fingerprint != null) row.fingerprint = fingerprint; }
    },
    async remove(key) { rows.delete(key); },
    async prune(olderThanMs) {
      const cutoff = Date.now() - olderThanMs;
      let removed = 0;
      for (const [k, r] of rows) if (r.createdAt < cutoff) { rows.delete(k); removed++; }
      return removed;
    },
  };
}

const baseAttack: AttackAction = {
  attackerId: "alice",
  targetParcelId: "plot-1",
  troopsCommitted: 5,
  resourcesBurned: { iron: 10, fuel: 8 },
  crystalBurned: 0,
  commanderId: undefined,
  sourceParcelId: undefined,
};

/** Mirrors the exact route dance: claim → deploy → record / release on throw. */
async function runAttack(
  guard: ReturnType<typeof createActionIdempotencyGuard>,
  deploy: () => Promise<{ id: string }>,
  nonce: string,
  fingerprint: string,
  actor = "alice",
) {
  const scope = attackIdempotencyScope(actor);
  const claim = await guard.claim(scope, nonce, fingerprint);
  if (!claim.ok) return claim; // rejected (in_progress / conflict / invalid)
  if (claim.replay) return { ok: true as const, replay: true }; // duplicate → replay, no re-apply
  try {
    const battle = await deploy();
    await guard.record(scope, nonce, JSON.stringify({ success: true, battle }), fingerprint);
    return { ok: true as const, battle };
  } catch (e) {
    await guard.release(scope, nonce);
    throw e;
  }
}

describe("attackPayloadFingerprint — canonical, deterministic, field-sensitive", () => {
  it("is identical for identical actions (same key + same payload → replay)", () => {
    const a = attackPayloadFingerprint("alice", baseAttack);
    const b = attackPayloadFingerprint("alice", { ...baseAttack });
    expect(a).toBe(b);
  });

  it("changes when the TARGET plot changes", () => {
    const a = attackPayloadFingerprint("alice", baseAttack);
    const b = attackPayloadFingerprint("alice", { ...baseAttack, targetParcelId: "plot-2" });
    expect(a).not.toBe(b);
  });

  it("changes when TROOPS change", () => {
    const a = attackPayloadFingerprint("alice", baseAttack);
    const b = attackPayloadFingerprint("alice", { ...baseAttack, troopsCommitted: 9 });
    expect(a).not.toBe(b);
  });

  it("changes when IRON / FUEL change", () => {
    const a = attackPayloadFingerprint("alice", baseAttack);
    const b = attackPayloadFingerprint("alice", { ...baseAttack, resourcesBurned: { iron: 11, fuel: 8 } });
    const c = attackPayloadFingerprint("alice", { ...baseAttack, resourcesBurned: { iron: 10, fuel: 9 } });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("changes when CRYSTAL changes", () => {
    const a = attackPayloadFingerprint("alice", baseAttack);
    const b = attackPayloadFingerprint("alice", { ...baseAttack, crystalBurned: 3 });
    expect(a).not.toBe(b);
  });

  it("changes when the COMMANDER changes", () => {
    const a = attackPayloadFingerprint("alice", baseAttack);
    const b = attackPayloadFingerprint("alice", { ...baseAttack, commanderId: "cmd-1" });
    expect(a).not.toBe(b);
  });

  it("changes when the SOURCE parcel changes", () => {
    const a = attackPayloadFingerprint("alice", baseAttack);
    const b = attackPayloadFingerprint("alice", { ...baseAttack, sourceParcelId: "plot-src" });
    expect(a).not.toBe(b);
  });

  it("never trusts the client attackerId — only the auth-verified actor is folded in", () => {
    // Two calls with differing client attackerId but the same verified actor produce
    // the SAME fingerprint (we always pass the verified id, not action.attackerId).
    const a = attackPayloadFingerprint("alice", { ...baseAttack, attackerId: "mallory" });
    const b = attackPayloadFingerprint("alice", baseAttack);
    expect(a).toBe(b);
  });
});

describe("attackIdempotencyScope — keyed on actor only", () => {
  it("omits the target/plot from the key (fingerprint carries it instead)", () => {
    const scope = attackIdempotencyScope("alice");
    expect(scope).toEqual({ playerId: "alice", action: "attack" });
    expect(scope).not.toHaveProperty("target");
  });
});

describe("plot-attack idempotency dance — exactly-once at the guard boundary", () => {
  it("1. first valid attack runs deployAttack exactly once and returns a battle", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const deploy = vi.fn(async () => ({ id: "b-1" }));
    const fp = attackPayloadFingerprint("alice", baseAttack);

    const res = await runAttack(guard, deploy, NONCE, fp);
    expect(res).toEqual({ ok: true, battle: { id: "b-1" } });
    expect(deploy).toHaveBeenCalledTimes(1);
  });

  it("2. sequential duplicate (same key + same payload) replays — deploy NOT called again", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const deploy = vi.fn(async () => ({ id: "b-1" }));
    const fp = attackPayloadFingerprint("alice", baseAttack);

    await runAttack(guard, deploy, NONCE, fp);
    const second = await runAttack(guard, deploy, NONCE, fp);
    expect(second).toEqual({ ok: true, replay: true });
    // Exactly one battle was ever created, regardless of how many retries.
    expect(deploy).toHaveBeenCalledTimes(1);
  });

  it("3. in-flight duplicate (no record yet) → in_progress, deploy NOT called twice", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const deploy = vi.fn(async () => ({ id: "b-1" }));
    const fp = attackPayloadFingerprint("alice", baseAttack);

    const first = await guard.claim(attackIdempotencyScope("alice"), NONCE, fp);
    expect(first).toEqual({ ok: true, replay: false });
    // A concurrent duplicate arrives before the first records.
    const concurrent = await runAttack(guard, deploy, NONCE, fp);
    expect(concurrent).toEqual({ ok: false, reason: "in_progress" });
    expect(deploy).toHaveBeenCalledTimes(0); // blocked before any side effect
  });

  it("4. same key + DIFFERENT payload (target) → 409 conflict, no second deploy", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const deploy = vi.fn(async () => ({ id: "b-1" }));
    const fpA = attackPayloadFingerprint("alice", baseAttack);
    const fpB = attackPayloadFingerprint("alice", { ...baseAttack, targetParcelId: "plot-2" });

    await runAttack(guard, deploy, NONCE, fpA);
    const conflict = await runAttack(guard, deploy, NONCE, fpB);
    expect(conflict).toEqual({ ok: false, reason: "conflict" });
    expect(deploy).toHaveBeenCalledTimes(1); // the original only
  });

  it("5. same key + DIFFERENT committed amount (iron) → 409 conflict (no double-spend)", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const deploy = vi.fn(async () => ({ id: "b-1" }));
    const fpFew = attackPayloadFingerprint("alice", baseAttack);
    const fpMany = attackPayloadFingerprint("alice", { ...baseAttack, resourcesBurned: { iron: 20, fuel: 8 } });

    await runAttack(guard, deploy, NONCE, fpFew);
    const conflict = await runAttack(guard, deploy, NONCE, fpMany);
    expect(conflict).toEqual({ ok: false, reason: "conflict" });
    expect(deploy).toHaveBeenCalledTimes(1);
  });

  it("6. different attacker reusing the SAME nonce string → distinct key, no collision", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const deployA = vi.fn(async () => ({ id: "b-a" }));
    const deployB = vi.fn(async () => ({ id: "b-b" }));
    const fp = attackPayloadFingerprint("alice", baseAttack);

    await runAttack(guard, deployA, NONCE, fp);
    const other = await runAttack(guard, deployB, NONCE, fp, "bob"); // "bob" actor
    expect(other).toEqual({ ok: true, battle: { id: "b-b" } });
    expect(deployA).toHaveBeenCalledTimes(1);
    expect(deployB).toHaveBeenCalledTimes(1);
  });

  it("7. pre-record failure RELEASES so a same-fingerprint retry is fresh", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const deploy = vi.fn(async () => ({ id: "b-1" })).mockRejectedValueOnce(new Error("insufficient resources"));
    const fp = attackPayloadFingerprint("alice", baseAttack);

    await expect(runAttack(guard, deploy, NONCE, fp)).rejects.toThrow("insufficient resources");
    // A genuine retry of the same logical attack is allowed (not locked out).
    const retry = await runAttack(guard, deploy, NONCE, fp);
    expect(retry).toEqual({ ok: true, battle: { id: "b-1" } });
    expect(deploy).toHaveBeenCalledTimes(2);
  });

  it("8. post-record (lost response) retry replays the committed battle", async () => {
    const guard = createActionIdempotencyGuard(fakeStore());
    const deploy = vi.fn(async () => ({ id: "b-1" }));
    const fp = attackPayloadFingerprint("alice", baseAttack);

    await runAttack(guard, deploy, NONCE, fp); // succeeds, recorded, response "lost"
    const retry = await runAttack(guard, deploy, NONCE, fp); // client retries
    expect(retry).toEqual({ ok: true, replay: true });
    expect(deploy).toHaveBeenCalledTimes(1); // never re-applied
  });
});
