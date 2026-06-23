/**
 * beacon — the pure core of Chapter 4 "Blackout" (see CHAPTER_4_DESIGN.md).
 *
 * A Mastermind-style signal decode: a hidden code of glyphs is inferred from probes
 * that return only how *close* each was (exact = right glyph+position, partial = right
 * glyph wrong position, duplicate-correct). The deduction tension is uncertainty —
 * `remainingCount` measures how many codes are still consistent, and Aether's proposal
 * (`firstConsistent`) is an honest deductive step, never an oracle peek at the secret.
 *
 * No React, no store — unit-tested (beacon.spec.ts) so the inference is provable and the
 * trust decision (accept her read vs. override) sits on a sound, reproducible engine.
 */

export type Code = number[]; // glyph indices, 0..palette-1, length `length`

export interface Score {
  /** Right glyph in the right position. */
  exact: number;
  /** Right glyph in the wrong position (duplicate-correct). */
  partial: number;
}

export interface Probe {
  guess: Code;
  score: Score;
}

export interface BeaconPuzzle {
  length: number;
  palette: number;
  secret: Code;
}

/**
 * Mastermind scoring. `exact` counts position-perfect glyphs; `partial` counts remaining
 * glyphs present in the secret but misplaced, each secret/guess glyph consumed at most
 * once (so duplicates never over-count).
 */
export function score(guess: Code, secret: Code): Score {
  const n = secret.length;
  let exact = 0;
  // Tally of unmatched glyphs left on each side after removing exacts.
  const secretLeft: Record<number, number> = {};
  const guessLeft: Record<number, number> = {};

  for (let i = 0; i < n; i++) {
    if (guess[i] === secret[i]) {
      exact++;
    } else {
      secretLeft[secret[i]] = (secretLeft[secret[i]] ?? 0) + 1;
      guessLeft[guess[i]] = (guessLeft[guess[i]] ?? 0) + 1;
    }
  }

  let partial = 0;
  for (const g of Object.keys(guessLeft)) {
    const k = Number(g);
    partial += Math.min(guessLeft[k], secretLeft[k] ?? 0);
  }
  return { exact, partial };
}

/** An exact lock: every glyph in the right place. */
export function isSolved(s: Score, length: number): boolean {
  return s.exact === length;
}

const sameScore = (a: Score, b: Score) => a.exact === b.exact && a.partial === b.partial;

/**
 * Is `candidate` consistent with every probe so far? A candidate secret is consistent
 * with a past probe iff scoring that probe's guess against the candidate reproduces the
 * feedback that was actually observed — the foundation of all deduction here.
 */
export function consistent(candidate: Code, history: Probe[]): boolean {
  return history.every((p) => sameScore(score(p.guess, candidate), p.score));
}

/** Enumerate every code of the given length over the palette (small spaces only). */
export function allCodes(length: number, palette: number): Code[] {
  let codes: Code[] = [[]];
  for (let i = 0; i < length; i++) {
    const next: Code[] = [];
    for (const c of codes) {
      for (let g = 0; g < palette; g++) next.push([...c, g]);
    }
    codes = next;
  }
  return codes;
}

/** How many codes remain consistent with the feedback — the uncertainty measure. */
export function remainingCount(history: Probe[], length: number, palette: number): number {
  return allCodes(length, palette).reduce(
    (n, c) => (consistent(c, history) ? n + 1 : n),
    0,
  );
}

/**
 * Aether's deductive proposal: the first code consistent with all feedback. An honest
 * inference (it never reads the secret) — early on, when many codes are consistent, it
 * can be wrong, which is exactly the uncertainty the trust decision turns on. Returns
 * `null` only if the history is contradictory (no consistent code exists).
 */
export function firstConsistent(
  history: Probe[],
  length: number,
  palette: number,
): Code | null {
  for (const c of allCodes(length, palette)) {
    if (consistent(c, history)) return c;
  }
  return null;
}
