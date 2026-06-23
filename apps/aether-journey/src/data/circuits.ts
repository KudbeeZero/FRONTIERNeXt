/**
 * circuits — the two authored boards for Chapter 2's Nav-Circuit Reroute.
 * Pure data: tweak layouts / fuel / damage here without touching the puzzle engine
 * (src/lib/navCircuit.ts) or the R3F component.
 */
import type { CircuitBoard } from "../lib/navCircuit";

/**
 * Stage 1 — POWER ROUTING. No gates: connect each source ▸ to its sink ◂ with a valid
 * wire, threading the two gaps in the storm-damaged column. Teaches the verb: drag,
 * reroute, don't cross. One clean solution per side; the damaged column forces the gaps.
 */
export const STAGE_1_POWER: CircuitBoard = {
  id: "nav-power",
  title: "STAGE 1 · POWER ROUTING",
  width: 7,
  height: 5,
  nodes: [
    { id: "s1", type: "source", pos: { x: 0, y: 0 } },
    { id: "s2", type: "source", pos: { x: 0, y: 4 } },
    { id: "k1", type: "sink", pos: { x: 6, y: 0 } },
    { id: "k2", type: "sink", pos: { x: 6, y: 4 } },
  ],
  // A damaged column at x=3 with gaps at y=1 and y=3 — each side routes through one gap.
  damaged: [
    { x: 3, y: 0 },
    { x: 3, y: 2 },
    { x: 3, y: 4 },
  ],
  fuelBudget: 100,
  shortCost: 8,
};

/**
 * Stage 2 — LOGIC RESTORATION. The nav core (k1) is interlocked: it refuses a raw bus
 * (`requiresGate`) and only powers when BOTH buses are confirmed live through the AND
 * gate — k1 = sA AND sB. The player must reason that a source can't go straight to the
 * core and route both lines through the logic array around the damaged center row.
 *
 * (The engine also supports NOT/OR gates and dead sources — see navCircuit.ts — held for
 * harder boards in later chapters; Stage 2 stays AND-only so it has a clean gated solution
 * with no source→sink bypass.)
 */
export const STAGE_2_LOGIC: CircuitBoard = {
  id: "nav-logic",
  title: "STAGE 2 · LOGIC RESTORATION",
  width: 7,
  height: 7,
  nodes: [
    { id: "sA", type: "source", pos: { x: 0, y: 1 }, live: true },
    { id: "sB", type: "source", pos: { x: 0, y: 5 }, live: true },
    { id: "g2", type: "and", pos: { x: 4, y: 3 } },
    { id: "k1", type: "sink", pos: { x: 6, y: 3 }, requiresGate: true },
  ],
  damaged: [
    { x: 2, y: 3 },
    { x: 3, y: 3 },
  ],
  fuelBudget: 80,
  shortCost: 10,
};

/** The two stages in order. Chapter 2 advances stage 1 → 2 → transit. */
export const CHAPTER_2_BOARDS: readonly CircuitBoard[] = [STAGE_1_POWER, STAGE_2_LOGIC];

/** Board for a 1-based stage number. */
export function boardForStage(stage: number): CircuitBoard {
  return CHAPTER_2_BOARDS[stage - 1] ?? STAGE_1_POWER;
}
