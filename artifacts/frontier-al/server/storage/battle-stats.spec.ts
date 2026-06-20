/**
 * server/storage/battle-stats.spec.ts
 *
 * Proves `computePlayerBattleStats` (Phase-2 PR2): attacker/defender win+hold
 * rates with divide-by-zero guard, current attacker streak (win/loss/none),
 * biggest-victory selection by power margin, lifetime commitment totals, recent
 * ordering + cap, and the empty/no-battles shape.
 */
import { describe, it, expect } from "vitest";
import { computePlayerBattleStats } from "./battle-stats";
import type { Battle } from "@shared/schema";

const ME = "player-me";

function battle(over: Partial<Battle>): Battle {
  return {
    id: "b-" + Math.random().toString(36).slice(2),
    attackerId: ME,
    defenderId: "player-other",
    targetParcelId: "parcel-x",
    attackerPower: 100,
    defenderPower: 80,
    troopsCommitted: 10,
    resourcesBurned: { iron: 5, fuel: 3 },
    startTs: 1000,
    resolveTs: 2000,
    status: "resolved",
    outcome: "attacker_wins",
    ...over,
  };
}

describe("computePlayerBattleStats", () => {
  it("returns a zeroed shape for a player with no battles", () => {
    const s = computePlayerBattleStats([], ME);
    expect(s).toMatchObject({
      attacks: { total: 0, wins: 0, losses: 0, winRate: 0 },
      defenses: { total: 0, held: 0, lost: 0, holdRate: 0 },
      currentStreak: { kind: "none", count: 0 },
      biggestVictory: null,
      recent: [],
    });
  });

  it("computes attacker win rate (rounded) and counts", () => {
    const s = computePlayerBattleStats(
      [
        battle({ outcome: "attacker_wins" }),
        battle({ outcome: "attacker_wins" }),
        battle({ outcome: "defender_wins" }),
      ],
      ME,
    );
    expect(s.attacks).toEqual({ total: 3, wins: 2, losses: 1, winRate: 67 });
  });

  it("computes defender hold rate", () => {
    const s = computePlayerBattleStats(
      [
        battle({ attackerId: "x", defenderId: ME, outcome: "defender_wins" }),
        battle({ attackerId: "x", defenderId: ME, outcome: "attacker_wins" }),
      ],
      ME,
    );
    expect(s.defenses).toEqual({ total: 2, held: 1, lost: 1, holdRate: 50 });
  });

  it("ignores pending/outcome-less battles", () => {
    const s = computePlayerBattleStats(
      [battle({ status: "pending", outcome: undefined }), battle({ outcome: "attacker_wins" })],
      ME,
    );
    expect(s.attacks.total).toBe(1);
  });

  it("tracks the current attacker streak from the most recent attack", () => {
    // most recent (resolveTs desc): win@5000, win@4000, loss@3000 → win streak 2
    const s = computePlayerBattleStats(
      [
        battle({ resolveTs: 3000, outcome: "defender_wins" }),
        battle({ resolveTs: 4000, outcome: "attacker_wins" }),
        battle({ resolveTs: 5000, outcome: "attacker_wins" }),
      ],
      ME,
    );
    expect(s.currentStreak).toEqual({ kind: "win", count: 2 });
  });

  it("reports a loss streak when the latest attacks are losses", () => {
    const s = computePlayerBattleStats(
      [
        battle({ resolveTs: 5000, outcome: "defender_wins" }),
        battle({ resolveTs: 4000, outcome: "defender_wins" }),
        battle({ resolveTs: 3000, outcome: "attacker_wins" }),
      ],
      ME,
    );
    expect(s.currentStreak).toEqual({ kind: "loss", count: 2 });
  });

  it("selects the biggest victory by power margin (wins only)", () => {
    const s = computePlayerBattleStats(
      [
        battle({ id: "small", attackerPower: 90, defenderPower: 80, outcome: "attacker_wins" }), // margin 10
        battle({ id: "big", attackerPower: 200, defenderPower: 50, outcome: "attacker_wins" }), // margin 150
        battle({ id: "loss", attackerPower: 999, defenderPower: 1, outcome: "defender_wins" }), // ignored
      ],
      ME,
    );
    expect(s.biggestVictory).toMatchObject({ battleId: "big", margin: 150 });
  });

  it("sums lifetime attacker commitments", () => {
    const s = computePlayerBattleStats(
      [
        battle({ troopsCommitted: 10, resourcesBurned: { iron: 5, fuel: 3 } }),
        battle({ troopsCommitted: 20, resourcesBurned: { iron: 1, fuel: 2 } }),
      ],
      ME,
    );
    expect(s.totals).toEqual({ troopsCommitted: 30, ironBurned: 6, fuelBurned: 5 });
  });

  it("returns recent battles newest-first, capped at 10, tagged by role", () => {
    const rows: Battle[] = [];
    for (let i = 0; i < 12; i++) rows.push(battle({ id: `a${i}`, resolveTs: 1000 + i }));
    rows.push(battle({ id: "def", attackerId: "x", defenderId: ME, resolveTs: 99999, outcome: "defender_wins" }));
    const s = computePlayerBattleStats(rows, ME);
    expect(s.recent.length).toBe(10);
    expect(s.recent[0]).toMatchObject({ battleId: "def", role: "defender", outcome: "defender_wins" });
    // strictly descending resolveTs
    for (let i = 1; i < s.recent.length; i++) {
      expect(s.recent[i - 1].resolveTs).toBeGreaterThanOrEqual(s.recent[i].resolveTs);
    }
  });
});
