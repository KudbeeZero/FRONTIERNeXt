import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Floating debris / dust caught in the cabin's god rays. Tiny additive points
// that drift slowly and re-wrap, selling the volume of light and the sense of a
// pressurized cabin that has seen better days.
// ---------------------------------------------------------------------------

const COUNT = 220;
const BOUND = 4.5;

export function DustMotes() {
  const points = useRef<THREE.Points>(null);

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * BOUND * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * BOUND;
      positions[i * 3 + 2] = (Math.random() - 0.5) * BOUND - 1;
      speeds[i] = 0.02 + Math.random() * 0.06;
    }
    return { positions, speeds };
  }, []);

  useFrame((state) => {
    const pts = points.current;
    if (!pts) return;
    const arr = pts.geometry.attributes.position.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      // Gentle drift with a little sinusoidal sway.
      arr[i * 3 + 1] += speeds[i] * 0.016;
      arr[i * 3 + 0] += Math.sin(t * 0.3 + i) * 0.0006;
      if (arr[i * 3 + 1] > BOUND / 2) arr[i * 3 + 1] = -BOUND / 2;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={COUNT}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.018}
        color="#ffe9c8"
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}
