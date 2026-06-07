import { describe, it, expect } from "vitest";
import { GAME_CONFIG, SEASON_DEFAULT_DAYS } from "./gameConfig";
import {
  LAND_PURCHASE_ALGO_ACTIVE,
  COMMANDER_MINT_FRNTR_ACTIVE,
  FACILITY_COSTS_ACTIVE,
  SPECIAL_ATTACK_COSTS_ACTIVE,
  DRONE_COST_FRNTR_ACTIVE,
  SATELLITE_COST_FRNTR_ACTIVE,
  LAND_DAILY_FRNTR_RATE,
} from "../../shared/economy-config";
import { MARKET_FEE_RATE } from "../../shared/schema";

// gameConfig is an aggregator: it must reference the authoritative constants,
// never duplicate their values. These assertions lock the no-drift / no-behavior
// -change guarantee — if anyone hardcodes a number here, this breaks.
describe("GAME_CONFIG aggregator", () => {
  it("references the live economy/pricing constants by identity", () => {
    expect(GAME_CONFIG.pricing.landByTier).toBe(LAND_PURCHASE_ALGO_ACTIVE);
    expect(GAME_CONFIG.pricing.commander.mintFrntr).toBe(COMMANDER_MINT_FRNTR_ACTIVE);
    expect(GAME_CONFIG.pricing.units.droneFrntr).toBe(DRONE_COST_FRNTR_ACTIVE);
    expect(GAME_CONFIG.pricing.units.satelliteFrntr).toBe(SATELLITE_COST_FRNTR_ACTIVE);
    expect(GAME_CONFIG.buildings.facilityCosts).toBe(FACILITY_COSTS_ACTIVE);
    expect(GAME_CONFIG.buildings.specialAttackCosts).toBe(SPECIAL_ATTACK_COSTS_ACTIVE);
    expect(GAME_CONFIG.emissions.landDailyFrntrRate).toBe(LAND_DAILY_FRNTR_RATE);
    expect(GAME_CONFIG.fees.marketFeeRate).toBe(MARKET_FEE_RATE);
  });

  it("keeps the season default at the value the storage layer mirrors (90)", () => {
    expect(SEASON_DEFAULT_DAYS).toBe(90);
    expect(GAME_CONFIG.season.defaultDays).toBe(90);
  });

  it("exposes the biome-dependent sub-parcel price function", () => {
    expect(typeof GAME_CONFIG.pricing.subParcelPrice).toBe("function");
  });
});
