import { describe, it, expect } from "vitest";
import {
  availableBus,
  tierFor,
  resolveTriage,
  balancedAllocation,
  CONSUMERS,
  type Allocation,
} from "./powerTriage";
import { VESTA_TRIAGE as C } from "../data/triage";

const alloc = (lifeSupport: number, comms: number, aetherCore: number): Allocation => ({
  lifeSupport,
  comms,
  aetherCore,
});

describe("availableBus", () => {
  it("subtracts the contain cost when VESTA is contained", () => {
    expect(availableBus(C, true)).toBe(8); // 10 - 2
  });
  it("subtracts the (larger) drain when VESTA is left loose", () => {
    expect(availableBus(C, false)).toBe(7); // 10 - 3
  });
});

describe("tierFor", () => {
  const spec = C.consumers.aetherCore; // demand 4, min 2
  it("is critical below min", () => expect(tierFor(1, spec)).toBe("critical"));
  it("is strained at/above min but below demand", () => {
    expect(tierFor(2, spec)).toBe("strained");
    expect(tierFor(3, spec)).toBe("strained");
  });
  it("is nominal at/above demand", () => expect(tierFor(4, spec)).toBe("nominal"));
});

describe("scenario feasibility (the forced tradeoff)", () => {
  it("cannot make all three nominal — demands exceed the contained bus", () => {
    const demandSum = CONSUMERS.reduce((n, c) => n + C.consumers[c].demand, 0);
    expect(demandSum).toBeGreaterThan(availableBus(C, true));
  });
  it("can always avoid all-critical — mins fit within the loose bus", () => {
    const minSum = CONSUMERS.reduce((n, c) => n + C.consumers[c].min, 0);
    expect(minSum).toBeLessThanOrEqual(availableBus(C, false));
  });
});

describe("resolveTriage — validity", () => {
  it("rejects an allocation that overspends the available bus", () => {
    const o = resolveTriage(C, alloc(4, 3, 4), true); // 11 > 8
    expect(o.valid).toBe(false);
    expect(o.trustDelta).toBe(0); // no trust change on an invalid commit
  });
  it("rejects negative units", () => {
    expect(resolveTriage(C, alloc(-1, 2, 4), true).valid).toBe(false);
  });
  it("accepts an allocation within the bus and reports remaining", () => {
    const o = resolveTriage(C, alloc(2, 2, 4), true); // 8 == available
    expect(o.valid).toBe(true);
    expect(o.used).toBe(8);
    expect(o.remaining).toBe(0);
  });
});

describe("resolveTriage — trust swing (Aether's core drives it)", () => {
  it("feeding her core nominal builds trust", () => {
    // aether 4 = nominal, life 2 strained, comms 2 nominal → +8, no starve bonus
    expect(resolveTriage(C, alloc(2, 2, 4), true).trustDelta).toBe(8);
  });
  it("starving yourself to keep her whole adds a sacrifice bonus", () => {
    // aether 4 nominal, life 1 critical, comms 0 → +8 +4
    const o = resolveTriage(C, alloc(1, 0, 4), true);
    expect(o.flags).toContain("starved_self");
    expect(o.trustDelta).toBe(12);
  });
  it("sacrificing her core is the big negative swing", () => {
    // aether 1 critical, life 4 nominal, comms 3 nominal → -12
    const o = resolveTriage(C, alloc(4, 3, 1), true);
    expect(o.trustDelta).toBe(-12);
    expect(o.flags).toEqual(expect.arrayContaining(["aether_starved", "sacrificed_aether"]));
  });
  it("a strained core is trust-neutral", () => {
    expect(resolveTriage(C, alloc(3, 2, 3), true).trustDelta).toBe(0);
  });
});

describe("resolveTriage — flags", () => {
  it("flags lost comms and the VESTA disposition", () => {
    const loose = resolveTriage(C, alloc(3, 0, 4), false); // comms 0 critical, loose
    expect(loose.flags).toEqual(expect.arrayContaining(["comms_lost", "vesta_loose"]));
    const contained = resolveTriage(C, alloc(2, 2, 4), true);
    expect(contained.flags).toContain("vesta_contained");
  });
});

describe("balancedAllocation", () => {
  it("stays within the available bus and never goes negative", () => {
    for (const contain of [true, false]) {
      const a = balancedAllocation(C, contain);
      const used = a.lifeSupport + a.comms + a.aetherCore;
      expect(used).toBeLessThanOrEqual(availableBus(C, contain));
      expect(Math.min(a.lifeSupport, a.comms, a.aetherCore)).toBeGreaterThanOrEqual(0);
    }
  });
  it("prioritizes keeping Aether's core out of critical", () => {
    const a = balancedAllocation(C, true);
    expect(tierFor(a.aetherCore, C.consumers.aetherCore)).not.toBe("critical");
    expect(resolveTriage(C, a, true).valid).toBe(true);
  });
});
