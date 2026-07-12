/**
 * shared/energyGrid.spec.ts
 *
 * Phase 2 contract tests for the deterministic sub-plot energy-grid simulator.
 * Small fixtures only — these are NOT production balance values.
 */
import { describe, it, expect } from "vitest";
import {
  createFacilityEnergyRequest,
  simulateEnergyGrid,
  simulateEnergyTicks,
  validateEnergyGridInput,
  EnergyGridValidationError,
  type EnergyConsumerInput,
  type EnergyGridInput,
  type NumericFacilityEnergyProfile,
} from "./energyGrid";

const baseProfile: NumericFacilityEnergyProfile = {
  standbyDemand: 0,
  operationalDemand: 10,
  activeDemand: 20,
  burstDemand: 40,
  minimumSustainableDemand: 5,
};

function consumer(
  id: string,
  over: Partial<EnergyConsumerInput> = {},
): EnergyConsumerInput {
  return {
    instanceId: id,
    archetypeId: "assault_foundry",
    operatingMode: "operational",
    priority: "normal",
    alignment: "helios",
    profile: { ...baseProfile },
    ...over,
  };
}

const grid = (over: Partial<EnergyGridInput> = {}): EnergyGridInput => ({
  producers: [{ id: "p1", generation: 100 }],
  consumers: [consumer("a")],
  ...over,
});

describe("validateEnergyGridInput", () => {
  it("accepts a minimal valid grid", () => {
    expect(() => validateEnergyGridInput(grid({ consumers: [consumer("a")] }))).not.toThrow();
  });

  it("rejects negative numbers", () => {
    const err = catchErr(() =>
      validateEnergyGridInput(grid({ producers: [{ id: "p", generation: -5 }] })),
    );
    expect(err).toBeInstanceOf(EnergyGridValidationError);
    expect(err.issues.join(" ")).toMatch(/generation/);
  });

  it("rejects fractional numbers", () => {
    const err = catchErr(() =>
      validateEnergyGridInput(grid({ producers: [{ id: "p", generation: 1.5 }] })),
    );
    expect(err).toBeInstanceOf(EnergyGridValidationError);
  });

  it("rejects unsafe integers", () => {
    const err = catchErr(() =>
      validateEnergyGridInput(grid({ producers: [{ id: "p", generation: Number.MAX_SAFE_INTEGER + 1 }] })),
    );
    expect(err).toBeInstanceOf(EnergyGridValidationError);
  });

  it("rejects duplicate facility instance IDs", () => {
    const err = catchErr(() =>
      validateEnergyGridInput(
        grid({ consumers: [consumer("a"), consumer("a")] }),
      ),
    );
    expect(err.issues.join(" ")).toMatch(/duplicate facility instance id/);
  });

  it("rejects duplicate explicit allocation-order values", () => {
    const err = catchErr(() =>
      validateEnergyGridInput(
        grid({
          consumers: [
            consumer("a", { allocationOrder: 3, priority: "high" }),
            consumer("b", { allocationOrder: 3, priority: "high" }),
          ],
        }),
      ),
    );
    expect(err.issues.join(" ")).toMatch(/duplicate explicit allocation-order/);
  });

  it("rejects unknown archetype IDs", () => {
    const err = catchErr(() =>
      validateEnergyGridInput(
        grid({ consumers: [consumer("a", { archetypeId: "not_a_facility" as "assault_foundry" })] }),
      ),
    );
    expect(err.issues.join(" ")).toMatch(/unknown facility archetype/);
  });

  it("rejects unsupported priority, mode, and alignment", () => {
    const p = catchErr(() =>
      validateEnergyGridInput(
        grid({ consumers: [consumer("a", { priority: "urgent" as "normal" })] }),
      ),
    );
    expect(p.issues.join(" ")).toMatch(/priority/);
    const m = catchErr(() =>
      validateEnergyGridInput(
        grid({ consumers: [consumer("a", { operatingMode: "turbo" as "active" })] }),
      ),
    );
    expect(m.issues.join(" ")).toMatch(/operatingMode/);
    const a = catchErr(() =>
      validateEnergyGridInput(
        grid({ consumers: [consumer("a", { alignment: "solar" as "helios" })] }),
      ),
    );
    expect(a.issues.join(" ")).toMatch(/alignment/);
  });

  it("rejects requested demand below minimum sustainable demand", () => {
    const profile: NumericFacilityEnergyProfile = {
      standbyDemand: 0,
      operationalDemand: 4,
      activeDemand: 6,
      burstDemand: 10,
      minimumSustainableDemand: 5,
    };
    const err = catchErr(() =>
      validateEnergyGridInput(
        grid({ consumers: [consumer("a", { operatingMode: "operational", profile })] }),
      ),
    );
    expect(err.issues.join(" ")).toMatch(/below minimum sustainable demand/);
  });

  it("rejects stored energy above capacity", () => {
    const err = catchErr(() =>
      validateEnergyGridInput(
        grid({
          storage: { capacity: 50, initialStored: 60, reserveFloor: 0, maxChargeRate: 10, maxDischargeRate: 10 },
        }),
      ),
    );
    expect(err.issues.join(" ")).toMatch(/above capacity/);
  });

  it("rejects reserve floor above capacity", () => {
    const err = catchErr(() =>
      validateEnergyGridInput(
        grid({
          storage: { capacity: 50, initialStored: 10, reserveFloor: 60, maxChargeRate: 10, maxDischargeRate: 10 },
        }),
      ),
    );
    expect(err.issues.join(" ")).toMatch(/above capacity/);
  });

  it("rejects invalid charge/discharge limits", () => {
    const neg = catchErr(() =>
      validateEnergyGridInput(
        grid({
          storage: { capacity: 50, initialStored: 10, reserveFloor: 0, maxChargeRate: -1, maxDischargeRate: 10 },
        }),
      ),
    );
    expect(neg).toBeInstanceOf(EnergyGridValidationError);
    const frac = catchErr(() =>
      validateEnergyGridInput(
        grid({
          storage: { capacity: 50, initialStored: 10, reserveFloor: 0, maxChargeRate: 1.5, maxDischargeRate: 10 },
        }),
      ),
    );
    expect(frac).toBeInstanceOf(EnergyGridValidationError);
  });
});

