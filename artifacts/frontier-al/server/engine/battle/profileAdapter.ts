/**
 * server/engine/battle/profileAdapter.ts
 *
 * Phase A — server-authoritative battle launch adapter.
 *
 * Connects the already-merged `CombatProfile` and `BattleSnapshot` contracts
 * (`shared/combatProfile.ts`) to the live `deployAttack()` launch path while
 * preserving the EXACT current battle behavior. This is architectural plumbing,
 * not a gameplay feature:
 *
 *   - It does NOT change the resolver formula, attack power, defender power,
 *     capture/casualty/pillage math, random seed, or AI behavior.
 *   - It does NOT add weapon, doctrine, facility, alignment, energy, or
 *     upgrade effects.
 *   - It does NOT add schema or migration changes.
 *   - It does NOT add durable snapshot persistence (that is Phase B).
 *
 * What it does:
 *   1. Builds a valid `CombatProfileDraft` from the live launch state.
 *   2. Creates an immutable `BattleSnapshot` at launch.
 *   3. Adapts the snapshot back into the EXACT legacy `EngineBattleInput`
 *      that the existing resolver consumes, byte-for-byte.
 *   4. Returns the exact legacy persisted battle row values, so the
 *      existing `resolveBattles()` and downstream logic remain unchanged.
 *
 * If `buildCombatProfile()` ever rejects a draft, the adapter throws a
 * `CombatProfileValidationError` — `deployAttack()` catches it and falls
 * through to a legacy-only path (preserves the immediate rollback contract
 * defined in the Phase A memory).
 */
import { hashSeed } from "./random.js";
import {
  buildCombatProfile,
  createBattleSnapshot,
  CombatProfileValidationError,
  type BattleSnapshot,
  type CombatActorRef,
  type CombatModifier,
  type CombatProfile,
  type CombatProfileDraft,
  type CombatPlotRef,
  type CombatResourceCommitment,
  type CombatTarget,
  type CombatTargetDefense,
  type CombatOrigin,
} from "@shared/combatProfile";
import type { ImprovementType } from "@shared/schema";
import type { BattleInput as EngineBattleInput, ImprovementType as EngineImprovementType, BiomeType as EngineBiomeType } from "./types.js";
import { CRYSTAL_POWER_FACTOR } from "./tuning.js";

// ---------------------------------------------------------------------------
// Public types — what deployAttack() passes in
// ---------------------------------------------------------------------------

/** Server-derived state for the attacker at the moment of launch. */
export interface AttackerLaunchState {
  id: string;
  name: string;
  isAI: boolean;
  /** Resolved commander power already computed from CommanderAvatar.attackBonus. */
  commanderBonus: number;
  commanderId: string | null;
  /** Active morale debuff flag (server-derived from moraleDebuffUntil). */
  moraleDebuffActive: boolean;
  /** Faction label if known (e.g. AI faction name). Optional. */
  factionLabel: string | null;
}

/** Server-derived state for the target parcel at the moment of launch. */
export interface TargetLaunchState {
  parcelId: string;
  plotId: number;
  biome: string;
  defenseLevel: number;
  ownerId: string | null;
  improvements: ReadonlyArray<{ type: string; level: number }>;
  /** Radar improvement present? Pre-computed by deployAttack() so the adapter
   *  can record the modifier without re-walking the improvements list. */
  hasRadar: boolean;
}

/** Client-supplied attack action (already validated by attackActionSchema). */
export interface LaunchAction {
  attackerId: string;
  targetParcelId: string;
  troopsCommitted: number;
  resourcesBurned: { iron: number; fuel: number };
  crystalBurned: number;
  sourceParcelId: string | null;
  commanderId: string | null;
}

