/**
 * shared/weapons/attributes.ts
 *
 * The NBA-2K-style attribute build: a fixed point budget spread across five
 * attributes, with a TRADEOFF CURVE so that over-investing in one attribute past
 * a soft cap drags down a tensioned attribute — "if you do a little too much in
 * this area it knocks another down one." This is what makes builds specialize.
 *
 * Pure functions only. The persisted profile stores the RAW point allocation;
 * `effectiveAttributes` derives the in-play values after tradeoff penalties.
 */

import type { AttributeKey } from "./types";

export const ATTRIBUTE_KEYS: AttributeKey[] = [
  "firepower",
  "range",
  "guidance",
  "interception",
  "logistics",
];

export interface AttributeBuild {
  firepower: number;
  range: number;
  guidance: number;
  interception: number;
  logistics: number;
}

/** Total points a player may distribute across all attributes. */
export const ATTRIBUTE_BUDGET = 60;
/** Hard ceiling for any single attribute. */
export const ATTRIBUTE_MAX = 20;
/** Investing beyond this in an attribute starts taxing its tensioned partner. */
export const ATTRIBUTE_SOFT_CAP = 14;
/** Each point above the soft cap costs this much of the tensioned attribute. */
export const TRADEOFF_RATE = 0.5;

/**
 * Tension pairs. Pushing one past the soft cap penalizes the other's effective
 * value (symmetric within a pair). Mirrors 2K's "too much here knocks that down":
 *   • firepower ⟷ logistics  (heavy hitters reload slower)
 *   • range     ⟷ guidance   (reaching far costs precision)
 *   • interception ⟷ firepower (a defensive build sacrifices raw offense)
 */
export const TENSION_PAIRS: [AttributeKey, AttributeKey][] = [
  ["firepower", "logistics"],
  ["range", "guidance"],
  ["interception", "firepower"],
];

export const ZERO_ATTRIBUTES: AttributeBuild = {
  firepower: 0,
  range: 0,
  guidance: 0,
  interception: 0,
  logistics: 0,
};

export function totalSpent(b: AttributeBuild): number {
  return ATTRIBUTE_KEYS.reduce((sum, k) => sum + b[k], 0);
}

export interface BuildValidation {
  ok: boolean;
  error?: string;
}

/** Validate a raw allocation against the budget and per-attribute bounds. */
export function validateBuild(b: AttributeBuild): BuildValidation {
  for (const k of ATTRIBUTE_KEYS) {
    const v = b[k];
    if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
      return { ok: false, error: `${k} must be a non-negative integer` };
    }
    if (v > ATTRIBUTE_MAX) {
      return { ok: false, error: `${k} exceeds max of ${ATTRIBUTE_MAX}` };
    }
  }
  const spent = totalSpent(b);
  if (spent > ATTRIBUTE_BUDGET) {
    return { ok: false, error: `budget exceeded: ${spent}/${ATTRIBUTE_BUDGET}` };
  }
  return { ok: true };
}

/**
 * Apply the tradeoff curve. For each tension pair, the amount one attribute sits
 * above the soft cap reduces the OTHER's effective value (and vice versa).
 * Effective values are clamped to >= 0. The raw build is never mutated.
 */
export function effectiveAttributes(raw: AttributeBuild): AttributeBuild {
  const eff: AttributeBuild = { ...raw };

  const penalty = (driver: number) =>
    driver > ATTRIBUTE_SOFT_CAP ? (driver - ATTRIBUTE_SOFT_CAP) * TRADEOFF_RATE : 0;

  for (const [a, b] of TENSION_PAIRS) {
    eff[b] -= penalty(raw[a]);
    eff[a] -= penalty(raw[b]);
  }

  for (const k of ATTRIBUTE_KEYS) {
    eff[k] = Math.max(0, Math.round(eff[k] * 100) / 100);
  }
  return eff;
}

/** Points left to spend. */
export function remainingPoints(b: AttributeBuild): number {
  return ATTRIBUTE_BUDGET - totalSpent(b);
}
