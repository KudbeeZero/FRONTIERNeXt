/**
 * client/src/components/game/weapons/ImpactBurst.tsx
 *
 * A one-shot expanding ring + flash, used for both warhead impacts (orange) and
 * kinetic interception kills (cyan). Mirrors the scale-and-fade useFrame math of
 * GlobeEvents.tsx's MiningPulse / ImpactZone.
 */

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { GeoPoint } from "@shared/weapons";
import { latLngToVec3 } from "@/lib/globe/globeUtils";
import { radiusForAltKm } from "./fxUtils";

export interface ImpactBurstProps {
  at: GeoPoint;
  /** Altitude (km) of the event — surface impacts use 0; interceptions use apex. */
  altKm?: number;
  /** Wall-clock time the burst fires (Date.now() ms). */
  triggerTs: number;
  color?: string;
  /** Peak ring scale multiplier. */
  maxScale?: number;
  durationMs?: number;
}

export function ImpactBurst({
  at,
  altKm = 0,
  triggerTs,
  color = "#ff7a1f",
  maxScale = 5,
  durationMs = 1100,
}: ImpactBurstProps) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const flashRef = useRef<THREE.Mesh>(null!);

  const pos = useMemo(
    () => latLngToVec3(at.lat, at.lng, radiusForAltKm(altKm)),
    [at.lat, at.lng, altKm],
  );
  const lookAt = useMemo(() => pos.clone().multiplyScalar(2), [pos]);

  useFrame(() => {
    const elapsed = Date.now() - triggerTs;
    const visible = elapsed >= 0 && elapsed <= durationMs;
    const t = Math.max(0, Math.min(1, elapsed / durationMs));
    const fade = Math.pow(1 - t, 1.5);

    if (ringRef.current) {
      ringRef.current.visible = visible;
      ringRef.current.scale.setScalar(1 + t * maxScale);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.9;
    }
    if (flashRef.current) {
      flashRef.current.visible = visible;
      flashRef.current.scale.setScalar(1 + t * 1.5);
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = fade;
    }
  });

  return (
    <group position={pos}>
      <mesh ref={ringRef} onUpdate={(self) => self.lookAt(lookAt)}>
        <ringGeometry args={[0.02, 0.035, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={flashRef}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}
