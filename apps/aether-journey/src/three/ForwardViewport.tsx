import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

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
  return (
    <group>
      {/* The sun — distant, hard, off to one side. Its light is the god-ray source. */}
      <mesh position={[-12, 6, -40]}>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshBasicMaterial color="#fff4e0" />
      </mesh>

      <Stars
        radius={120}
        depth={60}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={0.4}
      />

      <Mars />
    </group>
  );
}
