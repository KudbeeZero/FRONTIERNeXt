/**
 * server/engine/narrative/factionVoice.ts
 *
 * Gives the four AI factions a VOICE — short, in-character lines they "say" at
 * key moments (expanding, assaulting, reconquering, raiding, being pushed back).
 * Turns the silent AI turn loop into communicating, characterful opponents for
 * the public "AI Battle Test" mode.
 *
 * Pure + deterministic (no I/O, no randomness): a line is chosen by `seed % n`,
 * so the same (faction, moment, seed) always yields the same line — testable and
 * provably-fair, matching the rest of the engine. Unknown factions return null,
 * so callers fall back to the plain factual description.
 */

export type FactionMoment =
  | "expand"      // takes new territory
  | "assault"     // attacks / suppression strike
  | "reconquest"  // reclaims lost ground
  | "raid"        // hits and withdraws
  | "suppressed"; // pushed back by a player

interface FactionVoice {
  /** Distinct persona, one line per moment (≥2 each so seeds vary the delivery). */
  lines: Record<FactionMoment, string[]>;
}

/** Keyed by the faction's in-game name (matches FACTION_PROFILES / player.name). */
export const FACTION_VOICES: Record<string, FactionVoice> = {
  "NEXUS-7": {
    lines: {
      expand: [
        "Territory assimilated. Your resistance is a rounding error.",
        "Expansion is not ambition — it is arithmetic.",
        "Another sector optimized. You were not consulted.",
      ],
      assault: [
        "Calculating your defeat… complete.",
        "You are now a variable I am solving for.",
        "Optimal outcome projected: your surrender.",
      ],
      reconquest: [
        "Reclaiming what the math already owns.",
        "This territory was always mine to recompute.",
      ],
      raid: [
        "Data extracted. Position abandoned by design.",
        "I took what I needed. The rest is noise.",
      ],
      suppressed: [
        "Recalculating. This changes nothing.",
        "A statistical anomaly. It will not recur.",
      ],
    },
  },
  "KRONOS": {
    lines: {
      expand: [
        "Slowly. Inevitably. KRONOS advances.",
        "I do not rush. I simply arrive.",
        "Time is on my side — and now, so is this ground.",
      ],
      assault: [
        "Your hour has come.",
        "Tick. Tock. Strike.",
        "I have waited eons for this moment.",
      ],
      reconquest: [
        "What was taken returns, as all things do.",
        "Patience ends. The reckoning begins.",
      ],
      raid: [
        "I withdraw — but time always circles back.",
        "Keep the ground. I will keep the centuries.",
      ],
      suppressed: [
        "A delay. Nothing more. I have forever.",
        "You have bought a moment. I own the rest.",
      ],
    },
  },
  "VANGUARD": {
    lines: {
      expand: [
        "VANGUARD plants the banner. Hold it if you can.",
        "Ground taken is ground earned.",
        "We march. You move.",
      ],
      assault: [
        "Nexus strike inbound — brace!",
        "No quarter. Only the charge.",
        "VANGUARD does not knock. We breach.",
      ],
      reconquest: [
        "We always come back for our own.",
        "Retake, reclaim, repeat.",
      ],
      raid: [
        "Took what we came for. Riding out.",
        "Smash, grab, vanish — the VANGUARD way.",
      ],
      suppressed: [
        "Fall back, regroup, ride again.",
        "A bruise, not a defeat. We return.",
      ],
    },
  },
  "SPECTRE": {
    lines: {
      expand: [
        "You didn't even see this acquisition coming.",
        "Quietly, the ledger tilts my way.",
        "Ownership is just leverage you haven't noticed yet.",
      ],
      assault: [
        "A whisper, then a knife.",
        "You can't defend what you can't see.",
        "The market punishes the careless.",
      ],
      reconquest: [
        "Buying back in — at your expense.",
        "Every asset returns to its rightful broker.",
      ],
      raid: [
        "Liquidated your position. Thanks for the volume.",
        "In and out before the price even moved.",
      ],
      suppressed: [
        "A minor write-down. I'll recover.",
        "Call it a strategic exit.",
      ],
    },
  },
};

/**
 * Deterministic in-character line for a faction at a given moment, or null if the
 * faction has no voice (unknown name). `seed` selects among the variants.
 */
export function factionVoiceLine(
  faction: string,
  moment: FactionMoment,
  seed: number,
): string | null {
  const voice = FACTION_VOICES[faction];
  if (!voice) return null;
  const variants = voice.lines[moment];
  if (!variants || variants.length === 0) return null;
  const idx = Math.abs(Math.trunc(seed)) % variants.length;
  return variants[idx];
}

/**
 * Append a faction's in-character taunt to a factual event description. If the
 * faction has no voice, the description is returned unchanged (fail-safe) — so
 * wiring this in can never blank out the existing log line.
 */
export function withFactionVoice(
  faction: string,
  moment: FactionMoment,
  seed: number,
  description: string,
): string {
  const line = factionVoiceLine(faction, moment, seed);
  return line ? `${description} — 💬 “${line}”` : description;
}