describe("createFacilityEnergyRequest", () => {
  it("selects demand from operating mode", () => {
    const req = createFacilityEnergyRequest({
      instanceId: "x",
      archetypeId: "assault_foundry",
      operatingMode: "burst",
      priority: "normal",
      alignment: "helios",
      profile: baseProfile,
    });
    expect(req.operatingMode).toBe("burst");
  });

  it("does not convert Phase 1 qualitative labels", () => {
    const req = createFacilityEnergyRequest({
      instanceId: "x",
      archetypeId: "siege_battery",
      operatingMode: "operational",
      priority: "high",
      alignment: "aegis",
      profile: baseProfile,
    });
    expect(req.profile.operationalDemand).toBe(10);
  });

  it("throws on unknown archetype", () => {
    expect(() =>
      createFacilityEnergyRequest({
        instanceId: "x",
        archetypeId: "bogus" as "assault_foundry",
        operatingMode: "operational",
        priority: "normal",
        alignment: "helios",
        profile: baseProfile,
      }),
    ).toThrow(EnergyGridValidationError);
  });
});

describe("allocate order and storage", () => {
  it("exact supply => fully powered, no storage movement", () => {
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 10 }],
        consumers: [consumer("a", { profile: { ...baseProfile, operationalDemand: 10 } })],
      }),
    );
    expect(r.totalGeneration).toBe(10);
    expect(r.totalAllocated).toBe(10);
    expect(r.facilities[0].powerState).toBe("fully_powered");
    expect(r.facilities[0].allocated).toBe(10);
  });

  it("surplus charges storage, curtailing the overflow", () => {
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 100 }],
        consumers: [consumer("a", { profile: { ...baseProfile, operationalDemand: 10 } })],
        storage: { capacity: 50, initialStored: 10, reserveFloor: 0, maxChargeRate: 20, maxDischargeRate: 20 },
      }),
    );
    expect(r.charged).toBe(20); // rate-limited
    expect(r.endingStorage).toBe(30);
    expect(r.curtailedGeneration).toBe(70); // 90 surplus - 20 charged
  });

  it("full storage => all surplus curtailed", () => {
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 100 }],
        consumers: [consumer("a", { profile: { ...baseProfile, operationalDemand: 10 } })],
        storage: { capacity: 50, initialStored: 50, reserveFloor: 0, maxChargeRate: 100, maxDischargeRate: 100 },
      }),
    );
    expect(r.charged).toBe(0);
    expect(r.endingStorage).toBe(50);
    expect(r.curtailedGeneration).toBe(90);
  });

  it("deficit discharges storage above reserve floor", () => {
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 80 }],
        consumers: [consumer("a", { profile: { ...baseProfile, operationalDemand: 100 } })],
        storage: { capacity: 100, initialStored: 100, reserveFloor: 20, maxChargeRate: 100, maxDischargeRate: 50 },
      }),
    );
    // deficit 20, available above reserve = 80, limited by rate 50 => discharge 20
    expect(r.discharged).toBe(20);
    expect(r.endingStorage).toBe(80);
    expect(r.facilities[0].allocated).toBe(100);
    expect(r.facilities[0].powerState).toBe("fully_powered");
  });

  it("reserve floor is protected during deficit", () => {
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 0 }],
        consumers: [consumer("a", { profile: { ...baseProfile, operationalDemand: 100 } })],
        storage: { capacity: 100, initialStored: 30, reserveFloor: 30, maxChargeRate: 100, maxDischargeRate: 100 },
      }),
    );
    expect(r.discharged).toBe(0);
    expect(r.endingStorage).toBe(30);
    expect(r.facilities[0].allocated).toBe(0);
    expect(r.facilities[0].powerState).toBe("offline");
  });

  it("never charges and discharges in the same tick", () => {
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 50 }],
        consumers: [consumer("a", { profile: { ...baseProfile, operationalDemand: 100 } })],
        storage: { capacity: 100, initialStored: 100, reserveFloor: 0, maxChargeRate: 100, maxDischargeRate: 100 },
      }),
    );
    expect(r.discharged >= 0).toBe(true);
    expect(r.charged).toBe(0); // discharge happened; charge must not
    expect(r.facilities[0].allocated).toBe(100);
    expect(r.endingStorage).toBe(50);
  });
});

