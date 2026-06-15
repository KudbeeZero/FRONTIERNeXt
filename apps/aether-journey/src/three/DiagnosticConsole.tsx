import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";
import { DIALOGUE } from "../data/dialogue";
import { audio } from "../lib/audioEngine";

// ---------------------------------------------------------------------------
// A holographic diagnostic control on the console to the pilot's right.
//
// It only becomes "live" (pulsing, clickable) once Aether has asked the player
// to scan her — i.e. on the final, waiting line of the wake-up track. Touching
// it runs the diagnostic and moves the story forward. This is the first
// "physical control" the player operates.
// ---------------------------------------------------------------------------

export function DiagnosticConsole() {
  const phase = useGameStore((s) => s.phase);
  const dialogueIndex = useGameStore((s) => s.dialogueIndex);
  const enterDiagnostic = useGameStore((s) => s.enterDiagnostic);

  const mesh = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Live only on the waiting final line of the waking track.
  const actionable =
    phase === "waking" && dialogueIndex >= DIALOGUE.waking.length - 1;

  useFrame((state) => {
    if (!mesh.current) return;
    const m = mesh.current.material as THREE.MeshStandardMaterial;
    if (actionable) {
      const pulse = 1.4 + Math.sin(state.clock.elapsedTime * 4) * 0.8;
      m.emissiveIntensity = hovered ? pulse + 1 : pulse;
    } else {
      m.emissiveIntensity = 0.4;
    }
  });

  return (
    <group position={[1.7, -0.75, -2.9]} rotation={[-0.5, -0.2, 0]}>
      <mesh
        ref={mesh}
        onPointerOver={() => actionable && setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (!actionable) return;
          audio.beep(740, 0.12, "sine", 0.18);
          audio.glitchBurst(0.4);
          enterDiagnostic();
          setHovered(false);
        }}
      >
        <cylinderGeometry args={[0.22, 0.22, 0.06, 32]} />
        <meshStandardMaterial
          color="#1de9ff"
          emissive="#1de9ff"
          emissiveIntensity={0.4}
          metalness={0.4}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>

      {actionable && (
        <Html position={[0, 0.32, 0]} center>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: 2,
              color: "#7fe7ff",
              textShadow: "0 0 8px #1de9ff",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              userSelect: "none",
              animation: "none",
            }}
          >
            ◇ RUN DIAGNOSTIC
          </div>
        </Html>
      )}
    </group>
  );
}
