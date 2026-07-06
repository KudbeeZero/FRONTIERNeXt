/**
 * client/src/lib/globe/battleSequencePlayback.ts
 *
 * Pure mapping from the Battle Sequence timeline (`@shared/battle-sequence`) to
 * the concrete render channels the globe cinematic draws at a given instant:
 * the traveling strike, the telegraph/lock line, the impact flash, the luck-
 * swing pulse, the outcome ring, and the capture colour-fill. The R3F layer is
 * a thin renderer over this; ALL the timing math lives (and is tested) here.
 *
 * CONTRACT: pure — no React, no Three.js, no clock. `elapsedMs` is supplied by
 * the caller (driven off the server clock).
 */

import { beatAt, type BattleSequence, type BattleBeatKind } from "@shared/battle-sequence";

export interface GlobePlaybackState {
  /** 0…1 fraction the strike has traveled along the arc (0 pre-launch, 1 at impact). */
  arcProgress: number;
  /** 0…1 telegraph/lock line opacity (ramps in on lock, holds, fades at impact). */
  telegraphOpacity: number;
  /** 0…1 projectile visibility (launch through transit, fades across impact). */
  strikeOpacity: number;
  /** 0…1 impact flash envelope (a peak centred on the impact beat). */
  impactFlash: number;
  /** 0…1 luck-swing pulse — non-zero only when the swing decided the result. */
  swingPulse: number;
  /** 0…1 outcome ring opacity (resolve → aftermath, fades out at the end). */
  ringOpacity: number;
  /** 0…1 capture colour-fill at the target — non-zero only on a capture. */
  captureProgress: number;
  /** The dominant beat at this instant, or null once settled. */
  beatKind: BattleBeatKind | null;
  /** True once the cinematic has fully played (elapsed ≥ duration). */
  settled: boolean;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Local 0…1 progress through one beat at time t (0 before it starts, 1 after it ends). */
function beatProgress(seq: BattleSequence, kind: BattleBeatKind, t: number): number {
  const b = seq.beats.find((x) => x.kind === kind);
  if (!b) return 0;
  if (t <= b.startMs) return 0;
  if (t >= b.startMs + b.durationMs) return 1;
  return (t - b.startMs) / b.durationMs;
}

function beatStart(seq: BattleSequence, kind: BattleBeatKind): number {
  return seq.beats.find((x) => x.kind === kind)?.startMs ?? 0;
}

function beatEnd(seq: BattleSequence, kind: BattleBeatKind): number {
  const b = seq.beats.find((x) => x.kind === kind);
  return b ? b.startMs + b.durationMs : 0;
}

function intensityOf(seq: BattleSequence, kind: BattleBeatKind): number {
  return seq.beats.find((x) => x.kind === kind)?.intensity ?? 0;
}

/** Symmetric 0→1→0 envelope over a beat (a flash/pulse), scaled by its intensity. */
function pulse(seq: BattleSequence, kind: BattleBeatKind, t: number): number {
  const p = beatProgress(seq, kind, t);
  if (p <= 0 || p >= 1) return 0;
  return Math.sin(Math.PI * p) * clamp01(intensityOf(seq, kind));
}

/** Compute the globe render state for a sequence at `elapsedMs`. */
export function playbackAt(seq: BattleSequence, elapsedMs: number): GlobePlaybackState {
  const t = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  const settled = t >= seq.durationMs;

  // Arc travel == progress through the transit beat (impact == arrival).
  const arcProgress = beatProgress(seq, "transit", t);

  // Telegraph line: in over lock, hold through transit, out over impact.
  const impactP = beatProgress(seq, "impact", t);
  let telegraphOpacity = 0;
  if (t >= beatStart(seq, "lock") && t < beatEnd(seq, "transit")) {
    telegraphOpacity = beatProgress(seq, "lock", t); // 0→1 then holds at 1
  } else if (t >= beatStart(seq, "impact") && t < beatEnd(seq, "impact")) {
    telegraphOpacity = 1 - impactP;
  }
  telegraphOpacity = clamp01(telegraphOpacity);

  // Projectile: visible launch→transit, fades across impact.
  let strikeOpacity = 0;
  if (t >= beatStart(seq, "launch") && t < beatEnd(seq, "transit")) {
    strikeOpacity = 1;
  } else if (t >= beatStart(seq, "impact") && t < beatEnd(seq, "impact")) {
    strikeOpacity = 1 - impactP;
  }

  const impactFlash = pulse(seq, "impact", t);
  const swingPulse = seq.swingDecided ? pulse(seq, "swing", t) : 0;

  // Outcome ring: in over the first quarter of resolve, hold, out over the last
  // quarter of aftermath.
  const resolveStart = beatStart(seq, "resolve");
  const afterEnd = beatEnd(seq, "aftermath");
  let ringOpacity = 0;
  if (t >= resolveStart && t < afterEnd) {
    const resolveDur = beatEnd(seq, "resolve") - resolveStart;
    const fadeInEnd = resolveStart + resolveDur * 0.25;
    const fadeOutStart = afterEnd - (afterEnd - beatStart(seq, "aftermath")) * 0.25;
    if (t < fadeInEnd) ringOpacity = (t - resolveStart) / (fadeInEnd - resolveStart);
    else if (t > fadeOutStart) ringOpacity = 1 - (t - fadeOutStart) / (afterEnd - fadeOutStart);
    else ringOpacity = 1;
  }
  ringOpacity = clamp01(ringOpacity);

  // Capture fill: ramps over aftermath, only when the attacker took the plot.
  const captureProgress = seq.captured ? beatProgress(seq, "aftermath", t) : 0;

  return {
    arcProgress,
    telegraphOpacity,
    strikeOpacity: clamp01(strikeOpacity),
    impactFlash: clamp01(impactFlash),
    swingPulse: clamp01(swingPulse),
    ringOpacity,
    captureProgress,
    beatKind: settled ? null : beatAt(seq, t)?.beat.kind ?? null,
    settled,
  };
}

// ── Brace-beat shield dome ───────────────────────────────────────────────────
// A separate, independent channel — NOT part of GlobePlaybackState — so it can
// be consumed by its own sibling renderer (GlobeShieldDome) without touching
// GlobeBattleSequence or any of its existing readers.

export interface BraceDomeState {
  /** 0…1 overall dome opacity: rises over "brace", holds through "impact", then resolves per outcome. */
  opacity: number;
  /** 0…1 dome scale/brightness — the brace beat's real intensity (defender power + fortification). Constant per sequence. */
  strength: number;
  /** 0…1 crack/shatter progress after impact — only when the attacker wins (captured). */
  shatterProgress: number;
  /** 0…1 victory-flare pulse right after impact — only when the defense holds. */
  flareIntensity: number;
}

/** Symmetric 0→1→0 pulse over the first `frac` fraction of a 0…1 input; 0 outside that window. */
function flarePulse(x: number, frac: number): number {
  if (x <= 0 || x >= frac || frac <= 0) return 0;
  return Math.sin(Math.PI * (x / frac));
}

/** Compute the brace-beat shield-dome render state for a sequence at `elapsedMs`. */
export function braceDomeAt(seq: BattleSequence, elapsedMs: number): BraceDomeState {
  const t = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  const strength = clamp01(intensityOf(seq, "brace"));

  const braceStart = beatStart(seq, "brace");
  const braceEnd = beatEnd(seq, "brace");
  const impactEnd = beatEnd(seq, "impact");

  let opacity = 0;
  let shatterProgress = 0;
  let flareIntensity = 0;

  if (t < braceStart) {
    opacity = 0;
  } else if (t < braceEnd) {
    opacity = (t - braceStart) / Math.max(1, braceEnd - braceStart);
  } else if (t < impactEnd) {
    opacity = 1;
  } else {
    // Post-impact: the dome cracks apart on a capture, or flares solid on a
    // held defense — the clash/swing/resolve/aftermath beats play out here.
    const postSpan = Math.max(1, seq.durationMs - impactEnd);
    const postT = clamp01((t - impactEnd) / postSpan);
    if (seq.captured) {
      shatterProgress = postT;
      opacity = clamp01(1 - postT);
    } else {
      flareIntensity = flarePulse(postT, 0.3);
      opacity = 1;
    }
  }

  return {
    opacity: clamp01(opacity),
    strength,
    shatterProgress: clamp01(shatterProgress),
    flareIntensity: clamp01(flareIntensity),
  };
}
