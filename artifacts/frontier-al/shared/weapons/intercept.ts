/**
 * shared/weapons/intercept.ts
 *
 * The missile-defense solver: "missiles coming your way get detected and shot
 * down." Given an incoming offensive trajectory and a deployed defensive battery,
 * it models radar detection, the engagement window (range + altitude ceiling +
 * reaction time + interceptor flyout), and a probability of kill (Pk).
 *
 * Deterministic: `solveIntercept` returns geometry + Pk with no randomness;
 * `rollIntercept` resolves a hit/miss from Pk using a seedable hash so outcomes
 * are replayable (matching the battle engine's seeded-RNG approach).
 */

import type { WeaponSpec } from "./types";
import { isDefenseSpec } from "./types";
import type { GeoPoint } from "./scale";
import { greatCircleKm } from "./scale";
import { positionAt, timeOfFlightMs } from "./ballistics";

export interface InterceptInput {
  incoming: WeaponSpec;
  /** Incoming launch point. */
  from: GeoPoint;
  /** Incoming target (impact) point. */
  to: GeoPoint;
  /** Defensive battery spec (must carry an intercept envelope). */
  defense: WeaponSpec;
  /** Where the battery sits. */
  defenseAt: GeoPoint;
}

export interface InterceptResult {
  /** Radar saw the track at some point along its flight. */
  detected: boolean;
  /** A feasible engagement was found and (probabilistically) succeeds. */
  intercepted: boolean;
  /** Probability of kill the engagement would have (0 when infeasible). */
  pk: number;
  /** Normalized progress t∈[0,1] of the incoming flight at the intercept point. */
  tIntercept?: number;
  /** Geo position of the intercept. */
  interceptAt?: GeoPoint;
  /** Milliseconds after incoming launch that the intercept occurs. */
  timeToInterceptMs?: number;
}

/** Detection range extends a bit beyond the engagement (kill) range. */
const DETECTION_RANGE_MULTIPLIER = 1.35;
const SAMPLES = 64;

/**
 * Solve the engagement geometry. Walks the incoming trajectory, finds the
 * earliest sample the battery can both detect and physically reach (after its
 * reaction time and interceptor flyout), and scores a Pk for that engagement.
 */
export function solveIntercept(input: InterceptInput): InterceptResult {
  const { incoming, from, to, defense, defenseAt } = input;

  if (!isDefenseSpec(defense)) {
    return { detected: false, intercepted: false, pk: 0 };
  }
  const env = defense.intercept;
  const distanceKm = greatCircleKm(from, to);
  const tof = timeOfFlightMs(incoming, distanceKm);
  const detectionRangeKm = env.interceptRangeKm * DETECTION_RANGE_MULTIPLIER;

  let detected = false;

  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const p = positionAt(incoming, from, to, t, distanceKm);
    const groundKm = greatCircleKm(defenseAt, { lat: p.lat, lng: p.lng });
    // slant range from the battery to the track (ground + altitude)
    const slantKm = Math.hypot(groundKm, p.altKm);

    if (slantKm <= detectionRangeKm) detected = true;

    const sampleTimeMs = t * tof;
    const withinEnvelope = slantKm <= env.interceptRangeKm && p.altKm <= env.maxAltKm;
    if (!withinEnvelope) continue;

    // Interceptor cannot fly before reaction time has elapsed.
    if (sampleTimeMs < env.reactionMs) continue;

    // Can the interceptor physically reach this point before the track passes it?
    // slantKm·1000 = metres; /speed(m/s) = seconds; ·1000 = ms ⇒ km·1e6/speed.
    const interceptorFlyoutMs = (slantKm * 1_000_000) / env.interceptorSpeedMps;
    if (env.reactionMs + interceptorFlyoutMs > sampleTimeMs) continue;

    // Feasible engagement at the earliest such sample.
    const pk = computePk(incoming, defense, p.altKm, env, slantKm);
    return {
      detected: true,
      intercepted: pk > 0, // geometry feasible; rollIntercept resolves the hit
      pk,
      tIntercept: t,
      interceptAt: { lat: p.lat, lng: p.lng },
      timeToInterceptMs: Math.round(sampleTimeMs),
    };
  }

  return { detected, intercepted: false, pk: 0 };
}

/** Profiles that are intrinsically harder to intercept. */
const PROFILE_EVASION: Record<string, number> = {
  boost_glide: 0.35, // hypersonic glide — very hard
  cruise_low: 0.2, // low + terrain-following
  ballistic: 0.05,
  parabolic: 0.0,
};

/**
 * Probability of kill for a feasible engagement. Starts from the battery's basePk
 * and adjusts for closing-speed advantage, the incoming threat's evasion
 * (profile + guidance), and how close the engagement is to the battery's altitude
 * ceiling (edge-of-envelope shots are harder).
 */
function computePk(
  incoming: WeaponSpec,
  defense: WeaponSpec,
  altKm: number,
  env: NonNullable<WeaponSpec["intercept"]>,
  slantKm: number,
): number {
  // Closing-speed advantage: a faster interceptor relative to the threat helps.
  const speedRatio = env.interceptorSpeedMps / incoming.speedMps;
  const speedFactor = clamp(0.6 + 0.4 * Math.min(speedRatio, 2), 0.6, 1.4);

  // Threat evasion from flight profile; better-guided threats evade a touch more.
  const profileEvasion = PROFILE_EVASION[incoming.flightProfile] ?? 0.1;
  const guidanceEvasion = incoming.guidance === "gps" || incoming.guidance === "radar_homing" ? 0.05 : 0;
  const evasion = clamp(profileEvasion + guidanceEvasion, 0, 0.6);

  // Edge-of-envelope penalty: shots near the altitude ceiling or max range bleed Pk.
  const altMargin = clamp(1 - altKm / env.maxAltKm, 0, 1);
  const rangeMargin = clamp(1 - slantKm / env.interceptRangeKm, 0, 1);
  const envelopeFactor = 0.7 + 0.3 * Math.min(altMargin + rangeMargin, 1);

  const pk = env.basePk * speedFactor * (1 - evasion) * envelopeFactor;
  return clamp(pk, 0.02, 0.98);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Deterministically resolve a hit/miss from a Pk and an integer seed (e.g. a
 * battle/engagement id hash). Same seed + Pk ⇒ same outcome (replayable).
 */
export function rollIntercept(pk: number, seed: number): boolean {
  // xorshift-ish hash → uniform in [0,1)
  let x = (seed | 0) ^ 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const u = ((x >>> 0) % 1_000_000) / 1_000_000;
  return u < pk;
}
