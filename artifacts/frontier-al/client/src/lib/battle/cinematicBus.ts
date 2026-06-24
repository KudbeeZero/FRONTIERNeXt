/**
 * client/src/lib/battle/cinematicBus.ts
 *
 * A tiny in-process pub/sub so the on-globe cinematic (GlobeBattleSequence) and
 * the DOM HUD callout (BattleCalloutHUD) play the SAME battle sequence off the
 * SAME start time — the globe shows the lines, the HUD speaks the beats. The
 * globe layer already builds the full sequence (with real troops/commander), so
 * publishing it here avoids duplicating that assembly in the HUD.
 *
 * `activeCallout` is the pure read used by the HUD; the bus itself is a trivial
 * listener registry.
 */
import { beatAt, type BattleSequence } from "@shared/battle-sequence";

export interface CinematicHandle {
  seq: BattleSequence;
  /** Wall-clock ms (Date.now) the cinematic started, so the HUD shares the clock. */
  startMs: number;
}

type CinematicCallback = (h: CinematicHandle) => void;
const _callbacks = new Map<number, CinematicCallback>();
let _callbackId = 0;

/** Subscribe to cinematic starts. Returns an unsubscribe fn. */
export function onCinematic(cb: CinematicCallback): () => void {
  const id = ++_callbackId;
  _callbacks.set(id, cb);
  return () => _callbacks.delete(id);
}

/** Announce a cinematic has started (called by the globe layer). */
export function publishCinematic(h: CinematicHandle): void {
  for (const cb of _callbacks.values()) {
    try { cb(h); } catch { /* ignore */ }
  }
}

/** The active beat as a HUD callout, or null once the sequence has settled. */
export interface Callout {
  kind: string;
  caption: string;
  /** 0…1 dramatic weight of the active beat. */
  intensity: number;
}

export function activeCallout(seq: BattleSequence, elapsedMs: number): Callout | null {
  const a = beatAt(seq, elapsedMs);
  if (!a) return null;
  return { kind: a.beat.kind, caption: a.beat.caption, intensity: a.beat.intensity };
}
