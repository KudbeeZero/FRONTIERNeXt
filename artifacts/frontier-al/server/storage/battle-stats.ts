/**
 * server/storage/battle-stats.ts
 *
 * Pure aggregator for a player's combat record (Phase-2 PR2). Mirrors the pure
 * style of `computeLeaderboard` (game-rules.ts) — no DB, no IO, fully unit-testable.
 *
 * Input is the player's RESOLVED battles (as attacker or defender); output is a
 * derived stats shape served by GET /api/players/:id/battle-stats. Carries only
 * already-public data (powers, counts, battleId — battleId is already exposed by
 * /api/battles/history); no wallet addresses or player/parcel UUIDs.
 */

import type { Battle } from "@shared/schema";

export interface PlayerBattleStats {
  playerId: string;
  /** As attacker. */
  attacks: { total: number; wins: number; losses: number; winRate: number };
  /** As defender. `held` = defender_wins. */
  defenses: { total: number; held: number; lost: number; holdRate: number };
  /** Attacker-perspective streak over the most recent attacks. */
  currentStreak: { kind: "win" | "loss" | "none"; count: number };
  /** Lifetime attacker commitments. */
  totals: { troopsCommitted: number; ironBurned: number; fuelBurned: number };
  /** Attacker win with the largest power margin, or null if none. */
  biggestVictory: { battleId: string; attackerPower: number; defenderPower: number; margin: number } | null;
  /** Most recent battles (either role), newest first, capped at 10. */
  recent: Array<{ battleId: string; role: "attacker" | "defender"; outcome: "attacker_wins" | "defender_wins"; resolveTs: number }>;
}

const RECENT_LIMIT = 10;

/** Integer percent, guarded against divide-by-zero. */
function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

export function computePlayerBattleStats(battles: Battle[], playerId: string): PlayerBattleStats {
  // Defensive: only resolved battles with an outcome contribute.
  const resolved = battles.filter((b) => b.status === "resolved" && !!b.outcome);

  const asAttacker = resolved.filter((b) => b.attackerId === playerId);
  const asDefender = resolved.filter((b) => b.defenderId === playerId);

  const wins = asAttacker.filter((b) => b.outcome === "attacker_wins").length;
  const losses = asAttacker.length - wins;
  const held = asDefender.filter((b) => b.outcome === "defender_wins").length;
  const lost = asDefender.length - held;

  let troopsCommitted = 0;
  let ironBurned = 0;
  let fuelBurned = 0;
  let biggestVictory: PlayerBattleStats["biggestVictory"] = null;
  for (const b of asAttacker) {
    troopsCommitted += b.troopsCommitted ?? 0;
    ironBurned += b.resourcesBurned?.iron ?? 0;
    fuelBurned += b.resourcesBurned?.fuel ?? 0;
    if (b.outcome === "attacker_wins") {
      const margin = b.attackerPower - b.defenderPower;
      if (!biggestVictory || margin > biggestVictory.margin) {
        biggestVictory = { battleId: b.id, attackerPower: b.attackerPower, defenderPower: b.defenderPower, margin };
      }
    }
  }

  // Current attacker streak: walk most-recent attacks while the outcome matches.
  const attacksByRecent = [...asAttacker].sort((a, b) => b.resolveTs - a.resolveTs);
  let currentStreak: PlayerBattleStats["currentStreak"] = { kind: "none", count: 0 };
  if (attacksByRecent.length > 0) {
    const wonMostRecent = attacksByRecent[0].outcome === "attacker_wins";
    let count = 0;
    for (const b of attacksByRecent) {
      if ((b.outcome === "attacker_wins") === wonMostRecent) count++;
      else break;
    }
    currentStreak = { kind: wonMostRecent ? "win" : "loss", count };
  }

  const recent = resolved
    .slice()
    .sort((a, b) => b.resolveTs - a.resolveTs)
    .slice(0, RECENT_LIMIT)
    .map((b) => ({
      battleId: b.id,
      role: (b.attackerId === playerId ? "attacker" : "defender") as "attacker" | "defender",
      outcome: b.outcome as "attacker_wins" | "defender_wins",
      resolveTs: b.resolveTs,
    }));

  return {
    playerId,
    attacks: { total: asAttacker.length, wins, losses, winRate: pct(wins, asAttacker.length) },
    defenses: { total: asDefender.length, held, lost, holdRate: pct(held, asDefender.length) },
    currentStreak,
    totals: { troopsCommitted, ironBurned, fuelBurned },
    biggestVictory,
    recent,
  };
}
