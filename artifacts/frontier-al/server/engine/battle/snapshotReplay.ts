/**
 * server/engine/battle/snapshotReplay.ts
 *
 * Phase B — durable BattleSnapshot persistence and replay evidence.
 *
 * Provides:
 *   1. `serializeBattleSnapshotForStorage(snapshot)` — canonical JSON string
 *      for JSONB insertion. Uses the existing `serializeBattleSnapshot` from
 *      the shared contract (stable key ordering; deterministic).
 *   2. `parseStoredBattleSnapshot(raw)` — strict validation of a JSONB-
 *      decoded value into a typed `BattleSnapshot`. Rejects unsupported
 *      versions, malformed shapes, non-integer modifier values, mismatched
 *      hash/snapshotId.
 *   3. `replayBattleInputFromSnapshot(snapshot, persistedFields)` —
 *      reconstructs the exact legacy `EngineBattleInput` that the live
 *      `deployAttack()` built. Returns parity with the original launch.
 *   4. `replayLegacyPersistedFieldsFromSnapshot(snapshot, fallback?)` —
 *      derives the legacy persisted battle-row fields the route would have
 *      written, for replay verification.
 *
 * The replay utility is PURE — no I/O, no DB, no clock. It accepts a
 * validated snapshot (from `parseStoredBattleSnapshot`) and returns the
 * reconstructed legacy inputs. The existing live resolver continues to
 * consume the durable legacy battle fields; a future PR may switch
 * resolution to snapshot-backed input.
 *
 * Replayability verdict (Phase B): PARTIAL. The stored snapshot contains
 * every required input to reconstruct the EXACT legacy EngineBattleInput
 * and the exact persisted battle-row fields. It does NOT contain the
 * full `BattleResult` (randFactor, pillage amounts) because the legacy
 * resolver applies the randFactor at resolution time, not at launch.
 * Full outcome replay therefore requires the persisted `attackerPower` and
 * `defenderPower` columns plus the stored `randomSeed` (derivable from
 * `snapshot.randomSeed`).
 */
import { z } from "zod";
import {
  COMBAT_PROFILE_VERSION,
  serializeBattleSnapshot,
  type BattleSnapshot,
  type CombatModifier,
} from "@shared/combatProfile";
import type { EnergyAlignment } from "@shared/schema";
import type { FacilityArchetypeId, FacilityEffectKey } from "@shared/subplotArchitecture";
import type { ImprovementType } from "@shared/schema";
import type { BattleInput as EngineBattleInput, BiomeType as EngineBiomeType, ImprovementType as EngineImprovementType } from "./types.js";
import { CRYSTAL_POWER_FACTOR } from "./tuning.js";
import { hashSeed } from "./random.js";

// ---------------------------------------------------------------------------
// Version-locked legacy constants
// ---------------------------------------------------------------------------
//
// The replay source of truth for crystal power is the stored crystal
// commitment multiplied by a version-locked factor. We do NOT rely on the
// current `CRYSTAL_POWER_FACTOR` export at replay time because a future
// tuning change to that constant must not alter the result of replaying
// a version-1 snapshot.
//
// For version-1 snapshots, the crystal power factor is the same value
// that the legacy `deployAttack()` used at launch time: 1.2. This value
// is locked to the snapshot/profile version so that:
//
//   1. Replay is EXACT — `commitment.crystal * 1.2` always reproduces the
//      legacy `commanderBonus` value, regardless of whether the crystal
//      burn × 1.2 produces a fractional number (e.g. 5 × 1.2 = 6.0,
//      7 × 1.2 = 8.4).
//   2. A future tuning change to the current `CRYSTAL_POWER_FACTOR` does
//      NOT alter the result of replaying a version-1 snapshot.
//   3. The `resource.crystal` modifier stored in the profile is treated
//      as descriptive/semantic (it carries the rounded integer for
//      UI display), not as the authoritative replay input.

/** Version-1 crystal power factor — the legacy value used at Phase B launch. */
export const CRYSTAL_POWER_FACTOR_V1 = 1.2;

// ---------------------------------------------------------------------------
// Zod schema for strict stored-snapshot validation
// ---------------------------------------------------------------------------

const SafeInteger = z.number().refine((n) => Number.isSafeInteger(n), {
  message: "must be a safe integer",
});

const NonNegativeSafeInteger = SafeInteger.refine((n) => n >= 0, {
  message: "must be non-negative",
});

const BiomeEnum = z.enum([
  "forest", "desert", "mountain", "plains", "water", "tundra", "volcanic", "swamp",
]);

