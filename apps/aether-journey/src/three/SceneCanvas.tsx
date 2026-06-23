import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  Bloom,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { Cockpit } from "./Cockpit";
import { ForwardViewport } from "./ForwardViewport";
import { DustMotes } from "./DustMotes";
import { AetherHologram } from "./AetherHologram";
import { NeuralRepair } from "./NeuralRepair";
import { NavCircuit } from "./NavCircuit";
import { PowerBus } from "./PowerBus";
import { SignalDecode } from "./SignalDecode";
import { Descent } from "./Descent";
import { DiagnosticConsole } from "./DiagnosticConsole";
import { useGameStore } from "../store/gameStore";

// ---------------------------------------------------------------------------
// The 3D stage. A constrained orbit puts the player in the pilot's seat — you
// can look around the cabin, but you can't leave it. Cinematic lighting + a
// post chain (bloom, vignette, film grain) make even this first prototype feel
// expensive. The repair rig only mounts while it's relevant.
// ---------------------------------------------------------------------------

export function SceneCanvas() {
  const phase = useGameStore((s) => s.phase);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.25, 2.6], fov: 55, near: 0.1, far: 200 }}
    >
      {/* Deep-space void backdrop. */}
      <color attach="background" args={["#03060d"]} />
      <fog attach="fog" args={["#05080f", 12, 60]} />

      {/* --- Lighting rig --------------------------------------------------- */}
      {/* Low ambient so shadows stay rich. */}
      <ambientLight intensity={0.18} color="#33506b" />
      {/* Cold sunlight raking in through the forward viewport. */}
      <directionalLight
        position={[-6, 4, -8]}
        intensity={2.4}
        color="#cfe6ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      {/* Warm interior fill from below the console. */}
      <pointLight position={[0, -1, -2]} intensity={1.4} color="#ffb066" distance={8} decay={2} />
      {/* Faint cool rim from behind to separate the cockpit silhouette. */}
      <pointLight position={[0, 1.5, 3]} intensity={0.8} color="#3a6ea5" distance={10} decay={2} />

      {/* --- World --------------------------------------------------------- */}
      <ForwardViewport />
      <Cockpit />
      <DustMotes />
      <DiagnosticConsole />

      {/* Aether is present from the moment you wake. */}
      {phase !== "idle" && <AetherHologram />}

      {/* The repair rig is only live during the repair beat. */}
      {phase === "repair" && <NeuralRepair />}

      {/* Chapter 2: the nav-circuit board is only live during the rewiring beat. */}
      {phase === "rewiring" && <NavCircuit />}

      {/* Chapter 3: the power-bus triage board is only live during the triage beat. */}
      {phase === "triage" && <PowerBus />}

      {/* Chapter 4: the signal-decode board is only live during the decode beat. */}
      {phase === "decode" && <SignalDecode />}

      {/* Chapter 5: the descent burn board is only live during the descent beat. */}
      {phase === "descent" && <Descent />}

      {/* --- Camera control ------------------------------------------------ */}
      {/* Look-around is disabled during the repair beat: the nodes are a
          press-and-hold target, and an active orbit control competes for the
          same pointer/touch gesture — on touch the browser fires `pointercancel`
          when it claims the drag for the camera, which aborts the node's charge
          before it can lock. Freezing the camera here keeps the hold intact. */}
      <OrbitControls
        // Freeze look-around during the hands-on beats (repair hold + nav-circuit
        // clicks + power-bus controls + decode board) so the camera doesn't steal it.
        enabled={
          phase !== "repair" &&
          phase !== "rewiring" &&
          phase !== "triage" &&
          phase !== "decode" &&
          phase !== "descent"
        }
        target={[0, 0, -3]}
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={-0.35}
        minPolarAngle={Math.PI * 0.36}
        maxPolarAngle={Math.PI * 0.62}
        minAzimuthAngle={-0.55}
        maxAzimuthAngle={0.55}
      />

      {/* --- Post-processing ---------------------------------------------- */}
      <EffectComposer>
        <Bloom
          intensity={1.05}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.55}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.28} darkness={0.95} />
        <Noise opacity={0.045} premultiply />
      </EffectComposer>
    </Canvas>
  );
}
