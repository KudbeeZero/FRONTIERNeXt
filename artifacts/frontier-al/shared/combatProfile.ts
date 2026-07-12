/**
 * shared/combatProfile.ts
 *
 * Phase 3 — canonical, deterministic, IMMUTABLE combat-profile and
 * battle-snapshot contract.
 *
 * This module is a CONTRACT-FOUNDATION lane. It defines stable identifiers,
 * shapes, a validator, a builder, and a deterministic serializer. It has ZERO
 * gameplay effect:
 *
 *  - No attack route, DB write, `resolveBattle()` call, AI, or UI consumes
 *    these functions yet.
 *  - No schema, migration, seed, route, or persistence is touched.
 *  - It reuses existing shared identifiers (`BiomeType`, `ImprovementType`,
 *    `EnergyAlignment`, `FacilityArchetypeId`, `FacilityEffectKey`) and mirrors
 *    the existing deterministic helpers (`stableStringify` in
 *    `server/engine/markets/resolve.ts`, `hashSeed` in
 *    `server/engine/battle/random.ts`) locally so `shared/` stays dependency-
 *    free of `server/`.
 *
 * Later phases (Phase 4 idempotency, Phase 5 weapon integration, Phase 6
 * doctrines, Phase 7 facility/energy effects) will wire this profile into the
 * battle resolver via an immutable snapshot so the matchup is locked at launch.
 */

import type {
  BiomeType,
  ImprovementType,
  EnergyAlignment,
} from "./schema";
import {
  isFacilityArchetypeId,
  type FacilityArchetypeId,
  type FacilityEffectKey,
} from "./subplotArchitecture";

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

/** Contract version. Always `1` for this generation of the profile. */
export type CombatProfileVersion = 1;
export const COMBAT_PROFILE_VERSION: CombatProfileVersion = 1;

// ---------------------------------------------------------------------------
// Reused value sets
// ---------------------------------------------------------------------------

const VALID_BIOMES = new Set<string>([
  "forest", "desert", "mountain", "plains", "water", "tundra", "volcanic", "swamp",
]);

const VALID_IMPROVEMENTS = new Set<string>([
  "turret", "shield_gen", "fortress", "mine", "refinery", "solar_array",
  "storage_depot", "radar", "electricity", "blockchain_node", "data_centre",
  "ai_lab", "comm_terminal", "bunker",
]);

const VALID_ALIGNMENTS = new Set<string>(["helios", "aegis", "nexus"]);
const VALID_MODIFIER_KINDS = new Set<string>(["multiplier", "additive", "flat"]);
const VALID_MODIFIER_SCOPES = new Set<string>(["attacker", "defender", "global"]);

// ---------------------------------------------------------------------------
// Refs
// ---------------------------------------------------------------------------

/** A combatant (player or AI faction). */
export interface CombatActorRef {
  playerId: string; // UUID or AI_-prefixed id
  factionId: string | null; // e.g. "NEXUS-7" | null for unaligned
  isAI: boolean;
}

/** A macro-plot / parcel reference. */
export interface CombatPlotRef {
  plotId: number; // integer plot identifier
  parcelId: string; // parcel row id
}

/** A sub-parcel reference (one of 9 cells, index 0..8). */
export interface CombatSubplotRef {
  subParcelId: string;
  index: number; // 0..8
}

/** Attack origin (the launching side). */
export interface CombatOrigin {
  actor: CombatActorRef;
  plot: CombatPlotRef;
  subPlot?: CombatSubplotRef | null;
}

/** Attack target (the defending side). */
export interface CombatTarget {
  actor: CombatActorRef;
  plot: CombatPlotRef;
  subPlot?: CombatSubplotRef | null;
}

// ---------------------------------------------------------------------------
// Commitment / contexts
// ---------------------------------------------------------------------------

/** Troop and resource commitment for the engagement. */
export interface CombatResourceCommitment {
  troops: number;
  iron: number;
  fuel: number;
  crystal: number;
}

/** A single facility attached to an actor. */
export interface CombatFacilityEntry {
  instanceId: string;
  archetypeId: FacilityArchetypeId;
  alignment: EnergyAlignment;
  level: number;
}

/** Facility context (Phase 1 archetypes; no numeric effect in Phase 3). */
export interface CombatFacilityContext {
  facilities: CombatFacilityEntry[];
}

