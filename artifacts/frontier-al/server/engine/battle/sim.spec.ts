/**
 * server/engine/battle/sim.spec.ts
 *
 * Balance-gradient tests built on the simulation harness. These assert the
 * intended difficulty ordering produced by BIOME_DEFENSE_MOD and guard against a
 * future tuning edit silently flattening or inverting biome balance.
 */

import { describe, it, expect } from "vitest";
import { simulateBattles, SIM_BIOMES } from "./sim.js";

// Parameters chosen so the win-rate gradient spans the biome range and the
// neutral biome (plains) lands in a non-degenerate middle band.
const PARAMS = { trials: 2000, troops: 15, defenseLevel: 10, iron: 0, fuel: 0 };

describe("battle balance simulation", () => {
  const results = simulateBattles(PARAMS);
  const byBiome = Object.fromEntries(results.map((r) => [r.biome, r]));

  it("covers every biome", () => {
    expect(results.map((r) => r.biome).sort()).toEqual([...SIM_BIOMES].sort());
  });

  it("attacker win-rate is monotonically non-increasing as defense modifier rises", () => {
    // results are emitted in ascending defenseMod order (SIM_BIOMES)
    for (let i = 1; i < results.length; i++) {
      expect(results[i].defenseMod).toBeGreaterThanOrEqual(results[i - 1].defenseMod);
      // higher/equal defense ⇒ lower/equal attacker win-rate
      expect(results[i].winRate).toBeLessThanOrEqual(results[i - 1].winRate + 1e-9);
    }
  });

  it("water is easiest and mountain is hardest to capture", () => {
    expect(byBiome.water.winRate).toBeGreaterThan(byBiome.mountain.winRate);
    expect(byBiome.water.winRate).toBeGreaterThanOrEqual(byBiome.plains.winRate);
    expect(byBiome.plains.winRate).toBeGreaterThanOrEqual(byBiome.mountain.winRate);
  });

  it("the neutral biome is not a degenerate 0% or 100% outcome", () => {
    expect(byBiome.plains.winRate).toBeGreaterThan(0.05);
    expect(byBiome.plains.winRate).toBeLessThan(0.95);
  });

  it("is deterministic across runs", () => {
    const again = simulateBattles(PARAMS);
    expect(again.map((r) => r.winRate)).toEqual(results.map((r) => r.winRate));
  });

  it("raising defense never raises the attacker's win-rate (fixed biome)", () => {
    const weak = simulateBattles({ ...PARAMS, defenseLevel: 5 });
    const strong = simulateBattles({ ...PARAMS, defenseLevel: 15 });
    const w = Object.fromEntries(weak.map((r) => [r.biome, r.winRate]));
    const s = Object.fromEntries(strong.map((r) => [r.biome, r.winRate]));
    for (const biome of SIM_BIOMES) {
      expect(s[biome]).toBeLessThanOrEqual(w[biome] + 1e-9);
    }
  });
});
