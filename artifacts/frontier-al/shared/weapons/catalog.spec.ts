import { describe, it, expect } from "vitest";
import { MISSILES } from "./missiles";
import { ARTILLERY } from "./artillery";
import { ANTI_AIR } from "./antiAir";
import { DEFENSE_SYSTEMS } from "./defense";
import {
  ALL_WEAPONS,
  WEAPON_BY_ID,
  getWeapon,
  weaponsByCategory,
  DEFENSIVE_WEAPONS,
  OFFENSIVE_WEAPONS,
  validateCatalog,
} from "./catalog";

describe("weapon catalog", () => {
  it("ships a dozen missiles and a dozen artillery pieces", () => {
    expect(MISSILES).toHaveLength(12);
    expect(ARTILLERY).toHaveLength(12);
    expect(ANTI_AIR.length).toBeGreaterThanOrEqual(6);
    expect(DEFENSE_SYSTEMS.length).toBeGreaterThanOrEqual(6);
  });

  it("has no integrity issues", () => {
    expect(validateCatalog()).toEqual([]);
  });

  it("has unique ids and a working lookup", () => {
    const ids = new Set(ALL_WEAPONS.map((w) => w.id));
    expect(ids.size).toBe(ALL_WEAPONS.length);
    expect(getWeapon("msl_ballistic_1")?.name).toBe("Lancet TBM");
    expect(WEAPON_BY_ID["art_mlrs_4"].category).toBe("rocket_artillery");
    expect(getWeapon("does_not_exist")).toBeUndefined();
  });

  it("splits offensive vs defensive cleanly", () => {
    expect(OFFENSIVE_WEAPONS.every((w) => !w.intercept)).toBe(true);
    expect(DEFENSIVE_WEAPONS.every((w) => !!w.intercept)).toBe(true);
    expect(OFFENSIVE_WEAPONS.length + DEFENSIVE_WEAPONS.length).toBe(ALL_WEAPONS.length);
  });

  it("keeps real-world range bands: cruise out-ranges ballistic; missiles out-range guns", () => {
    const cruiseMax = Math.max(...weaponsByCategory("cruise").map((w) => w.rangeKm));
    const ballisticMax = Math.max(...weaponsByCategory("ballistic").map((w) => w.rangeKm));
    const towedMax = Math.max(...weaponsByCategory("artillery").map((w) => w.rangeKm));
    expect(cruiseMax).toBeGreaterThan(ballisticMax);
    expect(ballisticMax).toBeGreaterThan(towedMax);
    // towed howitzers stay local (grounded ~ <=70km)
    expect(towedMax).toBeLessThanOrEqual(70);
  });

  it("scales damage with tier within each missile line", () => {
    for (const prefix of ["msl_ballistic", "msl_cruise", "msl_hyper"]) {
      const line = ALL_WEAPONS
        .filter((w) => w.id.startsWith(prefix))
        .sort((a, b) => a.tier - b.tier);
      for (let i = 1; i < line.length; i++) {
        expect(line[i].damage).toBeGreaterThan(line[i - 1].damage);
      }
    }
  });
});
