/**
 * client/tests/combat-record-format.spec.ts
 *
 * Proves the pure commander combat-record formatter: W–L–rate string, singular/
 * plural battles label, streak shown only at >= 2 (win vs loss), and the biggest-
 * rout line present only when there's a victory.
 */
import { describe, it, expect } from "vitest";
import { formatCommanderRecord, shortCommanderId, type CommanderRecord } from "../src/lib/battle/combatRecordFormat";

function rec(over: Partial<CommanderRecord> = {}): CommanderRecord {
  return {
    commanderId: "c1",
    battles: { total: 15, wins: 12, losses: 3, winRate: 80 },
    currentStreak: { kind: "win", count: 4 },
    biggestVictory: { margin: 150 },
    ...over,
  };
}

describe("formatCommanderRecord", () => {
  it("formats the W–L–rate record and battles label", () => {
    const d = formatCommanderRecord(rec());
    expect(d.record).toBe("12W–3L · 80%");
    expect(d.battlesLabel).toBe("15 battles led");
  });

  it("uses the singular for a single battle", () => {
    expect(formatCommanderRecord(rec({ battles: { total: 1, wins: 1, losses: 0, winRate: 100 } })).battlesLabel)
      .toBe("1 battle led");
  });

  it("shows a win streak / loss skid only at >= 2", () => {
    expect(formatCommanderRecord(rec({ currentStreak: { kind: "win", count: 4 } })).streak).toBe("4-win streak");
    expect(formatCommanderRecord(rec({ currentStreak: { kind: "loss", count: 3 } })).streak).toBe("3-loss skid");
    expect(formatCommanderRecord(rec({ currentStreak: { kind: "win", count: 1 } })).streak).toBe("");
    expect(formatCommanderRecord(rec({ currentStreak: { kind: "none", count: 0 } })).streak).toBe("");
  });

  it("shows the biggest rout only when there's a victory", () => {
    expect(formatCommanderRecord(rec({ biggestVictory: { margin: 149.6 } })).biggest).toBe("best rout +150");
    expect(formatCommanderRecord(rec({ biggestVictory: null })).biggest).toBe("");
  });
});

describe("shortCommanderId", () => {
  it("abbreviates a long uuid, stripping dashes", () => {
    expect(shortCommanderId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe("a1b2…7890");
  });
  it("leaves a short id intact", () => {
    expect(shortCommanderId("abc123")).toBe("abc123");
  });
  it("falls back for an empty id", () => {
    expect(shortCommanderId("")).toBe("Commander");
  });
});
