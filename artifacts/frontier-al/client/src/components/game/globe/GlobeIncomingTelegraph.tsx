/**
 * GlobeIncomingTelegraph — the pre-resolution warning, on the globe.
 *
 * Mount INSIDE the <Canvas> scene. For each PENDING battle, draws a targeting
 * reticle on the defender's plot that builds in the final seconds before
 * resolution: an outer ring brightens and pulses faster while an inner ring
 * converges toward the centre — a warning that something is inbound. When the
 * battle resolves, `GlobeBattleSequence` takes over with the impact/capture
 * cinematic, so this is the build-up and that is the payoff.
 *
 * Driven by the pure, tested `incomingTelegraph` off the server clock; reads the
 * `battles`+`parcels` props it already receives — NO server change. (R3F —
 * typecheck/build-verified, not browser-verified in CI, like the other layers.)
 */
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Battle, LandParcel, SlimParcel } from "@shared/schema";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";
import { latLngToVec3 } from "@/lib/globe/globeUtils";
import { serverNow } from "@/lib/serverClock";
import { incomingTelegraph } from "@/lib/battle/incomingTelegraph";

const WARNING_COLOR = "#f59e0b"; // amber-500
const MAX_RETICLES = 16;

function SingleTelegraph({ pos, resolveTs }: { pos: THREE.Vector3; resolveTs: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const lookAt = useMemo(() => pos.clone().multiplyScalar(2), [pos]);

  useFrame(() => {
    const now = serverNow();
    const t = incomingTelegraph(resolveTs, now);
    const visible = t.active;
    if (groupRef.current) {
      groupRef.current.visible = visible;
      groupRef.current.lookAt(lookAt);
    }
    if (!visible) return;

    // Faster, brighter pulse as impact nears.
    const pulseSpeed = 0.004 + t.intensity * 0.012;
    const pulse = 0.55 + 0.45 * Math.sin(now * pulseSpeed);

    if (outerRef.current) {
      (outerRef.current.material as THREE.MeshBasicMaterial).opacity =
        (0.25 + 0.65 * t.intensity) * pulse;
    }
    if (innerRef.current) {
      // Converges from ~1.6× down toward the centre as intensity → 1.
      innerRef.current.scale.setScalar(1.6 - t.intensity * 1.1);
      (innerRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.6 * t.intensity;
    }
  });

  return (
    <group ref={groupRef} position={pos} visible={false}>
      <mesh ref={outerRef}>
        <ringGeometry args={[0.07, 0.095, 40]} />
        <meshBasicMaterial color={WARNING_COLOR} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={innerRef}>
        <ringGeometry args={[0.035, 0.05, 32]} />
        <meshBasicMaterial color={WARNING_COLOR} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

interface GlobeIncomingTelegraphProps {
  battles: Battle[];
  parcels: (LandParcel | SlimParcel)[];
}

export function GlobeIncomingTelegraph({ battles, parcels }: GlobeIncomingTelegraphProps) {
  const parcelLatLng = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>();
    for (const p of parcels) m.set(p.id, { lat: p.lat, lng: p.lng });
    return m;
  }, [parcels]);

  const reticles = useMemo(() => {
    const out: { key: string; pos: THREE.Vector3; resolveTs: number }[] = [];
    for (const b of battles) {
      if (b.status !== "pending" || !Number.isFinite(b.resolveTs)) continue;
      const coord = parcelLatLng.get(b.targetParcelId);
      if (!coord) continue;
      out.push({
        key: b.id,
        pos: latLngToVec3(coord.lat, coord.lng, GLOBE_RADIUS * 1.012),
        resolveTs: b.resolveTs,
      });
      if (out.length >= MAX_RETICLES) break;
    }
    return out;
  }, [battles, parcelLatLng]);

  if (reticles.length === 0) return null;
  return (
    <group>
      {reticles.map((r) => (
        <SingleTelegraph key={r.key} pos={r.pos} resolveTs={r.resolveTs} />
      ))}
    </group>
  );
}