/** Snapshot of the final, fully-resolved launch adapter output. */
export interface LaunchProfileResult {
  /** Immutable profile — content-addressed by profileId. */
  profile: CombatProfile;
  /** Immutable snapshot — frozen at startTs. */
  snapshot: BattleSnapshot;
  /** EXACT same engine input the legacy deployAttack() built (parity). */
  legacyBattleInput: EngineBattleInput;
  /**
   * Pre-resolved engine outputs that the legacy path derives from
   * `resolveBattle(legacyBattleInput)` — captured here so the route does
   * NOT need a second resolver call. The values are produced by the
   * existing resolver; this adapter does not recompute them.
   */
  legacyPowers: { attackerPower: number; defenderPower: number; randFactor: number };
  /**
   * Legacy persisted battle-row values (parity-shaped). The route writes
   * these exact fields to the `battles` table, so the existing
   * `resolveBattles()` and replay log code see no change.
   */
  legacyPersistedFields: LegacyPersistedBattleFields;
}

/** Shape of the battle row the legacy deployAttack() writes. */
export interface LegacyPersistedBattleFields {
  id: string;
  attackerId: string;
  defenderId: string | null;
  targetParcelId: string;
  attackerPower: number;
  defenderPower: number;
  troopsCommitted: number;
  resourcesBurned: { iron: number; fuel: number };
  crystalBurned: number;
  startTs: number;
  resolveTs: number;
  commanderId: string | null;
  sourceParcelId: string | null;
}

// ---------------------------------------------------------------------------
// Adapter entry point
// ---------------------------------------------------------------------------

/**
 * Build the authoritative CombatProfile + BattleSnapshot for a plot attack
 * and return the EXACT legacy engine input + persisted fields needed to
 * continue the existing transaction unchanged.
 *
 * Pure: no I/O, no clock reads beyond the caller-supplied `now`. The caller
 * is responsible for fetching the authoritative attacker/target state from
 * the DB (the existing `deployAttack()` already does this).
 *
 * Throws `CombatProfileValidationError` on any contract violation — the
 * caller's fallback path is to proceed with the legacy input builder.
 */
export function buildLaunchProfile(
  battleId: string,
  action: LaunchAction,
  attacker: AttackerLaunchState,
  target: TargetLaunchState,
  now: number,
): LaunchProfileResult {
  const draft = buildLaunchDraft(battleId, action, attacker, target, now);
  const profile = buildCombatProfile(draft);
  const snapshot = createBattleSnapshot(profile, now);

  const legacyBattleInput = buildLegacyBattleInput(
    battleId, action, attacker, target, now,
  );

  return {
    profile,
    snapshot,
    legacyBattleInput,
    legacyPersistedFields: buildLegacyPersistedFields(
      battleId, action, attacker, target, now,
    ),
    // legacyPowers are filled by the caller AFTER it has called
    // resolveBattle(legacyBattleInput) once — we leave them undefined here
    // so the adapter stays pure and the route composes them explicitly.
    legacyPowers: undefined as unknown as LaunchProfileResult["legacyPowers"],
  };
}

// ---------------------------------------------------------------------------
// Draft construction — authoritativeness rules
// ---------------------------------------------------------------------------

/**
 * Build a valid `CombatProfileDraft` that faithfully represents the live
 * launch state.
 *
 * Authoritative inputs that the resolver DOES consume today:
 *   - troops, iron, fuel, crystal          → commitment
 *   - commander bonus, crystal power      → explicit CombatModifier entries
 *   - radar × 0.9                         → explicit CombatModifier entry
 *   - morale debuff                       → explicit CombatModifier entry
 *   - target defenseLevel / biome / improvements → targetDefense
 *
 * Authoritative inputs that the resolver does NOT consume today (Phase A
 * must NOT fabricate values — they are recorded as empty/absent so later
 * phases know there is no live data here):
 *   - facility archetype / level / upgrades → empty facility/upgrade contexts
 *   - energy alignment / grid state        → alignment = null
 *   - weapon archetype / equipped weapon   → not modelled
 *   - attack doctrine                      → not modelled
 *   - origin / target subplot              → null (plot-level only)
 */
