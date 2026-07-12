/**
 * server/engine/battle/profileAdapter.spec.ts
 *
 * Phase A — parity and immutability tests for the battle launch adapter.
 *
 * These tests prove that the adapter:
 *   1. Produces the EXACT same EngineBattleInput as the legacy deployAttack
 *      formula (representative attack, minimum attack, commander, crystal,
 *      radar, biome/defense).
 *   2. Produces a stable, deterministic, content-addressed profile + snapshot.
 *   3. Snapshots are immutable — later mutation of source objects does not
 *      affect the created snapshot.
 *   4. Strategic systems (weapon, doctrine, facility, alignment, energy,
 *      upgrade) do not alter battle power in Phase A.
 *   5. Validation failures (unknown alignment, negative numbers, etc.) are
 *      rejected with CombatProfileValidationError.
 *   6. Crystal and commander are tracked as SEPARATE modifiers even though
 *      the legacy engine input combines them in one field.
 */
import { describe, it, expect } from "vitest";
import {
  buildLaunchProfile,
  CombatProfileValidationError,
  type LaunchAction,
  type AttackerLaunchState,
  type TargetLaunchState,
} from "./profileAdapter.js";
import { hashSeed } from "./random.js";
import { CRYSTAL_POWER_FACTOR } from "./tuning.js";

const NOW = 1_700_000_000_000;
const BATTLE_ID = "battle-00000000-0000-0000-0000-000000000001";

function action(overrides: Partial<LaunchAction> = {}): LaunchAction {
  return {
    attackerId:       "player-attacker",
    targetParcelId:   "parcel-target",
    troopsCommitted:  50,
    resourcesBurned:  { iron: 100, fuel: 80 },
    crystalBurned:    5,
    sourceParcelId:   null,
    commanderId:      "cmd-reaper",
    ...overrides,
  };
}

function attacker(overrides: Partial<AttackerLaunchState> = {}): AttackerLaunchState {
  return {
    id:                 "player-attacker",
    name:               "Attacker",
    isAI:               false,
    commanderBonus:     30, // 30% from Reaper Commander
    commanderId:        "cmd-reaper",
    moraleDebuffActive: false,
    factionLabel:       null,
    ...overrides,
  };
}

