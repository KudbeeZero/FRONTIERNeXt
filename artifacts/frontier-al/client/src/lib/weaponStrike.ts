/**
 * client/src/lib/weaponStrike.ts
 *
 * Pure targeting logic for the offensive "Weapon Strike" action. Given the
 * player's weapon catalog, the parcels they own, and a target, it works out
 * which owned OFFENSIVE weapons can actually fire — picking the nearest owned
 * parcel to fire from (the one most likely to be in range) — and, when a weapon
 * can't fire, why. No React, no network: trivially unit-testable, and the single
 * source of truth the StrikePanel renders from.
 *
 * Range/geometry come from the shared sim (`greatCircleKm`, `isDefenseSpec`) so
 * the client never disagrees with the server's own range check in `fireWeapon`.
 */
import type { WeaponSpec } from "@shared/weapons";
import { isDefenseSpec, greatCircleKm } from "@shared/weapons";

export interface Geo {
  lat: number;
  lng: number;
}

/** Minimal parcel shape the targeting math needs (a subset of LandParcel). */
export interface SourceParcel {
  id: string;
  plotId: number;
  lat: number;
  lng: number;
}

/** Minimal catalog-entry shape (a subset of the /api/weapons/catalog response). */
export interface CatalogEntryLike {
  spec: WeaponSpec;
  owned: boolean;
  fireCost: number;
}

export interface StrikeOption {
  spec: WeaponSpec;
  fireCost: number;
  /** Best owned parcel to fire from (nearest to target), or null if none usable. */
  source: SourceParcel | null;
  /** Great-circle distance from the nearest owned parcel to the target, km. */
  distanceKm: number | null;
  /** True when an owned parcel lies within the weapon's range. */
  canFire: boolean;
  /** Why it can't fire (null when it can). */
  reason: string | null;
}

/**
 * Whether the player owns at least one offensive weapon at all — used to
 * distinguish "you own nothing to strike with" from "you own offensive
 * weapons but none are in your loadout" in the empty-state UI, since
 * `eligibleStrikes` alone can't tell those two cases apart once a loadout
 * filter empties the result.
 */
export function hasOwnedOffensiveWeapons(entries: CatalogEntryLike[]): boolean {
  return entries.some((e) => e.owned && !isDefenseSpec(e.spec));
}

/** Nearest owned parcel to the target, with its great-circle distance. */
function nearestSource(
  parcels: SourceParcel[],
  target: Geo,
): { source: SourceParcel; distanceKm: number } | null {
  let best: { source: SourceParcel; distanceKm: number } | null = null;
  for (const p of parcels) {
    const distanceKm = greatCircleKm({ lat: p.lat, lng: p.lng }, target);
    if (!best || distanceKm < best.distanceKm) best = { source: p, distanceKm };
  }
  return best;
}

/**
 * The fireable/unfireable status of every owned OFFENSIVE weapon against
 * `target`, fired from the nearest owned parcel. Defensive weapons (which are
 * deployed, not fired) and unowned catalog entries are excluded entirely.
 *
 * `loadout` mirrors the server's own gate in `fireWeapon` (server/weapons/
 * service.ts): an EMPTY loadout means "no restriction yet" (every profile
 * defaults to `loadout: []`, so a player who has never opened the equip UI
 * can still fire any owned weapon, unchanged from before loadout existed).
 * Once at least one weapon is equipped, only equipped specs are eligible —
 * so the UI never offers a strike the server would then reject.
 */
export function eligibleStrikes(
  entries: CatalogEntryLike[],
  ownedParcels: SourceParcel[],
  target: Geo,
  loadout: string[] = [],
): StrikeOption[] {
  const offensiveOwned = entries.filter(
    (e) => e.owned && !isDefenseSpec(e.spec) && (loadout.length === 0 || loadout.includes(e.spec.id)),
  );
  const near = nearestSource(ownedParcels, target);

  return offensiveOwned.map((e): StrikeOption => {
    if (!near) {
      return {
        spec: e.spec,
        fireCost: e.fireCost,
        source: null,
        distanceKm: null,
        canFire: false,
        reason: "You hold no territory to fire from.",
      };
    }
    const canFire = near.distanceKm <= e.spec.rangeKm;
    return {
      spec: e.spec,
      fireCost: e.fireCost,
      source: canFire ? near.source : null,
      distanceKm: near.distanceKm,
      canFire,
      reason: canFire
        ? null
        : `Out of range — ${Math.round(near.distanceKm)}km > ${e.spec.rangeKm}km reach.`,
    };
  });
}
