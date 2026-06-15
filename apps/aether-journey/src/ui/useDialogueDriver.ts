import { useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { DIALOGUE } from "../data/dialogue";
import { audio } from "../lib/audioEngine";

// ---------------------------------------------------------------------------
// Drives the active dialogue track: speaks each line (modulated by its glitch
// level), fires audio glitch bursts for Aether's fragmented moments, sets the
// `aetherSpeaking` flag (which the hologram + glitch FX react to), and
// auto-advances cinematic lines. Lines with `autoMs === 0` are *waiting* lines —
// they hold until the player performs the gating action.
// ---------------------------------------------------------------------------

export function useDialogueDriver() {
  const phase = useGameStore((s) => s.phase);
  const dialogueIndex = useGameStore((s) => s.dialogueIndex);
  const advanceDialogue = useGameStore((s) => s.advanceDialogue);
  const setAetherSpeaking = useGameStore((s) => s.setAetherSpeaking);

  useEffect(() => {
    if (phase === "idle") return;
    const track = DIALOGUE[phase];
    if (!track) return;
    const line = track[Math.min(dialogueIndex, track.length - 1)];
    if (!line) return;

    const timers: number[] = [];

    if (line.speaker === "aether") {
      setAetherSpeaking(true);
      audio.speak(line.text, line.glitch);
      if (line.glitch > 0.4) audio.glitchBurst(line.glitch);
      // Stop the "speaking" energy a touch before the line auto-advances.
      const speakMs = line.autoMs ? line.autoMs - 600 : 2600;
      timers.push(
        window.setTimeout(() => setAetherSpeaking(false), Math.max(900, speakMs)),
      );
    } else {
      setAetherSpeaking(false);
      if (line.speaker === "system") audio.beep(440, 0.06, "square", 0.08);
    }

    // Auto-advance cinematic lines (but never past the end of the track).
    if (line.autoMs && line.autoMs > 0 && dialogueIndex < track.length - 1) {
      timers.push(window.setTimeout(() => advanceDialogue(), line.autoMs));
    }

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [phase, dialogueIndex, advanceDialogue, setAetherSpeaking]);
}
