/**
 * server/routeOwnership.spec.ts
 *
 * Proves the server route-loop protections: an authenticated mutating action
 * cannot be (a) called without valid auth, (b) called on behalf of another
 * player, (c) replayed, or (d) called with malformed input — and that error
 * responses stay generic (no secret/internal leak).
 *
 * Tests the REAL decision code: `evaluateOwnership` (the shared helper the
 * global mutation middleware AND assertPlayerOwnership in routes.ts both call),
 * the REAL `createPaymentReplayGuard` (the purchase/mint replay guard), and the
 * REAL zod action schema. No HTTP mounting, no mocks of the units under test.
 */
import { describe, it, expect } from "vitest";
import {
  evaluateOwnership,
  AUTH_REQUIRED_ERROR,
  NOT_OWNER_ERROR,
} from "./routeOwnership";
import { createPaymentReplayGuard } from "./security";
import { mineActionSchema } from "@shared/schema";
import type { AuthInfo } from "./auth";

const SESSION: AuthInfo = { address: "ALICEADDR", playerId: "player-alice" };

describe("route-loop auth/ownership decision (evaluateOwnership)", () => {
  it("1. happy path — a valid session acting on its own player is allowed", () => {
    expect(
      evaluateOwnership({ authRequired: true, auth: SESSION, ownerId: "player-alice" }),
    ).toEqual({ ok: true });
    // …and a request with no owner-identity field (e.g. a read-shaped mutation) is allowed.
    expect(
      evaluateOwnership({ authRequired: true, auth: SESSION, ownerId: null }),
    ).toEqual({ ok: true });
  });

  it("2. missing auth — rejected with 401 when wallet auth is enforced", () => {
    expect(
      evaluateOwnership({ authRequired: true, auth: null, ownerId: "player-alice" }),
    ).toEqual({ ok: false, status: 401, error: AUTH_REQUIRED_ERROR });
  });

  it("3. invalid auth — a session cannot act as a different player (403)", () => {
    const verdict = evaluateOwnership({ authRequired: true, auth: SESSION, ownerId: "player-bob" });
    expect(verdict).toEqual({ ok: false, status: 403, error: NOT_OWNER_ERROR });
  });

  it("documents the WALLET_AUTH_REQUIRED=false escape hatch (auth not enforced → allowed)", () => {
    // When wallet auth is disabled (rollout escape hatch), an unauthenticated
    // request is allowed — a known, documented posture, not a regression.
    expect(
      evaluateOwnership({ authRequired: false, auth: null, ownerId: "anyone" }),
    ).toEqual({ ok: true });
  });

  it("6. error bodies are generic — they never echo the session, address, or player id", () => {
    const missing = evaluateOwnership({ authRequired: true, auth: null, ownerId: "player-alice" });
    const mismatch = evaluateOwnership({ authRequired: true, auth: SESSION, ownerId: "player-bob" });
    for (const v of [missing, mismatch]) {
      if (v.ok) throw new Error("expected a rejection");
      expect(v.error).not.toMatch(/player-(alice|bob)|ALICEADDR|token|secret|Bearer/i);
    }
    // Stable, safe copy.
    expect(missing).toMatchObject({ error: AUTH_REQUIRED_ERROR });
    expect(mismatch).toMatchObject({ error: NOT_OWNER_ERROR });
  });
});

describe("route-loop replay protection (createPaymentReplayGuard)", () => {
  it("4. a replayed action (same payment txid) is rejected", async () => {
    const guard = createPaymentReplayGuard(null); // storeless dev/mem mode: claim-once in-process
    const meta = { purpose: "plot_purchase" as const, refId: "42", playerId: "player-alice" };

    expect(await guard.claim("TX-REPLAY", meta)).toEqual({ ok: true });
    const replay = await guard.claim("TX-REPLAY", meta);
    expect(replay).toEqual({ ok: false, reason: "already_redeemed" });
    // The rejection reason is a safe enum, not an internal/secret detail.
    if (replay.ok) throw new Error("expected rejection");
    expect(replay.reason).toBe("already_redeemed");
  });
});

describe("route-loop input validation (zod action schema)", () => {
  it("5. malformed input is rejected by the action schema", () => {
    // Missing required fields → rejected.
    expect(mineActionSchema.safeParse({}).success).toBe(false);
    expect(mineActionSchema.safeParse({ playerId: "player-alice" }).success).toBe(false);
    // Wrong types → rejected.
    expect(mineActionSchema.safeParse({ playerId: 1, parcelId: 2 }).success).toBe(false);
    // Well-formed → accepted.
    expect(mineActionSchema.safeParse({ playerId: "player-alice", parcelId: "42" }).success).toBe(true);
  });
});
