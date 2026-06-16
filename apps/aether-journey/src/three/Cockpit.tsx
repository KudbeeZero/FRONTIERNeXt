import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// The Aether Voyager's cockpit interior.
//
// Built from simple primitives but dressed with PBR materials, emissive trim,
// and a forward opening that frames the viewport. The cabin wraps the camera so
// constrained orbit feels like turning your head. One panel is visibly damaged —
// it flickers and bleeds red, environmental storytelling that the ship has
// already been through hell and is still fighting toward Mars.
// ---------------------------------------------------------------------------

const HULL = "#0b1320";
const HULL_DARK = "#070c16";
const TRIM = "#0e2233";

function Hull() {
  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -1.5, -1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 12]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.85} metalness={0.4} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, 2.2, -1]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 12]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.7} metalness={0.5} />
      </mesh>
      {/* Back wall (behind the pilot) */}
      <mesh position={[0, 0.3, 4]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[10, 6]} />
        <meshStandardMaterial color={HULL} roughness={0.6} metalness={0.55} />
      </mesh>
      {/* Side walls */}
      <mesh position={[-4.2, 0.3, -1]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial color={HULL} roughness={0.6} metalness={0.55} />
      </mesh>
      <mesh position={[4.2, 0.3, -1]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial color={HULL} roughness={0.6} metalness={0.55} />
      </mesh>
    </group>
  );
}

/** The forward window frame around the viewport opening (-Z). */
function ViewportFrame() {
  const frameMat = (
    <meshStandardMaterial color={HULL} roughness={0.45} metalness={0.7} />
  );
  return (
    <group position={[0, 0.3, -5.4]}>
      {/* top */}
      <mesh position={[0, 2.0, 0]}>
        <boxGeometry args={[8.4, 1.0, 0.5]} />
        {frameMat}
      </mesh>
      {/* bottom (dashboard lip) */}
      <mesh position={[0, -1.9, 0]}>
        <boxGeometry args={[8.4, 1.2, 0.6]} />
        {frameMat}
      </mesh>
      {/* left */}
      <mesh position={[-3.7, 0, 0]}>
        <boxGeometry args={[1.0, 5.0, 0.5]} />
        {frameMat}
      </mesh>
      {/* right */}
      <mesh position={[3.7, 0, 0]}>
        <boxGeometry args={[1.0, 5.0, 0.5]} />
        {frameMat}
      </mesh>
      {/* glowing inner sill — the cabin's signature cyan trim */}
      <mesh position={[0, -1.35, 0.28]}>
        <boxGeometry args={[6.6, 0.06, 0.06]} />
        <meshStandardMaterial
          color="#7fe7ff"
          emissive="#7fe7ff"
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** Main console below the window, with emissive holographic readout strips. */
function Console() {
  return (
    <group position={[0, -1.15, -3.4]}>
      {/* Console body, raked toward the pilot. */}
      <mesh rotation={[-0.5, 0, 0]} castShadow>
        <boxGeometry args={[5.2, 1.6, 0.25]} />
        <meshStandardMaterial color={TRIM} roughness={0.4} metalness={0.8} />
      </mesh>
      {/* Cyan readout strips. */}
      {[-1.6, -0.5, 0.6, 1.7].map((x, i) => (
        <mesh key={i} position={[x, 0.18, 0.46]} rotation={[-0.5, 0, 0]}>
          <planeGeometry args={[0.9, 0.16]} />
          <meshStandardMaterial
            color="#1de9ff"
            emissive="#1de9ff"
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** A damaged side panel — flickers and bleeds warning-red. */
function DamagedPanel() {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    if (!mat.current) return;
    const t = state.clock.elapsedTime;
    // Irregular flicker: mostly dim, with sharp stutters.
    const base = 0.4 + Math.sin(t * 2.3) * 0.2;
    const stutter = Math.random() < 0.06 ? Math.random() * 2.2 : 0;
    mat.current.emissiveIntensity = Math.max(0.05, base + stutter);
  });
  return (
    <group position={[-3.9, 0.4, -2]} rotation={[0, Math.PI / 2, 0]}>
      <mesh>
        <planeGeometry args={[1.5, 1.0]} />
        <meshStandardMaterial color="#1a0606" roughness={0.5} metalness={0.6} />
      </mesh>
      {/* Cracked warning glyph strip. */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[1.2, 0.18]} />
        <meshStandardMaterial
          ref={mat}
          color="#ff3b3b"
          emissive="#ff2a2a"
          emissiveIntensity={0.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** A loose conduit sparking softly on the right — more lived-in damage. */
function StarboardTrim() {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    if (mat.current)
      mat.current.emissiveIntensity = 0.8 + Math.sin(state.clock.elapsedTime * 5) * 0.5;
  });
  return (
    <mesh position={[3.95, 0.5, -1]} rotation={[0, -Math.PI / 2, 0]}>
      <boxGeometry args={[3.5, 0.05, 0.05]} />
      <meshStandardMaterial
        ref={mat}
        color="#ffb347"
        emissive="#ffb347"
        emissiveIntensity={1}
        toneMapped={false}
      />
    </mesh>
  );
}

export function Cockpit() {
  return (
    <group>
      <Hull />
      <ViewportFrame />
      <Console />
      <DamagedPanel />
      <StarboardTrim />
    </group>
  );
}
