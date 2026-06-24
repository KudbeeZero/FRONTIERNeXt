import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isReducedMotion } from "../store/settingsStore";

// ---------------------------------------------------------------------------
// Volumetric-feel nebula beyond the cockpit glass. Layered soft additive cloud
// sprites at varied depths give the scene real colour and the sense of vast open
// space — the "you're inside something enormous" feeling. The cloud texture is
// generated procedurally (no asset files); the whole field churns almost
// imperceptibly. The CLOUDS array is the tuning surface — palette + placement.
// ---------------------------------------------------------------------------

function useCloudTexture() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.35, "rgba(255,255,255,0.32)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

type Cloud = {
  pos: [number, number, number];
  scale: number;
  color: string;
  opacity: number;
  rot: number;
};

// A magenta→violet→blue→teal palette spread across the forward depth, echoing the
// deep-space reference. Kept conservative in opacity so overlaps read as glow, not mud.
const CLOUDS: Cloud[] = [
  { pos: [-9, 3, -42], scale: 26, color: "#3b2470", opacity: 0.5, rot: 0.2 },
  { pos: [8, -4, -38], scale: 22, color: "#6a2270", opacity: 0.42, rot: -0.4 },
  { pos: [2, 6, -48], scale: 30, color: "#1b3a86", opacity: 0.4, rot: 0.1 },
  { pos: [-6, -6, -30], scale: 16, color: "#7a2552", opacity: 0.32, rot: 0.6 },
  { pos: [12, 5, -50], scale: 24, color: "#1f6f8c", opacity: 0.3, rot: -0.2 },
  { pos: [-14, 1, -52], scale: 28, color: "#4a2480", opacity: 0.36, rot: 0.3 },
  { pos: [5, -8, -44], scale: 20, color: "#2a3aa0", opacity: 0.3, rot: -0.5 },
  { pos: [0, 1, -26], scale: 12, color: "#5a2e7a", opacity: 0.2, rot: 0.4 },
  { pos: [-3, 9, -40], scale: 18, color: "#8a3a6a", opacity: 0.24, rot: -0.3 },
  { pos: [10, 8, -34], scale: 14, color: "#2f7a9a", opacity: 0.22, rot: 0.5 },
  { pos: [-11, -7, -46], scale: 22, color: "#3a2a8a", opacity: 0.3, rot: -0.15 },
  { pos: [6, 2, -56], scale: 34, color: "#241a55", opacity: 0.4, rot: 0.08 },
];

export function Nebula() {
  const tex = useCloudTexture();
  const group = useRef<THREE.Group>(null);

  // Almost imperceptible churn — life without distraction. Frozen on reduced motion.
  useFrame((state) => {
    const g = group.current;
    if (!g || isReducedMotion()) return;
    const t = state.clock.elapsedTime;
    g.rotation.z = Math.sin(t * 0.01) * 0.04;
    for (let i = 0; i < g.children.length; i++) {
      // Absolute sway from the authored base x — frame-rate independent + bounded
      // (no accumulation), so it looks identical at 30 vs 60 fps.
      g.children[i].position.x = CLOUDS[i].pos[0] + Math.sin(t * 0.02 + i) * 0.6;
    }
  });

  return (
    <group ref={group}>
      {CLOUDS.map((c, i) => (
        <mesh key={i} position={c.pos} rotation={[0, 0, c.rot]} scale={c.scale}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={tex}
            color={c.color}
            transparent
            opacity={c.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            fog={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
