/**
 * server/veritas/assert.ts
 *
 * Pure assertion engine for VERITAS. Deterministic checks the flow runners use to
 * turn observations into PASS / FAIL / DRIFT step results. No I/O — fully unit-testable.
 */

import type { StepResult, StepStatus, FlowResult } from "./types.js";

/** Generic boolean assertion → PASS or FAIL. */
export function assert(step: string, ok: boolean, detail?: string, ms?: number): StepResult {
  return { step, status: ok ? "PASS" : "FAIL", detail: ok ? undefined : (detail ?? "assertion failed"), ms };
}

/** Equality assertion with a descriptive FAIL message. */
export function assertEqual<T>(step: string, actual: T, expected: T, ms?: number): StepResult {
  const ok = Object.is(actual, expected);
  return assert(step, ok, ok ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`, ms);
}

/**
 * Reconciliation assertion: compares what the DB says against what the chain says.
 *  - both agree with expected           → PASS
 *  - db and chain disagree              → DRIFT (the dangerous case)
 *  - they agree with each other but not the expectation → FAIL
 */
export function assertReconciled<T>(
  step: string,
  opts: { db: T; chain: T; expected?: T },
  ms?: number,
): StepResult {
  const { db, chain, expected } = opts;
  if (!Object.is(db, chain)) {
    return { step, status: "DRIFT", detail: `DB says ${JSON.stringify(db)} but chain says ${JSON.stringify(chain)}`, ms };
  }
  if (expected !== undefined && !Object.is(db, expected)) {
    return { step, status: "FAIL", detail: `DB and chain agree on ${JSON.stringify(db)} but expected ${JSON.stringify(expected)}`, ms };
  }
  return { step, status: "PASS", ms };
}

/** A skipped step (flow not implemented yet, or precondition unmet). */
export function skip(step: string, reason: string): StepResult {
  return { step, status: "SKIP", detail: reason };
}

const SEVERITY: Record<StepStatus, number> = { PASS: 0, SKIP: 1, DRIFT: 2, FAIL: 3 };

/** Worst status across steps (FAIL > DRIFT > SKIP > PASS). Empty → SKIP. */
export function worstStatus(steps: StepResult[]): StepStatus {
  if (steps.length === 0) return "SKIP";
  return steps.reduce<StepStatus>((worst, s) => (SEVERITY[s.status] > SEVERITY[worst] ? s.status : worst), "PASS");
}

/** Roll step results up into a flow result. */
export function toFlowResult(flow: string, steps: StepResult[], ms: number): FlowResult {
  return { flow, steps, status: worstStatus(steps), ms };
}

/** Tally step statuses across flows. */
export function tally(flows: FlowResult[]): Record<StepStatus, number> {
  const totals: Record<StepStatus, number> = { PASS: 0, FAIL: 0, DRIFT: 0, SKIP: 0 };
  for (const f of flows) for (const s of f.steps) totals[s.status] += 1;
  return totals;
}
