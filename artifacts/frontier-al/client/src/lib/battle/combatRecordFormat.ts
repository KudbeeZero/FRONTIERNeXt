/**
 * client/src/lib/battle/combatRecordFormat.ts
 *
 * Pure display formatting for a commander's combat record — turns the
 * `/api/players/:id/commander-stats` shape (server: computeCommanderStats) into
 * compact, ready-to-render strings. Pure + tested; the component is a thin shell.
 */

/** Structural subset of the server's CommanderBattleStats the UI needs. */
export interface CommanderRecord {
  commanderId: string;
  battles: { total: number; wins: number; losses: number; winRate: number };
  currentStreak: { kind: "win" | "loss" | "none"; count: number };
  biggestVictory: { margin: number } | null;
}

export interface CommanderRecordDisplay {
  /** e.g. "12W–3L · 80%" */
  record: string;
  /** e.g. "15 battles led" */
  battlesLabel: string;
  /** e.g. "4-win streak" / "3-loss skid" — empty for streaks < 2. */
  streak: string;
  /** e.g. "best rout +150" — empty when there's no victory. */
  biggest: string;
}

export function formatCommanderRecord(s: CommanderRecord): CommanderRecordDisplay {
  const record = `${s.battles.wins}W–${s.battles.losses}L · ${s.battles.winRate}%`;
  const battlesLabel = `${s.battles.total} ${s.battles.total === 1 ? "battle" : "battles"} led`;

  let streak = "";
  if (s.currentStreak.count >= 2) {
    streak =
      s.currentStreak.kind === "win"
        ? `${s.currentStreak.count}-win streak`
        : s.currentStreak.kind === "loss"
          ? `${s.currentStreak.count}-loss skid`
          : "";
  }

  const biggest = s.biggestVictory ? `best rout +${Math.round(s.biggestVictory.margin)}` : "";

  return { record, battlesLabel, streak, biggest };
}

/**
 * Short, readable label for a commander's public NFT id (the global leaderboard
 * has no name source). e.g. "a1b2c3d4-…-ef56" → "a1b2…ef56".
 */
export function shortCommanderId(id: string): string {
  if (!id) return "Commander";
  const compact = id.replace(/-/g, "");
  return compact.length > 8 ? `${compact.slice(0, 4)}…${compact.slice(-4)}` : compact;
}
