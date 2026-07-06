/**
 * client/tests/battle-pulse.spec.ts
 *
 * Proves the pure Battle Pulse bucketing: a full trailing window of UTC
 * calendar days (including zero-battle days), correct attacker/defender
 * tallies per day, boundary handling at the window edges, and out-of-window
 * battles excluded.
 */
import { describe, it, expect } from "vitest";
import { bucketBattlePulse } from "../src/lib/economics/battlePulse";

// Fixed "now": 2026-07-06T12:00:00Z
const NOW = Date.UTC(2026, 6, 6, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

describe("bucketBattlePulse", () => {
  it("returns exactly `days` buckets, oldest first, ending on today", () => {
    const out = bucketBattlePulse([], NOW, 5);
    expect(out).toHaveLength(5);
    expect(out[0].dateKey).toBe("2026-07-02");
    expect(out[4].dateKey).toBe("2026-07-06");
  });

  it("zero-battle days are still present with 0/0", () => {
    const out = bucketBattlePulse([], NOW, 3);
    for (const day of out) {
      expect(day.attackerWins).toBe(0);
      expect(day.defensesHeld).toBe(0);
    }
  });

  it("tallies attacker_wins and defender_wins into the correct day", () => {
    const todayStart = Date.UTC(2026, 6, 6);
    const out = bucketBattlePulse(
      [
        { outcome: "attacker_wins", resolvedAt: todayStart + 1000 },
        { outcome: "attacker_wins", resolvedAt: todayStart + 2000 },
        { outcome: "defender_wins", resolvedAt: todayStart + 3000 },
      ],
      NOW,
      1,
    );
    expect(out).toHaveLength(1);
    expect(out[0].attackerWins).toBe(2);
    expect(out[0].defensesHeld).toBe(1);
  });

  it("excludes battles resolved before the trailing window", () => {
    const tooOld = NOW - 30 * DAY;
    const out = bucketBattlePulse([{ outcome: "attacker_wins", resolvedAt: tooOld }], NOW, 14);
    const total = out.reduce((s, d) => s + d.attackerWins + d.defensesHeld, 0);
    expect(total).toBe(0);
  });

  it("includes a battle resolved earlier today (within the current UTC day)", () => {
    const earlierToday = Date.UTC(2026, 6, 6, 0, 30);
    const out = bucketBattlePulse([{ outcome: "attacker_wins", resolvedAt: earlierToday }], NOW, 1);
    expect(out[0].attackerWins).toBe(1);
  });

  it("ignores non-finite resolvedAt without throwing", () => {
    const out = bucketBattlePulse([{ outcome: "attacker_wins", resolvedAt: NaN }], NOW, 3);
    const total = out.reduce((s, d) => s + d.attackerWins, 0);
    expect(total).toBe(0);
  });
});
