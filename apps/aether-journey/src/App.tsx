import { SceneCanvas } from "./three/SceneCanvas";
import { DialogueOverlay } from "./ui/DialogueOverlay";
import { StartGate, WakeFade, EndCard } from "./ui/CinematicLayer";
import { HudDock } from "./ui/HudDock";
import { Subtitles } from "./ui/Subtitles";
import { useDialogueDriver } from "./ui/useDialogueDriver";
import { useRunStats } from "./store/settingsStore";
import { useGameStore } from "./store/gameStore";

// ---------------------------------------------------------------------------
// FRONTIER: Aether's Journey — Phase 1 root.
//
// The 3D cockpit is the persistent backdrop. Once the player wakes, a single
// mobile-first HudDock (the bottom bar + collapsible sheets) carries every HUD
// surface — objective, ship status, ledger, settings, pause — so nothing clutters
// the corners or blocks the in-world boards. The dialogue overlay sits just above
// the dock bar. The whole frame wears a CRT scanline veil for cabin-feed texture.
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

      {/* In-flight narrative + the single consolidated HUD dock (only once awake). */}
      {playing && (
        <>
          <DialogueOverlay />
          <Subtitles />
          <HudDock />
        </>
      )}

      {/* Cinematic bookends. */}
      <WakeFade />
      <StartGate />
      <EndCard />
    </div>
  );
}
