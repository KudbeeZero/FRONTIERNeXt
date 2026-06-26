/**
 * Pins the entry-cinematic timing (pure phase/progress) + the "seen once" round
 * trip. The component is a thin renderer over these.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  introPhaseAt,
  introProgress,
  introSeen,
  markIntroSeen,
  INTRO_DURATION_MS,
} from "@/lib/introCinematic";

describe("introPhaseAt", () => {
  it("walks ignition → approach → title → done across the timeline", () => {
    expect(introPhaseAt(0)).toBe("ignition");
    expect(introPhaseAt(1199)).toBe("ignition");
    expect(introPhaseAt(1200)).toBe("approach");
    expect(introPhaseAt(2599)).toBe("approach");
    expect(introPhaseAt(2600)).toBe("title");
    expect(introPhaseAt(INTRO_DURATION_MS - 1)).toBe("title");
    expect(introPhaseAt(INTRO_DURATION_MS)).toBe("done");
    expect(introPhaseAt(99_999)).toBe("done");
  });
});

describe("introProgress", () => {
  it("is clamped 0..1 and monotonic", () => {
    expect(introProgress(-50)).toBe(0);
    expect(introProgress(0)).toBe(0);
    expect(introProgress(INTRO_DURATION_MS / 2)).toBeCloseTo(0.5, 5);
    expect(introProgress(INTRO_DURATION_MS)).toBe(1);
    expect(introProgress(INTRO_DURATION_MS * 3)).toBe(1);
  });
});

describe("intro seen state", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("is false until marked, then true", () => {
    expect(introSeen()).toBe(false);
    markIntroSeen();
    expect(introSeen()).toBe(true);
  });
});
