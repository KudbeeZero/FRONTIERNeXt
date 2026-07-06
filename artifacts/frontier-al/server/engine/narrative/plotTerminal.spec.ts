/**
 * server/engine/narrative/plotTerminal.spec.ts
 *
 * Tests the deterministic heuristic path of the plot-terminal brief (runs
 * with no ANTHROPIC_API_KEY).
 */

import { describe, it, expect } from "vitest";
import { heuristicBrief, plotTerminalBrief } from "./plotTerminal.js";

describe("plot terminal — heuristic", () => {
  it("reports holding status for a player-owned plot", () => {
    const b = heuristicBrief({ plotId: 1, biome: "forest", richness: 60, defenseLevel: 5, ownership: "player" });
    expect(b.source).toBe("heuristic");
    expect(b.lines.length).toBeGreaterThan(0);
    expect(b.lines.some((l) => /HOLDING/.test(l))).toBe(true);
  });

  it("recommends seizing an unclaimed plot", () => {
    const b = heuristicBrief({ plotId: 2, biome: "plains", richness: 90, defenseLevel: 0, ownership: "unclaimed" });
    expect(b.lines.some((l) => /seize/i.test(l))).toBe(true);
    expect(b.lines.some((l) => /Unclaimed/.test(l))).toBe(true);
  });

  it("recommends reconnaissance over a heavily fortified AI enemy plot", () => {
    const b = heuristicBrief({ plotId: 3, biome: "mountain", richness: 40, defenseLevel: 9, ownership: "ai_enemy" });
    expect(b.lines.some((l) => /reconnaissance/i.test(l))).toBe(true);
  });

  it("authorizes attack on a weakly defended enemy plot", () => {
    const b = heuristicBrief({ plotId: 4, biome: "desert", richness: 40, defenseLevel: 1, ownership: "human_enemy" });
    expect(b.lines.some((l) => /attack authorized/i.test(l))).toBe(true);
  });

  it("plotTerminalBrief falls back to heuristic with no API key", async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const b = await plotTerminalBrief({ plotId: 5, biome: "swamp", richness: 30, defenseLevel: 2, ownership: "unclaimed" });
    expect(b.source).toBe("heuristic");
    if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
  });
});
