/**
 * server/weapons/service.ts
 *
 * Orchestration for the /api/weapons/* routes. Pure of Express — takes an IStorage
 * and an EngagementStore so it is unit-testable against MemStorage. Bridges the
 * three pieces: persisted profile (storage), FRNTR economy (storage.spendFrontier
 * + weapon-economy costs), and runtime combat (engagementStore + shared sim).
 */

import { randomUUID } from "crypto";
import type { IStorage } from "../storage/interface";
import type { EngagementStore, Engagement, DefenseBattery } from "./engagementStore";
import {
  getWeapon,
  isDefenseSpec,
  isWeaponUnlocked,
  resolveUnlockedWeapons,
  validateBuild,
  inRange,
  greatCircleKm,
  ALL_WEAPONS,
  MAX_WEAPON_UPGRADE_TIER,
  type AttributeBuild,
  type OwnedWeapon,
  type PlayerWeaponProfile,
  type WeaponSpec,
} from "@shared/weapons";
import {
  fireCostFrntr,
  unlockCostFrntr,
  deployCostFrntr,
  upgradeCostFrntr,
} from "@shared/weapon-economy";

async function parcelGeo(storage: IStorage, parcelId: string) {
  const parcel = await storage.getParcel(parcelId);
  if (!parcel) throw new Error("Parcel not found");
  return { parcel, geo: { lat: parcel.lat, lng: parcel.lng } };
}

// ── Build / catalog / loadout ─────────────────────────────────────────────────

export async function buildProfile(
  storage: IStorage,
  playerId: string,
  attributes: AttributeBuild,
): Promise<PlayerWeaponProfile> {
  const valid = validateBuild(attributes);
  if (!valid.ok) throw new Error(valid.error ?? "Invalid attribute build");
  return storage.updateWeaponProfile(playerId, { attributes });
}

export interface CatalogEntry {
  spec: WeaponSpec;
  unlocked: boolean;
  owned: boolean;
  fireCost: number;
  unlockCost: number;
}

export async function getCatalog(storage: IStorage, playerId: string): Promise<{
  profile: PlayerWeaponProfile;
  entries: CatalogEntry[];
}> {
  const profile = await storage.getWeaponProfile(playerId);
  const ownedIds = new Set(profile.ownedWeapons.map((w) => w.specId));
  const entries: CatalogEntry[] = ALL_WEAPONS.map((spec) => ({
    spec,
    unlocked: isWeaponUnlocked(spec, profile.badges),
    owned: ownedIds.has(spec.id),
    fireCost: fireCostFrntr(spec),
    unlockCost: unlockCostFrntr(spec),
  }));
  return { profile, entries };
}

export async function unlockWeapon(
  storage: IStorage,
  playerId: string,
  specId: string,
): Promise<PlayerWeaponProfile> {
  const spec = getWeapon(specId);
  if (!spec) throw new Error("Unknown weapon");
  const profile = await storage.getWeaponProfile(playerId);
  if (!isWeaponUnlocked(spec, profile.badges)) {
    throw new Error(`${spec.name} is locked — earn the ${spec.unlock.badge} badge (${spec.unlock.tier}).`);
  }
  if (profile.ownedWeapons.some((w) => w.specId === specId)) {
    throw new Error(`${spec.name} is already in your armory.`);
  }
  await storage.spendFrontier(playerId, unlockCostFrntr(spec));
  const owned: OwnedWeapon = {
    id: randomUUID(),
    specId,
    upgradeTier: 1,
    acquiredAt: Date.now(),
  };
  return storage.updateWeaponProfile(playerId, {
    ownedWeapons: [...profile.ownedWeapons, owned],
  });
}

export async function setLoadout(
  storage: IStorage,
  playerId: string,
  loadout: string[],
): Promise<PlayerWeaponProfile> {
  const profile = await storage.getWeaponProfile(playerId);
  const ownedIds = new Set(profile.ownedWeapons.map((w) => w.specId));
  for (const id of loadout) {
    if (!ownedIds.has(id)) throw new Error(`Cannot equip ${id} — not in your armory.`);
  }
  return storage.updateWeaponProfile(playerId, { loadout });
}

export async function upgradeWeapon(
  storage: IStorage,
  playerId: string,
  ownedWeaponId: string,
): Promise<PlayerWeaponProfile> {
  const profile = await storage.getWeaponProfile(playerId);
  const owned = profile.ownedWeapons.find((w) => w.id === ownedWeaponId);
  if (!owned) throw new Error("That weapon is not in your armory.");
  const spec = getWeapon(owned.specId);
  if (!spec) throw new Error("Unknown weapon");
  if (owned.upgradeTier >= MAX_WEAPON_UPGRADE_TIER) {
    throw new Error(`${spec.name} is already at max upgrade tier (${MAX_WEAPON_UPGRADE_TIER}).`);
  }
  const nextTier = owned.upgradeTier + 1;
  await storage.spendFrontier(playerId, upgradeCostFrntr(spec, nextTier));
  const ownedWeapons = profile.ownedWeapons.map((w) =>
    w.id === ownedWeaponId ? { ...w, upgradeTier: nextTier } : w,
  );
  return storage.updateWeaponProfile(playerId, { ownedWeapons });
}