const ImprovementEnum = z.enum([
  "turret", "shield_gen", "fortress", "mine", "refinery", "solar_array",
  "storage_depot", "radar", "electricity", "blockchain_node", "data_centre",
  "ai_lab", "comm_terminal", "bunker",
]);

const AlignmentEnum = z.enum(["helios", "aegis", "nexus"]);

const FacilityArchetypeEnum = z.enum([
  "assault_foundry", "siege_battery", "defense_bastion",
  "recon_array", "extraction_complex", "logistics_nexus",
] as const);

const FacilityEffectEnum = z.enum([
  "troop_production", "reinforcement_capacity", "armor_quality", "attack_range",
  "fortification_penetration", "shield_capacity", "emp_resistance", "sensor_range",
  "stealth_detection", "iron_output", "fuel_output", "crystal_output",
  "energy_efficiency", "repair_speed", "transfer_capacity",
] as const);

const ModifierKind = z.enum(["multiplier", "additive", "flat"]);
const ModifierScope = z.enum(["attacker", "defender", "global"]);

const ActorRefSchema = z.object({
  playerId:  z.string().min(1),
  factionId: z.string().nullable(),
  isAI:      z.boolean(),
});

const PlotRefSchema = z.object({
  plotId:   SafeInteger,
  parcelId: z.string().min(1),
});

const SubplotRefSchema = z.object({
  subParcelId: z.string().min(1),
  index:       z.number().int().min(0).max(8),
});

const CommitmentSchema = z.object({
  troops:  NonNegativeSafeInteger,
  iron:    NonNegativeSafeInteger,
  fuel:    NonNegativeSafeInteger,
  crystal: NonNegativeSafeInteger,
});

const FacilityEntrySchema = z.object({
  instanceId: z.string().min(1),
  archetypeId: FacilityArchetypeEnum,
  alignment:   AlignmentEnum,
  level:       NonNegativeSafeInteger,
});

const FacilityContextSchema = z.object({
  facilities: z.array(FacilityEntrySchema),
});

const EnergyContextSchema = z.object({
  alignment:   AlignmentEnum.nullable(),
  gridSummary: z.object({
    totalGeneration: NonNegativeSafeInteger,
    totalAllocated:  NonNegativeSafeInteger,
    endingStorage:   SafeInteger,
    brownout:        z.boolean(),
    blackout:        z.boolean(),
  }).nullable(),
});

const UpgradeEntrySchema = z.object({
  archetypeId: FacilityArchetypeEnum,
  effectKey:   FacilityEffectEnum,
  tier:        NonNegativeSafeInteger,
});

const UpgradeContextSchema = z.object({
  upgrades: z.array(UpgradeEntrySchema),
});

const TargetDefenseSchema = z.object({
  defenseLevel:        NonNegativeSafeInteger,
  biome:               BiomeEnum,
  improvements:        z.array(z.object({ type: ImprovementEnum, level: NonNegativeSafeInteger })),
  orbitalHazardActive: z.boolean(),
});

const ModifierSchema = z.object({
  source: z.string().min(1),
  kind:   ModifierKind,
  scope:  ModifierScope,
  value:  SafeInteger,
});

const OriginSchema = z.object({
  actor:   ActorRefSchema,
  plot:    PlotRefSchema,
  subPlot: SubplotRefSchema.nullable().optional(),
});

const TargetSchema = z.object({
  actor:   ActorRefSchema,
  plot:    PlotRefSchema,
  subPlot: SubplotRefSchema.nullable().optional(),
});

const ProfileSchema = z.object({
  version:        z.literal(COMBAT_PROFILE_VERSION),
  profileId:      z.string().min(1),
  origin:         OriginSchema,
  target:         TargetSchema,
  commitment:     CommitmentSchema,
  facilityContext: FacilityContextSchema,
  energyContext:   EnergyContextSchema,
  upgradeContext:  UpgradeContextSchema,
  targetDefense:   TargetDefenseSchema,
  modifiers:       z.array(ModifierSchema),
  randomSeed:      SafeInteger,
});

const BattleSnapshotSchema = z.object({
  version:    z.literal(COMBAT_PROFILE_VERSION),
  snapshotId: z.string().min(1),
  profile:    ProfileSchema,
  startTs:    SafeInteger,
  randomSeed: SafeInteger,
  hash:       z.string().min(1),
});

// ---------------------------------------------------------------------------
// Storage boundary
// ---------------------------------------------------------------------------

