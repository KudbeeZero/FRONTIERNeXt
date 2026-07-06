/**
 * server/services/economicsSnapshotShape.ts
 *
 * Pure pieces of the Unit D3 economics-history sampler — the hourly sample
 * gate and the row shaping. Deliberately has ZERO imports of `../db` or any
 * chain client, so this module (and its unit tests) can load without
 * `DATABASE_URL` set, unlike `economicsSnapshotSampler.ts` which does the
 * actual DB/chain integration and depends on this file.
 *
 * CONTRACT: pure — no DB, no chain, no clock (the caller supplies `now`).
 */

/** Sample once per hour — the fade/history granularity the chart needs, no more. */
export const SAMPLE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Should a new sample be taken right now? `lastSampledAt` is `null` on first
 * boot (always sample immediately so the very first data point exists as
 * soon as possible after this ships).
 */
export function shouldSampleNow(
  lastSampledAt: number | null,
  now: number,
  intervalMs: number = SAMPLE_INTERVAL_MS,
): boolean {
  if (lastSampledAt === null) return true;
  if (!Number.isFinite(now) || !Number.isFinite(lastSampledAt)) return false;
  return now - lastSampledAt >= intervalMs;
}

export interface EconomicsSnapshotValues {
  totalSupply: number;
  inGameCirculating: number;
  totalBurned: number;
  treasury: number;
  protocolTreasuryTotal: number;
}

export interface EconomicsSnapshotRowInput {
  id: string;
  capturedAt: number;
  totalSupply: number;
  inGameCirculating: number;
  totalBurned: number;
  treasury: number;
  protocolTreasuryTotal: number;
}

/** Shape the computed values into a row ready to insert. */
export function buildSnapshotRow(
  values: EconomicsSnapshotValues,
  capturedAt: number,
  id: string,
): EconomicsSnapshotRowInput {
  return {
    id,
    capturedAt,
    totalSupply: values.totalSupply,
    inGameCirculating: values.inGameCirculating,
    totalBurned: values.totalBurned,
    treasury: values.treasury,
    protocolTreasuryTotal: values.protocolTreasuryTotal,
  };
}
