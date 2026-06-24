/**
 * client/src/lib/battle/sequenceFromReplay.ts
 *
 * Pure adapter: public battle replay record (+ the bits of battle context the
 * record doesn't carry) → a Battle Sequence (`@shared/battle-sequence`). This is
 * the seam between the deterministic resolver's output and the cinematic spine,
 * so the watch modal — and later the globe — can replay a *real* battle as one
 * timed sequence instead of fabricating mock lore-events.
 *
 * CONTRACT: pure — no React, no fetch, no Date.now. Everything the engine needs
 * that the public record omits (troops, fortifications, commander, plot
 * positions, colours) is injected via SequenceContext by the caller.
 */

import {
  buildBattleSequence,
  type BattleSequence,
  type BattleBeat,
  type GeoPoint,
} from "@shared/battle-sequence";

/**
 * Defensive improvement types that feed battle *defender power*.
 * Mirrors the set in `server/engine/battle/resolve.ts` exactly — keep in sync.
 */
const DEFENSIVE_IMPROVEMENTS = new Set(["turret", "shield_gen", "fortress"]);

/** Sum of defensive improvement levels — the engine's `fortificationLevel`. */
export function fortificationLevel(
  improvements: ReadonlyArray<{ type: string; level: number }> | undefined | null,
): number {
  if (!improvements) return 0;
  return improvements
    .filter((i) => DEFENSIVE_IMPROVEMENTS.has(i.type))
    .reduce((sum, i) => sum + Math.max(0, i.level ?? 0), 0);
}

/** The minimal shape of the public replay record (`GET /api/battle/replay/:id`). */
export interface ReplayRecordLike {
  battleId?: string;
  attackerName?: string;
  defenderName?: string | null;
  attackerPower: number;
  defenderPower: number;
  randFactor: number;
  outcome: "attacker_wins" | "defender_wins";
  plotId?: number;
  biome?: string;
  pillagedIron?: number;
  pillagedFuel?: number;
  pillagedCrystal?: number;
}

/** Battle context the public record does not carry — injected by the caller. */
export interface SequenceContext {
  troopsCommitted: number;
  hasCommander?: boolean;
  improvements?: ReadonlyArray<{ type: string; level: number }> | null;
  /** Attacker origin on the globe; omitted ⇒ transit uses its base duration. */
  source?: GeoPoint;
  /** Defender plot on the globe; omitted ⇒ transit uses its base duration. */
  target?: GeoPoint;
  attackerColor?: string;
  defenderColor?: string;
}

const ORIGIN: GeoPoint = { lat: 0, lng: 0 };

/** Build the cinematic sequence for a resolved battle from its replay record. */
export function buildSequenceFromReplay(
  replay: ReplayRecordLike,
  ctx: SequenceContext,
): BattleSequence {
  return buildBattleSequence({
    battleId: replay.battleId ?? "battle",
    source: ctx.source ?? ORIGIN,
    target: ctx.target ?? ORIGIN,
    plotId: replay.plotId ?? 0,
    biome: replay.biome ?? "plains",
    attackerName: replay.attackerName ?? "Attacker",
    defenderName: replay.defenderName ?? null,
    attackerColor: ctx.attackerColor,
    defenderColor: ctx.defenderColor,
    attackerPower: replay.attackerPower,
    defenderPower: replay.defenderPower,
    randFactor: replay.randFactor,
    outcome: replay.outcome,
    troopsCommitted: ctx.troopsCommitted,
    hasCommander: ctx.hasCommander,
    fortificationLevel: fortificationLevel(ctx.improvements),
    pillagedIron: replay.pillagedIron,
    pillagedFuel: replay.pillagedFuel,
    pillagedCrystal: replay.pillagedCrystal,
  });
}

/**
 * The beats whose start has been reached by `elapsedMs` — i.e. what a playhead
 * scrubbing 0→duration should have revealed. Pure; drives the modal's feed.
 */
export function revealedBeats(seq: BattleSequence, elapsedMs: number): BattleBeat[] {
  if (!Number.isFinite(elapsedMs)) return [];
  return seq.beats.filter((b) => elapsedMs >= b.startMs);
}
