/**
 * server/config/gameConfig.ts — single typed entry point for game tunables.
 *
 * Per SKILL §12 ("the tunables principle") and the DORMANT LUT "variable
 * database" note: there should be ONE place to find every production-tunable
 * value, so rebalancing never requires a migration or a reset.
 *
 * This module is an AGGREGATOR, not a second source of truth. It REFERENCES the
 * existing authoritative constants (shared/economy-config, storage/game-rules,
 * shared/schema) rather than duplicating their numbers, so there is no drift and
 * no behavior change. Genuinely inline tunables that previously had no home
 * (e.g. the default season length) are defined here and referenced from their
 * call sites.
 *
 * It is intentionally a plain typed module (TypeScript-first, no DB reliance).
 * The shape is designed so it CAN later be backed by a DB live-tuning table
 * without a reset: read these stable keys, swap the source, keep the shape.
 *
 * DO NOT mirror battle balance here — server/engine/battle/tuning.ts is the pure
 * engine's canonical, untouchable source.
 */
import {
  ECONOMY_MODE,
  LAND_PURCHASE_ALGO_ACTIVE,
  COMMANDER_MINT_FRNTR_ACTIVE,
  COMMANDER_ALGO_PRICE_ACTIVE,
  COMMANDER_ALGO_NETWORK_FEE,
  FACILITY_COSTS_ACTIVE,
  SPECIAL_ATTACK_COSTS_ACTIVE,
  DRONE_COST_FRNTR_ACTIVE,
  SATELLITE_COST_FRNTR_ACTIVE,
  LAND_DAILY_FRNTR_RATE,
} from "../../shared/economy-config";
import { MARKET_FEE_RATE } from "../../shared/schema";
import { computeSubParcelPrice } from "../storage/game-rules";

/**
 * Default season length in days. Previously an inline `90` literal at the season
 * call sites. The storage default (`startSeason(name, daysLen = 90)`) mirrors
 * this value; keep them in sync if you change it.
 */
export const SEASON_DEFAULT_DAYS = 90;

export const GAME_CONFIG = {
  economyMode: ECONOMY_MODE,

  pricing: {
    /** ALGO price per land tier (standard/premium/legendary). */
    landByTier: LAND_PURCHASE_ALGO_ACTIVE,
    /** Sub-parcel purchase price is biome-dependent — call with the biome. */
    subParcelPrice: computeSubParcelPrice,
    commander: {
      mintFrntr: COMMANDER_MINT_FRNTR_ACTIVE,
      algoPrice: COMMANDER_ALGO_PRICE_ACTIVE,
      algoNetworkFee: COMMANDER_ALGO_NETWORK_FEE,
    },
    units: {
      droneFrntr: DRONE_COST_FRNTR_ACTIVE,
      satelliteFrntr: SATELLITE_COST_FRNTR_ACTIVE,
    },
  },

  /** Archetype building tree costs + special-attack costs. */
  buildings: {
    facilityCosts: FACILITY_COSTS_ACTIVE,
    specialAttackCosts: SPECIAL_ATTACK_COSTS_ACTIVE,
  },

  emissions: {
    landDailyFrntrRate: LAND_DAILY_FRNTR_RATE,
  },

  fees: {
    /** Protocol fee taken from a prediction market's winning pool. */
    marketFeeRate: MARKET_FEE_RATE,
  },

  season: {
    defaultDays: SEASON_DEFAULT_DAYS,
  },
} as const;

export type GameConfig = typeof GAME_CONFIG;
