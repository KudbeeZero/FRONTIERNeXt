/**
 * server/engine/markets/payout.ts
 *
 * Pure prediction-market payout math. DB-free, so it runs in the single-process
 * server test suite and is reused by the storage layer. The storage layer owns
 * the *atomicity* of claiming (compare-and-set UPDATEs inside a transaction);
 * this module owns only the arithmetic of splitting the pool, kept here so the
 * money math is testable in isolation and consistent everywhere.
 */

export interface MarketPayout {
  /** Whole-FRONTIER amount credited to the claimant (floored — never over-pays). */
  payout: number;
  /** Claimant's pro-rata share of the protocol fee, in micro-FRONTIER (floored). */
  feeShareMicro: number;
}

/**
 * Parimutuel split: the claimant receives a share of the distributable pool
 * (total pool minus the protocol fee), pro-rata to their stake in the winning
 * side. Floors downward so the sum of payouts can never exceed the pool.
 * Returns zeros when the winning pool or the claimant's stake is empty.
 */
export function computeMarketPayout(args: {
  playerWagered: number;
  totalWinningPool: number;
  totalLosingPool: number;
  feeRate: number;
}): MarketPayout {
  const { playerWagered, totalWinningPool, totalLosingPool, feeRate } = args;
  if (totalWinningPool <= 0 || playerWagered <= 0) return { payout: 0, feeShareMicro: 0 };

  const totalPool = totalWinningPool + totalLosingPool;
  const feeAmount = totalPool * feeRate;
  const distributablePool = totalPool - feeAmount;

  const share = playerWagered / totalWinningPool;
  const payout = Math.floor(share * distributablePool);
  const feeShareMicro = Math.floor(share * feeAmount * 1_000_000);
  return { payout, feeShareMicro };
}
