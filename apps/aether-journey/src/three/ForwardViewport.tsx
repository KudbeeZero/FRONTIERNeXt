import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { Nebula } from "./Nebula";
import { useSettingsStore } from "../store/settingsStore";
import { useGameStore } from "../store/gameStore";

// ---------------------------------------------------------------------------
// What lies beyond the cockpit glass: a deep starfield, a distant sun raking
// light across the cabin, and Mars — a small red promise — slightly off-centre
// early on. As the voyage closes it GROWS and, at touchdown ("we're down, Mars
// under us"), swings large and low so it reads as the surface beneath the ship —
// instead of staying a distant dot through the landing.
// ---------------------------------------------------------------------------

/** Mars' framing per story beat: [x, y, z, scale]. Lerped to, so moves are smooth. */
function marsTarget(phase: string, progress: number): [number, number, number, number] {
  // Touchdown — large and BELOW the window: the surface "under us".
  if (phase === "arrival") return [0.6, -4.4, -13, 3.4];
  // Descent — dropping in fast, filling more of the glass.
  if (phase === "descent") return [1.8, -1.0, -18, 2.3];
  // Cruise — drift in from far as the journey progresses (0→1).
  const p = Math.max(0, Math.min(1, progress));
  return [3.4 - 1.4 * p, 1.1 - 0.5 * p, -34 + 13 * p, 1 + 0.85 * p];
}

function Mars() {
  const body = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  const phase = useGameStore((s) => s.phase);
  const progress = useGameStore((s) => s.journeyProgress);

  useFrame((_, dt) => {
    if (body.current) body.current.rotation.y += dt * 0.02;
    const g = group.current;
    if (!g) return;
    const [x, y, z, s] = marsTarget(phase, progress);
    // Ease toward the beat's framing (frame-rate-independent).
    const k = 1 - Math.pow(0.5, dt * 1.4);
    g.position.lerp(new THREE.Vector3(x, y, z), k);
    const cur = g.scale.x;
    g.scale.setScalar(cur + (s - cur) * k);
  });

  return (
    <group ref={group} position={[3.4, 1.1, -34]}>
      {/* Planet body — rusty, faintly self-lit so it reads in shadow. */}
      <mesh ref={body}>
        <sphereGeometry args={[3.2, 64, 64]} />
        <meshStandardMaterial
          color="#c1582f"
          roughness={0.95}
          metalness={0.05}
          emissive="#3a0f06"
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* Thin warm atmosphere halo. */}
      <mesh scale={1.08}>
        <sphereGeometry args={[3.2, 48, 48]} />
        <meshBasicMaterial
          color="#ff9b6a"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

export function ForwardViewport() {
  // Subscribe directly so a runtime Reduced Motion toggle freezes the star/sparkle
  // drift immediately — no reliance on a parent re-render to propagate it.
  const rm = useSettingsStore((s) => s.reducedMotion);
  return (
    <group>
      {/* Deep colour field — the sense of vast open space. Drawn farthest back. */}
      <Nebula />

      {/* The sun — distant, hard, off to one side. Its light is the god-ray source. */}
      <mesh position={[-12, 6, -40]}>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshBasicMaterial color="#fff4e0" />
      </mesh>
      {/* Soft solar bloom halo so the sun reads as a light source, not a disc. */}
      <mesh position={[-12, 6, -40.2]}>
        <sphereGeometry args={[3.4, 24, 24]} />
        <meshBasicMaterial color="#ffdca0" transparent opacity={0.18} fog={false} />
      </mesh>

      {/* Two star layers for parallax depth: a bright near field + a faint far field. */}
      <Stars radius={120} depth={60} count={6500} factor={4} saturation={0} fade speed={rm ? 0 : 0.4} />
      <Stars radius={320} depth={80} count={2600} factor={7} saturation={0} fade speed={rm ? 0 : 0.1} />

      {/* Slow-drifting deep-space motes — they give the void scale + motion. */}
      <Sparkles
        count={70}
        scale={[46, 28, 34]}
        position={[0, 0, -28]}
        size={3.4}
        speed={rm ? 0 : 0.3}
        opacity={0.5}
        color="#bfe4ff"
        noise={1.4}
      />

      <Mars />
    </group>
  );
}