/** Record a minted NFT's asset id against an owned weapon instance. */
export async function recordWeaponNft(
  storage: IStorage,
  playerId: string,
  ownedWeaponId: string,
  nftAssetId: number,
): Promise<PlayerWeaponProfile> {
  const profile = await storage.getWeaponProfile(playerId);
  const owned = profile.ownedWeapons.find((w) => w.id === ownedWeaponId);
  if (!owned) throw new Error("That weapon is not in your armory.");
  const ownedWeapons = profile.ownedWeapons.map((w) =>
    w.id === ownedWeaponId ? { ...w, nftAssetId } : w,
  );
  return storage.updateWeaponProfile(playerId, { ownedWeapons });
}

// ── Fire / deploy (runtime) ───────────────────────────────────────────────────

export async function fireWeapon(
  storage: IStorage,
  store: EngagementStore,
  args: { playerId: string; specId: string; sourceParcelId: string; targetParcelId: string },
): Promise<Engagement> {
  const { playerId, specId, sourceParcelId, targetParcelId } = args;
  const spec = getWeapon(specId);
  if (!spec) throw new Error("Unknown weapon");
  if (isDefenseSpec(spec)) throw new Error(`${spec.name} is a defensive system — deploy it instead.`);

  const profile = await storage.getWeaponProfile(playerId);
  if (!profile.ownedWeapons.some((w) => w.specId === specId)) {
    throw new Error(`${spec.name} is not in your armory.`);
  }

  const [{ parcel: source, geo: from }, { geo: to }] = await Promise.all([
    parcelGeo(storage, sourceParcelId),
    parcelGeo(storage, targetParcelId),
  ]);
  if (source.ownerId !== playerId) throw new Error("You must fire from a parcel you own.");
  if (!inRange(spec, from, to)) {
    throw new Error(`Target out of range (${Math.round(greatCircleKm(from, to))}km > ${spec.rangeKm}km).`);
  }

  await storage.spendFrontier(playerId, fireCostFrntr(spec));

  const engagement = store.launch({
    weaponSpecId: specId,
    attackerId: playerId,
    from,
    to,
    sourceParcelId,
    targetParcelId,
  });

  // Update combat stats (drives badge progression). Best-effort.
  try {
    const distanceKm = greatCircleKm(from, to);
    const stats = { ...profile.stats };
    stats.shotsFired += 1;
    if (engagement.status === "impacted") {
      stats.kills += 1;
      if (distanceKm > spec.rangeKm * 0.6) stats.longRangeHits += 1;
      if (spec.cepM <= 10) stats.precisionHits += 1;
    }
    await storage.updateWeaponProfile(playerId, { stats });

    // Credit the intercepting battery's owner.
    if (engagement.status === "intercepted" && engagement.interceptedByBatteryId) {
      const battery = store.listBatteries().find((b) => b.id === engagement.interceptedByBatteryId);
      if (battery) {
        const defProfile = await storage.getWeaponProfile(battery.ownerId);
        await storage.updateWeaponProfile(battery.ownerId, {
          stats: { ...defProfile.stats, intercepts: defProfile.stats.intercepts + 1 },
        });
      }
    }
  } catch {
    /* stats are non-critical; never fail the shot on a stats hiccup */
  }

  return engagement;
}

export async function deployDefense(
  storage: IStorage,
  store: EngagementStore,
  args: { playerId: string; specId: string; parcelId: string },
): Promise<DefenseBattery> {
  const { playerId, specId, parcelId } = args;
  const spec = getWeapon(specId);
  if (!spec) throw new Error("Unknown weapon");
  if (!isDefenseSpec(spec)) throw new Error(`${spec.name} is not a defensive system.`);

  const profile = await storage.getWeaponProfile(playerId);
  if (!profile.ownedWeapons.some((w) => w.specId === specId)) {
    throw new Error(`${spec.name} is not in your armory.`);
  }
  const { parcel, geo } = await parcelGeo(storage, parcelId);
  if (parcel.ownerId !== playerId) throw new Error("You can only deploy on a parcel you own.");

  await storage.spendFrontier(playerId, deployCostFrntr(spec));
  return store.deployDefense({ specId, ownerId: playerId, parcelId, at: geo });
}
