import { useEffect, useMemo, useRef, useState } from "react";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";
import { audio } from "../lib/audioEngine";

// ---------------------------------------------------------------------------
// The repair interaction: realign Aether's desynchronized neural nodes.
//
// Four nodes float in an arc in front of her, each spinning erratically out of
// phase. The player presses and *holds* a node — a containment ring fills as
// they hold it steady — until it locks into alignment with a confirming chime.
// Holding (not just clicking) gives the task physical weight: you are steadying
// pieces of a wounded mind with your hands.
//
// Only mounted during phase === "repair". Each lock calls store.alignNode(),
// which heals Aether and (on the final node) advances the scene.
// ---------------------------------------------------------------------------

const NODE_POSITIONS: [number, number, number][] = [
  [-1.5, -0.1, -2.4],
  [-0.55, 0.55, -2.4],
  [0.55, 0.55, -2.4],
  [1.5, -0.1, -2.4],
];

const CHARGE_RATE = 0.85; // ~1.2s of steady holding to lock a node

const RED = new THREE.Color("#ff6a6a");
const AMBER = new THREE.Color("#ffd27f");
const CYAN = new THREE.Color("#7fe7ff");

interface NodeProps {
  index: number;
  position: [number, number, number];
  locked: boolean;
  charging: boolean;
  charge: number;
  onGrab: (i: number) => void;
  onRelease: () => void;
}

function NeuralNode({
  index,
  position,
  locked,
  charging,
  charge,
  onGrab,
  onRelease,
}: NodeProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const tint = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const m = mesh.current;
    if (!m) return;

    if (locked) {
      // Settled: gentle, steady spin, calm cyan.
      m.rotation.x += 0.004;
      m.rotation.y += 0.006;
      m.position.set(position[0], position[1], position[2]);
      applyEmissive(m, CYAN, 2.2);
    } else {
      // Desynced: erratic tumble + a nervous positional wobble that *eases*
      // as the player charges it toward alignment.
      const calm = charging ? 1 - charge : 1;
      m.rotation.x += 0.05 * calm + 0.01;
      m.rotation.y -= 0.07 * calm;
      m.rotation.z += 0.04 * calm;
      const wob = 0.05 * calm;
      m.position.set(
        position[0] + Math.sin(t * 7 + index) * wob,
        position[1] + Math.cos(t * 6 + index) * wob,
        position[2],
      );
      // Color heals red→amber→cyan with charge; hover brightens.
      tint.copy(RED).lerp(charging ? CYAN : AMBER, charging ? charge : 0.0);
      applyEmissive(m, tint, hovered || charging ? 1.8 : 1.1);
    }

    // Containment ring scales/brightens with charge.
    if (ring.current) {
      const r = ring.current;
      r.lookAt(state.camera.position);
      const scale = 1 + charge * 0.5;
      r.scale.setScalar(scale);
      const rm = r.material as THREE.MeshBasicMaterial;
      rm.opacity = locked ? 0.9 : 0.25 + charge * 0.7;
      rm.color.copy(locked ? CYAN : charge > 0 ? CYAN : AMBER);
    }
  });

  return (
    <group>
      <mesh
        ref={mesh}
        position={position}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          if (!locked) onGrab(index);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          onRelease();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => {
          setHovered(false);
          onRelease();
        }}
      >
        <icosahedronGeometry args={[0.26, 0]} />
        <meshStandardMaterial
          color={RED}
          emissive={RED}
          emissiveIntensity={1.1}
          roughness={0.25}
          metalness={0.3}
          toneMapped={false}
        />
      </mesh>

      {/* Containment ring (billboarded). */}
      <mesh ref={ring} position={position}>
        <torusGeometry args={[0.42, 0.02, 12, 48]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.25} toneMapped={false} />
      </mesh>

      {/* Floating status label. */}
      <Html position={[position[0], position[1] - 0.55, position[2]]} center>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: 1,
            color: locked ? "#7fe7ff" : "#ffd27f",
            textShadow: "0 0 6px currentColor",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {locked ? `NODE ${index + 1} ✓ LOCKED` : `NODE ${index + 1} · DESYNC`}
        </div>
      </Html>
    </group>
  );
}

export function NeuralRepair() {
  const totalNodes = useGameStore((s) => s.totalNodes);
  const alignNode = useGameStore((s) => s.alignNode);

  const [locked, setLocked] = useState<boolean[]>(() =>
    new Array(totalNodes).fill(false),
  );
  const [chargingIndex, setChargingIndex] = useState<number | null>(null);
  const [charges, setCharges] = useState<number[]>(() =>
    new Array(totalNodes).fill(0),
  );
  const chargesRef = useRef(charges);
  chargesRef.current = charges;

  // Release on any global pointer-up so dragging off a node cancels cleanly.
  useEffect(() => {
    const release = () => setChargingIndex(null);
    window.addEventListener("pointerup", release);
    return () => window.removeEventListener("pointerup", release);
  }, []);

  useFrame((_, dt) => {
    if (chargingIndex === null) return;
    const i = chargingIndex;
    if (locked[i]) return;
    const next = Math.min(1, chargesRef.current[i] + dt * CHARGE_RATE);
    setCharges((prev) => {
      const copy = [...prev];
      copy[i] = next;
      return copy;
    });
    if (next >= 1) {
      // Lock it in.
      setLocked((prev) => {
        const copy = [...prev];
        copy[i] = true;
        return copy;
      });
      setChargingIndex(null);
      audio.confirm();
      alignNode();
    }
  });

  return (
    <group>
      {NODE_POSITIONS.slice(0, totalNodes).map((pos, i) => (
        <NeuralNode
          key={i}
          index={i}
          position={pos}
          locked={locked[i]}
          charging={chargingIndex === i}
          charge={charges[i]}
          onGrab={(idx) => {
            if (!locked[idx]) {
              setChargingIndex(idx);
              audio.beep(520 + idx * 60, 0.05, "sine", 0.1);
            }
          }}
          onRelease={() => setChargingIndex(null)}
        />
      ))}
    </group>
  );
}

function applyEmissive(mesh: THREE.Mesh, color: THREE.Color, intensity: number) {
  const m = mesh.material as THREE.MeshStandardMaterial;
  m.color.copy(color);
  m.emissive.copy(color);
  m.emissiveIntensity = intensity;
}
