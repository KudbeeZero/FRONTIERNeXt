/**
 * server/engine/battle/tuning.spec.ts
 *
 * Balance-invariant tests for the battle tuning constants. These pin the
 * relationships the engine and game design depend on, so an accidental edit to
 * tuning.ts that breaks balance fails CI loudly. Pure — imports constants only.
 */

import { describe, it, expect } from "vitest";
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
  AI_FACTION_PRESETS,
  CRYSTAL_POWER_FACTOR,
} from "./tuning.js";

describe("battle tuning — power factors", () => {
  it("all power/defense factors are positive", () => {
    for (const v of [
      TROOPS_POWER_FACTOR,
      IRON_POWER_FACTOR,
      FUEL_POWER_FACTOR,
      BASE_DEFENSE_POWER,
      IMPROVEMENT_DEFENSE_PER_LEVEL,
      CRYSTAL_POWER_FACTOR,
      RAND_FACTOR_MAX,
    ]) {
      expect(v).toBeGreaterThan(0);
    }
  });

  it("troops dominate raw attacker power over iron and fuel per unit", () => {
    expect(TROOPS_POWER_FACTOR).toBeGreaterThan(IRON_POWER_FACTOR);
    expect(TROOPS_POWER_FACTOR).toBeGreaterThan(FUEL_POWER_FACTOR);
  });
});

describe("battle tuning — fractional penalties stay in (0,1)", () => {
  it.each([
    ["MORALE_ATTACK_PENALTY", MORALE_ATTACK_PENALTY],
    ["PILLAGE_RATE", PILLAGE_RATE],
    ["ORBITAL_HAZARD_DEFENSE_PENALTY", ORBITAL_HAZARD_DEFENSE_PENALTY],
  ])("%s is a fraction strictly between 0 and 1", (_name, v) => {
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });
});

describe("battle tuning — biome defense modifiers", () => {
  it("orders terrain so mountains defend best and water worst", () => {
    expect(BIOME_DEFENSE_MOD.mountain).toBeGreaterThan(BIOME_DEFENSE_MOD.plains);
    expect(BIOME_DEFENSE_MOD.plains).toBeGreaterThan(BIOME_DEFENSE_MOD.water);
  });

  it("treats plains as the neutral 1.0 baseline", () => {
    expect(BIOME_DEFENSE_MOD.plains).toBe(1.0);
  });

  it("keeps every biome modifier positive", () => {
    for (const mod of Object.values(BIOME_DEFENSE_MOD)) {
      expect(mod).toBeGreaterThan(0);
    }
  });
});

describe("battle tuning — AI faction presets", () => {
  it("defines the four canonical factions with positive modifiers", () => {
    for (const faction of ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE"]) {
      const preset = AI_FACTION_PRESETS[faction];
      expect(preset, `missing preset for ${faction}`).toBeDefined();
      expect(preset.attackModifier).toBeGreaterThan(0);
      expect(preset.defenseModifier).toBeGreaterThan(0);
    }
  });

  it("expresses faction archetypes — raider attacks hardest, defender holds hardest", () => {
    expect(AI_FACTION_PRESETS["VANGUARD"].attackModifier).toBeGreaterThan(
      AI_FACTION_PRESETS["KRONOS"].attackModifier,
    );
    expect(AI_FACTION_PRESETS["KRONOS"].defenseModifier).toBeGreaterThan(
      AI_FACTION_PRESETS["VANGUARD"].defenseModifier,
    );
  });
});
