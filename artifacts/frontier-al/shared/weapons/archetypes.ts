/**
 * shared/weapons/archetypes.ts
 *
 * Named builds derived from a player's effective attribute spread — the FRONTIER
 * analog of 2K's Sharpshooter / Lockdown / Glass-Cleaner archetypes. The archetype
 * you trend toward is "the armory you pick": it favors certain weapon categories
 * (your available sub-shots) and is purely a function of where your points land,
 * so hybrids emerge naturally (e.g. firepower+guidance → Hypersonic Striker).
 */

import type { AttributeKey, WeaponCategory } from "./types";
import type { AttributeBuild } from "./attributes";
import { ATTRIBUTE_KEYS } from "./attributes";

export interface Archetype {
  id: string;
  name: string;
  description: string;
  /** The two attributes that define this build. */
  primary: AttributeKey;
  secondary: AttributeKey;
  /** Weapon categories this archetype is built around. */
  favoredCategories: WeaponCategory[];
}

export const ARCHETYPES: Record<string, Archetype> = {
  siege_baron: {
    id: "siege_baron", name: "Siege Baron",
    description: "Overwhelming firepower backed by reach — the bombardment specialist.",
    primary: "firepower", secondary: "range",
    favoredCategories: ["ballistic", "rocket_artillery", "artillery"],
  },
  artillery_marshal: {
    id: "artillery_marshal", name: "Artillery Marshal",
    description: "Sustained long-range fires; out-ranges and out-volumes the enemy.",
    primary: "range", secondary: "logistics",
    favoredCategories: ["rocket_artillery", "artillery"],
  },
  hypersonic_striker: {
    id: "hypersonic_striker", name: "Hypersonic Striker",
    description: "Fast, precise, near-uninterceptable first strikes.",
    primary: "firepower", secondary: "guidance",
    favoredCategories: ["hypersonic", "ballistic"],
  },
  ghost_marksman: {
    id: "ghost_marksman", name: "Ghost Marksman",
    description: "Surgical long-range cruise strikes that slip under radar.",
    primary: "guidance", secondary: "range",
    favoredCategories: ["cruise", "ballistic"],
  },
  aegis_interceptor: {
    id: "aegis_interceptor", name: "Aegis Interceptor",
    description: "A layered shield — detects and kills incoming fire.",
    primary: "interception", secondary: "guidance",
    favoredCategories: ["missile_defense", "anti_air"],
  },
};

export const DEFAULT_ARCHETYPE = ARCHETYPES.siege_baron;

/**
 * Rank an effective attribute build's keys high→low (stable on ties by the fixed
 * ATTRIBUTE_KEYS order) and return [primary, secondary].
 */
export function topTwoAttributes(eff: AttributeBuild): [AttributeKey, AttributeKey] {
  const ranked = [...ATTRIBUTE_KEYS].sort((a, b) => eff[b] - eff[a]);
  return [ranked[0], ranked[1]];
}

/**
 * Derive the archetype whose (primary, secondary) best matches the build's top
 * two effective attributes. Scores each archetype: +2 if its primary is the
 * build's top attribute, +1 if its secondary is in the build's top two.
 * Falls back to DEFAULT_ARCHETYPE when everything is zero.
 */
export function deriveArchetype(eff: AttributeBuild): Archetype {
  const total = ATTRIBUTE_KEYS.reduce((s, k) => s + eff[k], 0);
  if (total <= 0) return DEFAULT_ARCHETYPE;

  const [top, second] = topTwoAttributes(eff);
  let best = DEFAULT_ARCHETYPE;
  let bestScore = -1;

  for (const arch of Object.values(ARCHETYPES)) {
    let score = 0;
    if (arch.primary === top) score += 2;
    if (arch.secondary === top || arch.secondary === second) score += 1;
    if (arch.primary === second) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = arch;
    }
  }
  return best;
}
