/**
 * shared/weapon-economy.ts
 *
 * Weapon-system pricing, in the same TEST/PROD/ACTIVE shape as economy-config.ts.
 * Costs are derived from each spec's own `costFrntr` (the per-shot fire cost),
 * with multipliers for the one-time unlock, per-tier upgrades, and deploying a
 * defensive battery. Keeping this beside economy-config.ts means a single place
 * to tune the weapon economy when it goes live.
 */

import { ECONOMY_MODE } from "./economy-config";
import type { WeaponSpec } from "./weapons/types";

/** Multiplier applied to a weapon's base fire cost to get its one-time unlock cost. */
export const WEAPON_UNLOCK_COST_MULT = 6;
/** Multiplier per upgrade tier (compounds): tier N upgrade = base * mult * N. */
export const WEAPON_UPGRADE_COST_MULT = 3;
/** Multiplier to deploy a defensive battery to a parcel. */
export const DEFENSE_DEPLOY_COST_MULT = 4;

/** In testing mode all FRNTR costs are scaled down for frictionless partner testing. */
export const WEAPON_TEST_DISCOUNT = 0.25;

function scale(frntr: number): number {
  return ECONOMY_MODE === "production"
    ? Math.round(frntr)
    : Math.max(1, Math.round(frntr * WEAPON_TEST_DISCOUNT));
}

/** FRNTR to fire one shot of this weapon. */
export function fireCostFrntr(spec: WeaponSpec): number {
  return scale(spec.costFrntr);
}

/** One-time FRNTR to unlock/acquire this weapon into the player's armory. */
export function unlockCostFrntr(spec: WeaponSpec): number {
  return scale(spec.costFrntr * WEAPON_UNLOCK_COST_MULT);
}

/** FRNTR to upgrade an owned weapon to the given (1-based) tier. */
export function upgradeCostFrntr(spec: WeaponSpec, toTier: number): number {
  return scale(spec.costFrntr * WEAPON_UPGRADE_COST_MULT * Math.max(1, toTier));
}

/** FRNTR to deploy a defensive battery onto a parcel. */
export function deployCostFrntr(spec: WeaponSpec): number {
  return scale(spec.costFrntr * DEFENSE_DEPLOY_COST_MULT);
}

/**
 * The unavoidable Algorand network fee for an on-chain weapon NFT mint (Phase 2).
 * Matches the commander mint convention — tiny, covers only the network cost.
 */
export const WEAPON_NFT_ALGO_NETWORK_FEE = 0.001;
