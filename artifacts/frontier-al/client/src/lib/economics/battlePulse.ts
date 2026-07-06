/**
 * client/src/lib/economics/battlePulse.ts
 *
 * Pure shaping for Unit D2's "Battle Pulse" chart — a diverging daily view of
 * the war: attacker victories (captures) above the zero line, defenses held
 * below it, over a fixed trailing window of UTC calendar days (including
 * zero-battle days, so the window is always the full span, not just days
 * with data).
 *
 * CONTRACT: pure — no fetch, no clock. The caller supplies `now` and the raw
 * resolved-battle records (from `GET /api/battles/history`).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface BattlePulseInput {
  outcome: "attacker_wins" | "defender_wins";
  /** Epoch ms the battle resolved. */
  resolvedAt: number;
}

export interface BattlePulseDay {
  /** UTC calendar day, "YYYY-MM-DD". */
  dateKey: string;
  /** Positive count — rendered above the zero line. */
  attackerWins: number;
  /** Positive count — rendered BELOW the zero line by the caller (chart negates it for display). */
  defensesHeld: number;
}

function utcDateKey(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/** Start-of-UTC-day epoch ms for the given epoch. */
function utcDayStart(epochMs: number): number {
  const d = new Date(epochMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * @param battles resolved-battle records, any order.
 * @param now     current time (epoch ms) — the window's last day.
 * @param days    trailing window length in UTC calendar days (default 14).
 */
export function bucketBattlePulse(
  battles: BattlePulseInput[],
  now: number,
  days = 14,
): BattlePulseDay[] {
  const todayStart = utcDayStart(now);
  const windowStart = todayStart - (days - 1) * MS_PER_DAY;

  const buckets = new Map<string, BattlePulseDay>();
  for (let i = 0; i < days; i++) {
    const dayStart = windowStart + i * MS_PER_DAY;
    const key = utcDateKey(dayStart);
    buckets.set(key, { dateKey: key, attackerWins: 0, defensesHeld: 0 });
  }

  for (const b of battles) {
    if (!Number.isFinite(b.resolvedAt)) continue;
    if (b.resolvedAt < windowStart || b.resolvedAt >= todayStart + MS_PER_DAY) continue;
    const key = utcDateKey(b.resolvedAt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (b.outcome === "attacker_wins") bucket.attackerWins += 1;
    else bucket.defensesHeld += 1;
  }

  return Array.from(buckets.values());
}
