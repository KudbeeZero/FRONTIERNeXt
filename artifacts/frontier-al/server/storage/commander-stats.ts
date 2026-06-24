/**
 * server/storage/commander-stats.ts
 *
 * Pure aggregator for a COMMANDER's combat record (Phase-2: commander stats /
 * leaderboard). Sibling to `computePlayerBattleStats` — same pure style, no DB,
 * no IO, fully unit-testable.
 *
 * A commander deploys on the attack, so its record is derived from the resolved
 * battles it was committed to (`battle.commanderId`). Output carries only
 * already-public combat data — powers, counts, battleId, and the commander's NFT
 * id (already a public identifier, e.g. `/api/nft/commander/:commanderId`). No
 * wallet addresses or player/parcel UUIDs.
 */

import type { Battle } from "@shared/schema";

export interface CommanderBattleStats {
  commanderId: string;
  /** Battles this commander was deployed in (attacker role). */
  battles: { total: number; wins: number; losses: number; winRate: number };
  /** Lifetime commitments while this commander led. */
  totals: { troopsCommitted: number; ironBurned: number; fuelBurned: number };
  /** Streak over the most recent battles this commander led. */
  currentStreak: { kind: "win" | "loss" | "none"; count: number };
  /** Win with the largest power margin under this commander, or null. */
  biggestVictory: { battleId: string; attackerPower: number; defenderPower: number; margin: number } | null;
  /** Most recent battles led, newest first, capped at 10. */
  recent: Array<{ battleId: string; outcome: "attacker_wins" | "defender_wins"; resolveTs: number }>;
}

const RECENT_LIMIT = 10;

/** Integer percent, guarded against divide-by-zero. */
function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

export function computeCommanderStats(battles: Battle[], commanderId: string): CommanderBattleStats {
  // Only resolved battles this commander actually led contribute.
  const fought = battles.filter(
    (b) => b.status === "resolved" && !!b.outcome && b.commanderId === commanderId,
  );

  const wins = fought.filter((b) => b.outcome === "attacker_wins").length;
  const losses = fought.length - wins;

  let troopsCommitted = 0;
  let ironBurned = 0;
  let fuelBurned = 0;
  let biggestVictory: CommanderBattleStats["biggestVictory"] = null;
  for (const b of fought) {
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

  // Current streak: walk most-recent battles while the outcome matches.
  const byRecent = [...fought].sort((a, b) => b.resolveTs - a.resolveTs);
  let currentStreak: CommanderBattleStats["currentStreak"] = { kind: "none", count: 0 };
  if (byRecent.length > 0) {
    const wonMostRecent = byRecent[0].outcome === "attacker_wins";
    let count = 0;
    for (const b of byRecent) {
      if ((b.outcome === "attacker_wins") === wonMostRecent) count++;
      else break;
    }
    currentStreak = { kind: wonMostRecent ? "win" : "loss", count };
  }

  const recent = byRecent.slice(0, RECENT_LIMIT).map((b) => ({
    battleId: b.id,
    outcome: b.outcome as "attacker_wins" | "defender_wins",
    resolveTs: b.resolveTs,
  }));

  return {
    commanderId,
    battles: { total: fought.length, wins, losses, winRate: pct(wins, fought.length) },
    totals: { troopsCommitted, ironBurned, fuelBurned },
    currentStreak,
    biggestVictory,
    recent,
  };
}

/**
 * Stats for every commander that led a battle in `battles`, ranked as a
 * leaderboard: most wins first, then most battles, then commanderId for a
 * stable order. Pass a single player's attacker battles to get *their*
 * commanders' records.
 */
export function computeAllCommanderStats(battles: Battle[]): CommanderBattleStats[] {
  const ids = Array.from(
    new Set(
      battles
        .filter((b) => b.status === "resolved" && !!b.outcome && !!b.commanderId)
        .map((b) => b.commanderId as string),
    ),
  );
  return ids
    .map((id) => computeCommanderStats(battles, id))
    .sort(
      (a, b) =>
        b.battles.wins - a.battles.wins ||
        b.battles.total - a.battles.total ||
        a.commanderId.localeCompare(b.commanderId),
    );
}
