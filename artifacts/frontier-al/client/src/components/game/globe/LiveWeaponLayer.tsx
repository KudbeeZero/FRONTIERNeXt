/**
 * client/src/components/game/globe/LiveWeaponLayer.tsx
 *
 * Bridges the server's live weapon engagements (streamed over WS as
 * `weapon_engagement`) onto the globe by mapping each into a WeaponShot and
 * rendering the particle-FX WeaponScene. Self-subscribing so it can be dropped
 * into PlanetGlobe's scene without threading props through the page.
 *
 * Timing is rebased to the client clock on receipt: the server stamps launchTs on
 * its own clock, so comparing it to the client's Date.now() would break the FX
 * under clock skew (missiles starting mid-flight or never rendering). We start the
 * flight "now" locally and preserve tof + the intercept fraction.
 */

import { useEffect, useRef, useState } from "react";
import { onWeaponEngagement } from "@/hooks/useGameSocket";
import { WeaponScene } from "@/components/game/weapons/WeaponScene";
import type { WeaponShot } from "@/components/game/weapons/WeaponProjectile";

/** Keep a shot mounted this long after it resolves so the FX fully plays out. */
const RETAIN_MS = 12_000;

export function LiveWeaponLayer() {
  const [shots, setShots] = useState<WeaponShot[]>([]);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const unsub = onWeaponEngagement((e) => {
      const recvNow = Date.now();
      const intercept =
        e.status === "intercepted" && e.interceptAt && e.interceptTs != null
          ? { at: e.interceptAt, ts: recvNow + (e.interceptTs - e.launchTs) }
          : undefined;
      const shot: WeaponShot = {
        id: e.id,
        specId: e.weaponSpecId,
        from: e.from,
        to: e.to,
        launchTs: recvNow,
        tof: e.tof,
        intercept,
      };
      setShots((prev) => [...prev.filter((s) => s.id !== shot.id), shot]);

      const endTs = (shot.intercept?.ts ?? shot.launchTs + shot.tof) + RETAIN_MS;
      const delay = Math.max(0, endTs - Date.now());
      const id = setTimeout(() => {
        setShots((prev) => prev.filter((s) => s.id !== shot.id));
        timers.current.delete(id);
      }, delay);
      timers.current.add(id);
    });

    return () => {
      unsub();
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, []);

  return <WeaponScene shots={shots} />;
}
