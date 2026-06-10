/**
 * client/src/components/game/weapons/WeaponProjectile.tsx
 *
 * A single in-flight weapon: an emissive warhead that travels the great-circle
 * flight path (from the shared ballistics sim) with a trailing additive particle
 * plume for fire/smoke. Built from three.js primitives in the GlobeEvents.tsx
 * idiom (useFrame + buffer attributes), so it drops onto the live globe later.
 */

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { getWeapon, positionAt, type GeoPoint } from "@shared/weapons";
import { latLngToVec3 } from "@/lib/globe/globeUtils";
import { radiusForAltKm, getParticleSprite, FIRE_HOT, SMOKE_COLOR } from "./fxUtils";

export interface WeaponShot {
  id: string;
  specId: string;
  from: GeoPoint;
  to: GeoPoint;
  /** Wall-clock launch time (Date.now() ms). */
  launchTs: number;
  /** Time of flight to the target (ms). */
  tof: number;
  /** Set when the shot is intercepted before impact. */
  intercept?: { at: GeoPoint; ts: number };
}

const POOL = 90;
const TRAIL_DECAY = 0.90; // additive particles fade to black (invisible) each frame

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function WeaponProjectile({ shot }: { shot: WeaponShot }) {
  const spec = getWeapon(shot.specId);
  const projRef = useRef<THREE.Mesh>(null!);
  const geoRef = useRef<THREE.BufferGeometry>(null!);
  const writeIdx = useRef(0);
  const settledRef = useRef(false); // once trail has fully faded, stop per-frame work
  const postFrames = useRef(0);
  const sprite = useMemo(() => getParticleSprite(), []);

  const positions = useMemo(() => new Float32Array(POOL * 3), []);
  const colors = useMemo(() => new Float32Array(POOL * 3), []);

  // terminal progress along the flight (1 = impact, or the intercept fraction)
  const endProgress = useMemo(() => {
    if (!shot.intercept) return 1;
    return clamp01((shot.intercept.ts - shot.launchTs) / shot.tof);
  }, [shot]);

  const headColor = spec?.flightProfile === "cruise_low" ? new THREE.Color("#9fe8ff") : FIRE_HOT;

  useFrame(() => {
    if (!spec || settledRef.current) return;
    const now = Date.now();
    const rawT = (now - shot.launchTs) / shot.tof;
    const t = clamp01(Math.min(rawT, endProgress));
    const inFlight = now >= shot.launchTs && rawT < endProgress;

    // Move the warhead.
    const fp = positionAt(spec, shot.from, shot.to, t);
    const head = latLngToVec3(fp.lat, fp.lng, radiusForAltKm(fp.altKm));
    if (projRef.current) {
      projRef.current.position.copy(head);
      projRef.current.visible = inFlight;
    }

    // Fade existing particles (additive → multiply toward black).
    for (let i = 0; i < colors.length; i++) colors[i] *= TRAIL_DECAY;

    // Emit a fresh particle at the nozzle while in flight.
    if (inFlight) {
      const i = writeIdx.current;
      const jitter = 0.004;
      positions[i * 3] = head.x + (Math.random() - 0.5) * jitter;
      positions[i * 3 + 1] = head.y + (Math.random() - 0.5) * jitter;
      positions[i * 3 + 2] = head.z + (Math.random() - 0.5) * jitter;
      // overdrive hot color so the core blooms; nearby tail cools toward smoke
      const mix = Math.random() * 0.4;
      const c = headColor.clone().lerp(SMOKE_COLOR, mix).multiplyScalar(1.7);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      writeIdx.current = (i + 1) % POOL;
    }

    if (geoRef.current) {
      geoRef.current.attributes.position.needsUpdate = true;
      geoRef.current.attributes.color.needsUpdate = true;
    }

    // Once the warhead is down and the additive trail has decayed to black
    // (~0.9^70 ≈ 0), stop doing per-frame fades + buffer uploads for this shot.
    if (inFlight) postFrames.current = 0;
    else if (++postFrames.current > 70) settledRef.current = true;
  });

  if (!spec) return null;

  return (
    <group>
      <points>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.05}
          map={sprite}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
      <mesh ref={projRef}>
        <sphereGeometry args={[0.012, 10, 10]} />
        <meshBasicMaterial color={headColor} />
      </mesh>
    </group>
  );
}
