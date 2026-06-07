/**
 * server/engine/battle/resolve.spec.ts
 *
 * Behavioural tests for the FRONTIER battle engine. Pure — no DB, no network.
 * Complements smoke.ts (run via tsx) and pins the invariants the DB storage
 * layer relies on, including the Pass B snapshot-resolution equivalence.
 */

import { describe, it, expect } from "vitest";
import { resolveBattle, resolveBattleFromPowers } from "./resolve.js";
import { hashSeed } from "./random.js";
import {
  RAND_FACTOR_MAX,
  BIOME_DEFENSE_MOD,
  PILLAGE_RATE,
  MORALE_ATTACK_PENALTY,
  CRYSTAL_POWER_FACTOR,
  BASE_DEFENSE_POWER,
} from "./tuning.js";
import type { BattleInput } from "./types.js";

function makeInput(overrides: Partial<BattleInput> = {}): BattleInput {
  return {
    battleId:           "battle-1",
    attackerId:         "attacker-1",
    defenderId:         "defender-1",
    plotId:             1,
    troopsCommitted:    50,
    resourcesBurned:    { iron: 100, fuel: 100 },
    commanderBonus:     0,
    moraleDebuffActive: false,
    defenseLevel:       2,
    biome:              "plains",
    improvements:       [],
    orbitalHazardActive: false,
    randomSeed:         hashSeed("battle-1", 1000),
    ...overrides,
  };
}

/** Recover pre-randFactor attacker power from a result (the value deployAttack stores). */
const basePower = (r: { attackerPower: number; randFactor: number }) =>
  r.attackerPower / (1 + r.randFactor / 100);

describe("resolveBattle — determinism", () => {
  it("identical input produces identical result", () => {
    const input = makeInput();
    const a = resolveBattle(input);
    const b = resolveBattle({ ...input });
    expect(b.outcome).toBe(a.outcome);
    expect(b.randFactor).toBe(a.randFactor);
    expect(b.attackerPower).toBe(a.attackerPower);
    expect(b.defenderPower).toBe(a.defenderPower);
  });

  it("randFactor stays within [-RAND_FACTOR_MAX, RAND_FACTOR_MAX] across many seeds", () => {
    for (let i = 0; i < 500; i++) {
      const { randFactor } = resolveBattle(makeInput({ randomSeed: hashSeed("b", i) }));
      expect(randFactor).toBeGreaterThanOrEqual(-RAND_FACTOR_MAX);
      expect(randFactor).toBeLessThanOrEqual(RAND_FACTOR_MAX);
    }
  });
});

describe("resolveBattle — defender power", () => {
  it("applies the biome defense modifier", () => {
    const plains   = resolveBattle(makeInput({ biome: "plains" }));
    const mountain = resolveBattle(makeInput({ biome: "mountain" }));
    // defenseLevel 2, no improvements → base 2 * BASE_DEFENSE_POWER, scaled by biome mod.
    expect(plains.defenderPower).toBeCloseTo(2 * BASE_DEFENSE_POWER * BIOME_DEFENSE_MOD.plains, 6);
    expect(mountain.defenderPower).toBeCloseTo(2 * BASE_DEFENSE_POWER * BIOME_DEFENSE_MOD.mountain, 6);
    expect(mountain.defenderPower).toBeCloseTo(
      plains.defenderPower * (BIOME_DEFENSE_MOD.mountain / BIOME_DEFENSE_MOD.plains),
      6,
    );
  });
});

describe("resolveBattle — morale debuff", () => {
  it("reduces attacker power by exactly MORALE_ATTACK_PENALTY at the same seed", () => {
    const without = resolveBattle(makeInput({ moraleDebuffActive: false }));
    const withDebuff = resolveBattle(makeInput({ moraleDebuffActive: true }));
    // Same seed → same randFactor, so the base ratio is preserved post-adjustment.
    expect(withDebuff.randFactor).toBe(without.randFactor);
    expect(basePower(withDebuff)).toBeCloseTo(basePower(without) * (1 - MORALE_ATTACK_PENALTY), 6);
  });
});

describe("resolveBattle — pillage", () => {
  it("returns PILLAGE_RATE on attacker win and 0 on defender win", () => {
    const win = resolveBattle(makeInput({ troopsCommitted: 100_000 }));
    expect(win.outcome).toBe("attacker_wins");
    expect(win.pillagedIron).toBe(PILLAGE_RATE);
    expect(win.pillagedFuel).toBe(PILLAGE_RATE);
    expect(win.pillagedCrystal).toBe(PILLAGE_RATE);

    const loss = resolveBattle(makeInput({
      troopsCommitted: 0,
      resourcesBurned: { iron: 0, fuel: 0 },
      commanderBonus: 0,
      defenseLevel: 10,
    }));
    expect(loss.outcome).toBe("defender_wins");
    expect(loss.pillagedIron).toBe(0);
    expect(loss.pillagedFuel).toBe(0);
    expect(loss.pillagedCrystal).toBe(0);
  });
});

describe("resolveBattle — storage-layer folding invariants", () => {
  it("crystal folded into commanderBonus adds exactly crystal * CRYSTAL_POWER_FACTOR", () => {
    const crystal = 40;
    const baseline = resolveBattle(makeInput({ commanderBonus: 10 }));
    const folded   = resolveBattle(makeInput({ commanderBonus: 10 + crystal * CRYSTAL_POWER_FACTOR }));
    expect(folded.randFactor).toBe(baseline.randFactor);
    expect(basePower(folded) - basePower(baseline)).toBeCloseTo(crystal * CRYSTAL_POWER_FACTOR, 6);
  });

  it("radar pre-scaling attacker inputs equals scaling total attacker power", () => {
    const radarMod = 0.9;
    const unscaled = makeInput({ troopsCommitted: 60, resourcesBurned: { iron: 80, fuel: 120 }, commanderBonus: 30 });
    const scaled = makeInput({
      troopsCommitted: 60 * radarMod,
      resourcesBurned: { iron: 80 * radarMod, fuel: 120 * radarMod },
      commanderBonus: 30 * radarMod,
    });
    const u = resolveBattle(unscaled);
    const s = resolveBattle(scaled);
    expect(s.randFactor).toBe(u.randFactor);
    expect(basePower(s)).toBeCloseTo(basePower(u) * radarMod, 6);
  });

  it("Pass B: resolveBattleFromPowers matches resolveBattle for the same snapshot + seed", () => {
    const input = makeInput({ troopsCommitted: 40, commanderBonus: 25, biome: "forest", defenseLevel: 3 });
    const full = resolveBattle(input);
    const snapshotBase = basePower(full); // what deployAttack persists on the battle row
    const fromPowers = resolveBattleFromPowers(snapshotBase, full.defenderPower, input.randomSeed);

    expect(fromPowers.outcome).toBe(full.outcome);
    expect(fromPowers.randFactor).toBe(full.randFactor);
    expect(fromPowers.attackerPower).toBeCloseTo(full.attackerPower, 6);
    expect(fromPowers.defenderPower).toBe(full.defenderPower);
    expect(fromPowers.pillagedIron).toBe(full.pillagedIron);
  });
});