function buildLaunchDraft(
  battleId: string,
  action: LaunchAction,
  attacker: AttackerLaunchState,
  target: TargetLaunchState,
  now: number,
): CombatProfileDraft {
  const origin: CombatOrigin = {
    actor: {
      playerId:  attacker.id,
      factionId: attacker.factionLabel,
      isAI:      attacker.isAI,
    },
    // origin = home plot of the attacker. When the launch action carries an
    // authoritative `sourceParcelId`, the adapter uses it exactly (preserved
    // by the snapshot). When it is absent, the contract requires a non-empty
    // `parcelId`, so we use the explicit sentinel "unknown_origin". A future
    // replay path can detect this sentinel and treat the origin as unknown.
    plot:    action.sourceParcelId
      ? { plotId: 0, parcelId: action.sourceParcelId }
      : { plotId: 0, parcelId: "unknown_origin" },
    subPlot: null,
  };
  const targetCombat: CombatTarget = {
    actor: {
      // Unowned territory has no defender; the contract requires a
      // non-empty playerId, so we use the explicit sentinel "unowned".
      // A future replay path can read this back as "no defender".
      playerId:  target.ownerId ?? "unowned",
      factionId: null,
      isAI:      false,
    },
    plot: plotRef(target.plotId, target.parcelId),
    subPlot: null,
  };

  const commitment: CombatResourceCommitment = {
    troops:  action.troopsCommitted,
    iron:    action.resourcesBurned.iron,
    fuel:    action.resourcesBurned.fuel,
    crystal: action.crystalBurned,
  };

  const targetDefense: CombatTargetDefense = {
    defenseLevel: target.defenseLevel,
    biome: target.biome as CombatTargetDefense["biome"],
    improvements: target.improvements
      .filter((i): i is { type: ImprovementType; level: number } =>
        isContractImprovement(i.type),
      )
      .map((i) => ({ type: i.type, level: i.level })),
    orbitalHazardActive: false, // not modelled in deployAttack today
  };

  // Modifiers — semantic entries that mirror the LIVE attacker-side
  // adjustments without claiming any NEW combat effects. These are
  // recorded for Phase B+ replay, not applied by the resolver today.
  const modifiers: CombatModifier[] = [];

  if (attacker.commanderBonus > 0) {
    modifiers.push({
      source: "commander.attackBonus",
      kind:   "flat",
      scope:  "attacker",
      value:  attacker.commanderBonus,
    });
  }
  if (action.crystalBurned > 0) {
    modifiers.push({
      source: "resource.crystal",
      kind:   "flat",
      scope:  "attacker",
      // CRYSTAL_POWER_FACTOR (1.2) is a server-resolved multiplier;
      // the modifier records the *contribution*, not the burn amount.
      // The contract's `value` field must be a safe integer; we round
      // to the nearest integer (the legacy resolver already does this
      // implicitly when the value flows into the summed `attackerPower`).
      value:  Math.round(action.crystalBurned * CRYSTAL_POWER_FACTOR),
    });
  }
  if (attacker.moraleDebuffActive) {
    modifiers.push({
      source: "debuff.morale",
      kind:   "multiplier",
      scope:  "attacker",
      // The legacy path applies ×(1 - 0.25) = 0.75. The contract's
      // `value` field requires a safe integer (per the
      // `validateModifiers` contract check). Multipliers are encoded as
      // percentages (value / 100) — 75 represents 0.75×. This is a
      // contract-supported representation and preserves replay fidelity
      // (a future replay path can divide by 100 to recover the factor).
      value:  75,
    });
  }
  if (target.hasRadar) {
    modifiers.push({
      source: "defense.radar",
      kind:   "multiplier",
      scope:  "attacker",
      // Radar reduction is 0.9× in the legacy path; encoded as 90/100.
      value:  90,
    });
  }

  return {
    origin,
    target: targetCombat,
    commitment,
    // Phase A: no live facility state. The contract explicitly tolerates an
    // empty facility list — validators accept zero entries. The
    // `subplotArchitecture` is a CATALOG_ONLY contract; the six canonical
    // facility archetype IDs are not yet persisted per-sub-parcel.
    facilityContext: { facilities: [] },
    energyContext:   { alignment: null, gridSummary: null },
    upgradeContext:  { upgrades: [] },
    targetDefense,
    modifiers,
    seedParts: [battleId, now],
  };
}

