/**
 * shared/economy-config.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FRONTIER-AL — Central Economy Configuration
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Single source of truth for all gameplay pricing and testing/production
 * economy values.
 *
 * ⚠ TESTING PHASE:
 *   All TEST values are intentionally low to allow partners to test core loops
 *   without wallet friction. Set ECONOMY_MODE=production to switch to live rates.
 *
 * Currency used per action:
 *   ALGO — unavoidable network transaction fees only (land purchase NFT mint).
 *          In testing mode, land prices are reduced to minimum viable amounts.
 *   ASCEND — primary in-game currency for all gameplay purchases.
 */

// ─── Economy Mode ─────────────────────────────────────────────────────────────

/**
 * Active economy mode.
 * - Server: reads process.env.ECONOMY_MODE ("production" | anything else → "testing")
 * - Client: always "testing" (safe fallback; mode display comes from API response)
 */
export const ECONOMY_MODE: "testing" | "production" =
  typeof process !== "undefined" && process?.env?.ECONOMY_MODE === "production"
    ? "production"
    : "testing";

// ─── Land Emission Rates (ASCEND / day per parcel) ────────────────────────────

/** Base ASCEND/day per owned parcel during testing phase. */
export const LAND_DAILY_ASCEND_RATE_TEST = 50;

/** Base ASCEND/day per owned parcel for live production. */
export const LAND_DAILY_ASCEND_RATE_PROD = 1;

/**
 * Currently active base emission rate.
 * Resolves to LAND_DAILY_ASCEND_RATE_TEST unless ECONOMY_MODE=production.
 */
export const LAND_DAILY_ASCEND_RATE: number =
  ECONOMY_MODE === "production" ? LAND_DAILY_ASCEND_RATE_PROD : LAND_DAILY_ASCEND_RATE_TEST;

// ─── Land Purchase Prices (ALGO) ─────────────────────────────────────────────
// ALGO is required for on-chain plot NFT minting — this is an unavoidable
// network cost. Testing prices are set to the absolute minimum viable amount.

/** Biome land purchase prices in ALGO — TESTING MODE (minimum viable). */
export const LAND_PURCHASE_ALGO_TEST: Record<string, number> = {
  forest:   0.1,
  plains:   0.1,
  mountain: 0.1,
  desert:   0.1,
  water:    0.1,
  tundra:   0.1,
  volcanic: 0.1,
  swamp:    0.1,
};

/** Biome land purchase prices in ALGO — PRODUCTION MODE. */
export const LAND_PURCHASE_ALGO_PROD: Record<string, number> = {
  forest:   0.5,
  plains:   0.3,
  mountain: 0.8,
  desert:   0.2,
  water:    1.5,
  tundra:   0.4,
  volcanic: 1.0,
  swamp:    0.3,
};

/** Active land purchase prices in ALGO. */
export const LAND_PURCHASE_ALGO_ACTIVE: Record<string, number> =
  ECONOMY_MODE === "production" ? LAND_PURCHASE_ALGO_PROD : LAND_PURCHASE_ALGO_TEST;

// ─── Commander Mint Prices ────────────────────────────────────────────────────
// Primary currency: ASCEND (in-game). No ALGO game-level charge for commanders.
// The minimal Algorand network fee (~0.001 ALGO) is the only on-chain cost
// and is handled automatically by the wallet; it is NOT a game-level charge.

/** Commander mint cost in ASCEND — TESTING MODE (affordable for partner testing). */
export const COMMANDER_MINT_ASCEND_TEST: Record<string, number> = {
  sentinel: 10,
  phantom:  25,
  reaper:   50,
};

/** Commander mint cost in ASCEND — PRODUCTION MODE. */
export const COMMANDER_MINT_ASCEND_PROD: Record<string, number> = {
  sentinel: 50,
  phantom:  150,
  reaper:   400,
};

/** Active commander mint cost in ASCEND. */
export const COMMANDER_MINT_ASCEND_ACTIVE: Record<string, number> =
  ECONOMY_MODE === "production" ? COMMANDER_MINT_ASCEND_PROD : COMMANDER_MINT_ASCEND_TEST;

/**
 * Commander ALGO network fee (unavoidable — covers NFT mint transaction fee).
 * This is intentionally tiny and covers only the Algorand network cost.
 * It is NOT a game-level price. Currency label: ALGO.
 */
export const COMMANDER_ALGO_NETWORK_FEE = 0.001;

/**
 * Commander ALGO game-level purchase price.
 * Charged to the player on top of the network fee above.
 * Testing: flat 0.5 ALGO. Production: tiered by rarity.
 */
export const COMMANDER_ALGO_PRICE_TEST: Record<string, number> = {
  sentinel: 0.5,
  phantom:  0.5,
  reaper:   0.5,
};

export const COMMANDER_ALGO_PRICE_PROD: Record<string, number> = {
  sentinel: 1.0,
  phantom:  2.0,
  reaper:   5.0,
};

export const COMMANDER_ALGO_PRICE_ACTIVE: Record<string, number> =
  ECONOMY_MODE === "production" ? COMMANDER_ALGO_PRICE_PROD : COMMANDER_ALGO_PRICE_TEST;

