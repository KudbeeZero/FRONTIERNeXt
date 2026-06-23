import { describe, it, expect } from "vitest";
import { applyOption, endingFor, seedTrust, ENDING_COPY, type DecisionState } from "./decisions";
import type { ShipSystems } from "../store/types";

const systems = (): ShipSystems => ({ power: 50, navigation: 50, lifeSupport: 50, aetherStability: 50 });
const state = (trust: number, flags: string[] = []): DecisionState => ({
  trust, flags: new Set(flags), systems: systems(),
});

describe("seedTrust", () => {
  it("clamps stability into a 0–100 trust seed", () => {
    expect(seedTrust(88)).toBe(88);
    expect(seedTrust(140)).toBe(100);
    expect(seedTrust(-5)).toBe(0);
  });
});

describe("applyOption", () => {
  it("shifts trust and clamps to [0,100]", () => {
    expect(applyOption(state(90), { id: "o", label: "", trust: 20 }).trust).toBe(100);
    expect(applyOption(state(10), { id: "o", label: "", trust: -30 }).trust).toBe(0);
  });

  it("merges flags without mutating the input", () => {
    const s = state(50, ["a"]);
    const next = applyOption(s, { id: "o", label: "", flags: ["b"] });
    expect([...next.flags].sort()).toEqual(["a", "b"]);
    expect([...s.flags]).toEqual(["a"]); // input untouched
  });

  it("applies + clamps system deltas without touching others", () => {
    const next = applyOption(state(50), { id: "o", label: "", systems: { lifeSupport: -70, power: 10 } });
    expect(next.systems.lifeSupport).toBe(0); // 50-70 clamped
    expect(next.systems.power).toBe(60);
    expect(next.systems.navigation).toBe(50); // untouched
  });

  it("is a no-op shift when the option carries no effects", () => {
    expect(applyOption(state(42), { id: "o", label: "" }).trust).toBe(42);
  });
});

describe("endingFor", () => {
  it("maps trust to the three endings at the thresholds", () => {
    expect(endingFor(85)).toBe("bonded");
    expect(endingFor(70)).toBe("bonded");
    expect(endingFor(69)).toBe("functional");
    expect(endingFor(35)).toBe("functional");
    expect(endingFor(34)).toBe("severance");
    expect(endingFor(0)).toBe("severance");
  });

  it("every ending has copy", () => {
    for (const e of ["bonded", "functional", "severance"] as const) {
      expect(ENDING_COPY[e].title.length).toBeGreaterThan(0);
      expect(ENDING_COPY[e].line.length).toBeGreaterThan(0);
    }
  });
});
