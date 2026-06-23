import { describe, it, expect } from "vitest";
import {
  DESCENT_STAGES,
  descentTuning,
  resolveEnding,
  ENDING_COPY,
  type DescentVerb,
} from "./descent";

describe("DESCENT_STAGES", () => {
  it("is a non-empty sequence with unique ids and valid verbs", () => {
    expect(DESCENT_STAGES.length).toBeGreaterThan(0);
    const ids = DESCENT_STAGES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // unique
    const verbs: DescentVerb[] = ["realign", "reroute", "balance", "confirm", "burn"];
    for (const s of DESCENT_STAGES) {
      expect(verbs).toContain(s.verb);
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.prompt.length).toBeGreaterThan(0);
    }
  });

  it("ends on the burn (the climax)", () => {
    expect(DESCENT_STAGES[DESCENT_STAGES.length - 1].verb).toBe("burn");
  });
});

describe("descentTuning", () => {
  it("is more generous as trust rises (more time; assist only when bonded)", () => {
    expect(descentTuning(85)).toEqual({ secondsPerStage: 12, assist: true });
    expect(descentTuning(70)).toEqual({ secondsPerStage: 12, assist: true });
    expect(descentTuning(69)).toEqual({ secondsPerStage: 9, assist: false });
    expect(descentTuning(35)).toEqual({ secondsPerStage: 9, assist: false });
    expect(descentTuning(34)).toEqual({ secondsPerStage: 7, assist: false });
    expect(descentTuning(0)).toEqual({ secondsPerStage: 7, assist: false });
  });

  it("never decreases time as trust increases (monotonic)", () => {
    let prev = 0;
    for (let t = 0; t <= 100; t += 5) {
      const s = descentTuning(t).secondsPerStage;
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});

describe("resolveEnding", () => {
  const flags = (...f: string[]) => new Set(f);

  it("maps trust to the three endings on the base thresholds", () => {
    expect(resolveEnding(85, flags())).toBe("bonded");
    expect(resolveEnding(50, flags())).toBe("functional");
    expect(resolveEnding(20, flags())).toBe("severance");
  });

  it("forces Severance when her core was sacrificed, even at high trust", () => {
    expect(resolveEnding(90, flags("sacrificed_aether"))).toBe("severance");
  });

  it("lifts a Functional to Bonded for a blind leap of faith that paid off", () => {
    expect(resolveEnding(50, flags("trusted_aether_blind"))).toBe("bonded");
    // but does not downgrade or affect an already-bonded / severance result
    expect(resolveEnding(85, flags("trusted_aether_blind"))).toBe("bonded");
    expect(resolveEnding(20, flags("trusted_aether_blind"))).toBe("severance");
  });

  it("sacrifice override beats the blind-trust upgrade", () => {
    expect(resolveEnding(50, flags("trusted_aether_blind", "sacrificed_aether"))).toBe(
      "severance",
    );
  });

  it("every ending has copy", () => {
    for (const e of ["bonded", "functional", "severance"] as const) {
      expect(ENDING_COPY[e].title.length).toBeGreaterThan(0);
      expect(ENDING_COPY[e].line.length).toBeGreaterThan(0);
    }
  });
});
