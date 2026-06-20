/**
 * server/engine/narrative/whispers.spec.ts
 *
 * Proves the Comm Terminal whisper generator is pure + deterministic: stable per
 * (player, window), distinct per player ("hear things others won't"), advances
 * across windows, stays within the intensity enum, and tunes toward stronger
 * reception at higher terminal level.
 */
import { describe, it, expect } from "vitest";
import {
  generateWhisper,
  whisperBucket,
  commTerminalLevel,
  WHISPER_WINDOW_MS,
  type WhisperIntensity,
} from "./whispers";

const INTENSITIES: WhisperIntensity[] = ["faint", "clear", "surge"];

describe("whisper generator", () => {
  it("is deterministic within the same (player, window)", () => {
    const t = 1_000_000;
    const a = generateWhisper("player-A", t);
    const b = generateWhisper("player-A", t + 100); // same window
    expect(a).toEqual(b);
  });

  it("gives different players different streams at the same moment", () => {
    const t = 1_000_000;
    const a = generateWhisper("player-A", t);
    const b = generateWhisper("player-B", t);
    // Overwhelmingly likely to differ; assert the id (player-seeded) differs.
    expect(a.id).not.toEqual(b.id);
  });

  it("advances to a new whisper in the next window", () => {
    const base = 5 * WHISPER_WINDOW_MS;
    const a = generateWhisper("player-A", base);
    const b = generateWhisper("player-A", base + WHISPER_WINDOW_MS);
    expect(a.bucket).not.toEqual(b.bucket);
  });

  it("always returns a valid intensity and non-empty text", () => {
    for (let i = 0; i < 200; i++) {
      const w = generateWhisper("p" + i, i * WHISPER_WINDOW_MS);
      expect(INTENSITIES).toContain(w.intensity);
      expect(w.text.length).toBeGreaterThan(0);
    }
  });

  it("buckets are stable within a window and increment across windows", () => {
    expect(whisperBucket(0)).toBe(0);
    expect(whisperBucket(WHISPER_WINDOW_MS - 1)).toBe(0);
    expect(whisperBucket(WHISPER_WINDOW_MS)).toBe(1);
  });

  it("clamps absurd levels without throwing", () => {
    const t = 42 * WHISPER_WINDOW_MS;
    expect(() => generateWhisper("p", t, { level: 999 })).not.toThrow();
    expect(() => generateWhisper("p", t, { level: -5 })).not.toThrow();
  });

  it("commTerminalLevel: unowned vs owned (max level across the player's plots)", () => {
    const parcels = [
      { ownerId: "me", improvements: [{ type: "electricity", level: 1 }, { type: "comm_terminal", level: 1 }] },
      { ownerId: "me", improvements: [{ type: "comm_terminal", level: 3 }] },
      { ownerId: "other", improvements: [{ type: "comm_terminal", level: 3 }] }, // not mine
      { ownerId: "me", improvements: null },
    ];
    expect(commTerminalLevel(parcels, "me")).toEqual({ owned: true, level: 3 });
    expect(commTerminalLevel(parcels, "nobody")).toEqual({ owned: false, level: 0 });
    expect(commTerminalLevel([], "me")).toEqual({ owned: false, level: 0 });
  });

  it("higher level tunes in more clear/surge transmissions over a sample", () => {
    const strong = (level: number) => {
      let count = 0;
      for (let i = 0; i < 400; i++) {
        const w = generateWhisper("sampler", i * WHISPER_WINDOW_MS, { level });
        if (w.intensity !== "faint") count++;
      }
      return count;
    };
    expect(strong(3)).toBeGreaterThan(strong(1));
  });
});
