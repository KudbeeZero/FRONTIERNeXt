import type { Phase } from "../store/types";

// ---------------------------------------------------------------------------
// Which phases mount an interactive 3D board the player must click through, and
// therefore whether the dialogue panel may show a CTA / capture pointer events.
//
// During a board phase the in-world board IS the gate (NeuralRepair, NavCircuit,
// PowerTriage, signal-decode, Descent). The dialogue panel must stay
// pointer-transparent then, or it eats the clicks meant for the board and the
// player is stranded on it. (Omitting `repair` here is exactly what froze the
// end of Chapter 1 — the neural-repair nodes couldn't be clicked.)
// ---------------------------------------------------------------------------

/** Phases whose interactive 3D board owns the pointer; the dialogue panel must defer. */
export const BOARD_PHASES: readonly Phase[] = [
  "repair",
  "rewiring",
  "triage",
  "decode",
  "descent",
] as const;

/**
 * True when a *waiting* (gate) dialogue line should surface a CTA button — and so
 * make the panel pointer-interactive. False on board phases, so the panel stays
 * transparent and the board receives the player's clicks.
 */
export function panelHasCTA(phase: Phase, waiting: boolean): boolean {
  return waiting && !BOARD_PHASES.includes(phase);
}