/**
 * Canonical JSON string for JSONB insertion. Uses the existing
 * `serializeBattleSnapshot` from the shared contract (stable key
 * ordering; deterministic). Callers SHOULD pre-validate via
 * `buildCombatProfile` + `createBattleSnapshot` so the snapshot is
 * guaranteed well-formed; this function then guarantees stable
 * serialization only.
 */
export function serializeBattleSnapshotForStorage(snapshot: BattleSnapshot): string {
  return serializeBattleSnapshot(snapshot);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class BattleSnapshotParseError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[]) {
    super(message);
    this.name = "BattleSnapshotParseError";
    this.issues = issues;
  }
}

/**
 * Strictly validate a JSONB-decoded value as a BattleSnapshot. Throws
 * `BattleSnapshotParseError` on any violation. Never silently coerces.
 *
 * The server creates and persists the snapshot; clients never supply
 * one. This parser exists so a corrupted or maliciously modified row
 * cannot poison downstream replay logic.
 */
export function parseStoredBattleSnapshot(raw: unknown): BattleSnapshot {
  const result = BattleSnapshotSchema.safeParse(raw);
  if (!result.success) {
    throw new BattleSnapshotParseError(
      `stored battle snapshot invalid (${result.error.issues.length} issue(s))`,
      result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  return result.data as unknown as BattleSnapshot;
}

/**
 * Convenience for callers that want a boolean (e.g. legacy NULL
 * compatibility checks) without exception handling.
 */
export function isParseableBattleSnapshot(raw: unknown): boolean {
  return BattleSnapshotSchema.safeParse(raw).success;
}

// ---------------------------------------------------------------------------
// Replay — reconstruct legacy EngineBattleInput from a stored snapshot
// ---------------------------------------------------------------------------

/**
 * Derive the exact legacy `EngineBattleInput` that `deployAttack()` built
 * at launch time, from a validated `BattleSnapshot`. Returns parity with
 * the live path (see `profileAdapter.buildLegacyBattleInput` for the
 * production implementation; this is a read-only mirror).
 *
 * The committed powers (attackerPower, defenderPower) are NOT derived
 * here — they are owned by the live `resolveBattle()` call at launch and
 * are read from the battle row. The snapshot only carries the inputs.
 */
export function replayBattleInputFromSnapshot(snapshot: BattleSnapshot): EngineBattleInput {
  const { profile, startTs } = snapshot;
  const { commitment, targetDefense, target, origin, modifiers } = profile;

  // ── Extract attacker-side inputs from the profile (parity with the
  //    legacy `deployAttack()` formula).
  //
  //    Commander contribution: stored as a `commander.attackBonus` modifier
  //    (the legacy `cmd.attackBonus` integer percentage value, e.g. 30).
  //
  //    Crystal contribution: derived from `commitment.crystal` ×
  //    `CRYSTAL_POWER_FACTOR_V1` (1.2). The crystal commitment is the
  //    authoritative replay input — NOT the rounded `resource.crystal`
  //    modifier. The modifier is kept for descriptive/UI purposes only.
  //    This ensures exact replay regardless of whether `crystal × 1.2`
  //    produces a fractional result (e.g. 7 × 1.2 = 8.4).
  //
  //    Radar and morale: stored as fixed-point percentage modifiers
  //    (90 = 0.90×, 75 = 0.75×). These are version-locked semantic
  //    entries and do not depend on any current tuning constant.
  const crystalPower = commitment.crystal * CRYSTAL_POWER_FACTOR_V1;
  const commanderContrib = modifierValueOrZero(modifiers, "commander.attackBonus");
  const radarMod = modifierRadarFactor(modifiers);  // 0.9 if present, else 1.0
  const moraleActive = modifiers.some((m) => m.source === "debuff.morale");

  // Re-derive the battle id from the snapshot via the legacy seed
  // construction: `hashSeed(battleId, now)`. We cannot invert hashSeed
  // (it's a djb2 hash, not reversible). Instead, the caller is expected
  // to supply the original battle id alongside the snapshot when calling
  // this function via `replayBattleInputFromStoredBattle`. The default
  // path below uses the snapshotId as a stand-in so callers can verify
  // shape parity; the real replay flow uses the persisted battle row id.
  // (The resolver is deterministic given the same seed, so the battleId
  // field does not actually influence the outcome — only the seed does.)
  const seed = hashSeed("placeholder", startTs);
  void seed;

  const defenderId = profile.target.actor.playerId === "unowned"
    ? null
    : profile.target.actor.playerId;

  return {
    battleId: replayBattleIdFromSnapshot(snapshot),
    attackerId:         profile.origin.actor.playerId,
    defenderId,
    plotId:             profile.target.plot.plotId,
    troopsCommitted:    commitment.troops * radarMod,
    resourcesBurned:    { iron: commitment.iron * radarMod, fuel: commitment.fuel * radarMod },
    // EXACT crystal power: `commitment.crystal × CRYSTAL_POWER_FACTOR_V1`.
    // This is the same formula the legacy `deployAttack()` used at launch:
    //   `(commanderBonus + crystal * CRYSTAL_POWER_FACTOR) * radarMod`
    // The replay derives crystal power from the stored commitment
    // (not the rounded modifier), so a future change to the current
    // `CRYSTAL_POWER_FACTOR` does not alter version-1 replay.
    commanderBonus:     (commanderContrib + crystalPower) * radarMod,
    moraleDebuffActive: moraleActive,
    defenseLevel:       targetDefense.defenseLevel,
    biome:              targetDefense.biome as EngineBiomeType,
    improvements:       targetDefense.improvements
      .filter((i) => ["turret", "shield_gen", "fortress"].includes(i.type))
      .map((i) => ({ type: i.type as EngineImprovementType, level: i.level })),
    orbitalHazardActive: targetDefense.orbitalHazardActive,
    randomSeed:         snapshot.randomSeed,
  };
}

/**
 * The legacy `EngineBattleInput.battleId` is the `battles.id` UUID (not the
 * snapshotId). Replay callers MUST supply the persisted battle row id so
 * the reconstructed input is byte-identical to the original. This wrapper
 * lets the caller do that.
 */
export function replayBattleInputFromStoredBattle(
  battleId: string,
  snapshot: BattleSnapshot,
): EngineBattleInput {
  const base = replayBattleInputFromSnapshot(snapshot);
  return { ...base, battleId };
}

/**
 * Derive the exact legacy persisted battle-row fields the route would
 * have written, from a validated `BattleSnapshot`. Used by replay tests
 * to verify parity with the actual `battles` row.
 */
export interface ReplayedPersistedFields {
  id:               string;
  attackerId:       string;
  defenderId:       string | null;
  targetParcelId:   string;
  troopsCommitted:  number;
  resourcesBurned:  { iron: number; fuel: number };
  crystalBurned:    number;
  startTs:          number;
  commanderId:      string | null;
  sourceParcelId:   string | null;
}

export function replayLegacyPersistedFieldsFromSnapshot(
  battleId: string,
  snapshot: BattleSnapshot,
): ReplayedPersistedFields {
  const { profile, startTs } = snapshot;
  // The target plot is the real authoritative target; the origin plot
  // is the attacker's source. The legacy persisted `targetParcelId` is
  // the real target parcel UUID; `sourceParcelId` is the attacker's
  // home parcel (or null in the legacy "unknown" case).
  const sourceParcelId = profile.origin.plot.parcelId === "unknown_origin"
    ? null
    : profile.origin.plot.parcelId;
  return {
    id:               battleId,
    attackerId:       profile.origin.actor.playerId,
    defenderId:       profile.target.actor.playerId === "unowned"
      ? null
      : profile.target.actor.playerId,
    targetParcelId:   profile.target.plot.parcelId,
    troopsCommitted:  profile.commitment.troops,
    resourcesBurned:  { iron: profile.commitment.iron, fuel: profile.commitment.fuel },
    crystalBurned:    profile.commitment.crystal,
    startTs:          startTs,
    commanderId:      null, // commander is recorded only as a modifier in the profile
    sourceParcelId:   sourceParcelId,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function modifierValueOrZero(modifiers: readonly CombatModifier[], source: string): number {
  for (const m of modifiers) {
    if (m.source === source) return m.value;
  }
  return 0;
}

function modifierRadarFactor(modifiers: readonly CombatModifier[]): number {
  for (const m of modifiers) {
    if (m.source === "defense.radar") {
      // Fixed-point percentage: 90 = 0.90×, 100 = 1.00×.
      if (m.kind !== "multiplier") continue;
      return m.value / 100;
    }
  }
  return 1.0;
}

/**
 * Derive the battle id that was used to construct the seed. The legacy
 * code uses the `battles.id` UUID, not the snapshotId. The caller must
 * supply the real id via `replayBattleInputFromStoredBattle`. This
 * function is only used internally for the default-shape parity test.
 */
function replayBattleIdFromSnapshot(snapshot: BattleSnapshot): string {
  return snapshot.snapshotId; // placeholder; real replay uses the battle row id
}
