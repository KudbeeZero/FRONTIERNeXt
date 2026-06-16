/**
 * shared/weapons/profile.ts
 *
 * The PERSISTED player weapon profile — the "memory layer" that survives sessions
 * and grows over time (the foundation we build on every season). Stored as a
 * `weaponProfile` JSON blob on the players row (mirroring commanders[]). Also
 * defines the Zod action schemas the /api/weapons/* routes validate against,
 * following the schema.ts action-schema convention.
 */

import { z } from "zod";
import type { BadgeKey, BadgeTier } from "./types";
import type { AttributeBuild } from "./attributes";
import { ZERO_ATTRIBUTES, effectiveAttributes } from "./attributes";
import type { WeaponStats } from "./badges";
import { EMPTY_WEAPON_STATS, computeBadges } from "./badges";
import { deriveArchetype } from "./archetypes";
import { resolveUnlockedAnimations, emptyBadges } from "./unlocks";

/** A weapon instance the player owns (optionally minted as an NFT in Phase 2). */
export interface OwnedWeapon {
  /** Instance id (UUID). */
  id: string;
  /** Catalog spec id (e.g. "msl_ballistic_2"). */
  specId: string;
  /** Per-instance upgrade level (1 = as unlocked). */
  upgradeTier: number;
  /** Algorand ASA id once minted as an NFT (Phase 2). */
  nftAssetId?: number;
  acquiredAt: number;
}

export interface PlayerWeaponProfile {
  /** Derived archetype id (recomputed from attributes; persisted for display). */
  archetypeId: string | null;
  /** Raw attribute allocation (the source of truth). */
  attributes: AttributeBuild;
  /** Derived badge tiers (recomputed from attributes + stats). */
  badges: Record<BadgeKey, BadgeTier>;
  ownedWeapons: OwnedWeapon[];
  /** Equipped weapon spec ids (the active loadout / "sub-shots"). */
  loadout: string[];
  /** Animation variant ids the player has unlocked. */
  unlockedAnimations: string[];
  /** Cumulative combat stats feeding badge progression. */
  stats: WeaponStats;
  updatedAt: number;
}

/** A fresh profile for a new player. */
export function createDefaultProfile(now: number = Date.now()): PlayerWeaponProfile {
  const attributes = { ...ZERO_ATTRIBUTES };
  return recomputeDerived({
    archetypeId: null,
    attributes,
    badges: emptyBadges(),
    ownedWeapons: [],
    loadout: [],
    unlockedAnimations: [],
    stats: { ...EMPTY_WEAPON_STATS },
    updatedAt: now,
  });
}

/**
 * Recompute every derived field (archetype, badges, unlocked animations) from the
 * raw attributes + stats. Call after any change to attributes or stats so the
 * persisted derived fields stay consistent. Pure — returns a new object.
 */
export function recomputeDerived(profile: PlayerWeaponProfile): PlayerWeaponProfile {
  const eff = effectiveAttributes(profile.attributes);
  const badges = computeBadges(eff, profile.stats);
  return {
    ...profile,
    archetypeId: deriveArchetype(eff).id,
    badges,
    unlockedAnimations: resolveUnlockedAnimations(badges),
  };
}

// ── Zod action schemas (validated by server/routes.ts) ────────────────────────

export const attributeBuildSchema = z.object({
  firepower: z.number().int().min(0),
  range: z.number().int().min(0),
  guidance: z.number().int().min(0),
  interception: z.number().int().min(0),
  logistics: z.number().int().min(0),
});

export const buildWeaponProfileActionSchema = z.object({
  playerId: z.string(),
  attributes: attributeBuildSchema,
  archetypeId: z.string().nullable().optional(),
});

export const unlockWeaponActionSchema = z.object({
  playerId: z.string(),
  specId: z.string(),
});

export const setLoadoutActionSchema = z.object({
  playerId: z.string(),
  loadout: z.array(z.string()).max(8),
});

export const fireWeaponActionSchema = z.object({
  playerId: z.string(),
  specId: z.string(),
  sourceParcelId: z.string(),
  targetParcelId: z.string(),
});

export const deployDefenseActionSchema = z.object({
  playerId: z.string(),
  specId: z.string(),
  parcelId: z.string(),
});

export const upgradeWeaponActionSchema = z.object({
  playerId: z.string(),
  ownedWeaponId: z.string(),
});

export const mintWeaponNftActionSchema = z.object({
  playerId: z.string(),
  ownedWeaponId: z.string(),
  receiverAddress: z.string().min(1),
});

/** Max per-instance upgrade level a weapon can reach. */
export const MAX_WEAPON_UPGRADE_TIER = 5;

export type BuildWeaponProfileAction = z.infer<typeof buildWeaponProfileActionSchema>;
export type UnlockWeaponAction = z.infer<typeof unlockWeaponActionSchema>;
export type SetLoadoutAction = z.infer<typeof setLoadoutActionSchema>;
export type FireWeaponAction = z.infer<typeof fireWeaponActionSchema>;
export type DeployDefenseAction = z.infer<typeof deployDefenseActionSchema>;
export type UpgradeWeaponAction = z.infer<typeof upgradeWeaponActionSchema>;
export type MintWeaponNftAction = z.infer<typeof mintWeaponNftActionSchema>;
