/**
 * GlobeMusterLayer — the attacker-side pending-battle build-up, on the globe.
 *
 * `GlobeIncomingTelegraph` gives the defender a converging warning reticle in
 * the final seconds before resolution; the attacker's launch plot showed
 * nothing at all. This mounts INSIDE the <Canvas> scene and, for each PENDING
 * battle, draws a pulsing staging glow + rising energy core on the SOURCE
 * plot for the entire pending window, plus a faint spark that creeps along
 * the existing battle arc toward the target as resolution nears — so a
 * rotating globe covered in brewing wars reads at a glance.
 *
 * Driven by the pure, tested `musterState` off the server clock; reads the
 * `battles`+`parcels`+`players` props the sibling layers already receive — NO
 * server change. Attacker identity color reuses `factionColor` (falls back to
 * neutral for human players, same as the resolution cinematic). (R3F —
 * typecheck/build-verified, not browser-verified in CI, like the other layers.)
 */
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Battle, LandParcel, Player, SlimParcel } from "@shared/schema";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";
import { latLngToVec3, buildArcCurve } from "@/lib/globe/globeUtils";
import { serverNow } from "@/lib/serverClock";
import { musterState } from "@/lib/battle/musterState";
import { factionColor } from "@/lib/battle/factionColor";
import { shouldPlayBattleCinematics } from "@/lib/battle/cinematicsEnabled";
import { useVisualPrefs } from "@/hooks/useVisualPrefs";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const MAX_MUSTERS = 16;

function SingleMuster({
  pos, curve, color, startTs, resolveTs, troopsCommitted,
}: {
  pos: THREE.Vector3;
  curve: THREE.QuadraticBezierCurve3 | null;
  color: string;
  startTs: number;
  resolveTs: number;
  troopsCommitted: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const sparkRef = useRef<THREE.Mesh>(null);
  const lookAt = useMemo(() => pos.clone().multiplyScalar(2), [pos]);

  useFrame(() => {
    const now = serverNow();
    const s = musterState(startTs, resolveTs, now, troopsCommitted);
    if (groupRef.current) {
      groupRef.current.visible = s.active;
      groupRef.current.lookAt(lookAt);
    }
    if (!s.active) {
      if (sparkRef.current) sparkRef.current.visible = false;
      return;
    }

    const pulse = 0.6 + 0.4 * Math.sin(now * (0.003 + s.troopScale * 0.01));
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + s.glowIntensity * 0.6);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = s.glowIntensity * 0.55 * pulse;
    }
    if (coreRef.current) {
      coreRef.current.scale.setScalar(0.3 + s.glowIntensity * 0.9);
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + s.glowIntensity * 0.6;
    }
    if (sparkRef.current && curve) {
      sparkRef.current.visible = s.glowIntensity > 0.05;
      sparkRef.current.position.copy(curve.getPoint(s.creepProgress));
      (sparkRef.current.material as THREE.MeshBasicMaterial).opacity = s.glowIntensity * 0.8;
    }
  });

  return (
    <>
      <group ref={groupRef} position={pos} visible={false}>
        <mesh ref={glowRef}>
          <ringGeometry args={[0.05, 0.09, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh ref={coreRef}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {curve && (
        <mesh ref={sparkRef} visible={false}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

interface GlobeMusterLayerProps {
  battles: Battle[];
  parcels: (LandParcel | SlimParcel)[];
  players: Player[];
}

export function GlobeMusterLayer({ battles, parcels, players }: GlobeMusterLayerProps) {
  const play = shouldPlayBattleCinematics(useVisualPrefs().battleCinematics, usePrefersReducedMotion());

  const parcelLatLng = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>();
    for (const p of parcels) m.set(p.id, { lat: p.lat, lng: p.lng });
    return m;
  }, [parcels]);

  const playerFirstParcel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of players) if (p.ownedParcels && p.ownedParcels.length > 0) m.set(p.id, p.ownedParcels[0]);
    return m;
  }, [players]);

  const playerName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of players) m.set(p.id, p.name);
    return m;
  }, [players]);

  const musters = useMemo(() => {
    const out: {
      key: string;
      pos: THREE.Vector3;
      curve: THREE.QuadraticBezierCurve3 | null;
      color: string;
      startTs: number;
      resolveTs: number;
      troopsCommitted: number;
    }[] = [];
    for (const b of battles) {
      if (b.status !== "pending" || !Number.isFinite(b.resolveTs) || !Number.isFinite(b.startTs)) continue;
      const sourceParcelId = b.sourceParcelId ?? playerFirstParcel.get(b.attackerId);
      if (!sourceParcelId) continue;
      const srcCoord = parcelLatLng.get(sourceParcelId);
      if (!srcCoord) continue;
      const pos = latLngToVec3(srcCoord.lat, srcCoord.lng, GLOBE_RADIUS * 1.012);

      const tgtCoord = parcelLatLng.get(b.targetParcelId);
      const curve = tgtCoord
        ? buildArcCurve(pos, latLngToVec3(tgtCoord.lat, tgtCoord.lng, GLOBE_RADIUS * 1.01))
        : null;

      out.push({
        key: b.id,
        pos,
        curve,
        color: factionColor(playerName.get(b.attackerId)),
        startTs: b.startTs,
        resolveTs: b.resolveTs,
        troopsCommitted: b.troopsCommitted,
      });
      if (out.length >= MAX_MUSTERS) break;
    }
    return out;
  }, [battles, parcelLatLng, playerFirstParcel, playerName]);

  if (!play || musters.length === 0) return null;
  return (
    <group>
      {musters.map((m) => (
        <SingleMuster
          key={m.key}
          pos={m.pos}
          curve={m.curve}
          color={m.color}
          startTs={m.startTs}
          resolveTs={m.resolveTs}
          troopsCommitted={m.troopsCommitted}
        />
      ))}
    </group>
  );
}
