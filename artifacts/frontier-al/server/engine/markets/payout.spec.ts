/**
 * server/engine/markets/payout.spec.ts
 *
 * Unit tests for the pure parimutuel payout math. DB-free, so it runs in the
 * single-process server suite. The atomicity of claiming (compare-and-set in a
 * transaction) lives in the storage layer and is verified by code review;
 * here we pin the arithmetic: pro-rata split, fee deduction, flooring, and the
 * conservation invariant (payouts never exceed the distributable pool).
 */

import { describe, it, expect } from "vitest";
import { computeMarketPayout } from "./payout.js";

describe("computeMarketPayout", () => {
  it("splits the distributable pool pro-rata to the winning stake", () => {
    // Pools: winners 1000, losers 1000 → total 2000, 5% fee = 100, distributable 1900.
    // Sole winner staked 1000 → receives the whole distributable pool.
    const r = computeMarketPayout({ playerWagered: 1000, totalWinningPool: 1000, totalLosingPool: 1000, feeRate: 0.05 });
    expect(r.payout).toBe(1900);
    expect(r.feeShareMicro).toBe(100 * 1_000_000);
  });

  it("gives a partial winner only their proportional share", () => {
    // Winner pool 1000 (this player 250 = 25%), loser pool 3000 → total 4000, fee 200, dist 3800.
    const r = computeMarketPayout({ playerWagered: 250, totalWinningPool: 1000, totalLosingPool: 3000, feeRate: 0.05 });
    expect(r.payout).toBe(Math.floor(0.25 * 3800)); // 950
    expect(r.feeShareMicro).toBe(Math.floor(0.25 * 200 * 1_000_000));
  });

  it("floors downward — never over-pays the pool", () => {
    // Winners 3, losers 97 → total 100, no fee, distributable 100.
    // 1/3 share = 33.33 → floors to 33.
    const r = computeMarketPayout({ playerWagered: 1, totalWinningPool: 3, totalLosingPool: 97, feeRate: 0 });
    expect(r.payout).toBe(33); // floor(1/3 * 100)
  });

  it("conservation: sum of floored payouts never exceeds the distributable pool", () => {
    const totalWinningPool = 7;
    const totalLosingPool = 5;
    const feeRate = 0.05;
    const distributable = (totalWinningPool + totalLosingPool) * (1 - feeRate);
    // Three winners splitting an indivisible pool.
    const stakes = [3, 3, 1];
    const sum = stakes.reduce(
      (acc, s) => acc + computeMarketPayout({ playerWagered: s, totalWinningPool, totalLosingPool, feeRate }).payout,
      0,
    );
    expect(sum).toBeLessThanOrEqual(distributable);
  });

  it("returns zero when the winning pool is empty or the stake is zero", () => {
    expect(computeMarketPayout({ playerWagered: 100, totalWinningPool: 0, totalLosingPool: 500, feeRate: 0.05 }))
      .toEqual({ payout: 0, feeShareMicro: 0 });
    expect(computeMarketPayout({ playerWagered: 0, totalWinningPool: 500, totalLosingPool: 500, feeRate: 0.05 }))
      .toEqual({ payout: 0, feeShareMicro: 0 });
  });

  it("with no losers and no fee, a sole winner gets their stake back", () => {
    const r = computeMarketPayout({ playerWagered: 500, totalWinningPool: 500, totalLosingPool: 0, feeRate: 0 });
    expect(r.payout).toBe(500);
    expect(r.feeShareMicro).toBe(0);
  });
});
