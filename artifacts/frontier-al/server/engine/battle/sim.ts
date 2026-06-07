/**
 * server/engine/battle/sim.ts
 *
 * Battle-balance simulation harness (LUT §10). Runs many deterministic battles
 * per biome through the real engine and reports attacker win rates, validating
 * that the canonical BIOME_DEFENSE_MOD produces the intended difficulty gradient
 * (mountains hardest to capture, water easiest). Pure — no DB, no network.
 *
 * Full report:  npx tsx server/engine/battle/sim.ts
 */

import { resolveBattle } from "./resolve.js";
import { hashSeed } from "./random.js";
import { BIOME_DEFENSE_MOD } from "./tuning.js";
import type { BattleInput, BiomeType } from "./types.js";

/** Biomes ordered by ascending defense modifier (easiest → hardest to capture). */
export const SIM_BIOMES: BiomeType[] = [
  "water", "desert", "plains", "forest", "swamp", "tundra", "volcanic", "mountain",
];

export interface SimOptions {
  trials?: number;
  troops?: number;
  defenseLevel?: number;
  iron?: number;
  fuel?: number;
}

export interface BiomeSimResult {
  biome: BiomeType;
  defenseMod: number;
  trials: number;
  wins: number;
  winRate: number;
  avgAttackerPower: number;
  avgDefenderPower: number;
}

/**
 * Simulate `trials` battles per biome against a fixed attacker/defender profile.
 * Each battle is seeded deterministically so results are reproducible.
 */
export function simulateBattles(opts: SimOptions = {}): BiomeSimResult[] {
  const trials = opts.trials ?? 10_000;
  const troops = opts.troops ?? 40;
  const defenseLevel = opts.defenseLevel ?? 5;
  const iron = opts.iron ?? 50;
  const fuel = opts.fuel ?? 50;

  return SIM_BIOMES.map((biome) => {
    let wins = 0;
    let sumAttacker = 0;
    let sumDefender = 0;

    for (let i = 0; i < trials; i++) {
      const input: BattleInput = {
        battleId: `sim-${biome}-${i}`,
        attackerId: "sim-attacker",
        defenderId: "sim-defender",
        plotId: i,
        troopsCommitted: troops,
        resourcesBurned: { iron, fuel },
        commanderBonus: 0,
        moraleDebuffActive: false,
        defenseLevel,
        biome,
        improvements: [],
        orbitalHazardActive: false,
        randomSeed: hashSeed("sim", biome, i),
      };
      const r = resolveBattle(input);
      if (r.outcome === "attacker_wins") wins++;
      sumAttacker += r.attackerPower;
      sumDefender += r.defenderPower;
    }

    return {
      biome,
      defenseMod: BIOME_DEFENSE_MOD[biome] ?? 1.0,
      trials,
      wins,
      winRate: wins / trials,
      avgAttackerPower: sumAttacker / trials,
      avgDefenderPower: sumDefender / trials,
    };
  });
}

export function formatReport(results: BiomeSimResult[], opts: SimOptions = {}): string {
  const lines: string[] = [];
  lines.push("FRONTIER battle-balance simulation");
  lines.push(
    `trials/biome=${results[0]?.trials ?? 0}  troops=${opts.troops ?? 40}  ` +
    `defenseLevel=${opts.defenseLevel ?? 5}  iron=${opts.iron ?? 50}  fuel=${opts.fuel ?? 50}`,
  );
  lines.push("");
  lines.push("biome      defMod   atkWin%   avgAtk    avgDef");
  lines.push("--------   ------   -------   ------    ------");
  for (const r of results) {
    lines.push(
      `${r.biome.padEnd(8)}   ${r.defenseMod.toFixed(2)}    ` +
      `${(r.winRate * 100).toFixed(1).padStart(5)}%   ` +
      `${r.avgAttackerPower.toFixed(1).padStart(6)}   ${r.avgDefenderPower.toFixed(1).padStart(6)}`,
    );
  }
  return lines.join("\n");
}

// Run directly: npx tsx server/engine/battle/sim.ts
import { pathToFileURL } from "url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Profile chosen so the biome difficulty gradient is visible (defender power
  // spans the attacker's randFactor band). Override via the exported API for
  // other scenarios.
  const opts: SimOptions = { trials: 10_000, troops: 30, defenseLevel: 20, iron: 20, fuel: 20 };
  const results = simulateBattles(opts);
  console.log(formatReport(results, opts));
}
