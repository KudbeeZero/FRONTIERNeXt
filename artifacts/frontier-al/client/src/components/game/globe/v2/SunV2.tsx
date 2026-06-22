/**
 * SunV2 — the single writer of the shared sun direction, plus the visible sun.
 *
 * Each frame it advances the orbit clock (unless paused), writes the world-space
 * unit direction into `sunDirRef` (the one ref every other v2 layer reads), and
 * parks a glowing disc + a directionalLight along that direction. Because the
 * direction is world-space and the planet group never rotates, dragging the globe
 * no longer slides the terminator — the REBUILD_NOTES "shadow shifts when rotating"
 * bug cannot recur.
 */

import * as THREE from "three";
import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { computeSunDirection, SUN_DISTANCE } from "./sunModelV2";

interface SunV2Props {
  /** Shared world-space sun direction, written here, read by every other layer. */
  sunDirRef: MutableRefObject<THREE.Vector3>;
  /** Manual scrub offset in radians (debug slider). */
  phase: number;
  /** Freeze the auto-orbit (the scrub slider still applies). */
  paused: boolean;
  /** Show the glowing sun disc (the directional light always stays on). */
  showDisc?: boolean;
}

export function SunV2({ sunDirRef, phase, paused, showDisc = true }: SunV2Props) {
  const timeRef = useRef(0);
  const discRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.DirectionalLight>(null!);
  const pos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!paused) timeRef.current += delta;
    // Write the canonical direction in place so all readers share one Vector3.
    computeSunDirection(timeRef.current, phase, sunDirRef.current);
    pos.current.copy(sunDirRef.current).multiplyScalar(SUN_DISTANCE);
    if (discRef.current) discRef.current.position.copy(pos.current);
    if (lightRef.current) lightRef.current.position.copy(pos.current);
  });

  return (
    <>
      {/* A soft fill so the night side never crushes to pure black, plus the
          real directional sun that drives every layer's terminator. */}
      <ambientLight intensity={0.25} color="#9fb8ff" />
      <directionalLight ref={lightRef} intensity={2.2} color="#fff4e0" />
      {showDisc && (
        <mesh ref={discRef}>
          <sphereGeometry args={[1.6, 24, 24]} />
          <meshBasicMaterial color="#fff6d8" toneMapped={false} />
        </mesh>
      )}
    </>
  );
}
