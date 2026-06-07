/**
 * server/engine/narrative/advisor.spec.ts
 *
 * Tests the deterministic heuristic path of the terraform advisor (runs with no
 * ANTHROPIC_API_KEY). Pins the ranking so balance edits surface here.
 */

import { describe, it, expect } from "vitest";
import { heuristicAdvice, recommendTerraform } from "./advisor.js";

const healthy = { stability: 90, hazardLevel: 5, yieldMultiplier: 1 } as const;

describe("terraform advisor — heuristic", () => {
  it("recommends the hardest-defending biome (mountain) for a defense goal", () => {
    const a = heuristicAdvice({ biome: "plains", goal: "defense", ...healthy });
    expect(a.recommendedAction).toBe("convert_biome");
    expect(a.recommendedBiome).toBe("mountain");
    expect(a.recommendedDefenseMod).toBeGreaterThan(a.currentDefenseMod);
  });

  it("recommends the richest resource biome (volcanic) for a yield goal", () => {
    const a = heuristicAdvice({ biome: "plains", goal: "yield", ...healthy });
    expect(a.recommendedBiome).toBe("volcanic");
    expect(a.recommendedYieldScore).toBeGreaterThan(a.currentYieldScore);
  });

  it("prioritises stabilising a low-stability plot over converting", () => {
    const a = heuristicAdvice({ biome: "plains", goal: "defense", stability: 10, hazardLevel: 5, yieldMultiplier: 1 });
    expect(a.recommendedAction).toBe("increase_stability");
    expect(a.recommendedBiome).toBe("plains");
  });

  it("prioritises reducing high hazard before biome work", () => {
    const a = heuristicAdvice({ biome: "plains", goal: "yield", stability: 90, hazardLevel: 80, yieldMultiplier: 1 });
    expect(a.recommendedAction).toBe("reduce_hazard");
  });

  it("suggests no conversion when already optimal for the goal", () => {
    const a = heuristicAdvice({ biome: "mountain", goal: "defense", ...healthy });
    expect(a.recommendedBiome).toBe("mountain");
    expect(a.recommendedAction).toBe("none");
  });

  it("recommendTerraform falls back to heuristic with no API key", async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const a = await recommendTerraform({ biome: "plains", goal: "defense", ...healthy });
    expect(a.source).toBe("heuristic");
    expect(a.recommendedBiome).toBe("mountain");
    if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
  });
});
