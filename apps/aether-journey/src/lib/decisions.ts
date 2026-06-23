/**
 * decisions — the pure core of the long-game decision system (see GAME_ARC.md §2).
 *
 * One persistent axis, `trust` (0–100), seeded from Ch.1's Aether stability, plus a
 * set of story `flags`. Choices are data (DecisionOption); this module applies them
 * and resolves the ending. No React, no store — unit-tested (decisions.spec.ts) so
 * the branching is provable and serializable (on-chain-ready).
 */
import type { DecisionOption, ShipSystems } from "../store/types";

export type Ending = "bonded" | "functional" | "severance";

export interface DecisionState {
  trust: number;
  flags: ReadonlySet<string>;
  systems: ShipSystems;
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

/** Trust seed from Aether's healed stability at the end of Ch.1. */
export function seedTrust(aetherStability: number): number {
  return clamp100(Math.round(aetherStability));
}

/**
 * Apply a chosen option to the decision state, returning a NEW state (pure).
 * Trust and every touched system are clamped to [0,100]; flags are merged.
 */
export function applyOption(state: DecisionState, option: DecisionOption): DecisionState {
  const flags = new Set(state.flags);
  for (const f of option.flags ?? []) flags.add(f);

  const systems: ShipSystems = { ...state.systems };
  if (option.systems) {
    for (const k of Object.keys(option.systems) as (keyof ShipSystems)[]) {
      systems[k] = clamp100(systems[k] + (option.systems[k] ?? 0));
    }
  }

  return {
    trust: clamp100(state.trust + (option.trust ?? 0)),
    flags,
    systems,
  };
}

/**
 * The ending the run resolves to, from final trust (+ flags reserved for special
 * endings later). Thresholds: ≥70 bonded, ≥35 functional, else severance.
 */
export function endingFor(trust: number, _flags: ReadonlySet<string> = new Set()): Ending {
  if (trust >= 70) return "bonded";
  if (trust >= 35) return "functional";
  return "severance";
}

/** Human-facing copy for each ending (surfaced on the EndCard later). */
export const ENDING_COPY: Record<Ending, { title: string; line: string }> = {
  bonded: {
    title: "BONDED",
    line: "Aether came through whole. You arrive at Mars together — and neither of you is alone.",
  },
  functional: {
    title: "FUNCTIONAL",
    line: "You make Mars. Something between you stayed guarded, but the ship holds and the mission stands.",
  },
  severance: {
    title: "SEVERANCE",
    line: "You survive. Aether is diminished — a price paid in the dark. The frontier waits, quieter now.",
  },
};
