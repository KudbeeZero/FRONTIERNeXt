/**
 * client/src/lib/introCinematic.ts
 *
 * Timing + "seen" state for the entry cinematic that replaces the old launch
 * counter: a short orbital push-in → title → hand-off to the faction-select gate.
 * The phase math is pure (testable); the component just renders the current phase.
 * Shown once per browser, and skippable.
 */
export const INTRO_DURATION_MS = 4200;

export type IntroPhase = "ignition" | "approach" | "title" | "done";

/** Phase of the intro at a given elapsed time. Pure + total over the timeline. */
export function introPhaseAt(elapsedMs: number): IntroPhase {
  if (elapsedMs < 1200) return "ignition";   // deep space, engines light
  if (elapsedMs < 2600) return "approach";   // planet rushes up
  if (elapsedMs < INTRO_DURATION_MS) return "title"; // title card holds
  return "done";
}

/** 0→1 progress through the whole cinematic (clamped). */
export function introProgress(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs >= INTRO_DURATION_MS) return 1;
  return elapsedMs / INTRO_DURATION_MS;
}

const INTRO_KEY = "frontier_intro_seen";

export function introSeen(): boolean {
  if (typeof window === "undefined") return true; // SSR: never block
  return window.localStorage.getItem(INTRO_KEY) === "1";
}

export function markIntroSeen(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INTRO_KEY, "1");
}
