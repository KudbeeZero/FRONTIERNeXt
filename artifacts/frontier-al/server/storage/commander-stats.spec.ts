/**
 * server/storage/commander-stats.spec.ts
 *
 * Proves `computeCommanderStats` / `computeAllCommanderStats`: only resolved
 * battles the commander led count; win/loss/winRate; lifetime totals; biggest
 * victory by power margin; current streak; recent cap; and the leaderboard
 * ranking (wins, then battles, then id) with per-commander grouping.
 */
import { describe, it, expect } from "vitest";
import type { Battle } from "@shared/schema";
import { computeCommanderStats, computeAllCommanderStats } from "./commander-stats";

const CMD = "cmd-1";

function battle(over: Partial<Battle> = {}): Battle {
  return {
    id: "b-" + Math.random().toString(36).slice(2, 8),
    attackerId: "p-a",
    defenderId: "p-d",
    targetParcelId: "parcel-t",
    attackerPower: 120,
    defenderPower: 80,
    troopsCommitted: 30,
    resourcesBurned: { iron: 100, fuel: 40 },
    startTs: 1000,
    resolveTs: 2000,
    status: "resolved",
    outcome: "attacker_wins",
    commanderId: CMD,
    ...over,
  };
}

describe("computeCommanderStats", () => {
  it("is all-zero for a commander that never fought", () => {
    const s = computeCommanderStats([], CMD);
    expect(s.battles).toEqual({ total: 0, wins: 0, losses: 0, winRate: 0 });
    expect(s.biggestVictory).toBeNull();
    expect(s.currentStreak).toEqual({ kind: "none", count: 0 });
    expect(s.recent).toEqual([]);
  });

  it("counts only resolved battles this commander led", () => {
    const s = computeCommanderStats(
      [
        battle({ outcome: "attacker_wins" }),
        battle({ outcome: "defender_wins" }),
        battle({ status: "pending", outcome: undefined }), // unresolved → ignored
        battle({ commanderId: "other" }), // another commander → ignored
      ],
      CMD,
    );
    expect(s.battles.total).toBe(2);
    expect(s.battles.wins).toBe(1);
    expect(s.battles.losses).toBe(1);
    expect(s.battles.winRate).toBe(50);
  });

  it("sums lifetime commitments across led battles", () => {
    const s = computeCommanderStats(
      [
        battle({ troopsCommitted: 10, resourcesBurned: { iron: 5, fuel: 2 } }),
        battle({ troopsCommitted: 25, resourcesBurned: { iron: 15, fuel: 8 } }),
      ],
      CMD,
    );
    expect(s.totals).toEqual({ troopsCommitted: 35, ironBurned: 20, fuelBurned: 10 });
  });

  it("picks the biggest victory by power margin (wins only)", () => {
    const s = computeCommanderStats(
      [
        battle({ id: "small", attackerPower: 90, defenderPower: 80, outcome: "attacker_wins" }),
        battle({ id: "big", attackerPower: 200, defenderPower: 50, outcome: "attacker_wins" }),
        battle({ id: "loss", attackerPower: 300, defenderPower: 400, outcome: "defender_wins" }),
      ],
      CMD,
    );
    expect(s.biggestVictory?.battleId).toBe("big");
    expect(s.biggestVictory?.margin).toBe(150);
  });

  it("computes the current streak from the most recent led battles", () => {
    const s = computeCommanderStats(
      [
        battle({ resolveTs: 100, outcome: "attacker_wins" }),
        battle({ resolveTs: 200, outcome: "defender_wins" }),
        battle({ resolveTs: 300, outcome: "attacker_wins" }),
        battle({ resolveTs: 400, outcome: "attacker_wins" }),
      ],
      CMD,
    );
    expect(s.currentStreak).toEqual({ kind: "win", count: 2 });
  });

  it("caps recent at 10, newest first", () => {
    const rows = Array.from({ length: 14 }, (_, i) => battle({ id: "r" + i, resolveTs: i }));
    const s = computeCommanderStats(rows, CMD);
    expect(s.recent).toHaveLength(10);
    expect(s.recent[0].resolveTs).toBe(13);
    expect(s.recent[9].resolveTs).toBe(4);
  });
});

describe("computeAllCommanderStats", () => {
  it("groups by commander and ranks by wins, then battles, then id", () => {
    const rows = [
      battle({ commanderId: "alpha", outcome: "attacker_wins" }),
      battle({ commanderId: "alpha", outcome: "attacker_wins" }),
      battle({ commanderId: "beta", outcome: "attacker_wins" }),
      battle({ commanderId: "beta", outcome: "defender_wins" }),
      battle({ commanderId: "gamma", outcome: "defender_wins" }),
      battle({ status: "pending", outcome: undefined, commanderId: "delta" }), // ignored
    ];
    const all = computeAllCommanderStats(rows);
    expect(all.map((c) => c.commanderId)).toEqual(["alpha", "beta", "gamma"]); // delta excluded
    expect(all[0].battles.wins).toBe(2); // alpha leads
    expect(all[1].commanderId).toBe("beta"); // 1 win > gamma's 0
    expect(all[2].commanderId).toBe("gamma");
  });

  it("returns an empty leaderboard when no commander has fought", () => {
    expect(computeAllCommanderStats([])).toEqual([]);
    expect(computeAllCommanderStats([battle({ commanderId: undefined })])).toEqual([]);
  });
});
