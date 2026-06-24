import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { Nebula } from "./Nebula";
import { useSettingsStore } from "../store/settingsStore";

// ---------------------------------------------------------------------------
// What lies beyond the cockpit glass: a deep starfield, a distant sun raking
// light across the cabin, and Mars — a small red promise — slightly off-centre
// for emotional framing. The player is travelling *toward* it.
// ---------------------------------------------------------------------------

function Mars() {
  const mars = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (mars.current) mars.current.rotation.y += dt * 0.02;
  });
  return (
    <group position={[3.4, 1.1, -34]}>
      {/* Planet body — rusty, faintly self-lit so it reads in shadow. */}
      <mesh ref={mars}>
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
