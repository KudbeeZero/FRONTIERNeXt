/**
 * server/veritas/types.ts
 *
 * VERITAS — Verification Grind Engine. Shared types for the always-on harness that
 * walks the chain/game flows on a loop and reports exactly where things break.
 *
 * Runs as an external client (CLI on Lightning AI or anywhere) that pokes the live
 * testnet backend the way a real player would. Read/test-only — never touches mainnet.
 */

/**
 * Step status.
 *  - PASS  : assertion held.
 *  - FAIL  : assertion broke (something is wrong).
 *  - DRIFT : the DB and the chain disagree — the dangerous on-chain-game failure mode
 *            (a half-completed mint, a confirmed transfer that didn't sync, etc.).
 *  - SKIP  : step not run (flow not yet implemented, or precondition unmet).
 */
export type StepStatus = "PASS" | "FAIL" | "DRIFT" | "SKIP";

export interface StepResult {
  step: string;
  status: StepStatus;
  /** Human-readable detail — for FAIL/DRIFT, specific enough to hand to Claude Code. */
  detail?: string;
  /** Milliseconds the step took. */
  ms?: number;
}

export interface FlowResult {
  flow: string;
  steps: StepResult[];
  /** Worst status across steps (DRIFT/FAIL dominate PASS). */
  status: StepStatus;
  ms: number;
}

export interface RunResult {
  startedAt: number;
  ms: number;
  flows: FlowResult[];
  totals: Record<StepStatus, number>;
}

/** A flow runner takes a context and returns its step results. */
export interface FlowContext {
  /** Base URL of the live backend under test (e.g. https://testnet.frontierprotocol.app). */
  baseUrl: string;
  /** Admin key for admin-guarded endpoints (market create / resolve trigger). */
  adminKey?: string;
  /** A player id to act as, if a flow needs one. */
  playerId?: string;
  /** Test wallet (testnet) for flows that perform on-chain actions. Null if unconfigured. */
  wallet?: import("./wallet.js").TestWallet | null;
  /** FRONTIER ($FRNTR) ASA id, for token/balance reconciliation flows. */
  frontierAsaId?: number;
  /** Structured logger. */
  log: (msg: string) => void;
}

export interface FlowRunner {
  name: string;
  /** Returns the step results for one pass of this flow. */
  run(ctx: FlowContext): Promise<StepResult[]>;
}
