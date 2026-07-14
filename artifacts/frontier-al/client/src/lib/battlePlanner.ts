/**
 * client/src/lib/battlePlanner.ts
 *
 * Pure, deterministic helpers for the Battle Planner flow.
 *
 * These functions contain NO React, NO side-effects, and NO server/auth logic.
 * They exist so the planner's recommendation, eligibility, and launch-gating
 * logic can be unit-tested in isolation and reused by the component.
 *
 * The planner is strictly an advisory client layer over the EXISTING attack
 * contract. None of this changes battle math, ownership, deployAttack(),
 * resolveBattles(), or idempotency — those remain server-authoritative.
 */

import type { LandParcel, Player, CommanderAvatar, Battle, BiomeType } from "@shared/schema";
import { ATTACK_BASE_COST, COMMANDER_INFO, biomeBonuses } from "@shared/schema";

// ── Geometry ──────────────────────────────────────────────────────────────────

/** Great-circle distance (radians) between two lat/lng points. Pure. */
export function sphereDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Human-readable distance label matching the existing BattleTargetSelector. */
export function formatDistanceLabel(distance: number): string {
  if (distance < 0.01) return "Nearby";
  if (distance < 0.05) return "~50 units";
  return "~100 units";
}

// ── Launch origin (source parcel) ───────────────────────────────────────────────

export interface OriginEvaluation {
  parcel: LandParcel;
  distance: number;
  eligible: boolean;
  blockedReason: string | null;
  hasActiveBattle: boolean;
  /** Sum of stored resources on the parcel — an operational-position proxy. */
  storedResources: number;
}

/**
 * Evaluate every player-owned parcel as a potential launch origin for `target`.
 *
 * Eligibility rules (advisory only — the server is authoritative):
 *  - a parcel cannot launch an attack against itself
 *  - a parcel already engaged in a battle cannot be used as an origin
 *  - otherwise the parcel is eligible
 */
export function evaluateOrigins(
  ownedParcels: LandParcel[],
  target: LandParcel | null | undefined,
  _battles: Battle[] = [],
): OriginEvaluation[] {
  const targetId = target?.id ?? null;
  return ownedParcels.map((parcel) => {
    const hasActiveBattle = parcel.activeBattleId != null;
    let eligible = true;
    let blockedReason: string | null = null;

    if (parcel.id === targetId) {
      eligible = false;
      blockedReason = "Target plot";
    } else if (hasActiveBattle) {
      eligible = false;
      blockedReason = "Origin engaged";
    }

    const storedResources =
      (parcel.ironStored || 0) + (parcel.fuelStored || 0) + (parcel.crystalStored || 0);

    const distance = target
      ? sphereDistance(parcel.lat, parcel.lng, target.lat, target.lng)
      : Number.POSITIVE_INFINITY;

    return {
      parcel,
      distance,
      eligible,
      blockedReason,
      hasActiveBattle,
      storedResources,
    };
  });
}

/**
 * Return owned parcels sorted as launch-origin recommendations.
 *
 * Deterministic priority order:
 *  1. eligible before blocked
 *  2. not currently engaged before engaged
 *  3. shortest distance to target
 *  4. more stored resources (operational position)
 *  5. stronger defense
 *  6. lowest plot id (stable tiebreak)
 */
export function recommendOrigins(
  ownedParcels: LandParcel[],
  target: LandParcel | null | undefined,
  battles: Battle[] = [],
): LandParcel[] {
  return evaluateOrigins(ownedParcels, target, battles)
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      if (a.hasActiveBattle !== b.hasActiveBattle) return a.hasActiveBattle ? 1 : -1;
      const da = Number.isFinite(a.distance) ? a.distance : Number.POSITIVE_INFINITY;
      const db = Number.isFinite(b.distance) ? b.distance : Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      if (a.storedResources !== b.storedResources) return b.storedResources - a.storedResources;
      if (a.parcel.defenseLevel !== b.parcel.defenseLevel)
        return b.parcel.defenseLevel - a.parcel.defenseLevel;
      return a.parcel.plotId - b.parcel.plotId;
    })
    .map((e) => e.parcel);
}

// ── Commander evaluation ────────────────────────────────────────────────────────

export type CommanderState = "available" | "locked" | "maxed";