describe("power states", () => {
  it("reduced when allocated >= minimum but below requested", () => {
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 7 }],
        consumers: [consumer("a", { profile: { ...baseProfile, operationalDemand: 10, minimumSustainableDemand: 5 } })],
      }),
    );
    expect(r.facilities[0].allocated).toBe(7);
    expect(r.facilities[0].powerState).toBe("reduced");
  });

  it("offline when allocated below minimum", () => {
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 3 }],
        consumers: [consumer("a", { profile: { ...baseProfile, operationalDemand: 10, minimumSustainableDemand: 5 } })],
      }),
    );
    expect(r.facilities[0].allocated).toBe(0);
    expect(r.facilities[0].powerState).toBe("offline");
  });

  it("sub-minimum energy is left in the pool for a smaller-minimum facility", () => {
    const big: NumericFacilityEnergyProfile = {
      standbyDemand: 0, operationalDemand: 10, activeDemand: 10, burstDemand: 10, minimumSustainableDemand: 10,
    };
    const small: NumericFacilityEnergyProfile = {
      standbyDemand: 0, operationalDemand: 8, activeDemand: 8, burstDemand: 8, minimumSustainableDemand: 2,
    };
    // 12 total; big needs 10 but pool only 12 after big takes? order: big first by priority.
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 12 }],
        consumers: [
          consumer("big", { profile: big, priority: "low" }),
          consumer("small", { profile: small, priority: "high" }),
        ],
      }),
    );
    // high (small) served first: gets 8 (>=min), pool 4. low (big) pool 4 < min10 => 0.
    const smallRes = r.facilities.find((f) => f.instanceId === "small")!;
    const bigRes = r.facilities.find((f) => f.instanceId === "big")!;
    expect(smallRes.allocated).toBe(8);
    expect(bigRes.allocated).toBe(0);
    expect(bigRes.powerState).toBe("offline");
  });
});

describe("priority and determinism", () => {
  it("priority ordering: critical served before low", () => {
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 15 }],
        consumers: [
          consumer("low", { operatingMode: "active", priority: "low", profile: { ...baseProfile, activeDemand: 10 } }),
          consumer("crit", { operatingMode: "active", priority: "critical", profile: { ...baseProfile, activeDemand: 10 } }),
        ],
      }),
    );
    const crit = r.facilities.find((f) => f.instanceId === "crit")!;
    const low = r.facilities.find((f) => f.instanceId === "low")!;
    expect(crit.allocated).toBe(10);
    expect(low.allocated).toBe(5);
    expect(low.powerState).toBe("reduced");
  });

  it("equal-priority deterministic ordering by instanceId", () => {
    const make = () =>
      simulateEnergyGrid(
        grid({
          producers: [{ id: "p", generation: 5 }],
          consumers: [
            consumer("z", { priority: "normal" }),
            consumer("a", { priority: "normal" }),
          ],
        }),
      );
    const r1 = make();
    const r2 = make();
    expect(r1.facilities.map((f) => f.instanceId)).toEqual(["a", "z"]);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("explicit allocationOrder overrides instanceId tiebreak", () => {
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 5 }],
        consumers: [
          consumer("z", { priority: "normal", allocationOrder: 2 }),
          consumer("a", { priority: "normal", allocationOrder: 1 }),
        ],
      }),
    );
    expect(r.facilities.map((f) => f.instanceId)).toEqual(["a", "z"]);
  });

  it("deterministic serialization for identical inputs", () => {
    const r1 = simulateEnergyGrid(grid());
    const r2 = simulateEnergyGrid(grid());
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

describe("brownout and blackout", () => {
  it("brownout when one facility is reduced", () => {
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 7 }],
        consumers: [consumer("a", { profile: { ...baseProfile, operationalDemand: 10, minimumSustainableDemand: 5 } })],
      }),
    );
    expect(r.brownout).toBe(true);
    expect(r.blackout).toBe(false);
  });

  it("blackout when no requesting facility receives its minimum", () => {
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 3 }],
        consumers: [consumer("a", { profile: { ...baseProfile, operationalDemand: 10, minimumSustainableDemand: 5 } })],
      }),
    );
    expect(r.brownout).toBe(true);
    expect(r.blackout).toBe(true);
  });
});

