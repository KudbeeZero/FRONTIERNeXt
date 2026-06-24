/**
 * shared/battle-sequence-tuning.ts
 *
 * Centralised tempo + intensity constants for the FRONTIER Battle Sequence
 * Engine (`battle-sequence.ts`). Change these to re-time or re-weight the
 * cinematic without touching the engine logic — exactly as `engine/battle/
 * tuning.ts` is to `resolve.ts`.
 *
 * All durations are in milliseconds. The sequence is a gapless chain of 10
 * beats, so the total cinematic length is just the sum of the (data-scaled)
 * beat durations below.
 *
 * CONTRACT: pure constants — no logic, no imports.
 */

// ── Beat durations (ms) ───────────────────────────────────────────────────────

/** 1. MUSTER — attacker charges up. Base, plus a little per committed troop. */
export const MUSTER_BASE_MS = 700;
export const MUSTER_PER_TROOP_MS = 4;
export const MUSTER_MAX_MS = 1500;

/** 2. LOCK — the telegraph line reaches from attacker to defender. */
export const LOCK_MS = 500;

/** 3. LAUNCH — the strike leaves the source plot. */
export const LAUNCH_MS = 350;

/**
 * 4. TRANSIT — the strike travels the great-circle arc. Scales with the
 * angular distance between the two plots (0…π radians) so far attacks visibly
 * take longer to arrive — the single most "connected" beat.
 */
export const TRANSIT_BASE_MS = 500;
export const TRANSIT_PER_RAD_MS = 1200;
export const TRANSIT_MAX_MS = 2600;

/** 5. BRACE — defender raises shields / fortifications. */
export const BRACE_MS = 450;

/** 6. IMPACT — the strike lands. */
export const IMPACT_MS = 450;

/** 7. CLASH — attacker power vs defender power collide. */
export const CLASH_MS = 800;

/**
 * 8. SWING — the randFactor luck swing. Bigger swings linger longer; a swing
 * that actually flipped the result lingers longer still (see SWING_FLIP_BONUS_MS).
 */
export const SWING_BASE_MS = 400;
export const SWING_PER_FACTOR_MS = 40; // × |randFactor| (0…RAND_FACTOR_MAX)
export const SWING_FLIP_BONUS_MS = 350;

/** 9. RESOLVE — VICTORY / DEFENSE HELD locks in. */
export const RESOLVE_MS = 700;

/** 10. AFTERMATH — capture + spoils stream home, or the defender holds. */
export const AFTERMATH_MS = 1200;

// ── Intensity saturation constants ─────────────────────────────────────────────
// Intensities are 0…1 dramatic weights that drive FX scale/volume. Unbounded
// inputs (troops, power, spoils, fortification) are mapped through a soft
// saturating curve x/(x+k); a larger k means the input must be larger to feel
// "intense". These are knobs, not physics.

export const TROOP_INTENSITY_K = 60;
export const POWER_INTENSITY_K = 120;
export const SPOILS_INTENSITY_K = 80;
export const FORT_INTENSITY_K = 6;

/** Floor so even a trivial beat renders *something* (never a dead 0-intensity FX). */
export const MIN_INTENSITY = 0.12;