export interface CommanderEvaluation {
  commander: CommanderAvatar;
  activeBattles: number;
  maxConcurrent: number;
  isMaxed: boolean;
  isLocked: boolean;
  lockRemainingMs: number;
  state: CommanderState;
}

/** Count the player's pending battles currently attributed to a given commander. */
export function countActiveBattlesForCommander(battles: Battle[], commanderId: string): number {
  return battles.filter((b) => b.status === "pending" && b.commanderId === commanderId).length;
}

/** Pure commander readiness evaluation at a given `now` (ms epoch). */
export function evaluateCommander(
  commander: CommanderAvatar,
  battles: Battle[],
  now: number,
): CommanderEvaluation {
  const activeBattles = countActiveBattlesForCommander(battles, commander.id);
  const maxConcurrent = COMMANDER_INFO[commander.tier]?.maxConcurrentAttacks ?? 1;
  const isLocked = !!(commander.lockedUntil && commander.lockedUntil > now);
  const isMaxed = activeBattles >= maxConcurrent;
  const lockRemainingMs = isLocked ? (commander.lockedUntil as number) - now : 0;
  const state: CommanderState = isMaxed ? "maxed" : isLocked ? "locked" : "available";
  return {
    commander,
    activeBattles,
    maxConcurrent,
    isMaxed,
    isLocked,
    lockRemainingMs,
    state,
  };
}

export function evaluateCommanders(
  commanders: CommanderAvatar[],
  battles: Battle[],
  now: number,
): CommanderEvaluation[] {
  return commanders.map((c) => evaluateCommander(c, battles, now));
}

// ── Resource commitment ────────────────────────────────────────────────────────

export interface ResourceCost {
  iron: number;
  fuel: number;
  crystal: number;
}

export interface ResourceBalance {
  iron: number;
  fuel: number;
  crystal: number;
}

/**
 * Compute the total resource burn for a planned attack. Mirrors the EXACT
 * formula used by CommanderPanel / handleAttackConfirm — do not change values
 * here without aligning the server attack contract.
 */
export function computeAttackCost(
  troops: number,
  extraIron: number,
  extraFuel: number,
  extraCrystal: number,
): ResourceCost {
  return {
    iron: ATTACK_BASE_COST.iron * troops + extraIron,
    fuel: ATTACK_BASE_COST.fuel * troops + extraFuel,
    crystal: extraCrystal,
  };
}

export function remainingBalance(player: Player, cost: ResourceCost): ResourceBalance {
  return {
    iron: player.iron - cost.iron,
    fuel: player.fuel - cost.fuel,
    crystal: player.crystal - cost.crystal,
  };
}

/** True only when the player can cover every committed resource. */
export function isAffordable(player: Player, cost: ResourceCost): boolean {
  return player.iron >= cost.iron && player.fuel >= cost.fuel && player.crystal >= cost.crystal;
}

/** Max troops the player can field given base iron/fuel cost (mirrors panel cap). */
export function maxTroopsFor(player: Player): number {
  return Math.min(
    10,
    Math.floor(player.iron / ATTACK_BASE_COST.iron),
    Math.floor(player.fuel / ATTACK_BASE_COST.fuel),
  );
}

// ── Outcome projection (advisory) ───────────────────────────────────────────────

/**
 * Inputs needed to project a planned attack's outcome. Every field is already
 * present in the planner's props — no new server data is required.
 */
export interface PlannedPowersInput {
  troops: number;
  extraIron: number;
  extraFuel: number;
  extraCrystal: number;
  /** Selected commander's `attackBonus`. Pass 0 when none selected. */
  commanderAttackBonus: number;
  /** Target `defenseLevel`. Pass 0 when no target is selected. */
  targetDefenseLevel: number;
  /** Target biome. `defenseMod` defaults to 1 when unknown. */
  targetBiome: BiomeType;
}

export interface PlannedPowers {
  attackerPower: number;
  defenderPower: number;
}

/**
 * Compute attacker/defender power for a planned attack.
 *
 * BYTE-FOR-BYTE equivalent to the legacy formula in `CommanderPanel.tsx`
 * (the `attackerPower` / `defenderPower` derivation). Do not rebalance here —
 * this is an advisory preview of the existing combat math.
 *
 * When no target is selected, pass `targetDefenseLevel = 0`, which yields
 * `defenderPower = 0` and therefore a 75% projected win chance (matching the
 * legacy `defenderPower > 0 ? … : 75` branch).
 */
