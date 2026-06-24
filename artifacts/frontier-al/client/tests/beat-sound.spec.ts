/**
 * client/tests/beat-sound.spec.ts
 *
 * Proves the pure beat → synth-cue mapping: the punchy beats get cues in sane
 * ranges, everything else is silent, and impact is a noise burst.
 */
import { describe, it, expect } from "vitest";
import { beatSound } from "../src/lib/battle/beatSound";

describe("beatSound", () => {
  it("gives cues to launch / impact / swing / resolve only", () => {
    for (const k of ["launch", "impact", "swing", "resolve"]) {
      expect(beatSound(k)).not.toBeNull();
    }
    for (const k of ["muster", "lock", "transit", "brace", "clash", "aftermath"]) {
      expect(beatSound(k)).toBeNull();
    }
  });

  it("impact is a noise burst; the others are tones", () => {
    expect(beatSound("impact")!.wave).toBe("noise");
    expect(beatSound("launch")!.wave).toBe("tone");
    expect(beatSound("swing")!.wave).toBe("tone");
    expect(beatSound("resolve")!.wave).toBe("tone");
  });

  it("every cue has a positive duration and a gain within 0…1", () => {
    for (const k of ["launch", "impact", "swing", "resolve"]) {
      const s = beatSound(k)!;
      expect(s.durationMs).toBeGreaterThan(0);
      expect(s.gain).toBeGreaterThan(0);
      expect(s.gain).toBeLessThanOrEqual(1);
    }
  });

  it("returns null for an unknown beat kind", () => {
    expect(beatSound("nope")).toBeNull();
  });
});
