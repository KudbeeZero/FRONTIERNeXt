/**
 * GlobeShieldDome — the brace-beat fortification dome, on the globe.
 *
 * Unit B2 from the battle-visuals plan. Mount INSIDE the <Canvas> scene.
 * Subscribes independently to the SAME `cinematicBus` that
 * `GlobeCinematicCamera`/`BattleCalloutHUD` already use (does NOT edit
 * `GlobeBattleSequence.tsx`) and, for each cinematic, raises a translucent
 * hex-faceted shield dome over the DEFENDER's plot — size/brightness driven
 * by the real `brace` beat intensity (defender power + fortification level,
 * already baked into the sequence by the shared battle engine). At impact the
 * dome either **cracks apart** (attacker wins) or **flares once and holds
 * solid** (defense held).
 *
 * All timing math is the pure, tested `braceDomeAt` in
 * `battleSequencePlayback.ts`; this is a thin renderer. (R3F —
 * typecheck/build-verified, not browser-verified in CI, like the other globe
 * layers.)
 */
import * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { BattleSequence } from "@shared/battle-sequence";
import { onCinematic, type CinematicHandle } from "@/lib/battle/cinematicBus";
import { braceDomeAt } from "@/lib/globe/battleSequencePlayback";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";
import { latLngToVec3 } from "@/lib/globe/globeUtils";
import { shouldPlayBattleCinematics } from "@/lib/battle/cinematicsEnabled";
import { useVisualPrefs } from "@/hooks/useVisualPrefs";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const DEFENSE_COLOR_FALLBACK = "#f87171"; // rose-400 — matches GlobeBattleSequence's DEFENSE_COLOR
const FLARE_COLOR = "#e0f2fe"; // pale cyan-white "shield holds" flash
/** Hard cap on how long a dome lingers before forced cleanup (ms) — matches GlobeBattleSequence. */
const MAX_LIFETIME_MS = 12_000;

interface ActiveDome {
  key: string;
  seq: BattleSequence;
  toVec: THREE.Vector3;
  startMs: number;
}

function SingleDome({ dome, onDone }: { dome: ActiveDome; onDone: (key: string) => void }) {
  const { seq, toVec } = dome;
  const domeRef = useRef<THREE.Mesh>(null);
  const crackRef = useRef<THREE.Mesh>(null);
  const flareRef = useRef<THREE.Mesh>(null);

  // Orient the dome's local +Y (its pole) to the outward surface normal, so
  // the hex-faceted cap bulges away from the globe with its flat base
  // sitting on the plot.
  const quaternion = useMemo(() => {
    const normal = toVec.clone().normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  }, [toVec]);

  const color = seq.defender.color ?? DEFENSE_COLOR_FALLBACK;

  useFrame(() => {
    const elapsed = Date.now() - dome.startMs;
    const s = braceDomeAt(seq, elapsed);

    if (domeRef.current) {
      const scale = 0.03 + s.strength * 0.02;
      domeRef.current.scale.setScalar(scale);
      const mat = domeRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = s.opacity * (1 - s.shatterProgress) * 0.4;
      domeRef.current.visible = mat.opacity > 0.01;
    }
    if (crackRef.current) {
      const scale = 0.03 + s.strength * 0.02;
      crackRef.current.scale.setScalar(scale);
      const mat = crackRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = s.shatterProgress * 0.8;
      crackRef.current.visible = mat.opacity > 0.01;
    }
    if (flareRef.current) {
      const scale = (0.03 + s.strength * 0.02) * (1.05 + s.flareIntensity * 0.25);
      flareRef.current.scale.setScalar(scale);
      const mat = flareRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = s.flareIntensity * 0.6;
      flareRef.current.visible = mat.opacity > 0.01;
    }

    if (elapsed > MAX_LIFETIME_MS) onDone(dome.key);
  });

  return (
    <group position={toVec} quaternion={quaternion}>
      {/* Solid shield — hex-faceted low-poly dome (widthSegments=6 → hexagonal silhouette). */}
      <mesh ref={domeRef}>
        <sphereGeometry args={[1, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color={color} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Crack overlay — same geometry, wireframe, brightens as the dome shatters. */}
      <mesh ref={crackRef}>
        <sphereGeometry args={[1, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Victory flare — a brief brighter overlay when the defense holds. */}
      <mesh ref={flareRef}>
        <sphereGeometry args={[1, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color={FLARE_COLOR} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function GlobeShieldDome() {
  const [active, setActive] = useState<ActiveDome[]>([]);
  const play = shouldPlayBattleCinematics(useVisualPrefs().battleCinematics, usePrefersReducedMotion());

  const remove = useCallback((key: string) => {
    setActive((prev) => prev.filter((d) => d.key !== key));
  }, []);

  useEffect(() => {
    const unsub = onCinematic((handle: CinematicHandle) => {
      const toVec = latLngToVec3(handle.seq.target.lat, handle.seq.target.lng, GLOBE_RADIUS * 1.015);
      setActive((prev) => {
        const next = prev.filter((d) => d.key !== handle.seq.battleId);
        return [...next, { key: handle.seq.battleId, seq: handle.seq, toVec, startMs: handle.startMs }].slice(-6);
      });
    });
    return () => unsub();
  }, []);

  if (!play || active.length === 0) return null;
  return (
    <group>
      {active.map((d) => (
        <SingleDome key={d.key} dome={d} onDone={remove} />
      ))}
    </group>
  );
}
