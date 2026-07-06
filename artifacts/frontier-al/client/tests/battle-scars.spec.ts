/**
 * client/tests/battle-scars.spec.ts
 *
 * Proves the pure Battle Scars derivation: age-based fade, power-differential
 * sizing, dedupe-by-battleId (live update refreshes a seeded record), and a
 * hard cap on concurrently rendered scars.
 */
import { describe, it, expect } from "vitest";
import {
  deriveBattleScars,
  scarOpacityForAge,
  scarSizeForPowerDiff,
  MAX_SCAR_AGE_MS,
  type BattleScarRecord,
} from "../src/lib/battle/battleScars";

function rec(over: Partial<BattleScarRecord> = {}): BattleScarRecord {
  return {
    battleId: "b-1",
    plotId: 100,
    outcome: "attacker_wins",
    attackerPower: 100,
    defenderPower: 80,
    resolvedAt: 1_000_000,
    color: "#22d3ee",
    ...over,
  };
}

describe("scarOpacityForAge", () => {
  it("is fully opaque for a brand-new scar", () => {
    expect(scarOpacityForAge(0)).toBe(1);
  });

  it("fades linearly toward 0 as it ages", () => {
    const half = scarOpacityForAge(MAX_SCAR_AGE_MS / 2);
    expect(half).toBeCloseTo(0.5, 5);
  });

  it("is 0 at and after the max age", () => {
    expect(scarOpacityForAge(MAX_SCAR_AGE_MS)).toBe(0);
    expect(scarOpacityForAge(MAX_SCAR_AGE_MS + 1)).toBe(0);
  });

  it("treats negative age (clock skew) as brand new, not invalid", () => {
    expect(scarOpacityForAge(-500)).toBe(1);
  });

  it("tolerates non-finite input", () => {
    expect(scarOpacityForAge(NaN)).toBe(0);
  });
});

describe("scarSizeForPowerDiff", () => {
  it("increases with a bigger power differential and saturates toward 1", () => {
    const small = scarSizeForPowerDiff(100, 95); // diff 5
    const medium = scarSizeForPowerDiff(150, 80); // diff 70
    const huge = scarSizeForPowerDiff(1000, 10); // diff 990
    expect(medium).toBeGreaterThan(small);
    expect(huge).toBeGreaterThan(medium);
    expect(huge).toBeLessThan(1);
  });

  it("is 0 for an even matchup", () => {
    expect(scarSizeForPowerDiff(100, 100)).toBe(0);
  });
});

describe("deriveBattleScars — dedupe, decay, cap", () => {
  it("drops records past their max age", () => {
    const now = 1_000_000 + MAX_SCAR_AGE_MS + 1;
    const out = deriveBattleScars([rec()], now);
    expect(out).toHaveLength(0);
  });

  it("keeps a fresh record and derives captured/color from it", () => {
    const out = deriveBattleScars([rec({ outcome: "defender_wins", color: "#f87171" })], 1_000_500);
    expect(out).toHaveLength(1);
    expect(out[0].captured).toBe(false);
    expect(out[0].color).toBe("#f87171");
    expect(out[0].opacity).toBeGreaterThan(0);
    expect(out[0].opacity).toBeLessThanOrEqual(1);
  });

  it("dedupes by battleId — a later record for the same battle replaces the earlier one", () => {
    const seeded = rec({ battleId: "b-1", color: "#111111", resolvedAt: 1_000_000 });
    const live = rec({ battleId: "b-1", color: "#ffffff", resolvedAt: 1_000_100 });
    const out = deriveBattleScars([seeded, live], 1_000_200);
    expect(out).toHaveLength(1);
    expect(out[0].color).toBe("#ffffff");
  });

  it("sorts newest first", () => {
    const older = rec({ battleId: "old", resolvedAt: 1_000_000 });
    const newer = rec({ battleId: "new", resolvedAt: 1_500_000 });
    const out = deriveBattleScars([older, newer], 1_600_000);
    expect(out.map((s) => s.battleId)).toEqual(["new", "old"]);
  });

  it("caps at maxScars, keeping the newest", () => {
    const now = 2_000_000;
    const records = Array.from({ length: 10 }, (_, i) =>
      rec({ battleId: `b-${i}`, resolvedAt: 1_000_000 + i * 1000 }),
    );
    const out = deriveBattleScars(records, now, MAX_SCAR_AGE_MS, 3);
    expect(out).toHaveLength(3);
    expect(out.map((s) => s.battleId)).toEqual(["b-9", "b-8", "b-7"]);
  });
});
