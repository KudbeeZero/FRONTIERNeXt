/**
 * client/src/lib/battle/beatSound.ts
 *
 * Pure mapping from a battle beat to a synth cue spec — the audio half of the
 * sequence. Only the punchy beats get a cue (launch / impact / swing / resolve);
 * the rest are silent so the soundtrack reads as hits, not a drone. Cues are
 * synthesised at play time (see `battleSoundPlayer`) so there are NO audio
 * assets to ship.
 *
 * CONTRACT: pure.
 */
export interface BeatSoundSpec {
  /** A pitched tone, or a noise burst (impact). */
  wave: "tone" | "noise";
  /** Start frequency (Hz) for tones (ignored for noise). */
  freq: number;
  /** Optional glide target (Hz) — a sweep across the duration. */
  sweepTo?: number;
  durationMs: number;
  /** Peak gain, 0…1. */
  gain: number;
}

/** The synth cue for a beat, or null when the beat is silent. */
export function beatSound(kind: string): BeatSoundSpec | null {
  switch (kind) {
    case "launch":
      return { wave: "tone", freq: 220, sweepTo: 760, durationMs: 220, gain: 0.16 };
    case "impact":
      return { wave: "noise", freq: 0, durationMs: 200, gain: 0.32 };
    case "swing":
      return { wave: "tone", freq: 700, sweepTo: 1040, durationMs: 160, gain: 0.18 };
    case "resolve":
      return { wave: "tone", freq: 523, sweepTo: 784, durationMs: 320, gain: 0.2 };
    default:
      return null;
  }
}
