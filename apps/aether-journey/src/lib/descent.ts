/**
 * descent — the pure core of Chapter 5 "Descent", the finale (see CHAPTER_5_DESIGN.md).
 *
 * Integration: a fixed sequence of stages, each a one-beat callback to a prior chapter's
 * verb, run under a countdown whose generosity scales with accumulated `trust`. The whole
 * run then resolves to one of three endings — `resolveEnding` is a pure function of state
 * (trust + key flags), so every ending is reachable and testable.
 *
 * No React, no store — unit-tested (descent.spec.ts). The real-time stage progression /
 * countdown lives in the store; the difficulty + ending math live here.
 */
import { endingFor, ENDING_COPY, type Ending } from "./decisions";

export { ENDING_COPY };
export type { Ending };

/** The earlier-chapter verb each descent stage recombines. */
export type DescentVerb = "realign" | "reroute" | "balance" | "confirm" | "burn";

export interface DescentStage {
  id: string;
  verb: DescentVerb;
  label: string;
  prompt: string;
}

/** The fixed insertion sequence — one beat per prior verb, then the burn. */
export const DESCENT_STAGES: readonly DescentStage[] = [
  { id: "realign", verb: "realign", label: "REALIGN", prompt: "Hold the core steady through entry shear." },
  { id: "reroute", verb: "reroute", label: "REROUTE", prompt: "Patch the entry vector around the fault." },
  { id: "balance", verb: "balance", label: "BALANCE", prompt: "Shunt the bus to the heat shield." },
  { id: "confirm", verb: "confirm", label: "CONFIRM", prompt: "Confirm the landing beacon read." },
  { id: "burn", verb: "burn", label: "BURN", prompt: "Commit the final retro burn." },
] as const;

export interface DescentTuning {
  /** Seconds allowed per stage before it fails (and retries). */
  secondsPerStage: number;
  /** Whether Aether pre-flags the right move (high-trust assist). */
  assist: boolean;
}

/**
 * Difficulty from the bond: high trust buys time and Aether's help, low trust is tightest
 * and she's quiet. Monotonic in trust.
 */
export function descentTuning(trust: number): DescentTuning {
  if (trust >= 70) return { secondsPerStage: 12, assist: true };
  if (trust >= 35) return { secondsPerStage: 9, assist: false };
  return { secondsPerStage: 7, assist: false };
}

/**
 * The ending the whole run resolves to — pure in (trust, flags). Layers finale-specific
 * flag weight on top of the shipped trust thresholds (`endingFor`):
 *  - sacrificing her core (`sacrificed_aether`) forces Severance regardless of the number;
 *  - a blind leap of faith that paid off (`trusted_aether_blind`) lifts a Functional to Bonded.
 */
export function resolveEnding(trust: number, flags: ReadonlySet<string>): Ending {
  if (flags.has("sacrificed_aether")) return "severance";
  let ending = endingFor(trust);
  if (ending === "functional" && flags.has("trusted_aether_blind")) ending = "bonded";
  return ending;
}
