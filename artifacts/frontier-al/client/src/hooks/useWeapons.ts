/**
 * client/src/hooks/useWeapons.ts
 *
 * React Query bindings for the weapon combat API. Until now only the Armory
 * (build/unlock/upgrade/loadout) was wired; this adds the missing offensive
 * verb — firing — so equipped weapons can finally act on the map.
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PlayerWeaponProfile, WeaponSpec } from "@shared/weapons";

export interface WeaponCatalogEntry {
  spec: WeaponSpec;
  unlocked: boolean;
  owned: boolean;
  fireCost: number;
  unlockCost: number;
}

export interface WeaponCatalogResponse {
  profile: PlayerWeaponProfile;
  entries: WeaponCatalogEntry[];
}

/**
 * The player's weapon catalog (owned/unlocked flags + ASCEND costs). Shares the
 * ArmoryPanel cache key so an unlock/build there is reflected here immediately.
 */
export function useWeaponCatalog(playerId: string | null) {
  return useQuery<WeaponCatalogResponse>({
    queryKey: ["weapons-catalog", playerId],
    enabled: !!playerId,
    queryFn: async () =>
      (
        await apiRequest("GET", `/api/weapons/catalog?playerId=${encodeURIComponent(playerId!)}`)
      ).json(),
  });
}

export interface FireWeaponArgs {
  playerId: string;
  specId: string;
  sourceParcelId: string;
  targetParcelId: string;
}

/**
 * Fire an offensive weapon at a target parcel. The server resolves the
 * engagement synchronously (hit or intercepted) and broadcasts it; we refresh
 * the catalog (ASCEND spent, stats) and game state on success.
 */
export function useFireWeapon() {
  return useMutation({
    mutationFn: async (args: FireWeaponArgs) =>
      (await apiRequest("POST", "/api/weapons/fire", args)).json(),
    onSuccess: (_data, args) => {
      queryClient.invalidateQueries({ queryKey: ["weapons-catalog", args.playerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
    },
  });
}
