/**
 * Pins the AI Battle Test objective engine: symmetric rivalries, mission briefing,
 * and win/lose/active progress math (defensive against bad inputs).
 */
import { describe, it, expect } from "vitest";
import { rivalOf, missionBriefing, evaluateObjective } from "./battleObjective";
import { PLAYER_FACTION_IDS } from "./waitlist";

describe("rivalOf", () => {
  it("is defined and symmetric for every faction", () => {
    for (const f of PLAYER_FACTION_IDS) {
      const r = rivalOf(f);
      expect(r, `${f} rival`).toBeTruthy();
      expect(r).not.toBe(f);                 // never your own rival
      expect(rivalOf(r!)).toBe(f);           // symmetric
    }
  });

  it("returns null for an unknown faction", () => {
    expect(rivalOf("DEV-TEST-COMMANDER")).toBeNull();
    expect(rivalOf("")).toBeNull();
  });
});

describe("missionBriefing", () => {
  it("names the rival and an objective", () => {
    const b = missionBriefing("NEXUS-7");
    expect(b).not.toBeNull();
    expect(b!.rival).toBe("KRONOS");
    expect(b!.headline).toContain("NEXUS-7");
    expect(b!.headline).toContain("KRONOS");
    expect(b!.objective).toContain("KRONOS");
  });

  it("is null for an unknown faction", () => {
    expect(missionBriefing("BOGUS")).toBeNull();
  });
});

describe("evaluateObjective", () => {
  it("won when the rival is cleared", () => {
    const s = evaluateObjective({ rivalStart: 10, rivalNow: 0, playerNow: 3 });
    expect(s.status).toBe("won");
    expect(s.progress).toBe(1);
  });

  it("active with proportional progress as the rival shrinks", () => {
    const s = evaluateObjective({ rivalStart: 10, rivalNow: 4, playerNow: 5 });
    expect(s.status).toBe("active");
    expect(s.progress).toBeCloseTo(0.6, 5);
    expect(s.headline).toContain("4 rival outposts remaining");
  });

  it("singular wording at one rival outpost", () => {
    expect(evaluateObjective({ rivalStart: 10, rivalNow: 1, playerNow: 1 }).headline)
      .toContain("1 rival outpost remaining");
  });

  it("lost only when overrun AND holding nothing", () => {
    expect(evaluateObjective({ rivalStart: 5, rivalNow: 10, playerNow: 0 }).status).toBe("lost");
    // still holding ground → not lost, even if the rival doubled
    expect(evaluateObjective({ rivalStart: 5, rivalNow: 10, playerNow: 2 }).status).toBe("active");
  });

  it("is defensive against a zero / negative start (no NaN, clamped 0..1)", () => {
    const s = evaluateObjective({ rivalStart: 0, rivalNow: 3, playerNow: 1 });
    expect(s.status).toBe("active");
    expect(s.progress).toBe(0);
    expect(Number.isFinite(s.progress)).toBe(true);
  });
});
