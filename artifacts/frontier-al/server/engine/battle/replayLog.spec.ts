/**
 * server/engine/battle/replayLog.spec.ts
 *
 * Proves `buildReplayLog` — the deterministic, structured battle replay log
 * (Phase-2 PR1). It must: compose attacker commitment → snapshot power, describe
 * defender terrain/fortifications → defender power, spread the engine's resolution
 * entries verbatim, and append the correct aftermath (conquest+pillage vs repelled).
 * Security: messages must never contain wallet addresses or raw UUIDs (the log is
 * served to clients via /api/battle/replay/:id).
 */
import { describe, it, expect } from "vitest";
import { buildReplayLog, type ReplayLogInput } from "./replayLog";
import type { BattleLogEntry } from "./types";

const RESOLUTION: BattleLogEntry[] = [
  { phase: "resolution", message: "randFactor=3, adjusted attacker=103.00, defender=80.00" },
  { phase: "resolution", message: "Outcome: attacker_wins" },
];

function baseInput(over: Partial<ReplayLogInput> = {}): ReplayLogInput {
  return {
    attackerName: "Vanguard",
    troopsCommitted: 50,
    ironBurned: 100,
    fuelBurned: 40,
    crystalBurned: 0,
    hasCommander: false,
    attackerPowerSnapshot: 100,
    defenderPower: 80,
    defenseLevel: 3,
    biome: "mountain",
    improvements: [],
    plotId: 1234,
    attackerWins: true,
    pillagedIron: 25,
    pillagedFuel: 10,
    pillagedCrystal: 0,
    resolutionLog: RESOLUTION,
    ...over,
  };
}

describe("buildReplayLog", () => {
  it("emits structured phases in order: power_calc, terrain, resolution…, aftermath", () => {
    const log = buildReplayLog(baseInput());
    expect(log[0].phase).toBe("power_calc");
    expect(log[1].phase).toBe("terrain");
    // resolution log spread, then aftermath (all "resolution")
    expect(log.slice(2).every((e) => e.phase === "resolution")).toBe(true);
  });

  it("composes attacker commitment and snapshot power", () => {
    const msg = buildReplayLog(baseInput())[0].message;
    expect(msg).toContain("Vanguard committed 50 troops, 100 iron, 40 fuel");
    expect(msg).toContain("attack power 100.00");
    expect(msg).not.toContain("crystal"); // omitted when 0
    expect(msg).not.toContain("commander"); // omitted when absent
  });

  it("notes commander and crystal when present", () => {
    const msg = buildReplayLog(baseInput({ hasCommander: true, crystalBurned: 5 }))[0].message;
    expect(msg).toContain("5 crystal");
    expect(msg).toContain("(commander deployed)");
  });

  it("describes defender terrain, defense level, fortifications and power", () => {
    const msg = buildReplayLog(
      baseInput({ improvements: [{ type: "turret", level: 2 }, { type: "shield_gen", level: 1 }, { type: "mine", level: 5 }] }),
    )[1].message;
    expect(msg).toContain("mountain biome");
    expect(msg).toContain("defense L3");
    expect(msg).toContain("turret L2");
    expect(msg).toContain("shield_gen L1");
    expect(msg).not.toContain("mine"); // non-defensive improvements excluded
    expect(msg).toContain("defender power 80.00");
  });

  it("says 'no fortifications' when there are none", () => {
    expect(buildReplayLog(baseInput())[1].message).toContain("no fortifications");
  });

  it("spreads the engine resolution log verbatim", () => {
    const log = buildReplayLog(baseInput());
    expect(log).toContainEqual(RESOLUTION[0]);
    expect(log).toContainEqual(RESOLUTION[1]);
  });

  it("appends a conquest + pillage line on attacker win", () => {
    const last = buildReplayLog(baseInput({ pillagedCrystal: 7 })).at(-1)!;
    expect(last.message).toBe("Vanguard captured plot #1234 — pillaged 25 iron, 10 fuel, 7 crystal.");
  });

  it("appends a repelled line on defender win (no spoils)", () => {
    const last = buildReplayLog(baseInput({ attackerWins: false })).at(-1)!;
    expect(last.message).toBe("Defense held at plot #1234 — Vanguard's attack was repelled.");
  });

  it("never leaks UUIDs or wallet addresses in any message", () => {
    const log = buildReplayLog(baseInput({ hasCommander: true, improvements: [{ type: "fortress", level: 2 }] }));
    const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i;
    const algoAddr = /[A-Z2-7]{58}/; // base32 Algorand address
    for (const e of log) {
      expect(e.message).not.toMatch(uuid);
      expect(e.message).not.toMatch(algoAddr);
    }
  });
});
