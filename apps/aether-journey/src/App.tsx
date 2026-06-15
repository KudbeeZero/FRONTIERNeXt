import { useState } from "react";
import { SceneCanvas } from "./three/SceneCanvas";
import { StatusHUD } from "./ui/StatusHUD";
import { ObjectiveTracker } from "./ui/ObjectiveTracker";
import { DialogueOverlay } from "./ui/DialogueOverlay";
import { OnchainLedger } from "./ui/OnchainLedger";
import { StartGate, WakeFade, EndCard } from "./ui/CinematicLayer";
import { useDialogueDriver } from "./ui/useDialogueDriver";
import { useGameStore } from "./store/gameStore";
import { audio } from "./lib/audioEngine";

// ---------------------------------------------------------------------------
// FRONTIER: Aether's Journey — Phase 1 root.
//
// The 3D cockpit is the persistent backdrop; the HUD + dialogue overlays sit on
// top once the player wakes. The dialogue driver runs the narrative beats. The
// whole frame wears a CRT scanline veil for cabin-feed texture.
// ---------------------------------------------------------------------------

function MuteButton() {
  const [muted, setMuted] = useState(false);
  return (
    <button
      onClick={() => {
        const next = !muted;
        setMuted(next);
        audio.setMuted(next);
        if (next) audio.stopSpeaking();
      }}
      className="holo-panel pointer-events-auto absolute bottom-4 left-4 z-30 rounded-md px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-aether-core text-glow transition hover:bg-aether-core/10"
      aria-label={muted ? "Unmute" : "Mute"}
    >
      {muted ? "🔇 muted" : "🔊 audio"}
    </button>
  );
}

export default function App() {
  // Drive the active dialogue track (speech, glitch FX, auto-advance).
  useDialogueDriver();
  const phase = useGameStore((s) => s.phase);
  const playing = phase !== "idle";

  return (
    <div className="scanlines relative h-full w-full overflow-hidden bg-[#03060d]">
      {/* Persistent 3D cockpit. */}
      <SceneCanvas />

      {/* In-flight HUD + narrative (only once awake). */}
      {playing && (
        <>
          <StatusHUD />
          <ObjectiveTracker />
          <DialogueOverlay />
          <OnchainLedger />
          <MuteButton />
        </>
      )}

      {/* Cinematic bookends. */}
      <WakeFade />
      <StartGate />
      <EndCard />
    </div>
  );
}
