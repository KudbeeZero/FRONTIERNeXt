/**
 * server/engine/battle/resolve.ts
 *
 * FRONTIER Battle Engine — deterministic resolution.
 *
 * CONTRACT:
 *   - Given identical BattleInput, always returns identical BattleResult.
 *   - No DB calls, no network, no Algorand SDK, no randomUUID.
 *   - All randomness flows through mulberry32(input.randomSeed).
 */

import type { BattleInput, BattleResult, BattleLogEntry } from "./types.js";
import { mulberry32, randInt } from "./random.js";
import {
  TROOPS_POWER_FACTOR,
  IRON_POWER_FACTOR,
  FUEL_POWER_FACTOR,
  BASE_DEFENSE_POWER,
  IMPROVEMENT_DEFENSE_PER_LEVEL,
  MORALE_ATTACK_PENALTY,
  BIOME_DEFENSE_MOD,
  RAND_FACTOR_MAX,
  PILLAGE_RATE,
  ORBITAL_HAZARD_DEFENSE_PENALTY,
} from "./tuning.js";

export function resolveBattle(input: BattleInput): BattleResult {
  const log: BattleLogEntry[] = [];

  // ── Attacker Power ────────────────────────────────────────────────────────
  const rawAttackerPower =
    input.troopsCommitted * TROOPS_POWER_FACTOR +
    input.resourcesBurned.iron * IRON_POWER_FACTOR +
    input.resourcesBurned.fuel * FUEL_POWER_FACTOR +
    input.commanderBonus;

  log.push({
    phase: "power_calc",
    message: `Raw attacker power: ${rawAttackerPower.toFixed(2)} (troops=${input.troopsCommitted}, iron=${input.resourcesBurned.iron}, fuel=${input.resourcesBurned.fuel}, cmdBonus=${input.commanderBonus})`,
  });

  // ── Morale Debuff ─────────────────────────────────────────────────────────
  const attackerPower = input.moraleDebuffActive
    ? rawAttackerPower * (1 - MORALE_ATTACK_PENALTY)
    : rawAttackerPower;

  if (input.moraleDebuffActive) {
    log.push({
      phase: "morale",
      message: `Morale debuff active: attacker power reduced ${(MORALE_ATTACK_PENALTY * 100).toFixed(0)}% → ${attackerPower.toFixed(2)}`,
    });
  }

  // ── Defender Power ────────────────────────────────────────────────────────
  const biomeMod = BIOME_DEFENSE_MOD[input.biome] ?? 1.0;

  const improvementBonus = input.improvements
    .filter((i) => ["turret", "shield_gen", "fortress"].includes(i.type))
    .reduce((sum, i) => sum + i.level * IMPROVEMENT_DEFENSE_PER_LEVEL, 0);

  let rawDefenderPower = (input.defenseLevel * BASE_DEFENSE_POWER + improvementBonus) * biomeMod;

  log.push({
    phase: "terrain",
    message: `Biome=${input.biome} (×${biomeMod}), improvements bonus=${improvementBonus}, base defender power: ${rawDefenderPower.toFixed(2)}`,
  });

  // ── Orbital Hazard ────────────────────────────────────────────────────────
  if (input.orbitalHazardActive) {
    rawDefenderPower *= 1 - ORBITAL_HAZARD_DEFENSE_PENALTY;
    log.push({
      phase: "terrain",
      message: `Orbital hazard active: defender power reduced ${(ORBITAL_HAZARD_DEFENSE_PENALTY * 100).toFixed(0)}% → ${rawDefenderPower.toFixed(2)}`,
    });
  }

  const defenderPower = rawDefenderPower;

  // ── Random Factor + Outcome ───────────────────────────────────────────────
  // Delegated to resolveBattleFromPowers so the randFactor algorithm and the
  // win/pillage decision live in exactly one place. attackerPower here is the
  // post-morale, pre-randFactor value; the helper applies randFactor.
  const resolution = resolveBattleFromPowers(attackerPower, defenderPower, input.randomSeed);
  log.push(...resolution.log);

  return {
    winner:          resolution.winner,
    attackerPower:   resolution.attackerPower,
    defenderPower:   resolution.defenderPower,
    randFactor:      resolution.randFactor,
    outcome:         resolution.outcome,
    pillagedIron:    resolution.pillagedIron,
    pillagedFuel:    resolution.pillagedFuel,
    pillagedCrystal: resolution.pillagedCrystal,
    log,
  };
}

/**
 * Resolve a battle from already-computed powers.
 *
 * This is the deterministic resolution core shared by:
 *   - resolveBattle() (computes powers from raw BattleInput, then calls this)
 *   - the DB storage layer at battle-resolution time, which passes the
 *     deploy-time snapshot powers stored on the battle row so the matchup is
 *     locked at launch (immune to mid-battle defence changes).
 *
 * CONTRACT: identical (attackerPower, defenderPower, randomSeed) → identical result.
 *
 * @param attackerPower pre-randFactor attacker power (morale already applied).
 * @param defenderPower  final defender power.
 * @param randomSeed     derive via hashSeed(battleId, startTs) for stability.
 */
export function resolveBattleFromPowers(
  attackerPower: number,
  defenderPower: number,
  randomSeed: number,
): Omit<BattleResult, "log"> & { log: BattleLogEntry[] } {
  const log: BattleLogEntry[] = [];
  const rng = mulberry32(randomSeed);

  // randFactor in [-RAND_FACTOR_MAX, +RAND_FACTOR_MAX]
  const randFactor = randInt(rng, -RAND_FACTOR_MAX, RAND_FACTOR_MAX);
  const adjustedAttackerPower = attackerPower * (1 + randFactor / 100);

  log.push({
    phase: "resolution",
    message: `randFactor=${randFactor}, adjusted attacker=${adjustedAttackerPower.toFixed(2)}, defender=${defenderPower.toFixed(2)}`,
  });

  const attackerWins = adjustedAttackerPower > defenderPower;
  const outcome: BattleResult["outcome"] = attackerWins ? "attacker_wins" : "defender_wins";
  const winner: BattleResult["winner"]   = attackerWins ? "attacker"      : "defender";

  log.push({
    phase: "resolution",
    message: `Outcome: ${outcome}`,
  });

  // Pillage rates (only on attacker win). Caller multiplies against stored amounts.
  const pillagedIron    = attackerWins ? PILLAGE_RATE : 0;
  const pillagedFuel    = attackerWins ? PILLAGE_RATE : 0;
  const pillagedCrystal = attackerWins ? PILLAGE_RATE : 0;

  return {
    winner,
    attackerPower: adjustedAttackerPower,
    defenderPower,
    randFactor,
    outcome,
    pillagedIron,
    pillagedFuel,
    pillagedCrystal,
    log,
  };
}
