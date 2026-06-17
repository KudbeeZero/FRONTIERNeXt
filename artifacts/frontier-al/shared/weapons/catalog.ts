/**
 * shared/weapons/catalog.ts
 *
 * The unified weapon registry + lookups. Mirrors the `Record<Type, Info>` access
 * style of COMMANDER_INFO / SPECIAL_ATTACK_INFO in shared/schema.ts, but as a
 * flat registry keyed by spec id (weapons span several categories).
 */

import type { WeaponCategory, WeaponSpec } from "./types";
import { isDefenseSpec } from "./types";
import { MISSILES } from "./missiles";
import { ARTILLERY } from "./artillery";
import { LOITERING } from "./loitering";
import { ANTI_AIR } from "./antiAir";
import { DEFENSE_SYSTEMS } from "./defense";

/** Every weapon in the game, across all categories. */
export const ALL_WEAPONS: WeaponSpec[] = [
  ...MISSILES,
  ...ARTILLERY,
  ...LOITERING,
  ...ANTI_AIR,
  ...DEFENSE_SYSTEMS,
];

/** id → spec lookup map. */
export const WEAPON_BY_ID: Record<string, WeaponSpec> = Object.fromEntries(
  ALL_WEAPONS.map((w) => [w.id, w]),
);

export function getWeapon(id: string): WeaponSpec | undefined {
  return WEAPON_BY_ID[id];
}

export function weaponsByCategory(category: WeaponCategory): WeaponSpec[] {
  return ALL_WEAPONS.filter((w) => w.category === category);
}

/** All weapons that can intercept incoming fire (carry an envelope). */
export const DEFENSIVE_WEAPONS: WeaponSpec[] = ALL_WEAPONS.filter(isDefenseSpec);

/** All weapons the player launches at a target. */
export const OFFENSIVE_WEAPONS: WeaponSpec[] = ALL_WEAPONS.filter((w) => !isDefenseSpec(w));

// ── Integrity invariants (asserted in catalog.spec.ts; also usable at runtime) ─

export interface CatalogIssue {
  weaponId: string;
  problem: string;
}

/**
 * Validate the catalog's internal consistency. Returns [] when the catalog is
 * well-formed. Used by the unit test and as a defensive runtime check.
 */
export function validateCatalog(): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const seen = new Set<string>();

  for (const w of ALL_WEAPONS) {
    if (seen.has(w.id)) issues.push({ weaponId: w.id, problem: "duplicate id" });
    seen.add(w.id);

    if (w.rangeKm <= 0) issues.push({ weaponId: w.id, problem: "rangeKm must be positive" });
    if (w.speedMps <= 0) issues.push({ weaponId: w.id, problem: "speedMps must be positive" });
    if (w.damage <= 0) issues.push({ weaponId: w.id, problem: "damage must be positive" });
    if (w.costAscend <= 0) issues.push({ weaponId: w.id, problem: "costAscend must be positive" });
    if (w.cooldownMs <= 0) issues.push({ weaponId: w.id, problem: "cooldownMs must be positive" });

    const defensive = w.category === "anti_air" || w.category === "missile_defense";
    if (defensive && !w.intercept) {
      issues.push({ weaponId: w.id, problem: "defensive weapon missing intercept envelope" });
    }
    if (!defensive && w.intercept) {
      issues.push({ weaponId: w.id, problem: "offensive weapon must not carry intercept envelope" });
    }
    if (w.intercept) {
      if (w.intercept.basePk < 0 || w.intercept.basePk > 1) {
        issues.push({ weaponId: w.id, problem: "intercept.basePk must be within [0,1]" });
      }
      if (w.intercept.magazine <= 0) {
        issues.push({ weaponId: w.id, problem: "intercept.magazine must be positive" });
      }
    }
  }
  return issues;
}
