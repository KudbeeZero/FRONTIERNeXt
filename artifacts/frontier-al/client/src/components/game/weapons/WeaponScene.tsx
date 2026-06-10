/**
 * client/src/components/game/weapons/WeaponScene.tsx
 *
 * Composes the live weapon FX for a set of shots: an arcing projectile + particle
 * trail per shot, plus the terminal event (orange impact at the target, or a cyan
 * kinetic-kill flash at the intercept point). This is the layer that mounts inside
 * PlanetGlobe alongside <GlobeEvents/> when the system goes live; the sandbox
 * mounts it directly.
 */

import { getWeapon, positionAt } from "@shared/weapons";
import { WeaponProjectile, type WeaponShot } from "./WeaponProjectile";
import { ImpactBurst } from "./ImpactBurst";

export function WeaponScene({ shots }: { shots: WeaponShot[] }) {
  return (
    <group name="weapon-fx-layer">
      {shots.map((shot) => {
        const spec = getWeapon(shot.specId);
        if (!spec) return null;

        let terminal = null;
        if (shot.intercept) {
          // altitude at the intercept fraction, for a flash above the surface
          const frac = Math.max(0, Math.min(1, (shot.intercept.ts - shot.launchTs) / shot.tof));
          const altKm = positionAt(spec, shot.from, shot.to, frac).altKm;
          terminal = (
            <ImpactBurst
              at={shot.intercept.at}
              altKm={altKm}
              triggerTs={shot.intercept.ts}
              color="#5bf0ff"
              maxScale={3}
              durationMs={900}
            />
          );
        } else {
          terminal = (
            <ImpactBurst
              at={shot.to}
              triggerTs={shot.launchTs + shot.tof}
              color="#ff7a1f"
              maxScale={6}
            />
          );
        }

        return (
          <group key={shot.id}>
            <WeaponProjectile shot={shot} />
            {terminal}
          </group>
        );
      })}
    </group>
  );
}
