/**
 * server/engine/markets/resolve.spec.ts
 *
 * Unit tests for the pure provably-fair resolution core. DB-free, so it runs in the
 * single-process server suite. Covers outcome derivation per source type, threshold
 * edges, resolvability gating, and hash determinism/verifiability.
 */

import { describe, it, expect } from "vitest";
import type { ResolutionSource } from "@shared/schema";
import {
  deriveOutcome,
  isResolvable,
  hashResolution,
  stableStringify,
} from "./resolve.js";

describe("deriveOutcome", () => {
  it("battle_outcome: 'a' when attacker won, 'b' otherwise", () => {
    const src: ResolutionSource = { type: "battle_outcome", battleId: "b1" };
    expect(deriveOutcome(src, { attackerWon: true })).toBe("a");
    expect(deriveOutcome(src, { attackerWon: false })).toBe("b");
  });

  it("ownership_at_turn: 'a' only when owner matches the predicted id", () => {
    const src: ResolutionSource = { type: "ownership_at_turn", plotId: 12, ownerId: "NEXUS-7", turn: 1500 };
    expect(deriveOutcome(src, { owner: "NEXUS-7" })).toBe("a");
    expect(deriveOutcome(src, { owner: "KRONOS" })).toBe("b");
    expect(deriveOutcome(src, { owner: null })).toBe("b");
  });

  it("burn_threshold: 'a' when burned >= amount (inclusive edge)", () => {
    const src: ResolutionSource = { type: "burn_threshold", amount: 100_000, byTurn: 2000 };
    expect(deriveOutcome(src, { burned: 100_000 })).toBe("a"); // edge: equal meets threshold
    expect(deriveOutcome(src, { burned: 100_001 })).toBe("a");
    expect(deriveOutcome(src, { burned: 99_999 })).toBe("b");
  });

  it("territory_count: 'a' when count >= threshold (inclusive edge)", () => {
    const src: ResolutionSource = { type: "territory_count", ownerId: "VANGUARD", turn: 800, threshold: 50 };
    expect(deriveOutcome(src, { count: 50 })).toBe("a");
    expect(deriveOutcome(src, { count: 49 })).toBe("b");
  });
});

describe("isResolvable", () => {
  const now = 1_000;

  it("never resolvable before the staking cutoff", () => {
    const src: ResolutionSource = { type: "battle_outcome", battleId: "b1" };
    expect(isResolvable(src, { now, cutoffTs: 2_000, currentTurn: 9999, battleResolved: true })).toBe(false);
  });

  it("battle market needs the battle resolved", () => {
    const src: ResolutionSource = { type: "battle_outcome", battleId: "b1" };
    expect(isResolvable(src, { now, cutoffTs: 500, currentTurn: 0, battleResolved: false })).toBe(false);
    expect(isResolvable(src, { now, cutoffTs: 500, currentTurn: 0, battleResolved: true })).toBe(true);
  });

  it("turn-based markets need currentTurn to reach the target turn", () => {
    const own: ResolutionSource = { type: "ownership_at_turn", plotId: 1, ownerId: "x", turn: 1500 };
    expect(isResolvable(own, { now, cutoffTs: 500, currentTurn: 1499 })).toBe(false);
    expect(isResolvable(own, { now, cutoffTs: 500, currentTurn: 1500 })).toBe(true);

    const burn: ResolutionSource = { type: "burn_threshold", amount: 1, byTurn: 2000 };
    expect(isResolvable(burn, { now, cutoffTs: 500, currentTurn: 1999 })).toBe(false);
    expect(isResolvable(burn, { now, cutoffTs: 500, currentTurn: 2000 })).toBe(true);
  });
});

describe("hashResolution / stableStringify", () => {
  it("is independent of object key order (verifiable by re-running)", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it("produces a stable, reproducible sha256 a verifier can recompute", () => {
    const src: ResolutionSource = { type: "battle_outcome", battleId: "b1" };
    const inputs = { seed: 12345, attackerWon: true };
    const h1 = hashResolution(src, inputs, "a");
    // Same logical inputs, different key order → same hash.
    const h2 = hashResolution(src, { attackerWon: true, seed: 12345 }, "a");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when the outcome or inputs change", () => {
    const src: ResolutionSource = { type: "burn_threshold", amount: 10, byTurn: 5 };
    const a = hashResolution(src, { burned: 11 }, "a");
    const b = hashResolution(src, { burned: 9 }, "b");
    expect(a).not.toBe(b);
  });
});
