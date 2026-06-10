import { describe, expect, it } from "vitest";
import {
  MARKET_FEE_RATE,
  MAX_SAME_ARCHETYPE_PER_GRID,
  WELCOME_BONUS_FRONTIER,
} from "@shared/schema";
import {
  COMMANDER_MINT_FRNTR_ACTIVE,
  LAND_DAILY_FRNTR_RATE,
  LAND_PURCHASE_ALGO_ACTIVE,
} from "@shared/economy-config";
import { GAME_CONFIG } from "../config/gameConfig";

describe("GAME_CONFIG (centralized tunables)", () => {
  it("composes the canonical constants without drift", () => {
    expect(GAME_CONFIG.bonuses.welcomeFrontier).toBe(WELCOME_BONUS_FRONTIER);
    expect(GAME_CONFIG.fees.marketFeeRate).toBe(MARKET_FEE_RATE);
    expect(GAME_CONFIG.buildings.maxSameArchetypePerGrid).toBe(MAX_SAME_ARCHETYPE_PER_GRID);
    expect(GAME_CONFIG.emissions.parcelDailyFrontier).toBe(LAND_DAILY_FRNTR_RATE);
    expect(GAME_CONFIG.pricing.parcelAlgoByBiome).toBe(LAND_PURCHASE_ALGO_ACTIVE);
    expect(GAME_CONFIG.pricing.commanderTiersFrontier).toBe(COMMANDER_MINT_FRNTR_ACTIVE);
  });

  it("pins the sub-parcel base price to the db-schema column default", () => {
    // purchase_price_frontier default lives in server/db-schema.ts; if either side
    // changes, this test forces them to move together.
    expect(GAME_CONFIG.pricing.subParcelBaseFrontier).toBe(50);
  });

  it("keeps the stable top-level shape (the Option B migration contract)", () => {
    expect(Object.keys(GAME_CONFIG).sort()).toEqual(
      ["bonuses", "buildings", "emissions", "fees", "mode", "pricing", "scan", "season"].sort(),
    );
    expect(GAME_CONFIG.scan).toEqual({ baseCost: 25, baseRadius: 5, baseDuration: 3 });
    expect(GAME_CONFIG.season.defaultDays).toBe(90);
  });
});
