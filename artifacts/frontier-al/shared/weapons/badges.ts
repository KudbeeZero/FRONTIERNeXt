/**
 * shared/weapons/badges.ts
 *
 * The badge system — 2K's Bronze / Silver / Gold / Hall-of-Fame tiers applied to
 * five weapon disciplines. A badge's tier is earned from BOTH the player's
 * effective attribute in that discipline AND their accumulated combat stats, so
 * badges climb as you build AND as you actually use the system. Badge tiers gate
 * weapon unlocks (see unlocks.ts) and unlock animation variants.
 */

import type { AttributeKey, BadgeKey, BadgeTier } from "./types";
import type { AttributeBuild } from "./attributes";

/** Cumulative combat statistics that feed badge progression (persisted). */
export interface WeaponStats {
  shotsFired: number;
  kills: number;
  intercepts: number;
  /** Hits inside a tight CEP (precision discipline). */
  precisionHits: number;
  /** Hits delivered beyond a long-range threshold. */
  longRangeHits: number;
}

export const EMPTY_WEAPON_STATS: WeaponStats = {
  shotsFired: 0,
  kills: 0,
  intercepts: 0,
  precisionHits: 0,
  longRangeHits: 0,
};

export const BADGE_KEYS: BadgeKey[] = [
  "demolition",
  "marksman",
  "long_rifle",
  "aegis",
  "quartermaster",
];

export const BADGE_TIER_ORDER: BadgeTier[] = [
  "none",
  "bronze",
  "silver",
  "gold",
  "hall_of_fame",
];

export interface BadgeDef {
  key: BadgeKey;
  name: string;
  description: string;
  /** Effective attribute that drives this badge. */
  attribute: AttributeKey;
  /** Combat stat that drives this badge. */
  stat: keyof WeaponStats;
}

export const BADGE_DEFS: Record<BadgeKey, BadgeDef> = {
  demolition: {
    key: "demolition", name: "Demolition",
    description: "Raw destructive output — earned by dealing damage and scoring kills.",
    attribute: "firepower", stat: "kills",
  },
  marksman: {
    key: "marksman", name: "Marksman",
    description: "Pinpoint accuracy — earned through precision hits.",
    attribute: "guidance", stat: "precisionHits",
  },
  long_rifle: {
    key: "long_rifle", name: "Long Rifle",
    description: "Reach — earned by landing hits at extreme range.",
    attribute: "range", stat: "longRangeHits",
  },
  aegis: {
    key: "aegis", name: "Aegis",
    description: "The shield — earned by intercepting incoming fire.",
    attribute: "interception", stat: "intercepts",
  },
  quartermaster: {
    key: "quartermaster", name: "Quartermaster",
    description: "Throughput — earned by sustaining volume of fire.",
    attribute: "logistics", stat: "shotsFired",
  },
};

/** Minimum composite score required to reach each tier. */
export const BADGE_TIER_THRESHOLDS: Record<BadgeTier, number> = {
  none: 0,
  bronze: 12,
  silver: 35,
  gold: 65,
  hall_of_fame: 110,
};

/** How much each effective attribute point contributes to a badge score. */
export const BADGE_ATTRIBUTE_WEIGHT = 3;

/** Composite badge score from an effective attribute value + a stat value. */
export function badgeScore(attributeValue: number, statValue: number): number {
  return attributeValue * BADGE_ATTRIBUTE_WEIGHT + statValue;
}

/** Highest tier whose threshold the score meets. */
export function badgeTierForScore(score: number): BadgeTier {
  let result: BadgeTier = "none";
  for (const tier of BADGE_TIER_ORDER) {
    if (score >= BADGE_TIER_THRESHOLDS[tier]) result = tier;
  }
  return result;
}

export function tierIndex(tier: BadgeTier): number {
  return BADGE_TIER_ORDER.indexOf(tier);
}

/** True when `tier` is at least `required`. */
export function tierAtLeast(tier: BadgeTier, required: BadgeTier): boolean {
  return tierIndex(tier) >= tierIndex(required);
}

/** Compute every badge's tier from the effective build + accumulated stats. */
export function computeBadges(
  eff: AttributeBuild,
  stats: WeaponStats,
): Record<BadgeKey, BadgeTier> {
  const result = {} as Record<BadgeKey, BadgeTier>;
  for (const key of BADGE_KEYS) {
    const def = BADGE_DEFS[key];
    const score = badgeScore(eff[def.attribute], stats[def.stat]);
    result[key] = badgeTierForScore(score);
  }
  return result;
}
