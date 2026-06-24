/**
 * client/src/lib/battle/cameraDirector.ts
 *
 * Pure "camera director" for the battle cinematic: given the sequence + elapsed,
 * it says where along the arc the camera should look and how strongly to bias
 * toward it. The renderer only ever nudges the OrbitControls *target* (a gentle
 * pan), never the zoom, and releases as the sequence settles — so it guides the
 * eye to the action without wresting control away.
 *
 * Anticipate the launch → follow the strike across the arc → hold on the target
 * through impact/resolution → let go.
 *
 * CONTRACT: pure — no clock, no Three.js.
 */
import { beatAt, type BattleSequence } from "@shared/battle-sequence";

export interface CameraDirection {
  /** Whether the camera should bias at all right now. */
  active: boolean;
  /** 0…1 position along the arc to look toward (0 = attacker, 1 = defender). */
  arcT: number;
  /** 0…1 how strongly to bias toward `arcT` (the renderer scales its lerp by this). */
  weight: number;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function localProgress(seq: BattleSequence, kind: string, t: number): number {
  const b = seq.beats.find((x) => x.kind === kind);
  if (!b) return 0;
  if (t <= b.startMs) return 0;
  if (t >= b.startMs + b.durationMs) return 1;
  return (t - b.startMs) / b.durationMs;
}

export function cameraDirectorAt(seq: BattleSequence, elapsedMs: number): CameraDirection {
  const t = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  if (t < 0 || t >= seq.durationMs) return { active: false, arcT: t >= seq.durationMs ? 1 : 0, weight: 0 };

  const kind = beatAt(seq, t)?.beat.kind;
  let arcT = 0;
  let weight = 0;
  switch (kind) {
    case "muster":
      arcT = 0; weight = 0; break;
    case "lock": // drift toward the launch site
      arcT = 0; weight = 0.4 * localProgress(seq, "lock", t); break;
    case "launch":
      arcT = 0; weight = 0.6; break;
    case "transit": // follow the strike across the arc
      arcT = localProgress(seq, "transit", t); weight = 0.85; break;
    case "brace": // strike has arrived; hold on the target
      arcT = 1; weight = 0.9; break;
    case "impact":
      arcT = 1; weight = 1; break;
    case "clash":
      arcT = 1; weight = 0.8; break;
    case "swing":
      arcT = 1; weight = 0.7; break;
    case "resolve":
      arcT = 1; weight = 0.5; break;
    case "aftermath": // ease the bias out
      arcT = 1; weight = 0.5 * (1 - localProgress(seq, "aftermath", t)); break;
    default:
      weight = 0;
  }
  weight = clamp01(weight);
  return { active: weight > 0, arcT: clamp01(arcT), weight };
}
