/**
 * client/src/components/game/globe/LiveWeaponLayer.tsx
 *
 * Bridges the server's live weapon engagements (streamed over WS as
 * `weapon_engagement`) onto the globe by mapping each into a WeaponShot and
 * rendering the particle-FX WeaponScene. Self-subscribing so it can be dropped
 * into PlanetGlobe's scene without threading props through the page.
 */

import { useEffect, useState } from "react";
import { onWeaponEngagement } from "@/hooks/useGameSocket";
import { WeaponScene } from "@/components/game/weapons/WeaponScene";
import type { WeaponShot } from "@/components/game/weapons/WeaponProjectile";

/** Keep a shot mounted this long after it resolves so the FX fully plays out. */
const RETAIN_MS = 12_000;

export function LiveWeaponLayer() {
  const [shots, setShots] = useState<WeaponShot[]>([]);

  useEffect(() => {
    return onWeaponEngagement((e) => {
      const shot: WeaponShot = {
        id: e.id,
        specId: e.weaponSpecId,
        from: e.from,
        to: e.to,
        launchTs: e.launchTs,
        tof: e.tof,
        intercept:
          e.status === "intercepted" && e.interceptAt && e.interceptTs != null
            ? { at: e.interceptAt, ts: e.interceptTs }
            : undefined,
      };
      setShots((prev) => [...prev.filter((s) => s.id !== shot.id), shot]);

      const endTs = (shot.intercept?.ts ?? shot.launchTs + shot.tof) + RETAIN_MS;
      const delay = Math.max(0, endTs - Date.now());
      setTimeout(() => setShots((prev) => prev.filter((s) => s.id !== shot.id)), delay);
    });
  }, []);

  return <WeaponScene shots={shots} />;
}