describe("multiple instances and burst", () => {
  it("handles multiple instances of one archetype", () => {
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 20 }],
        consumers: [
          consumer("a", { instanceId: "a" }),
          consumer("b", { instanceId: "b" }),
        ],
      }),
    );
    expect(r.totalAllocated).toBe(20);
    expect(r.facilities).toHaveLength(2);
    expect(r.facilities.every((f) => f.powerState === "fully_powered")).toBe(true);
  });

  it("serves burst demand", () => {
    const r = simulateEnergyGrid(
      grid({
        producers: [{ id: "p", generation: 40 }],
        consumers: [consumer("a", { operatingMode: "burst", profile: { ...baseProfile, burstDemand: 40 } })],
      }),
    );
    expect(r.facilities[0].requested).toBe(40);
    expect(r.facilities[0].allocated).toBe(40);
  });
});

describe("alignment has no numerical effect", () => {
  it("identical numeric inputs give identical allocations across alignments", () => {
    const mk = (alignment: "helios" | "aegis" | "nexus") =>
      simulateEnergyGrid(
        grid({
          producers: [{ id: "p", generation: 15 }],
          consumers: [consumer("a", { alignment, profile: { ...baseProfile, operationalDemand: 10 } })],
        }),
      );
    const h = mk("helios");
    const a = mk("aegis");
    const n = mk("nexus");
    expect(h.facilities[0].allocated).toBe(a.facilities[0].allocated);
    expect(a.facilities[0].allocated).toBe(n.facilities[0].allocated);
    expect(h.totalAllocated).toBe(a.totalAllocated);
    expect(a.totalAllocated).toBe(n.totalAllocated);
    // Only the echoed alignment differs.
    expect(h.facilities[0].alignment).toBe("helios");
    expect(a.facilities[0].alignment).toBe("aegis");
    expect(n.facilities[0].alignment).toBe("nexus");
  });
});

describe("multi-tick", () => {
  it("threads ending storage across ticks (discharge then recharge)", () => {
    const ticks: EnergyGridInput[] = [
      {
        producers: [{ id: "p", generation: 0 }],
        consumers: [consumer("a", { profile: { ...baseProfile, operationalDemand: 30 } })],
        storage: { capacity: 100, initialStored: 100, reserveFloor: 0, maxChargeRate: 50, maxDischargeRate: 50 },
      },
      {
        producers: [{ id: "p", generation: 100 }],
        consumers: [consumer("a", { profile: { ...baseProfile, operationalDemand: 10 } })],
        storage: { capacity: 100, initialStored: 100, reserveFloor: 0, maxChargeRate: 50, maxDischargeRate: 50 },
      },
    ];
    const results = simulateEnergyTicks(ticks);
    // tick 0: deficit 30 => discharge 30, ending 70
    expect(results[0].endingStorage).toBe(70);
    expect(results[0].discharged).toBe(30);
    // tick 1: starts at 70, surplus 90, charge min(50, room30, 90)=30 => ending 100
    expect(results[1].startingStorage).toBe(70);
    expect(results[1].charged).toBe(30);
    expect(results[1].endingStorage).toBe(100);
  });

  it("storage never exceeds capacity or goes negative", () => {
    const ticks: EnergyGridInput[] = [
      {
        producers: [{ id: "p", generation: 0 }],
        consumers: [consumer("a", { profile: { ...baseProfile, operationalDemand: 200 } })],
        storage: { capacity: 100, initialStored: 100, reserveFloor: 0, maxChargeRate: 100, maxDischargeRate: 100 },
      },
    ];
    const [r] = simulateEnergyTicks(ticks);
    expect(r.endingStorage).toBeGreaterThanOrEqual(0);
    expect(r.endingStorage).toBeLessThanOrEqual(100);
  });
});

function catchErr(fn: () => unknown): EnergyGridValidationError {
  try {
    fn();
  } catch (e) {
    if (e instanceof EnergyGridValidationError) return e;
    throw e;
  }
  throw new Error("expected EnergyGridValidationError");
}
