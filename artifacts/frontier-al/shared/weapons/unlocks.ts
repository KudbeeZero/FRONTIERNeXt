/**
 * shared/weapons/unlocks.ts
 *
 * The single seam the game/UI calls to ask "what can this player field?". A
 * weapon is unlocked when the player's badge in the weapon's gating discipline is
 * at the required tier. Animation variants unlock at badge tiers too — the higher
 * the badge, the flashier the launch/impact you've earned (2K's animation unlocks).
 */

import type { BadgeKey, BadgeTier, WeaponSpec } from "./types";
import { ALL_WEAPONS } from "./catalog";
import { tierAtLeast, BADGE_KEYS } from "./badges";

export function isWeaponUnlocked(
  spec: WeaponSpec,
  badges: Record<BadgeKey, BadgeTier>,
): boolean {
  const have = badges[spec.unlock.badge] ?? "none";
  return tierAtLeast(have, spec.unlock.tier);
}

/** Every weapon the player has unlocked, given their badge tiers. */
export function resolveUnlockedWeapons(
  badges: Record<BadgeKey, BadgeTier>,
): WeaponSpec[] {
  return ALL_WEAPONS.filter((w) => isWeaponUnlocked(w, badges));
}

// ── Animation unlocks ─────────────────────────────────────────────────────────

export interface AnimationUnlock {
  id: string;
  name: string;
  badge: BadgeKey;
  tier: BadgeTier;
}

/**
 * Animation variants gated by badge tier. Each discipline gets progressively
 * richer launch/impact FX as its badge climbs. The render layer keys off the
 * returned ids to swap particle/impact treatments.
 */
export const ANIMATION_UNLOCKS: AnimationUnlock[] = [
  { id: "launch_smoke_plume", name: "Smoke Plume Launch", badge: "demolition", tier: "bronze" },
  { id: "impact_shockwave", name: "Shockwave Impact", badge: "demolition", tier: "gold" },
  { id: "impact_mushroom", name: "Mushroom Cloud", badge: "demolition", tier: "hall_of_fame" },
  { id: "trail_precision_tracer", name: "Precision Tracer Trail", badge: "marksman", tier: "silver" },
  { id: "trail_terrain_hug", name: "Terrain-Hug Trail", badge: "marksman", tier: "gold" },
  { id: "launch_salvo_ripple", name: "Salvo Ripple Launch", badge: "long_rifle", tier: "silver" },
  { id: "arc_extreme_apex", name: "Extreme-Apex Arc", badge: "long_rifle", tier: "gold" },
  { id: "intercept_kinetic_flash", name: "Kinetic Kill Flash", badge: "aegis", tier: "silver" },
  { id: "intercept_layered_dome", name: "Layered Dome Sweep", badge: "aegis", tier: "gold" },
  { id: "intercept_exo_burst", name: "Exo Burst", badge: "aegis", tier: "hall_of_fame" },
  { id: "reload_rapid_cycle", name: "Rapid Cycle Reload", badge: "quartermaster", tier: "gold" },
];

/** Animation variant ids unlocked by the player's current badges. */
export function resolveUnlockedAnimations(
  badges: Record<BadgeKey, BadgeTier>,
): string[] {
  return ANIMATION_UNLOCKS
    .filter((a) => tierAtLeast(badges[a.badge] ?? "none", a.tier))
    .map((a) => a.id);
}

/** Convenience: a fresh player's empty badge map. */
export function emptyBadges(): Record<BadgeKey, BadgeTier> {
  const b = {} as Record<BadgeKey, BadgeTier>;
  for (const k of BADGE_KEYS) b[k] = "none";
  return b;
}
