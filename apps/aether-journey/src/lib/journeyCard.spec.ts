import { describe, it, expect } from "vitest";
import { buildJourneyCard, ENDING_HUE } from "./journeyCard";

describe("buildJourneyCard", () => {
  it("uses the ending's title + verdict and a seal grade", () => {
    const c = buildJourneyCard({ ending: "bonded", trust: 90, flags: [] });
    expect(c.title).toBe("BONDED");
    expect(c.verdict.length).toBeGreaterThan(0);
    expect(c.rating).toBe("S"); // bonded + trust ≥ 85
    expect(c.trust).toBe(90);
  });

  it("grades by ending: bonded<85→A, functional→B, severance→C", () => {
    expect(buildJourneyCard({ ending: "bonded", trust: 72, flags: [] }).rating).toBe("A");
    expect(buildJourneyCard({ ending: "functional", trust: 50, flags: [] }).rating).toBe("B");
    expect(buildJourneyCard({ ending: "severance", trust: 20, flags: [] }).rating).toBe("C");
  });

  it("falls back gracefully when there is no ending", () => {
    const c = buildJourneyCard({ ending: null, trust: 60, flags: [] });
    expect(c.title).toBe("FIRST WATCH");
    expect(c.verdict.length).toBeGreaterThan(0);
    expect(c.rating).toBe("—");
  });

  it("clamps + rounds trust", () => {
    expect(buildJourneyCard({ ending: "bonded", trust: 140, flags: [] }).trust).toBe(100);
    expect(buildJourneyCard({ ending: "severance", trust: -5, flags: [] }).trust).toBe(0);
    expect(buildJourneyCard({ ending: "functional", trust: 49.6, flags: [] }).trust).toBe(50);
  });

  it("selects defining choices by priority, at most 3", () => {
    const c = buildJourneyCard({
      ending: "functional",
      trust: 50,
      flags: ["vesta_contained", "trusted_aether", "solo_decode", "comms_lost", "starved_self"],
    });
    expect(c.highlights).toHaveLength(3);
    // priority order: starved_self > trusted_aether > solo_decode (the present, higher-ranked first)
    expect(c.highlights[0]).toBe("Went without to keep her whole");
    expect(c.highlights[1]).toBe("Trusted her judgment when it counted");
    expect(c.highlights[2]).toBe("Cracked the beacon alone");
  });

  it("has no highlights when no defining flags are set", () => {
    expect(buildJourneyCard({ ending: "bonded", trust: 80, flags: [] }).highlights).toEqual([]);
  });

  it("produces a stable, flag-order-independent seed that varies with the run", () => {
    const a = buildJourneyCard({ ending: "bonded", trust: 80, flags: ["x", "y"] }).seed;
    const b = buildJourneyCard({ ending: "bonded", trust: 80, flags: ["y", "x"] }).seed; // reordered
    const c = buildJourneyCard({ ending: "bonded", trust: 81, flags: ["x", "y"] }).seed; // different trust
    expect(a).toMatch(/^AE-[0-9A-Z]{5}$/);
    expect(a).toBe(b); // order-independent + deterministic
    expect(a).not.toBe(c); // sensitive to the run
  });

  it("every ending has a display hue", () => {
    for (const e of ["bonded", "functional", "severance"] as const) {
      expect(ENDING_HUE[e]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