/**
 * Energy context. Contract-only in Phase 3 — an optional locked summary from
 * the Phase 2 `simulateEnergyGrid()` result may be attached, but it has NO
 * numeric effect on resolution yet.
 */
export interface CombatEnergyContext {
  alignment: EnergyAlignment | null;
  gridSummary?: {
    totalGeneration: number;
    totalAllocated: number;
    endingStorage: number;
    brownout: boolean;
    blackout: boolean;
  } | null;
}

/** A single applied upgrade node. */
export interface CombatUpgradeEntry {
  archetypeId: FacilityArchetypeId;
  effectKey: FacilityEffectKey;
  tier: number;
}

/** Upgrade context (Phase 1 effect keys; no numeric effect in Phase 3). */
export interface CombatUpgradeContext {
  upgrades: CombatUpgradeEntry[];
}

/** An abstract, serializable modifier (source/kind/scope/value). */
export interface CombatModifier {
  source: string; // e.g. "alignment.helios", "upgrade.troop_production"
  kind: "multiplier" | "additive" | "flat";
  scope: "attacker" | "defender" | "global";
  value: number;
}

/** Defender-side defense snapshot (mirrors BattleInput defender fields). */
export interface CombatTargetDefense {
  defenseLevel: number;
  biome: BiomeType;
  improvements: { type: ImprovementType; level: number }[];
  orbitalHazardActive: boolean;
}

// ---------------------------------------------------------------------------
// Draft + built profile + snapshot
// ---------------------------------------------------------------------------

/**
 * Caller-supplied, pre-validation input. Numbers must be non-negative safe
 * integers. Modifier `value` must also be a safe integer: multiplier-kind
 * modifiers are encoded as fixed-point percentages where `100` means
 * `1.00×`, `90` means `0.90×`, and `75` means `0.75×`; additive-kind
 * modifiers carry integer legacy power units. `version` is forced to `1`
 * on build.
 */
export interface CombatProfileDraft {
  origin: CombatOrigin;
  target: CombatTarget;
  commitment: CombatResourceCommitment;
  facilityContext: CombatFacilityContext;
  energyContext: CombatEnergyContext;
  upgradeContext: CombatUpgradeContext;
  targetDefense: CombatTargetDefense;
  modifiers: CombatModifier[];
  /** Deterministic seed parts; hashed if `randomSeed` is omitted. */
  seedParts: (string | number)[];
  /** Optional explicit seed; must be a finite safe integer when provided. */
  randomSeed?: number;
}

/** Immutable, validated, built combat profile. Content-addressed by `profileId`. */
export interface CombatProfile {
  readonly version: CombatProfileVersion;
  readonly profileId: string;
  readonly origin: CombatOrigin;
  readonly target: CombatTarget;
  readonly commitment: CombatResourceCommitment;
  readonly facilityContext: CombatFacilityContext;
  readonly energyContext: CombatEnergyContext;
  readonly upgradeContext: CombatUpgradeContext;
  readonly targetDefense: CombatTargetDefense;
  readonly modifiers: readonly CombatModifier[];
  readonly randomSeed: number;
}

/** Immutable battle snapshot: the profile frozen at launch. */
export interface BattleSnapshot {
  readonly version: CombatProfileVersion;
  readonly snapshotId: string;
  readonly profile: CombatProfile;
  readonly startTs: number;
  readonly randomSeed: number;
  readonly hash: string;
}

export class CombatProfileValidationError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[]) {
    super(message);
    this.name = "CombatProfileValidationError";
    this.issues = issues;
  }
}

// ---------------------------------------------------------------------------
// Deterministic helpers (local mirrors of server/engine helpers)
// ---------------------------------------------------------------------------

/**
 * Stable JSON stringify with recursively sorted object keys, so output is
 * identical regardless of insertion order. Mirrors
 * `server/engine/markets/resolve.ts#stableStringify`.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/** djb2-style deterministic 32-bit hash. Mirrors server hashSeed but local. */
