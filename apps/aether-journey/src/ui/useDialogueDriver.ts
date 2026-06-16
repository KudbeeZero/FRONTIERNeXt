import { useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { DIALOGUE } from "../data/dialogue";
import { audio } from "../lib/audioEngine";
import { getVoiceClip } from "../lib/voice";

// ---------------------------------------------------------------------------
// Drives the active dialogue track: speaks each line (cast clip when one
// exists, else modulated Web Speech), fires glitch bursts for Aether's
// fragmented moments, sets `aetherSpeaking` (which the hologram + glitch FX
// react to), and advances cinematic lines.
//
// Advancing:
//   - GATE lines (`autoMs === 0`, always last in their track) hold until the
//     player performs the gating action — never auto-advance.
//   - Voiced cinematic lines advance when the cast clip *ends*, so a long take
//     is never cut off. A generous cap still advances if the clip is muted,
//     autoplay-blocked, or paused, so the story can't stall.
//   - Un-voiced cinematic lines advance on their authored `autoMs`.
// ---------------------------------------------------------------------------

/** Rough spoken duration (~14 chars/sec) — used to pace un-voiced lines and to
 *  cap voiced ones if their `ended` event never arrives. */
const estimateReadMs = (text: string) =>
  Math.max(1800, Math.round((text.length / 14) * 1000));

export function useDialogueDriver() {
  const phase = useGameStore((s) => s.phase);
  const dialogueIndex = useGameStore((s) => s.dialogueIndex);
  const advanceDialogue = useGameStore((s) => s.advanceDialogue);
  const setAetherSpeaking = useGameStore((s) => s.setAetherSpeaking);

  useEffect(() => {
    if (phase === "idle") return;
    const track = DIALOGUE[phase];
    if (!track) return;
    const idx = Math.min(dialogueIndex, track.length - 1);
    const line = track[idx];
    if (!line) return;

    const timers: number[] = [];
    const isLast = idx >= track.length - 1;
    // `cancelled` neutralises a late `ended` callback from a superseded line
    // (e.g. a synth `cancel()` firing `onend`) so it can't advance the wrong line.
    let cancelled = false;
    let advanced = false;
    const advance = () => {
      if (advanced || cancelled) return;
      advanced = true;
      advanceDialogue();
    };

    const spoken = line.speaker === "aether" || line.speaker === "archivist";
    const hasClip = !!(line.voiceId && getVoiceClip(line.voiceId));

    if (spoken) {
      const isAether = line.speaker === "aether";
      setAetherSpeaking(isAether);
      audio.speakLine(
        line.voiceId,
        line.text,
        isAether ? line.glitch : 0,
        // Voiced cinematic lines advance when the clip finishes (gates/last don't).
        !isLast ? advance : undefined,
      );
      if (isAether) {
        if (line.glitch > 0.4) audio.glitchBurst(line.glitch);
        // Ease the hologram's "speaking" energy back off; clip-driven lines
        // settle while the take plays, the next line re-arms it.
        const speakMs = hasClip
          ? estimateReadMs(line.text)
          : line.autoMs
            ? line.autoMs - 600
            : 2600;
        timers.push(
          window.setTimeout(() => setAetherSpeaking(false), Math.max(900, speakMs)),
        );
      }
    } else {
      setAetherSpeaking(false);
      if (line.speaker === "system") audio.beep(440, 0.06, "square", 0.08);
    }

    // Auto-advance non-gate cinematic lines (never past the end of the track).
    if (!isLast && line.autoMs !== 0) {
      const delay = hasClip
        ? estimateReadMs(line.text) + 6000 // safety cap; `ended` normally wins
        : line.autoMs ?? estimateReadMs(line.text);
      timers.push(window.setTimeout(advance, delay));
    }

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [phase, dialogueIndex, advanceDialogue, setAetherSpeaking]);
}
