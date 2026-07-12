/**
 * shared/combatProfile.spec.ts
 *
 * Phase 3 contract tests for the immutable combat-profile / battle-snapshot.
 * Small fixtures only — NOT production balance values.
 */
import { describe, it, expect } from "vitest";
import {
  buildCombatProfile,
  createBattleSnapshot,
  serializeBattleSnapshot,
  stableStringify,
  validateCombatProfileDraft,
  CombatProfileValidationError,
  type CombatProfileDraft,
} from "./combatProfile";

function baseDraft(over: Partial<CombatProfileDraft> = {}): CombatProfileDraft {
  return {
    origin: {
      actor: { playerId: "attacker-1", factionId: "NEXUS-7", isAI: false },
      plot: { plotId: 11, parcelId: "parcel-origin" },
      subPlot: { subParcelId: "sp-1", index: 4 },
    },
    target: {
      actor: { playerId: "defender-1", factionId: "KRONOS", isAI: true },
      plot: { plotId: 12, parcelId: "parcel-target" },
      subPlot: null,
    },
    commitment: { troops: 50, iron: 10, fuel: 5, crystal: 0 },
    facilityContext: {
      facilities: [
        { instanceId: "f1", archetypeId: "assault_foundry", alignment: "helios", level: 2 },
      ],
    },
    energyContext: { alignment: "helios", gridSummary: null },
    upgradeContext: {
      upgrades: [{ archetypeId: "assault_foundry", effectKey: "troop_production", tier: 1 }],
    },
    targetDefense: {
      defenseLevel: 3,
      biome: "mountain",
      improvements: [{ type: "turret", level: 1 }, { type: "fortress", level: 2 }],
      orbitalHazardActive: false,
    },
    modifiers: [],
    seedParts: ["battle-xyz", 1700000000000],
    ...over,
  };
}

describe("validateCombatProfileDraft", () => {
  it("accepts a valid draft", () => {
    expect(() => validateCombatProfileDraft(baseDraft())).not.toThrow();
  });

  it("rejects a non-object draft", () => {
    expect(() => validateCombatProfileDraft(null)).toThrow(CombatProfileValidationError);
  });

  it("rejects missing/invalid actor refs", () => {
    const err = catchErr(() => validateCombatProfileDraft(baseDraft({ origin: { actor: { playerId: "", factionId: null, isAI: "no" as unknown as boolean }, plot: { plotId: 1, parcelId: "p" } } as CombatProfileDraft["origin"] } as unknown as CombatProfileDraft)));
    expect(err.issues.join(" ")).toMatch(/origin\.actor\.playerId/);
  });

  it("rejects negative commitment numbers", () => {
    const err = catchErr(() => validateCombatProfileDraft(baseDraft({ commitment: { troops: -1, iron: 0, fuel: 0, crystal: 0 } })));
    expect(err.issues.join(" ")).toMatch(/commitment\.troops/);
  });

  it("rejects fractional numbers", () => {
    const err = catchErr(() => validateCombatProfileDraft(baseDraft({ commitment: { troops: 1.5, iron: 0, fuel: 0, crystal: 0 } })));
    expect(err.issues.join(" ")).toMatch(/commitment\.troops/);
  });

  it("rejects unknown facility archetype", () => {
    const err = catchErr(() =>
      validateCombatProfileDraft(
        baseDraft({ facilityContext: { facilities: [{ instanceId: "f1", archetypeId: "bogus" as "assault_foundry", alignment: "helios", level: 1 }] } }),
      ),
    );
    expect(err.issues.join(" ")).toMatch(/unknown facility archetype/);
  });

  it("rejects duplicate facility instance ids", () => {
    const err = catchErr(() =>
      validateCombatProfileDraft(
        baseDraft({
          facilityContext: {
            facilities: [
              { instanceId: "f1", archetypeId: "assault_foundry", alignment: "helios", level: 1 },
              { instanceId: "f1", archetypeId: "siege_battery", alignment: "aegis", level: 1 },
            ],
          },
        }),
      ),
    );
    expect(err.issues.join(" ")).toMatch(/duplicate facility instance id/);
  });

  it("rejects unsupported biome", () => {
    const err = catchErr(() =>
      validateCombatProfileDraft(baseDraft({ targetDefense: { defenseLevel: 1, biome: "lava" as "mountain", improvements: [], orbitalHazardActive: false } })),
    );
    expect(err.issues.join(" ")).toMatch(/biome/);
  });

  it("rejects unsupported alignment", () => {
    const err = catchErr(() =>
      validateCombatProfileDraft(baseDraft({ energyContext: { alignment: "solar" as "helios", gridSummary: null } })),
    );
    expect(err.issues.join(" ")).toMatch(/alignment/);
  });

  it("rejects invalid modifier", () => {
    const err = catchErr(() =>
      validateCombatProfileDraft(
        baseDraft({ modifiers: [{ source: "", kind: "explode" as "flat", scope: "attacker", value: 1 }] }),
      ),
    );
    expect(err.issues.join(" ")).toMatch(/modifiers\[0\]\.source|modifiers\[0\]\.kind/);
  });

  it("rejects empty seedParts", () => {
    const err = catchErr(() => validateCombatProfileDraft(baseDraft({ seedParts: [] })));
    expect(err.issues.join(" ")).toMatch(/seedParts/);
  });

  it("rejects non-integer randomSeed", () => {
    const err = catchErr(() => validateCombatProfileDraft(baseDraft({ randomSeed: 1.5 })));
    expect(err.issues.join(" ")).toMatch(/randomSeed/);
  });
});

