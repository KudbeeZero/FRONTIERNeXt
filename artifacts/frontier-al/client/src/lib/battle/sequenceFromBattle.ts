/**
 * client/src/lib/battle/sequenceFromBattle.ts
 *
 * Pure builders that assemble a Battle Sequence for the GLOBE cinematic from a
 * live battle row + the resolution facts the client knows at resolve time.
 *
 * Unlike the watch modal (which fetches the full replay record), the globe plays
 * the cinematic the instant a `battle_resolved` event arrives, off data already
 * on the client: the cached (still-"pending") Battle row carries the snapshot
 * powers, source/target parcels, troops and commander; the event carries the
 * outcome and target coordinates. randFactor isn't in the world event, so it's
 * optional (defaults to 0 — the luck-swing beat just plays flat).
 *
 * CONTRACT: pure — no React, no Three.js, no fetch.
 */

import {
  buildBattleSequence,
  type BattleSequence,
  type BattleOutcome,
  type GeoPoint,
} from "@shared/battle-sequence";
import type { Battle } from "@shared/schema";
import { fortificationLevel } from "./sequenceFromReplay";

/** Everything needed to choreograph a resolved battle on the globe. */
export interface ResolvedBattleFacts {
  battleId: string;
  source: GeoPoint;
  target: GeoPoint;
  plotId: number;
  biome: string;
  attackerName: string;
  defenderName?: string | null;
  attackerColor?: string;
  defenderColor?: string;
  /** Snapshot attacker power from the battle row (pre-randFactor). */
  attackerPowerSnapshot: number;
  defenderPower: number;
  /** From the engine resolver; absent in the world event ⇒ treated as 0. */
  randFactor?: number;
  outcome: BattleOutcome;
  troopsCommitted: number;
  hasCommander?: boolean;
  improvements?: ReadonlyArray<{ type: string; level: number }> | null;
}

/**
 * Build the globe cinematic sequence from resolution facts. Reconstructs the
 * final adjusted attacker power (snapshot × (1 + randFactor/100)) so the engine's
 * swing-flip detection matches the resolver. Spoils aren't on the client at this
 * point, so they default to 0 — the globe shows capture, not pillage counts.
 */
export function buildSequenceFromFacts(f: ResolvedBattleFacts): BattleSequence {
  const rf = f.randFactor ?? 0;
  const adjustedAttackerPower = Math.max(0, f.attackerPowerSnapshot) * (1 + rf / 100);
  return buildBattleSequence({
    battleId: f.battleId,
    source: f.source,
    target: f.target,
    plotId: f.plotId,
    biome: f.biome,
    attackerName: f.attackerName,
    defenderName: f.defenderName ?? null,
    attackerColor: f.attackerColor,
    defenderColor: f.defenderColor,
    attackerPower: adjustedAttackerPower,
    defenderPower: Math.max(0, f.defenderPower),
    randFactor: rf,
    outcome: f.outcome,
    troopsCommitted: f.troopsCommitted,
    hasCommander: f.hasCommander,
    fortificationLevel: fortificationLevel(f.improvements),
  });
}

/** A parcel's position + display context, looked up by the globe layer. */
export interface ParcelFacts {
  source: GeoPoint;
  target: GeoPoint;
  plotId: number;
  biome: string;
  improvements?: ReadonlyArray<{ type: string; level: number }> | null;
}

/**
 * Merge a cached (pending) Battle row, the resolution outcome, and looked-up
 * parcel positions into the facts the cinematic needs. Returns null when the
 * essentials (a known source position) are missing — the layer then skips the
 * attacker→defender arc rather than drawing a bogus one.
 */
export function factsFromBattle(
  battle: Battle,
  outcome: BattleOutcome,
  parcel: ParcelFacts,
  names: { attackerName: string; defenderName?: string | null },
  colors?: { attackerColor?: string; defenderColor?: string },
): ResolvedBattleFacts {
  return {
    battleId: battle.id,
    source: parcel.source,
    target: parcel.target,
    plotId: parcel.plotId,
    biome: parcel.biome,
    attackerName: names.attackerName,
    defenderName: names.defenderName ?? null,
    attackerColor: colors?.attackerColor,
    defenderColor: colors?.defenderColor,
    attackerPowerSnapshot: battle.attackerPower ?? 0,
    defenderPower: battle.defenderPower ?? 0,
    randFactor: battle.randFactor ?? 0,
    outcome,
    troopsCommitted: battle.troopsCommitted ?? 0,
    hasCommander: !!battle.commanderId,
    improvements: parcel.improvements,
  };
}