// ─── Facility Build Costs (ASCEND) ─────────────────────────────────────────────

export interface FacilityCostConfig {
  ascend: number;
}

/** Facility costs in ASCEND — TESTING MODE. */
export const FACILITY_COSTS_TEST: Record<string, FacilityCostConfig> = {
  electricity:       { ascend: 5 },
  blockchain_node_1: { ascend: 15 },
  blockchain_node_2: { ascend: 30 },
  blockchain_node_3: { ascend: 50 },
  data_centre_1:     { ascend: 15 },
  data_centre_2:     { ascend: 30 },
  data_centre_3:     { ascend: 50 },
  ai_lab_1:          { ascend: 15 },
  ai_lab_2:          { ascend: 30 },
  ai_lab_3:          { ascend: 50 },
};

/** Facility costs in ASCEND — PRODUCTION MODE (matches schema.ts). */
export const FACILITY_COSTS_PROD: Record<string, FacilityCostConfig> = {
  electricity:       { ascend: 30 },
  blockchain_node_1: { ascend: 120 },
  blockchain_node_2: { ascend: 270 },
  blockchain_node_3: { ascend: 480 },
  data_centre_1:     { ascend: 120 },
  data_centre_2:     { ascend: 270 },
  data_centre_3:     { ascend: 480 },
  ai_lab_1:          { ascend: 120 },
  ai_lab_2:          { ascend: 270 },
  ai_lab_3:          { ascend: 480 },
};

/** Active facility costs. */
export const FACILITY_COSTS_ACTIVE: Record<string, FacilityCostConfig> =
  ECONOMY_MODE === "production" ? FACILITY_COSTS_PROD : FACILITY_COSTS_TEST;

// ─── Special Attack Costs (ASCEND) ─────────────────────────────────────────────

/** Special attack costs in ASCEND — TESTING MODE. */
export const SPECIAL_ATTACK_COSTS_TEST: Record<string, number> = {
  orbital_strike: 5,
  emp_blast:      3,
  siege_barrage:  8,
  sabotage:       2,
};

/** Special attack costs in ASCEND — PRODUCTION MODE (matches schema.ts). */
export const SPECIAL_ATTACK_COSTS_PROD: Record<string, number> = {
  orbital_strike: 25,
  emp_blast:      15,
  siege_barrage:  40,
  sabotage:       10,
};

/** Active special attack costs in ASCEND. */
export const SPECIAL_ATTACK_COSTS_ACTIVE: Record<string, number> =
  ECONOMY_MODE === "production" ? SPECIAL_ATTACK_COSTS_PROD : SPECIAL_ATTACK_COSTS_TEST;

// ─── Drone & Satellite Costs (ASCEND) ─────────────────────────────────────────

export const DRONE_COST_ASCEND_TEST = 2;
export const DRONE_COST_ASCEND_PROD = 20;
export const DRONE_COST_ASCEND_ACTIVE =
  ECONOMY_MODE === "production" ? DRONE_COST_ASCEND_PROD : DRONE_COST_ASCEND_TEST;

export const SATELLITE_COST_ASCEND_TEST = 5;
export const SATELLITE_COST_ASCEND_PROD = 50;
export const SATELLITE_COST_ASCEND_ACTIVE =
  ECONOMY_MODE === "production" ? SATELLITE_COST_ASCEND_PROD : SATELLITE_COST_ASCEND_TEST;

// ─── Emission Safety Checks ───────────────────────────────────────────────────

/**
 * Parcel counts used for projected emission safety checks.
 * Used by the admin safety log and the economics API endpoint.
 */
export const EMISSION_CHECK_PARCEL_COUNTS = [1, 10, 100, 250] as const;

/**
 * Returns projected daily ASCEND emissions for a given parcel count.
 * Uses base rate only — does not include per-parcel facility bonuses.
 */
export function projectedDailyEmissions(parcelCount: number): number {
  return parcelCount * LAND_DAILY_ASCEND_RATE;
}

// ─── Testing Economy Summary ──────────────────────────────────────────────────

/**
 * Human-readable summary of active testing economy config.
 * Used by admin/economics endpoints and UI display.
 */
export const TESTING_ECONOMY_SUMMARY = {
  mode: ECONOMY_MODE,
  landEmissionRatePerDay: LAND_DAILY_ASCEND_RATE,
  landPurchaseAlgo: LAND_PURCHASE_ALGO_ACTIVE,
  commanderMintAscend: COMMANDER_MINT_ASCEND_ACTIVE,
  commanderAlgoNetworkFeeOnly: COMMANDER_ALGO_NETWORK_FEE,
  primaryCurrency: "ASCEND",
  unavoidableAlgoCost: "network fee only (~0.001 ALGO per transaction)",
  note: ECONOMY_MODE === "testing"
    ? "TESTING MODE: All prices reduced for partner testing. ASCEND is the primary gameplay currency."
    : "PRODUCTION MODE: Live tokenomics active.",
} as const;
