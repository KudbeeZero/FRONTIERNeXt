/**
 * server/engine/narrative/whispers.ts
 *
 * Comm Terminal — the "lost souls of the world" whisper generator.
 *
 * A purchasable Comm Terminal lets its owner hear faint ambient transmissions
 * that no one else receives. Generation is **pure + deterministic**: seeded by
 * (playerId, time-bucket), so each player gets their *own* stream, it's stable
 * within a short window (a whisper lingers, then a new one drifts in), and it's
 * fully unit-testable. No DB, no network, no global RNG — reuses the battle
 * engine's seeded RNG.
 *
 * Whispers are pure atmosphere: they carry no hidden game state (fair-play —
 * they never reveal another player's position, holdings, or plans), only mood.
 */

import { mulberry32, hashSeed } from "../battle/random.js";

export type WhisperIntensity = "faint" | "clear" | "surge";

export interface Whisper {
  /** Stable id for client dedup (one whisper per player per window). */
  id: string;
  text: string;
  intensity: WhisperIntensity;
  /** The time-bucket index this whisper belongs to (stable within the window). */
  bucket: number;
}

/** A new whisper drifts in roughly every 45s, per player. */
export const WHISPER_WINDOW_MS = 45_000;

/** Largest sane terminal level (kept in sync with FACILITY_INFO.comm_terminal). */
const MAX_LEVEL = 3;

// ── Whisper pools (atmosphere only) ──────────────────────────────────────────
// faint: barely-there, easy to dismiss. clear: a coherent lost voice.
// surge: the world bleeding through — louder, stranger, more emotional.

const FAINT: string[] = [
  "…is anyone still listening…",
  "static breathes where a voice used to be.",
  "…cold. it's so cold up here…",
  "a signal with no sender drifts past.",
  "…I left something down there. I can't remember what…",
  "somewhere, a door that was never built closes.",
  "…the orbit hums a name. not yours. not quite.",
  "fragments of a song no one finished.",
  "…we were here first. weren't we…",
  "a tide of whispers, none of them awake.",
];

const CLEAR: string[] = [
  "They sold the sky and called it progress. I remember the blue.",
  "Hold the center. The center is the only thing that's ever ours.",
  "I traded everything for this rock. I'd do it again. I think.",
  "There's a deal in the dark — there's always a deal in the dark.",
  "The small ones bite back. Don't ever forget the small ones.",
  "Something woke under the crust and it's counting our lights.",
  "Build, and they come. Burn, and they come faster.",
  "A faction is just a lie enough people agree to bleed for.",
  "I heard your engines from three plots over. So did they.",
  "When the region falls, it falls all at once. Watch the edges.",
];

const SURGE: string[] = [
  "THE GROUND REMEMBERS EVERY OWNER. IT IS NOT FORGIVING.",
  "A SUPERPOWER IS BORN — somewhere a thousand small worlds go quiet.",
  "DO YOU FEEL THAT? THE WHOLE HEMISPHERE JUST LEANED.",
  "we are the ones the map forgot. we are still voting.",
  "the asteroid is awake and it has opinions about your borders.",
  "PROFIT IS A PRAYER AND THE TREASURY IS A GOD THAT EATS.",
  "they're rewriting which way is up. soon you'll agree it always was.",
  "EVERY TARIFF IS A SCAR SOMEONE ELSE HAS TO WEAR.",
  "the dead don't take sides. they just keep transmitting.",
  "you will see it our way. give it time. give it intensity.",
];

/**
 * Whether a player owns a Comm Terminal and at what (max) level — pure, so it's
 * shared by the DB + in-memory storage and unit-tested. Owning the facility on
 * any plot unlocks the feed; the highest level tunes reception.
 */
export function commTerminalLevel(
  parcels: Array<{ ownerId: string | null; improvements?: Array<{ type: string; level: number }> | null }>,
  playerId: string,
): { owned: boolean; level: number } {
  let level = 0;
  for (const p of parcels) {
    if (p.ownerId !== playerId) continue;
    for (const imp of p.improvements ?? []) {
      if (imp.type === "comm_terminal") level = Math.max(level, imp.level);
    }
  }
  return { owned: level > 0, level };
}

/** Time-bucket index for a moment in time. */
export function whisperBucket(nowMs: number, windowMs: number = WHISPER_WINDOW_MS): number {
  return Math.floor(nowMs / windowMs);
}

function pick(rng: () => number, pool: string[]): string {
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/**
 * The whisper a given player hears right now. Deterministic in
 * (playerId, bucket): the same player hears the same line for the whole window,
 * different players hear different lines, and a higher terminal level tunes in
 * more "clear"/"surge" transmissions.
 */
export function generateWhisper(
  playerId: string,
  nowMs: number,
  opts: { level?: number; windowMs?: number } = {},
): Whisper {
  const windowMs = opts.windowMs ?? WHISPER_WINDOW_MS;
  const level = Math.max(1, Math.min(MAX_LEVEL, opts.level ?? 1));
  const bucket = whisperBucket(nowMs, windowMs);
  const seed = hashSeed(playerId, bucket, "whisper");
  const rng = mulberry32(seed);

  // Higher level → stronger reception (more surges + clear, fewer faint).
  const surgeChance = 0.12 + 0.06 * (level - 1);
  const clearChance = 0.42 + 0.04 * (level - 1);
  const roll = rng();

  let pool: string[];
  let intensity: WhisperIntensity;
  if (roll < surgeChance) {
    pool = SURGE;
    intensity = "surge";
  } else if (roll < surgeChance + clearChance) {
    pool = CLEAR;
    intensity = "clear";
  } else {
    pool = FAINT;
    intensity = "faint";
  }

  return {
    id: `w-${bucket}-${(seed & 0xffff).toString(16)}`,
    text: pick(rng, pool),
    intensity,
    bucket,
  };
}
