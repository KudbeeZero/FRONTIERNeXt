import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";

// ---------------------------------------------------------------------------
// Aether — a holographic presence above the console.
//
// Deliberately *not* a humanoid: an elegant abstract form — a luminous core
// wrapped in three counter-rotating rings and a halo of orbiting motes. She
// reads as a mind, not a face. Her appearance is fully data-driven:
//
//   • color    lerps red→cyan as `aetherStability` rises (wounded → healed)
//   • jitter   spikes while she is speaking or badly fragmented
//   • opacity  flickers/drops out at low stability (a failing projection)
//
// As the player heals her, she literally becomes steadier and more whole.
// ---------------------------------------------------------------------------

const RED = new THREE.Color("#ff5a5a");
const CYAN = new THREE.Color("#7fe7ff");
const MOTE_COUNT = 60;

export function AetherHologram() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const ringC = useRef<THREE.Mesh>(null);
  const motes = useRef<THREE.Points>(null);

  const stability = useGameStore((s) => s.systems.aetherStability);
  const speaking = useGameStore((s) => s.aetherSpeaking);

  const motePositions = useMemo(() => {
    const arr = new Float32Array(MOTE_COUNT * 3);
    for (let i = 0; i < MOTE_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.7 + Math.random() * 0.5;
      arr[i * 3 + 0] = Math.cos(a) * r;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 1.4;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  }, []);

  // Reusable scratch color so we don't allocate every frame.
  const tint = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const stab = stability / 100;
    // 0 = fully fragmented, 1 = fully healed.
    const damage = 1 - stab;

    tint.copy(RED).lerp(CYAN, stab);

    // Instability → positional jitter + dropout flicker. Speaking adds energy.
    const jitterAmp = damage * 0.06 + (speaking ? 0.03 : 0);
    if (group.current) {
      group.current.position.x = (Math.random() - 0.5) * jitterAmp;
      group.current.position.y =
        0.15 + Math.sin(t * 1.6) * 0.05 + (Math.random() - 0.5) * jitterAmp;
      // Occasional whole-projection dropout when badly hurt.
      const dropout = damage > 0.4 && Math.random() < damage * 0.04;
      group.current.visible = !dropout;
    }

    const speakPulse = speaking ? 1 + Math.sin(t * 22) * 0.06 : 1;

    if (core.current) {
      const s = (0.9 + Math.sin(t * 2.2) * 0.06) * speakPulse;
      core.current.scale.setScalar(s);
      const m = core.current.material as THREE.MeshStandardMaterial;
      m.color.copy(tint);
      m.emissive.copy(tint);
      m.emissiveIntensity = 1.6 + (speaking ? 1.2 : 0.4) + Math.sin(t * 3) * 0.3;
    }

    // Counter-rotating rings — faster/wobblier the more damaged she is.
    const wob = damage * 0.4;
    if (ringA.current) {
      ringA.current.rotation.x = t * 0.6 + Math.sin(t * 4) * wob;
      ringA.current.rotation.y = t * 0.3;
      applyTint(ringA.current, tint, 0.5 + stab * 0.5);
    }
    if (ringB.current) {
      ringB.current.rotation.y = -t * 0.5 + Math.cos(t * 3) * wob;
      ringB.current.rotation.z = t * 0.4;
      applyTint(ringB.current, tint, 0.5 + stab * 0.5);
    }
    if (ringC.current) {
      ringC.current.rotation.z = t * 0.35;
      ringC.current.rotation.x = -t * 0.25 + Math.sin(t * 5) * wob;
      applyTint(ringC.current, tint, 0.5 + stab * 0.5);
    }

    if (motes.current) {
      motes.current.rotation.y = t * 0.25;
      const mm = motes.current.material as THREE.PointsMaterial;
      mm.color.copy(tint);
      mm.opacity = 0.4 + stab * 0.4 + (speaking ? 0.15 : 0);
    }
  });

  return (
    <group ref={group} position={[0, 0.15, -3.1]}>
      {/* Luminous core */}
      <mesh ref={core}>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshStandardMaterial
          color={CYAN}
          emissive={CYAN}
          emissiveIntensity={2}
          transparent
          opacity={0.9}
          roughness={0.2}
          metalness={0.1}
          toneMapped={false}
        />
      </mesh>

      {/* Three counter-rotating rings */}
      <mesh ref={ringA}>
        <torusGeometry args={[0.85, 0.012, 16, 80]} />
        <meshStandardMaterial transparent opacity={0.7} toneMapped={false} />
      </mesh>
      <mesh ref={ringB}>
        <torusGeometry args={[1.05, 0.01, 16, 80]} />
        <meshStandardMaterial transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <mesh ref={ringC}>
        <torusGeometry args={[0.66, 0.014, 16, 80]} />
        <meshStandardMaterial transparent opacity={0.6} toneMapped={false} />
      </mesh>

      {/* Orbiting motes / data fragments */}
      <points ref={motes}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[motePositions, 3]}
            count={MOTE_COUNT}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.035}
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      {/* Soft light she casts into the cabin. */}
      <pointLight color={CYAN} intensity={2.2} distance={6} decay={2} />
    </group>
  );
}

function applyTint(mesh: THREE.Mesh, color: THREE.Color, intensity: number) {
  const m = mesh.material as THREE.MeshStandardMaterial;
  m.color.copy(color);
  m.emissive.copy(color);
  m.emissiveIntensity = intensity;
}