export function computePlannedPowers(input: PlannedPowersInput): PlannedPowers {
  const { troops, extraIron, extraFuel, extraCrystal, commanderAttackBonus, targetDefenseLevel, targetBiome } = input;
  const attackerPower = troops * 10 + extraIron * 0.5 + extraFuel * 0.8 + extraCrystal * 1.2 + commanderAttackBonus;
  const defenderPower = targetDefenseLevel * 15 * (biomeBonuses[targetBiome]?.defenseMod ?? 1);
  return { attackerPower, defenderPower };
}

/**
 * Project the win chance (%) for a planned attack.
 *
 * Mirrors `CommanderPanel.tsx`'s `winChance` exactly:
 *   defenderPower <= 0  → 75
 *   otherwise → clamp(5, 95, attacker / (attacker + defender) * 100)
 */
export function projectWinChance(input: PlannedPowersInput): number {
  const { attackerPower, defenderPower } = computePlannedPowers(input);
  if (defenderPower <= 0) return 75;
  const raw = (attackerPower / (attackerPower + defenderPower)) * 100;
  return Math.min(95, Math.max(5, raw));
}

// ── Launch-state resolution ────────────────────────────────────────────────────

export type LaunchState =
  | "REVIEW_ATTACK"
  | "READY_TO_LAUNCH"
  | "ATTACK_SUBMITTING"
  | "TARGET_ALREADY_ENGAGED"
  | "COMMANDER_LOCKED"
  | "MAXIMUM_ACTIVE"
  | "INSUFFICIENT_RESOURCES"
  | "PLAYER_COOLDOWN";

export interface LaunchResolutionInput {
  target: LandParcel | null | undefined;
  sourceParcelId: string | null;
  selectedCommander: CommanderEvaluation | null;
  player: Player;
  cost: ResourceCost;
  attacking: boolean;
  now: number;
}

/**
 * Resolve the single launch state the planner button should present.
 * Order matters: in-flight submission wins, then hard blocks, then readiness.
 */
export function resolveLaunchState(input: LaunchResolutionInput): LaunchState {
  const { target, sourceParcelId, selectedCommander, player, cost, attacking, now } = input;

  if (attacking) return "ATTACK_SUBMITTING";

  if (!target || !sourceParcelId || !selectedCommander) return "REVIEW_ATTACK";

  if (player.attackCooldownUntil && player.attackCooldownUntil > now) return "PLAYER_COOLDOWN";

  if (target.activeBattleId != null) return "TARGET_ALREADY_ENGAGED";

  if (selectedCommander.state === "locked") return "COMMANDER_LOCKED";
  if (selectedCommander.state === "maxed") return "MAXIMUM_ACTIVE";

  if (!isAffordable(player, cost)) return "INSUFFICIENT_RESOURCES";

  return "READY_TO_LAUNCH";
}

export const LAUNCH_STATE_LABEL: Record<LaunchState, string> = {
  REVIEW_ATTACK: "Review Attack",
  READY_TO_LAUNCH: "Launch Attack",
  ATTACK_SUBMITTING: "Attack Submitting…",
  TARGET_ALREADY_ENGAGED: "Target Already Engaged",
  COMMANDER_LOCKED: "Commander Locked",
  MAXIMUM_ACTIVE: "Maximum Active",
  INSUFFICIENT_RESOURCES: "Insufficient Resources",
  PLAYER_COOLDOWN: "Player Cooldown",
};

export function isLaunchEnabled(state: LaunchState): boolean {
  return state === "READY_TO_LAUNCH";
}

// ── Step model ─────────────────────────────────────────────────────────────────

export type PlannerStep = "target" | "origin" | "commander" | "commitment" | "review" | "launch";

export const PLANNER_STEPS: { id: PlannerStep; label: string }[] = [
  { id: "target", label: "Target" },
  { id: "origin", label: "Origin" },
  { id: "commander", label: "Commander" },
  { id: "commitment", label: "Commit" },
  { id: "review", label: "Review" },
  { id: "launch", label: "Launch" },
];