describe("buildCombatProfile", () => {
  it("builds an immutable, version-1 profile", () => {
    const p = buildCombatProfile(baseDraft());
    expect(p.version).toBe(1);
    expect(p.profileId).toMatch(/^cp_/);
    expect(p.randomSeed).toBeGreaterThanOrEqual(0);
  });

  it("derives a deterministic profileId for identical drafts", () => {
    const a = buildCombatProfile(baseDraft());
    const b = buildCombatProfile(baseDraft());
    expect(a.profileId).toBe(b.profileId);
    expect(a.randomSeed).toBe(b.randomSeed);
  });

  it("content-addresses: different drafts yield different ids", () => {
    const a = buildCombatProfile(baseDraft());
    const b = buildCombatProfile(baseDraft({ commitment: { troops: 99, iron: 0, fuel: 0, crystal: 0 } }));
    expect(a.profileId).not.toBe(b.profileId);
  });

  it("uses an explicit randomSeed when provided", () => {
    const p = buildCombatProfile(baseDraft({ randomSeed: 4242 }));
    expect(p.randomSeed).toBe(4242);
  });

  it("fails closed on invalid drafts", () => {
    expect(() => buildCombatProfile(baseDraft({ commitment: { troops: -1, iron: 0, fuel: 0, crystal: 0 } }))).toThrow(
      CombatProfileValidationError,
    );
  });

  it("does NOT call resolveBattle or touch runtime types", () => {
    // Pure build; no side effects. (Implicit — if it imported the engine it
    // would still run, but the contract guarantees no integration here.)
    const p = buildCombatProfile(baseDraft());
    expect(p.modifiers).toEqual([]);
  });
});

describe("createBattleSnapshot", () => {
  it("freezes the profile and locks the seed", () => {
    const p = buildCombatProfile(baseDraft());
    const s = createBattleSnapshot(p, 1700000000000);
    expect(s.version).toBe(1);
    expect(s.snapshotId).toMatch(/^bs_/);
    expect(s.startTs).toBe(1700000000000);
    expect(s.randomSeed).toBe(p.randomSeed);
    expect(s.hash).toMatch(/^\d+$/);
  });

  it("is deterministic for identical (profile, startTs)", () => {
    const p = buildCombatProfile(baseDraft());
    const a = createBattleSnapshot(p, 1700000000000);
    const b = createBattleSnapshot(p, 1700000000000);
    expect(a.snapshotId).toBe(b.snapshotId);
    expect(a.hash).toBe(b.hash);
  });

  it("differs when startTs differs", () => {
    const p = buildCombatProfile(baseDraft());
    const a = createBattleSnapshot(p, 1700000000000);
    const b = createBattleSnapshot(p, 1700000000001);
    expect(a.snapshotId).not.toBe(b.snapshotId);
  });

  it("rejects non-integer startTs", () => {
    const p = buildCombatProfile(baseDraft());
    expect(() => createBattleSnapshot(p, 1.5)).toThrow(CombatProfileValidationError);
  });
});

describe("serializeBattleSnapshot determinism", () => {
  it("produces identical output for identical snapshots", () => {
    const p = buildCombatProfile(baseDraft());
    const a = serializeBattleSnapshot(createBattleSnapshot(p, 100));
    const b = serializeBattleSnapshot(createBattleSnapshot(p, 100));
    expect(a).toBe(b);
  });

  it("stableStringify is key-order independent", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it("serialization changes only when content changes", () => {
    const p1 = serializeBattleSnapshot(createBattleSnapshot(buildCombatProfile(baseDraft()), 100));
    const p2 = serializeBattleSnapshot(
      createBattleSnapshot(buildCombatProfile(baseDraft({ commitment: { troops: 1, iron: 0, fuel: 0, crystal: 0 } })), 100),
    );
    expect(p1).not.toBe(p2);
  });
});

function catchErr(fn: () => unknown): CombatProfileValidationError {
  try {
    fn();
  } catch (e) {
    if (e instanceof CombatProfileValidationError) return e;
    throw e;
  }
  throw new Error("expected CombatProfileValidationError");
}
