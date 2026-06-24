/**
 * client/src/lib/battle/incomingTelegraph.ts
 *
 * Pure timing for the pre-resolution "incoming attack" telegraph — the warning
 * that builds on a defender's plot in the final seconds before a pending battle
 * resolves. This is telegraphy in its truest sense: it tells you something is
 * about to hit *before* it does, so the resolution cinematic
 * (`GlobeBattleSequence`) lands as the payoff of a build-up rather than a
 * surprise.
 *
 * CONTRACT: pure — no clock, no Three.js. The caller passes `now` (server time).
 */

export interface IncomingTelegraph {
  /** True while the battle is within the lead-in window (and not yet resolved). */
  active: boolean;
  /** 0…1 — ramps up as resolution nears (closer ⇒ stronger). 0 when inactive. */
  intensity: number;
  /** Whole seconds until resolution (>= 0), for a countdown readout. */
  secondsLeft: number;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * @param resolveTs server timestamp (ms) the battle resolves at.
 * @param now       current server time (ms).
 * @param leadMs    how long before resolution the telegraph starts (default 8s).
 */
export function incomingTelegraph(
  resolveTs: number,
  now: number,
  leadMs = 8000,
): IncomingTelegraph {
  const left = resolveTs - now;
  const secondsLeft = left > 0 ? Math.ceil(left / 1000) : 0;
  // Inactive before the window, and at/after resolution (the cinematic takes over).
  if (!Number.isFinite(left) || left <= 0 || left > leadMs) {
    return { active: false, intensity: 0, secondsLeft };
  }
  // Closer to impact ⇒ higher intensity. left=leadMs → 0, left→0 → 1.
  return { active: true, intensity: clamp01(1 - left / leadMs), secondsLeft };
}