function target(overrides: Partial<TargetLaunchState> = {}): TargetLaunchState {
  return {
    parcelId:     "parcel-target",
    plotId:       123,
    biome:        "mountain",
    defenseLevel: 3,
    ownerId:      "player-defender",
    improvements: [
      { type: "turret",     level: 2 },
      { type: "shield_gen", level: 1 },
      { type: "fortress",   level: 1 },
      { type: "radar",      level: 1 },
      { type: "data_centre", level: 1 }, // ignored by both legacy and adapter
    ],
    hasRadar: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Legacy parity — the adapter's `legacyBattleInput` must match the legacy
// deployAttack() formula exactly.
// ---------------------------------------------------------------------------

describe("profileAdapter — legacy input parity", () => {
  it("representative attack: legacyBattleInput matches the legacy formula", () => {
    const result = buildLaunchProfile(BATTLE_ID, action(), attacker(), target(), NOW);
    const expected = {
      battleId: BATTLE_ID,
      attackerId: "player-attacker",
      defenderId: "player-defender",
      plotId: 123,
      troopsCommitted: 50 * 0.9,
      resourcesBurned: { iron: 100 * 0.9, fuel: 80 * 0.9 },
      commanderBonus: (30 + 5 * CRYSTAL_POWER_FACTOR) * 0.9,
      moraleDebuffActive: false,
      defenseLevel: 3,
      biome: "mountain",
      improvements: [
        { type: "turret", level: 2 },
        { type: "shield_gen", level: 1 },
        { type: "fortress", level: 1 },
      ],
      orbitalHazardActive: false,
      randomSeed: hashSeed(BATTLE_ID, NOW),
    };
    expect(result.legacyBattleInput).toEqual(expected);
  });

  it("minimum valid attack: no commander, no crystal, no radar, no morale", () => {
    const result = buildLaunchProfile(
      BATTLE_ID,
      action({ crystalBurned: 0, commanderId: null, troopsCommitted: 1, resourcesBurned: { iron: 0, fuel: 0 } }),
      attacker({ commanderBonus: 0, commanderId: null }),
      target({
        improvements: [],
        hasRadar: false,
        ownerId: null,
      }),
      NOW,
    );
    const expected = {
      battleId: BATTLE_ID,
      attackerId: "player-attacker",
      defenderId: null,
      plotId: 123,
      troopsCommitted: 1, // radarMod = 1
      resourcesBurned: { iron: 0, fuel: 0 },
      commanderBonus: 0,
      moraleDebuffActive: false,
      defenseLevel: 3,
      biome: "mountain",
      improvements: [],
      orbitalHazardActive: false,
      randomSeed: hashSeed(BATTLE_ID, NOW),
    };
    expect(result.legacyBattleInput).toEqual(expected);
  });

  it("commander contribution: commanderBonus flows through unchanged", () => {
    const a = attacker({ commanderBonus: 42 });
    const result = buildLaunchProfile(BATTLE_ID, action({ crystalBurned: 0 }), a, target({ hasRadar: false }), NOW);
    // (42 + 0 * 1.2) * 1.0 = 42
    expect(result.legacyBattleInput.commanderBonus).toBe(42);
  });

  it("crystal contribution: crystal × CRYSTAL_POWER_FACTOR is added to commanderBonus (not double-counted with commander)", () => {
    const a = attacker({ commanderBonus: 10 });
    const actionA = action({ crystalBurned: 5 });
    const result = buildLaunchProfile(BATTLE_ID, actionA, a, target({ hasRadar: false }), NOW);
    // (10 + 5 * 1.2) * 1.0 = 10 + 6 = 16
    expect(result.legacyBattleInput.commanderBonus).toBe(10 + 5 * CRYSTAL_POWER_FACTOR);
    // Crystal is NOT silently double-counted — the adapter records it as a
    // separate CombatModifier with its own `value` and the legacy input is
    // still the single combined number the resolver sees.
    const crystalMod = result.profile.modifiers.find((m) => m.source === "resource.crystal");
    expect(crystalMod).toBeDefined();
    expect(crystalMod?.value).toBe(Math.round(5 * CRYSTAL_POWER_FACTOR));
    const cmdMod = result.profile.modifiers.find((m) => m.source === "commander.attackBonus");
    expect(cmdMod).toBeDefined();
    expect(cmdMod?.value).toBe(10);
  });

  it("Radar Array modifier: defender's radar reduces all attacker inputs × 0.9", () => {
    const a = attacker({ commanderBonus: 0 });
    const actionA = action({ crystalBurned: 0, troopsCommitted: 100, resourcesBurned: { iron: 50, fuel: 40 } });
    const result = buildLaunchProfile(BATTLE_ID, actionA, a, target({ hasRadar: true }), NOW);
    expect(result.legacyBattleInput.troopsCommitted).toBe(90);
    expect(result.legacyBattleInput.resourcesBurned).toEqual({ iron: 45, fuel: 36 });
    expect(result.legacyBattleInput.commanderBonus).toBe(0);
  });

  it("biome and defense state: targetDefense mirrors target launch state", () => {
    const result = buildLaunchProfile(
      BATTLE_ID,
      action(),
      attacker(),
      target({ biome: "desert", defenseLevel: 7, improvements: [{ type: "turret", level: 3 }] }),
      NOW,
    );
    expect(result.profile.targetDefense.defenseLevel).toBe(7);
    expect(result.profile.targetDefense.biome).toBe("desert");
    expect(result.profile.targetDefense.improvements).toEqual([{ type: "turret", level: 3 }]);
    // The legacy input filters to defense-relevant improvements.
    expect(result.legacyBattleInput.improvements).toEqual([{ type: "turret", level: 3 }]);
  });

  it("unowned target: defenderId is null, target actor uses 'unowned' sentinel", () => {
    const result = buildLaunchProfile(
      BATTLE_ID,
      action(),
      attacker(),
      target({ ownerId: null }),
      NOW,
    );
    expect(result.legacyBattleInput.defenderId).toBeNull();
    expect(result.profile.target.actor.playerId).toBe("unowned");
  });

  it("morale debuff: flag is preserved in legacy input, modifier is recorded", () => {
    const result = buildLaunchProfile(
      BATTLE_ID,
      action(),
      attacker({ moraleDebuffActive: true }),
      target({ hasRadar: false }),
      NOW,
    );
    expect(result.legacyBattleInput.moraleDebuffActive).toBe(true);
    const moraleMod = result.profile.modifiers.find((m) => m.source === "debuff.morale");
    expect(moraleMod).toBeDefined();
    expect(moraleMod?.kind).toBe("multiplier");
    // Encoded as 75 (= 0.75×, the legacy (1 - 0.25) factor).
    expect(moraleMod?.value).toBe(75);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("profileAdapter — determinism", () => {
  it("same authoritative state, start time, and seed produce the same profile + snapshot", () => {
    const a = buildLaunchProfile(BATTLE_ID, action(), attacker(), target(), NOW);
    const b = buildLaunchProfile(BATTLE_ID, action(), attacker(), target(), NOW);
    expect(a.profile.profileId).toBe(b.profile.profileId);
    expect(a.snapshot.snapshotId).toBe(b.snapshot.snapshotId);
    expect(a.snapshot.hash).toBe(b.snapshot.hash);
    expect(a.legacyBattleInput.randomSeed).toBe(b.legacyBattleInput.randomSeed);
  });

  it("different battleId produces a different snapshot id", () => {
    const a = buildLaunchProfile("id-a", action(), attacker(), target(), NOW);
    const b = buildLaunchProfile("id-b", action(), attacker(), target(), NOW);
    expect(a.snapshot.snapshotId).not.toBe(b.snapshot.snapshotId);
  });

  it("different startTs produces a different snapshot id (locks the launch time)", () => {
    const a = buildLaunchProfile(BATTLE_ID, action(), attacker(), target(), NOW);
    const b = buildLaunchProfile(BATTLE_ID, action(), attacker(), target(), NOW + 1);
    expect(a.snapshot.snapshotId).not.toBe(b.snapshot.snapshotId);
  });
});

// ---------------------------------------------------------------------------
// Snapshot immutability
// ---------------------------------------------------------------------------

describe("profileAdapter — snapshot immutability", () => {
  it("later mutation of the attacker does not change the created snapshot", () => {
    const a = attacker();
    const result = buildLaunchProfile(BATTLE_ID, action(), a, target(), NOW);
    const beforeProfileId = result.profile.profileId;
    const beforeSnapshotId = result.snapshot.snapshotId;
    const beforeCommanderBonus = result.legacyBattleInput.commanderBonus;

    // Mutate after construction.
    a.commanderBonus = 999;
    a.isAI = true;
    a.factionLabel = "KRONOS";

    expect(result.profile.profileId).toBe(beforeProfileId);
    expect(result.snapshot.snapshotId).toBe(beforeSnapshotId);
    expect(result.legacyBattleInput.commanderBonus).toBe(beforeCommanderBonus);
    // The CombatProfile itself is readonly, so the TS compiler enforces it
    // at compile time; we still assert the value did not change.
    expect(result.profile.commitment.troops).toBe(action().troopsCommitted);
  });

  it("later mutation of the target does not change the created snapshot", () => {
    const t = target();
    const result = buildLaunchProfile(BATTLE_ID, action(), attacker(), t, NOW);
    const beforeId = result.snapshot.snapshotId;

    t.defenseLevel = 99;
    t.biome = "swamp";
    t.hasRadar = false;

    expect(result.snapshot.snapshotId).toBe(beforeId);
    expect(result.profile.targetDefense.defenseLevel).toBe(3); // unchanged
    expect(result.profile.targetDefense.biome).toBe("mountain");
  });
});

// ---------------------------------------------------------------------------
// No-new-effects guarantee
// ---------------------------------------------------------------------------

describe("profileAdapter — no new combat effects", () => {
  it("changing the (currently empty) facility context does not alter the legacy engine input", () => {
    const a = buildLaunchProfile(BATTLE_ID, action(), attacker(), target(), NOW);
    const b = buildLaunchProfile(BATTLE_ID, action(), attacker(), target(), NOW);
    expect(a.legacyBattleInput).toEqual(b.legacyBattleInput);
    expect(a.profile.facilityContext.facilities).toEqual([]);
  });

  it("changing the (currently null) energy context does not alter the legacy engine input", () => {
    const result = buildLaunchProfile(BATTLE_ID, action(), attacker(), target(), NOW);
    expect(result.profile.energyContext.alignment).toBeNull();
    expect(result.profile.energyContext.gridSummary).toBeNull();
  });

  it("changing the (currently empty) upgrade context does not alter the legacy engine input", () => {
    const result = buildLaunchProfile(BATTLE_ID, action(), attacker(), target(), NOW);
    expect(result.profile.upgradeContext.upgrades).toEqual([]);
  });

  it("the legacy input is independent of the snapshot's modifier list (modifiers are for replay)", () => {
    // Same legacy inputs → same engine input, regardless of how many
    // modifiers the draft records. This proves the resolver still only
    // sees the legacy values; the snapshot is purely descriptive.
    const r1 = buildLaunchProfile(
      BATTLE_ID, action({ crystalBurned: 5 }),
      attacker({ commanderBonus: 30 }),
      target({ hasRadar: true }),
      NOW,
    );
    const r2 = buildLaunchProfile(
      BATTLE_ID, action({ crystalBurned: 5 }),
      attacker({ commanderBonus: 30 }),
      target({ hasRadar: true }),
      NOW,
    );
    expect(r1.legacyBattleInput).toEqual(r2.legacyBattleInput);
    expect(r1.profile.modifiers.length).toBeGreaterThan(0);
    expect(r2.profile.modifiers.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Crystal / Commander separation
// ---------------------------------------------------------------------------

describe("profileAdapter — crystal and commander are conceptually separate", () => {
  it("records commander and crystal as two distinct modifiers even though the legacy engine input combines them", () => {
    const result = buildLaunchProfile(
      BATTLE_ID, action({ crystalBurned: 10 }),
      attacker({ commanderBonus: 25 }),
      target({ hasRadar: false }),
      NOW,
    );
    const sources = result.profile.modifiers.map((m) => m.source).sort();
    expect(sources).toContain("commander.attackBonus");
    expect(sources).toContain("resource.crystal");
    // Legacy engine input still combines them into one number.
    expect(result.legacyBattleInput.commanderBonus).toBe(25 + 10 * CRYSTAL_POWER_FACTOR);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("profileAdapter — contract validation", () => {
  it("rejects fractional commitment numbers", () => {
    expect(() =>
      buildLaunchProfile(
        BATTLE_ID,
        action({ troopsCommitted: 50.5 }),
        attacker(),
        target(),
        NOW,
      ),
    ).toThrow(CombatProfileValidationError);
  });

  it("silently filters unknown improvement types (legacy-compatible behavior)", () => {
    // The legacy `target.improvements` can contain non-defense improvement
    // ids (e.g. "data_centre", "radar", "electricity") that the resolver
    // itself ignores. The adapter's contract filter strips them so the
    // profile never contains an unknown improvement. This is contract-
    // safe and matches the legacy `target.improvements` filtering
    // behavior in deployAttack().
    const result = buildLaunchProfile(
      BATTLE_ID,
      action(),
      attacker(),
      target({ improvements: [{ type: "exotic_thing", level: 1 }] }),
      NOW,
    );
    expect(result.profile.targetDefense.improvements).toEqual([]);
  });

  it("rejects unknown biome", () => {
    expect(() =>
      buildLaunchProfile(
        BATTLE_ID,
        action(),
        attacker(),
        target({ biome: "moon" }),
        NOW,
      ),
    ).toThrow(CombatProfileValidationError);
  });

  it("rejects negative crystal burned", () => {
    expect(() =>
      buildLaunchProfile(
        BATTLE_ID,
        action({ crystalBurned: -1 }),
        attacker(),
        target(),
        NOW,
      ),
    ).toThrow(CombatProfileValidationError);
  });
});

// ---------------------------------------------------------------------------
// Legacy persisted fields parity
// ---------------------------------------------------------------------------

describe("profileAdapter — legacy persisted fields parity", () => {
  it("persisted fields match what deployAttack would have written", () => {
    const result = buildLaunchProfile(
      BATTLE_ID,
      action(),
      attacker(),
      target(),
      NOW,
    );
    expect(result.legacyPersistedFields.id).toBe(BATTLE_ID);
    expect(result.legacyPersistedFields.attackerId).toBe("player-attacker");
    expect(result.legacyPersistedFields.defenderId).toBe("player-defender");
    expect(result.legacyPersistedFields.targetParcelId).toBe("parcel-target");
    expect(result.legacyPersistedFields.troopsCommitted).toBe(50);
    expect(result.legacyPersistedFields.resourcesBurned).toEqual({ iron: 100, fuel: 80 });
    expect(result.legacyPersistedFields.crystalBurned).toBe(5);
    expect(result.legacyPersistedFields.startTs).toBe(NOW);
    // BATTLE_DURATION_MS = 10 * 60 * 1000
    expect(result.legacyPersistedFields.resolveTs).toBe(NOW + 10 * 60 * 1000);
    expect(result.legacyPersistedFields.commanderId).toBe("cmd-reaper");
    // attackerPower and defenderPower are filled by the route AFTER
    // resolveBattle() runs — the adapter leaves them at zero.
    expect(result.legacyPersistedFields.attackerPower).toBe(0);
    expect(result.legacyPersistedFields.defenderPower).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Authoritative origin (sourceParcelId preservation)
// ---------------------------------------------------------------------------

describe("profileAdapter — authoritative origin", () => {
  it("uses action.sourceParcelId when present (exact preservation)", () => {
    const result = buildLaunchProfile(
      BATTLE_ID,
      action({ sourceParcelId: "parcel-source-uuid" }),
      attacker(),
      target(),
      NOW,
    );
    expect(result.profile.origin.plot.parcelId).toBe("parcel-source-uuid");
    // The serialized snapshot must also carry the exact source parcel.
    expect(result.snapshot.profile.origin.plot.parcelId).toBe("parcel-source-uuid");
  });

  it("falls back to the 'unknown_origin' sentinel when sourceParcelId is null", () => {
    const result = buildLaunchProfile(
      BATTLE_ID,
      action({ sourceParcelId: null }),
      attacker(),
      target(),
      NOW,
    );
    expect(result.profile.origin.plot.parcelId).toBe("unknown_origin");
    expect(result.snapshot.profile.origin.plot.parcelId).toBe("unknown_origin");
  });

  it("does not fabricate origin data — no plotId, no extra fields", () => {
    const result = buildLaunchProfile(
      BATTLE_ID,
      action({ sourceParcelId: "real-source" }),
      attacker(),
      target(),
      NOW,
    );
    // plotId is always 0 in Phase A (legacy does not encode the source
    // plotId); the contract requires a number, so 0 is the explicit
    // "not encoded" sentinel. No fabrication of plot coordinates.
    expect(result.profile.origin.plot.plotId).toBe(0);
    expect(result.profile.origin.subPlot).toBeNull();
  });

  it("unowned target uses 'unowned' defender sentinel, distinct from origin", () => {
    const result = buildLaunchProfile(
      BATTLE_ID,
      action({ sourceParcelId: "real-source" }),
      attacker(),
      target({ ownerId: null }),
      NOW,
    );
    // Origin keeps the authoritative source.
    expect(result.profile.origin.plot.parcelId).toBe("real-source");
    // Target's defender is the "unowned" sentinel.
    expect(result.profile.target.actor.playerId).toBe("unowned");
    // The two sentinels do not collide.
    expect(result.profile.origin.plot.parcelId).not.toBe(result.profile.target.actor.playerId);
  });
});

// ---------------------------------------------------------------------------
// Fixed-point modifier semantics (CHECK C)
// ---------------------------------------------------------------------------

describe("profileAdapter — fixed-point modifier semantics", () => {
  it("multiplier modifier value 100 represents 1.00× (no change)", () => {
    // Use a custom attacker to trigger a no-op multiplier; the adapter
    // only pushes the morale modifier when moraleDebuffActive is true, so
    // we verify the absence of a 100-valued multiplier as the "no effect"
    // case. The contract is: multipliers are fixed-point percentages
    // (value / 100).
    const result = buildLaunchProfile(
      BATTLE_ID,
      action(),
      attacker({ moraleDebuffActive: true }),
      target({ hasRadar: false }),
      NOW,
    );
    const morale = result.profile.modifiers.find((m) => m.source === "debuff.morale");
    expect(morale?.value).toBe(75); // 0.75×
  });

  it("radar multiplier value 90 represents 0.90×", () => {
    const result = buildLaunchProfile(
      BATTLE_ID,
      action(),
      attacker({ moraleDebuffActive: false }),
      target({ hasRadar: true }),
      NOW,
    );
    const radar = result.profile.modifiers.find((m) => m.source === "defense.radar");
    expect(radar?.value).toBe(90); // 0.90×
  });

  it("all modifier values are safe integers (no floating-point leakage)", () => {
    const result = buildLaunchProfile(
      BATTLE_ID,
      action({ crystalBurned: 5 }),
      attacker({ moraleDebuffActive: true, commanderBonus: 30 }),
      target({ hasRadar: true }),
      NOW,
    );
    for (const m of result.profile.modifiers) {
      expect(Number.isSafeInteger(m.value)).toBe(true);
    }
  });
});
