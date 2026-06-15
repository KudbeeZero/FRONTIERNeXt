import { SceneCanvas } from "./three/SceneCanvas";
import { StatusHUD } from "./ui/StatusHUD";
import { ObjectiveTracker } from "./ui/ObjectiveTracker";
import { DialogueOverlay } from "./ui/DialogueOverlay";
import { OnchainLedger } from "./ui/OnchainLedger";
import { StartGate, WakeFade, EndCard } from "./ui/CinematicLayer";
import { MenuLayer } from "./ui/MenuLayer";
import { useDialogueDriver } from "./ui/useDialogueDriver";
import { useRunStats } from "./store/settingsStore";
import { useGameStore } from "./store/gameStore";

// ---------------------------------------------------------------------------
// FRONTIER: Aether's Journey — Phase 1 root.
//
// The 3D cockpit is the persistent backdrop; the HUD + dialogue overlays sit on
// top once the player wakes. The dialogue driver runs the narrative beats; the
// menu layer (☰ / Esc) provides pause + settings. The whole frame wears a CRT
// scanline veil for cabin-feed texture.
// ---------------------------------------------------------------------------

export default function App() {
  // Drive the active dialogue track (speech, glitch FX, auto-advance).
  useDialogueDriver();
  // Record local best-run stats (repair time, final stability).
  useRunStats();
  const phase = useGameStore((s) => s.phase);
  const playing = phase !== "idle";

  return (
    <div className="scanlines relative h-full w-full overflow-hidden bg-[#03060d]">
      {/* Persistent 3D cockpit. */}
      <SceneCanvas />

      {/* In-flight HUD + narrative + menu (only once awake). */}
      {playing && (
        <>
          <StatusHUD />
          <ObjectiveTracker />
          <DialogueOverlay />
          <OnchainLedger />
          <MenuLayer />
        </>
      )}

      {/* Cinematic bookends. */}
      <WakeFade />
      <StartGate />
      <EndCard />
    </div>
  );
}
