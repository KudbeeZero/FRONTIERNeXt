// ---------------------------------------------------------------------------
// Text corruption helpers for Aether's damaged speech.
//
// `corrupt()` returns a glitched variant of a string given a severity 0..1:
// dropped characters, swapped glyphs, and zalgo-ish noise. Pure + deterministic
// per call (uses Math.random) so a render loop can re-roll it for a live flicker.
// ---------------------------------------------------------------------------

const GLITCH_GLYPHS = "▓▒░#@%&*<>/\\|=+×÷¦‡†§¤";

/** Replace a fraction of characters with glitch glyphs / drop them entirely. */
export function corrupt(text: string, severity: number): string {
  if (severity <= 0) return text;
  const s = Math.max(0, Math.min(1, severity));
  let out = "";
  for (const ch of text) {
    if (ch === " ") {
      out += ch;
      continue;
    }
    const roll = Math.random();
    if (roll < s * 0.08) {
      // Drop the character (a stutter / dropout).
      continue;
    }
    if (roll < s * 0.22) {
      // Swap for a glitch glyph.
      out += GLITCH_GLYPHS[Math.floor(Math.random() * GLITCH_GLYPHS.length)];
      continue;
    }
    out += ch;
  }
  return out;
}

/** Occasionally returns true — used to trigger intermittent flicker frames. */
export function shouldFlicker(severity: number): boolean {
  return Math.random() < severity * 0.5;
}
