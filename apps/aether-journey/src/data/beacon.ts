/**
 * Chapter 4 scenario data — the degraded nav beacon (see CHAPTER_4_DESIGN.md §5).
 *
 * length 4 over a 6-glyph palette = 1296 codes (classic Mastermind). The secret has a
 * duplicate glyph on purpose, so the decode exercises duplicate-correct scoring and isn't
 * trivially separable. Glyphs are abstract indices; the scene maps them to beacon symbols.
 */
import type { BeaconPuzzle } from "../lib/beacon";

/** Display glyphs for the 6-symbol palette (scene/HUD only — engine uses indices). */
export const BEACON_GLYPHS = ["◈", "▲", "●", "✶", "⬢", "❍"] as const;

export const NAV_BEACON: BeaconPuzzle = {
  length: 4,
  palette: 6,
  secret: [3, 1, 1, 4], // ✶ ▲ ▲ ⬢ — note the duplicate ▲
};

/**
 * When this many candidate codes still remain consistent, locking on Aether's proposal is
 * a genuine leap of faith (sets `trusted_aether_blind`). Below it, trusting her is just the
 * efficient finish.
 */
export const HIGH_UNCERTAINTY = 4;