// ---------------------------------------------------------------------------
// Legacy bridge — produces the EXACT same EngineBattleInput the legacy
// deployAttack() built, byte-for-byte. This is the parity boundary.
// ---------------------------------------------------------------------------

/**
 * Build the legacy `EngineBattleInput` for the existing resolver. This
 * function is a deliberate copy of the live formula so the adapter can be
 * audited against the production deployAttack() path. Any drift between
 * this and deployAttack() breaks the Phase A parity guarantee.
 */
function buildLegacyBattleInput(
  battleId: string,
  action: LaunchAction,
  attacker: AttackerLaunchState,
  target: TargetLaunchState,
  now: number,
): EngineBattleInput {
  const hasRadar     = target.hasRadar;
  const radarMod     = hasRadar ? 0.9 : 1.0;
  const moraleActive = attacker.moraleDebuffActive;
  const crystal      = action.crystalBurned;

  return {
    battleId,
    attackerId:         attacker.id,
    defenderId:         target.ownerId,
    plotId:             target.plotId,
    troopsCommitted:    action.troopsCommitted * radarMod,
    resourcesBurned:    { iron: action.resourcesBurned.iron * radarMod, fuel: action.resourcesBurned.fuel * radarMod },
    commanderBonus:     (attacker.commanderBonus + crystal * CRYSTAL_POWER_FACTOR) * radarMod,
    moraleDebuffActive: moraleActive,
    defenseLevel:       target.defenseLevel,
    biome:              target.biome as EngineBiomeType,
    improvements:       target.improvements
      .filter((i) => ["turret", "shield_gen", "fortress"].includes(i.type))
      .map((i) => ({ type: i.type as EngineImprovementType, level: i.level })),
    orbitalHazardActive: false,
    randomSeed:         hashSeed(battleId, now),
  };
}

// ---------------------------------------------------------------------------
// Legacy persisted fields — exact shape the route writes to `battles`.
// ---------------------------------------------------------------------------

function buildLegacyPersistedFields(
  battleId: string,
  action: LaunchAction,
  attacker: AttackerLaunchState,
  target: TargetLaunchState,
  now: number,
): LegacyPersistedBattleFields {
  return {
    id:               battleId,
    attackerId:       attacker.id,
    defenderId:       target.ownerId,
    targetParcelId:   target.parcelId,
    // Powers are filled in by the route AFTER it has called the resolver
    // (the resolver needs the pre-randFactor base, not the adjusted one).
    // The adapter leaves them at zero here as a safe sentinel; the route
    // overwrites them before persisting.
    attackerPower:    0,
    defenderPower:    0,
    troopsCommitted:  action.troopsCommitted,
    resourcesBurned:  { iron: action.resourcesBurned.iron, fuel: action.resourcesBurned.fuel },
    crystalBurned:    action.crystalBurned,
    startTs:          now,
    resolveTs:        now + 10 * 60 * 1000, // BATTLE_DURATION_MS — kept inline to avoid import cycles
    commanderId:      attacker.commanderId,
    sourceParcelId:   action.sourceParcelId,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function plotRef(plotId: number, parcelId: string): CombatPlotRef {
  return { plotId, parcelId };
}

/**
 * Guard for the contract's accepted `ImprovementType` set. The legacy
 * `target.improvements` may contain improvement IDs (e.g. "data_centre",
 * "radar") that the resolver itself ignores; the contract list is the
 * authoritative filter.
 */
function isContractImprovement(t: string): t is ImprovementType {
  return [
    "turret", "shield_gen", "fortress", "mine", "refinery", "solar_array",
    "storage_depot", "radar", "electricity", "blockchain_node", "data_centre",
    "ai_lab", "comm_terminal", "bunker",
  ].includes(t);
}

// ---------------------------------------------------------------------------
// Re-exports for callers
// ---------------------------------------------------------------------------

export { CombatProfileValidationError };
export type { BattleSnapshot, CombatProfile, CombatProfileDraft, CombatModifier };
