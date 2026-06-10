// Centralized game-economy tunables (DORMANT SYSTEMS LUT §7 / MASTER INTEGRATION A3).
// Option A: a typed module composed from the existing canonical exports, so values
// cannot drift from the code that already enforces them. The shape is the contract —
// stable keys let a DB-backed layer (Option B, live tuning) be added additively later.
// Production rebalancing must never require a migration.
import {
  ARCHETYPE_BUILDING_CATALOG,
  MARKET_FEE_RATE,
  MAX_SAME_ARCHETYPE_PER_GRID,
  SATELLITE_YIELD_BONUS,
  SUB_PARCEL_DEFENSE_COSTS,
  SUB_PARCEL_FACILITY_COSTS,
  SUB_PARCEL_FULL_CONTROL_BONUS,
  WELCOME_BONUS_FRONTIER,
} from "@shared/schema";
import {
  COMMANDER_MINT_FRNTR_ACTIVE,
  DRONE_COST_FRNTR_ACTIVE,
  ECONOMY_MODE,
  FACILITY_COSTS_ACTIVE,
  LAND_DAILY_FRNTR_RATE,
  LAND_PURCHASE_ALGO_ACTIVE,
  SATELLITE_COST_FRNTR_ACTIVE,
  SPECIAL_ATTACK_COSTS_ACTIVE,
} from "@shared/economy-config";

export const GAME_CONFIG = {
  mode: ECONOMY_MODE,
  pricing: {
    parcelAlgoByBiome: LAND_PURCHASE_ALGO_ACTIVE,
    // Must match the purchase_price_frontier column default (server/db-schema.ts).
    subParcelBaseFrontier: 50,
    commanderTiersFrontier: COMMANDER_MINT_FRNTR_ACTIVE,
    droneFrontier: DRONE_COST_FRNTR_ACTIVE,
    satelliteFrontier: SATELLITE_COST_FRNTR_ACTIVE,
    specialAttacksFrontier: SPECIAL_ATTACK_COSTS_ACTIVE,
  },
  emissions: {
    parcelDailyFrontier: LAND_DAILY_FRNTR_RATE,
  },
  buildings: {
    facilityUpgradeFrontier: SUB_PARCEL_FACILITY_COSTS,
    facilityResourceCosts: FACILITY_COSTS_ACTIVE,
    defenseResourceCosts: SUB_PARCEL_DEFENSE_COSTS,
    archetypeCatalog: ARCHETYPE_BUILDING_CATALOG,
    maxSameArchetypePerGrid: MAX_SAME_ARCHETYPE_PER_GRID,
  },
  bonuses: {
    welcomeFrontier: WELCOME_BONUS_FRONTIER,
    satelliteYield: SATELLITE_YIELD_BONUS,
    subParcelFullControlYield: SUB_PARCEL_FULL_CONTROL_BONUS,
  },
  // No live consumer yet — reserved shape from LUT §7 for the scan system.
  scan: { baseCost: 25, baseRadius: 5, baseDuration: 3 },
  season: { defaultDays: 90 },
  fees: {
    marketFeeRate: MARKET_FEE_RATE,
  },
} as const;

export type GameConfig = typeof GAME_CONFIG;
