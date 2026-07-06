/**
 * client/src/lib/battle/musterState.ts
 *
 * Pure timing for the attacker-side "War Council Muster" build-up — the other
 * half of the pending-battle story `incomingTelegraph` tells for the defender.
 * Where the defender's telegraph only activates in the final lead-in seconds,
 * the muster is active for the *whole* pending window: a globe covered in
 * brewing wars should read at a glance long before any single battle nears
 * resolution.
 *
 * Troop scaling reuses the same soft-saturating curve (`x / (x + k)`, k=60)
 * as the `muster` beat inside the resolution cinematic itself
 * (`shared/battle-sequence.ts` / `TROOP_INTENSITY_K`), so the build-up and the
 * payoff read as the same fight at two different moments.
 *
 * CONTRACT: pure — no clock, no Three.js. The caller passes `now` (server time).
 */

const MIN_GLOW = 0.15; // floor once ramped-in, so the staging glow is never fully invisible
const TROOP_INTENSITY_K = 60; // matches shared/battle-sequence-tuning.ts TROOP_INTENSITY_K

export interface MusterState {
  /** True for the whole pending window (startTs..resolveTs), false once resolved (the cinematic takes over). */
  active: boolean;
  /** 0..1 — soft-saturating troop-count scale. Constant for a given battle. */
  troopScale: number;
  /** 0..1 — staging glow / particle-column strength. Ramps in at muster start, then holds at the troop-scaled level for the rest of the window. */
  glowIntensity: number;
  /** 0..1 — fraction of the pending window elapsed; drives the charging-arc spark toward the target. */
  creepProgress: number;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function saturate(x: number, k: number): number {
  const v = x <= 0 || !Number.isFinite(x) ? 0 : x / (x + k);
  return clamp01(v);
}

/**
 * @param startTs         server timestamp (ms) the battle was launched at.
 * @param resolveTs       server timestamp (ms) the battle resolves at.
 * @param now             current server time (ms).
 * @param troopsCommitted real troop count committed to the attack.
 * @param glowRampMs      how long the glow takes to ramp in from muster start (default 2s).
 */
export function musterState(
  startTs: number,
  resolveTs: number,
  now: number,
  troopsCommitted: number,
  glowRampMs = 2000,
): MusterState {
  const total = resolveTs - startTs;
  const elapsed = now - startTs;
  if (
    !Number.isFinite(total) ||
    !Number.isFinite(elapsed) ||
    total <= 0 ||
    elapsed < 0 ||
    elapsed >= total
  ) {
    return { active: false, troopScale: 0, glowIntensity: 0, creepProgress: 0 };
  }

  const troopScale = saturate(Math.max(0, troopsCommitted), TROOP_INTENSITY_K);
  const rampIn = clamp01(elapsed / Math.min(glowRampMs, total));
  const glowIntensity = clamp01(Math.max(MIN_GLOW, troopScale) * rampIn);
  const creepProgress = clamp01(elapsed / total);

  return { active: true, troopScale, glowIntensity, creepProgress };
}