function hashSeed(...parts: (string | number)[]): number {
  const combined = parts.map(String).join("|");
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function contentHash(label: string, value: unknown): string {
  return `${label}_${hashSeed(stableStringify(value))}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isSafeNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && Number.isSafeInteger(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function validateActor(ref: unknown, field: string, issues: string[]): void {
  if (typeof ref !== "object" || ref === null) {
    issues.push(`${field} must be an object`);
    return;
  }
  const a = ref as Record<string, unknown>;
  if (!isNonEmptyString(a.playerId)) issues.push(`${field}.playerId must be a non-empty string`);
  if (a.factionId !== null && !isNonEmptyString(a.factionId)) {
    issues.push(`${field}.factionId must be null or a non-empty string`);
  }
  if (typeof a.isAI !== "boolean") issues.push(`${field}.isAI must be a boolean`);
}

function validatePlot(ref: unknown, field: string, issues: string[]): void {
  if (typeof ref !== "object" || ref === null) {
    issues.push(`${field} must be an object`);
    return;
  }
  const p = ref as Record<string, unknown>;
  if (!isSafeNonNegativeInt(p.plotId)) issues.push(`${field}.plotId must be a non-negative safe integer`);
  if (!isNonEmptyString(p.parcelId)) issues.push(`${field}.parcelId must be a non-empty string`);
}

function validateSubPlot(ref: unknown, field: string, issues: string[]): void {
  if (typeof ref !== "object" || ref === null) {
    issues.push(`${field} must be an object`);
    return;
  }
  const s = ref as Record<string, unknown>;
  if (!isNonEmptyString(s.subParcelId)) issues.push(`${field}.subParcelId must be a non-empty string`);
  if (typeof s.index !== "number" || !Number.isInteger(s.index) || s.index < 0 || s.index > 8) {
    issues.push(`${field}.index must be an integer in 0..8`);
  }
}

function validateCommitment(c: unknown, field: string, issues: string[]): void {
  if (typeof c !== "object" || c === null) {
    issues.push(`${field} must be an object`);
    return;
  }
  const k = c as Record<string, unknown>;
  for (const key of ["troops", "iron", "fuel", "crystal"]) {
    if (!isSafeNonNegativeInt(k[key])) {
      issues.push(`${field}.${key} must be a non-negative safe integer`);
    }
  }
}

function validateFacilityContext(ctx: unknown, field: string, issues: string[]): void {
  if (typeof ctx !== "object" || ctx === null || !Array.isArray((ctx as Record<string, unknown>).facilities)) {
    issues.push(`${field} must have a facilities array`);
    return;
  }
  const seen = new Set<string>();
  (ctx as { facilities: unknown[] }).facilities.forEach((f, i) => {
    const ff = `${field}.facilities[${i}]`;
    if (typeof f !== "object" || f === null) {
      issues.push(`${ff} must be an object`);
      return;
    }
    const e = f as Record<string, unknown>;
    if (!isNonEmptyString(e.instanceId)) {
      issues.push(`${ff}.instanceId must be a non-empty string`);
    } else if (seen.has(e.instanceId)) {
      issues.push(`${ff}.instanceId duplicate facility instance id "${e.instanceId}"`);
    } else {
      seen.add(e.instanceId);
    }
    if (!isFacilityArchetypeId(e.archetypeId as string)) {
      issues.push(`${ff}.archetypeId unknown facility archetype "${e.archetypeId}"`);
    }
    if (!VALID_ALIGNMENTS.has(e.alignment as string)) {
      issues.push(`${ff}.alignment unsupported alignment "${e.alignment}"`);
    }
    if (!isSafeNonNegativeInt(e.level)) issues.push(`${ff}.level must be a non-negative safe integer`);
  });
}

function validateEnergyContext(ctx: unknown, field: string, issues: string[]): void {
  if (typeof ctx !== "object" || ctx === null) {
    issues.push(`${field} must be an object`);
    return;
  }
  const e = ctx as Record<string, unknown>;
  if (e.alignment !== null && !VALID_ALIGNMENTS.has(e.alignment as string)) {
    issues.push(`${field}.alignment unsupported alignment "${e.alignment}"`);
  }
  if (e.gridSummary !== undefined && e.gridSummary !== null) {
    const g = e.gridSummary as Record<string, unknown>;
    for (const k of ["totalGeneration", "totalAllocated", "endingStorage"]) {
      if (!isSafeNonNegativeInt(g[k])) issues.push(`${field}.gridSummary.${k} must be a non-negative safe integer`);
    }
    if (typeof g.brownout !== "boolean") issues.push(`${field}.gridSummary.brownout must be a boolean`);
    if (typeof g.blackout !== "boolean") issues.push(`${field}.gridSummary.blackout must be a boolean`);
  }
}

function validateUpgradeContext(ctx: unknown, field: string, issues: string[]): void {
  if (typeof ctx !== "object" || ctx === null || !Array.isArray((ctx as Record<string, unknown>).upgrades)) {
    issues.push(`${field} must have an upgrades array`);
    return;
  }
  (ctx as { upgrades: unknown[] }).upgrades.forEach((u, i) => {
    const uf = `${field}.upgrades[${i}]`;
    if (typeof u !== "object" || u === null) {
      issues.push(`${uf} must be an object`);
      return;
    }
    const e = u as Record<string, unknown>;
    if (!isFacilityArchetypeId(e.archetypeId as string)) {
      issues.push(`${uf}.archetypeId unknown facility archetype "${e.archetypeId}"`);
    }
    if (typeof e.effectKey !== "string" || e.effectKey.length === 0) {
      issues.push(`${uf}.effectKey must be a non-empty string`);
    }
    if (!isSafeNonNegativeInt(e.tier)) issues.push(`${uf}.tier must be a non-negative safe integer`);
  });
}

function validateTargetDefense(d: unknown, field: string, issues: string[]): void {
  if (typeof d !== "object" || d === null) {
    issues.push(`${field} must be an object`);
    return;
  }
  const t = d as Record<string, unknown>;
  if (!isSafeNonNegativeInt(t.defenseLevel)) issues.push(`${field}.defenseLevel must be a non-negative safe integer`);
  if (!VALID_BIOMES.has(t.biome as string)) issues.push(`${field}.biome unsupported biome "${t.biome}"`);
  if (!Array.isArray(t.improvements)) {
    issues.push(`${field}.improvements must be an array`);
  } else {
    t.improvements.forEach((imp, i) => {
      const impf = `${field}.improvements[${i}]`;
      if (typeof imp !== "object" || imp === null) {
        issues.push(`${impf} must be an object`);
        return;
      }
      const m = imp as Record<string, unknown>;
      if (!VALID_IMPROVEMENTS.has(m.type as string)) issues.push(`${impf}.type unsupported improvement "${m.type}"`);
      if (!isSafeNonNegativeInt(m.level)) issues.push(`${impf}.level must be a non-negative safe integer`);
    });
  }
  if (typeof t.orbitalHazardActive !== "boolean") {
    issues.push(`${field}.orbitalHazardActive must be a boolean`);
  }
}

function validateModifiers(list: unknown, field: string, issues: string[]): void {
  if (!Array.isArray(list)) {
    issues.push(`${field} must be an array`);
    return;
  }
  list.forEach((mod, i) => {
    const mf = `${field}[${i}]`;
    if (typeof mod !== "object" || mod === null) {
      issues.push(`${mf} must be an object`);
      return;
    }
    const m = mod as Record<string, unknown>;
    if (!isNonEmptyString(m.source)) issues.push(`${mf}.source must be a non-empty string`);
    if (!VALID_MODIFIER_KINDS.has(m.kind as string)) issues.push(`${mf}.kind unsupported "${m.kind}"`);
    if (!VALID_MODIFIER_SCOPES.has(m.scope as string)) issues.push(`${mf}.scope unsupported "${m.scope}"`);
    if (typeof m.value !== "number" || !Number.isFinite(m.value) || !Number.isSafeInteger(m.value)) {
      issues.push(`${mf}.value must be a finite safe integer`);
    }
  });
}

/**
 * Validate a `CombatProfileDraft`. Throws `CombatProfileValidationError` with
 * field-level messages on any violation; never silently coerces.
 */
export function validateCombatProfileDraft(draft: unknown): CombatProfileDraft {
  const issues: string[] = [];
  if (typeof draft !== "object" || draft === null) {
    throw new CombatProfileValidationError("combat profile draft must be an object", [
      `draft must be an object, got ${JSON.stringify(draft)}`,
    ]);
  }
  const d = draft as Record<string, unknown>;

  const origin = d.origin as Record<string, unknown> | undefined;
  const target = d.target as Record<string, unknown> | undefined;
  validateActor(origin?.actor, "origin.actor", issues);
  validateActor(target?.actor, "target.actor", issues);
  validatePlot(origin?.plot, "origin.plot", issues);
  validatePlot(target?.plot, "target.plot", issues);
  if (origin?.subPlot) validateSubPlot(origin.subPlot, "origin.subPlot", issues);
  if (target?.subPlot) validateSubPlot(target.subPlot, "target.subPlot", issues);
  validateCommitment(d.commitment, "commitment", issues);
  validateFacilityContext(d.facilityContext, "facilityContext", issues);
  validateEnergyContext(d.energyContext, "energyContext", issues);
  validateUpgradeContext(d.upgradeContext, "upgradeContext", issues);
  validateTargetDefense(d.targetDefense, "targetDefense", issues);
  validateModifiers(d.modifiers, "modifiers", issues);

  if (!Array.isArray(d.seedParts) || d.seedParts.length === 0) {
    issues.push("seedParts must be a non-empty array of strings/numbers");
  } else {
    for (const part of d.seedParts as unknown[]) {
      if (typeof part !== "string" && typeof part !== "number") {
        issues.push("seedParts entries must be string or number");
        break;
      }
    }
  }
  if (d.randomSeed !== undefined) {
    if (typeof d.randomSeed !== "number" || !Number.isInteger(d.randomSeed) || !Number.isSafeInteger(d.randomSeed)) {
      issues.push("randomSeed must be a finite safe integer when provided");
    }
  }

  if (issues.length > 0) {
    throw new CombatProfileValidationError(`combat profile draft invalid (${issues.length} issue(s))`, issues);
  }
  return draft as CombatProfileDraft;
}

// ---------------------------------------------------------------------------
// Build + snapshot
// ---------------------------------------------------------------------------

/**
 * Build an immutable, validated `CombatProfile` from a draft. Derives a
 * deterministic `profileId` (content-addressed) and `randomSeed` (from
 * `seedParts` when `randomSeed` is omitted). Pure: no clock, no randomness.
 */
export function buildCombatProfile(draft: CombatProfileDraft): CombatProfile {
  validateCombatProfileDraft(draft);
  const randomSeed =
    draft.randomSeed !== undefined ? draft.randomSeed : hashSeed(...draft.seedParts);

  const profile: CombatProfile = {
    version: COMBAT_PROFILE_VERSION,
    profileId: "",
    origin: draft.origin,
    target: draft.target,
    commitment: draft.commitment,
    facilityContext: draft.facilityContext,
    energyContext: draft.energyContext,
    upgradeContext: draft.upgradeContext,
    targetDefense: draft.targetDefense,
    modifiers: draft.modifiers.slice(),
    randomSeed,
  };
  // Content-addressed id (excludes nothing — the whole profile defines it).
  (profile as { profileId: string }).profileId = contentHash("cp", profile);
  return profile;
}

/**
 * Freeze a profile into an immutable `BattleSnapshot` at a caller-supplied
 * launch timestamp. The snapshot locks `randomSeed` and carries a
 * deterministic `hash` over (profile + startTs). Pure: `startTs` is supplied,
 * not read from a clock.
 */
export function createBattleSnapshot(profile: CombatProfile, startTs: number): BattleSnapshot {
  if (!Number.isInteger(startTs) || !Number.isSafeInteger(startTs)) {
    throw new CombatProfileValidationError("startTs must be a safe integer", [
      `startTs must be a safe integer, got ${JSON.stringify(startTs)}`,
    ]);
  }
  const snapshot: BattleSnapshot = {
    version: COMBAT_PROFILE_VERSION,
    snapshotId: "",
    profile,
    startTs,
    randomSeed: profile.randomSeed,
    hash: "",
  };
  (snapshot as { snapshotId: string }).snapshotId = contentHash("bs", { profile: profile.profileId, startTs });
  (snapshot as { hash: string }).hash = hashSeed(stableStringify({ profile: profile.profileId, startTs })).toString();
  return snapshot;
}

/**
 * Deterministically serialize a snapshot. Identical snapshots (same profile,
 * same startTs) always produce identical output — order-independent via
 * `stableStringify`.
 */
export function serializeBattleSnapshot(snapshot: BattleSnapshot): string {
  return stableStringify(snapshot);
}
