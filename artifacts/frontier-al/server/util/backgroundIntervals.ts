/**
 * server/util/backgroundIntervals.ts
 *
 * Centralised resolution of the tunable cadences for the background loops that
 * were made configurable in the cost-control pass. Each helper is a thin
 * wrapper over `clampIntervalMs` so the env var, default, and floor are
 * documented in one place and unit-tested directly (no need to mount the
 * Express app or read process.env at import time).
 */
import { clampIntervalMs } from "./intervals.js";

/** AI scheduler cadence (ms). Default 120s, floor 30s. */
export function resolveAiTurnIntervalMs(env: NodeJS.ProcessEnv = process.env): number {
  return clampIntervalMs(env.AI_TURN_INTERVAL_MS, 120_000, 30_000);
}

/** Expired-debuff cleanup cadence (ms). Default 60s, floor 10s. */
export function resolveDebuffCleanupIntervalMs(env: NodeJS.ProcessEnv = process.env): number {
  return clampIntervalMs(env.DEBUFF_CLEANUP_INTERVAL_MS, 60_000, 10_000);
}
