/**
 * server/engine/battle/replayLog.ts
 *
 * Pure builder for the player-visible battle replay log.
 *
 * The deterministic resolution core (`resolveBattleFromPowers`) already emits the
 * randFactor → adjusted-attacker-vs-defender → outcome entries. This wraps that
 * with a composition prefix (what the attacker committed → snapshot attack power)
 * and a defender/terrain line (biome + fortifications → defender power) and an
 * aftermath suffix (conquest + pillage, or a repelled attack) — all derived from
 * data already persisted on the battle row + target parcel, so no schema change is
 * needed and the log is fully deterministic.
 *
 * CONTRACT: pure — no DB, no network, no randomness. Messages contain only display
 * names, plot ids, biome, powers and resource counts — never wallet addresses or
 * raw UUIDs (the log is served to clients via /api/battle/replay/:id).
 */

import type { BattleLogEntry } from "./types.js";

/** Improvement types that actually contribute to defender power (mirrors resolve.ts). */
const DEFENSIVE_IMPROVEMENTS = ["turret", "shield_gen", "fortress"] as const;

export interface ReplayLogInput {
  attackerName: string;
  // Attacker commitment (persisted on the battle row).
  troopsCommitted: number;
  ironBurned: number;
  fuelBurned: number;
  crystalBurned: number;
  hasCommander: boolean;
  /** Post-morale, pre-randFactor snapshot stored at deploy time. */
  attackerPowerSnapshot: number;
  /** Final defender power snapshot. */
  defenderPower: number;
  // Defender context (from the target parcel).
  defenseLevel: number;
  biome: string;
  improvements: { type: string; level: number }[];
  plotId: number;
  // Outcome / aftermath.
  attackerWins: boolean;
  pillagedIron: number;
  pillagedFuel: number;
  pillagedCrystal: number;
  /** The resolution entries from resolveBattleFromPowers (randFactor → outcome). */
  resolutionLog: BattleLogEntry[];
}

export function buildReplayLog(i: ReplayLogInput): BattleLogEntry[] {
  const log: BattleLogEntry[] = [];

  // ── Attacker composition ──────────────────────────────────────────────────
  const committed = [
    `${i.troopsCommitted} troops`,
    `${i.ironBurned} iron`,
    `${i.fuelBurned} fuel`,
    ...(i.crystalBurned > 0 ? [`${i.crystalBurned} crystal`] : []),
  ].join(", ");
  log.push({
    phase: "power_calc",
    message:
      `${i.attackerName} committed ${committed}` +
      (i.hasCommander ? " (commander deployed)" : "") +
      ` → attack power ${i.attackerPowerSnapshot.toFixed(2)}`,
  });

  // ── Defender / terrain ────────────────────────────────────────────────────
  const forts = i.improvements
    .filter((imp) => (DEFENSIVE_IMPROVEMENTS as readonly string[]).includes(imp.type))
    .map((imp) => `${imp.type} L${imp.level}`);
  log.push({
    phase: "terrain",
    message:
      `Defender: ${i.biome} biome, defense L${i.defenseLevel}, ` +
      (forts.length > 0 ? forts.join(", ") : "no fortifications") +
      ` → defender power ${i.defenderPower.toFixed(2)}`,
  });

  // ── Resolution (single source of truth: the engine's resolution log) ──────
  log.push(...i.resolutionLog);

  // ── Aftermath ─────────────────────────────────────────────────────────────
  if (i.attackerWins) {
    const spoils = [
      `${i.pillagedIron} iron`,
      `${i.pillagedFuel} fuel`,
      ...(i.pillagedCrystal > 0 ? [`${i.pillagedCrystal} crystal`] : []),
    ].join(", ");
    log.push({
      phase: "resolution",
      message: `${i.attackerName} captured plot #${i.plotId} — pillaged ${spoils}.`,
    });
  } else {
    log.push({
      phase: "resolution",
      message: `Defense held at plot #${i.plotId} — ${i.attackerName}'s attack was repelled.`,
    });
  }

  return log;
}
