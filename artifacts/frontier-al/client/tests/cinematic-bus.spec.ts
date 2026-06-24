/**
 * client/tests/cinematic-bus.spec.ts
 *
 * Proves the cinematic pub/sub + the pure `activeCallout` read: subscribers
 * receive published handles, unsubscribe stops delivery, and the callout tracks
 * the active beat caption and goes null once the sequence settles.
 */
import { describe, it, expect } from "vitest";
import { buildBattleSequence, type BattleSequenceInput } from "@shared/battle-sequence";
import { onCinematic, publishCinematic, activeCallout } from "../src/lib/battle/cinematicBus";

function seq(over: Partial<BattleSequenceInput> = {}) {
  return buildBattleSequence({
    battleId: "b-1",
    source: { lat: 10, lng: 20 },
    target: { lat: -15, lng: 95 },
    plotId: 1234,
    biome: "mountain",
    attackerName: "NEXUS-7",
    defenderName: "KRONOS",
    attackerPower: 103,
    defenderPower: 80,
    randFactor: 3,
    outcome: "attacker_wins",
    troopsCommitted: 50,
    ...over,
  });
}

describe("cinematic bus", () => {
  it("delivers published handles to subscribers and stops after unsubscribe", () => {
    const got: number[] = [];
    const unsub = onCinematic((h) => got.push(h.startMs));
    publishCinematic({ seq: seq(), startMs: 111 });
    publishCinematic({ seq: seq(), startMs: 222 });
    unsub();
    publishCinematic({ seq: seq(), startMs: 333 });
    expect(got).toEqual([111, 222]);
  });

  it("isolates subscribers — one throwing doesn't stop the others", () => {
    const got: string[] = [];
    const a = onCinematic(() => { throw new Error("boom"); });
    const b = onCinematic(() => got.push("b"));
    expect(() => publishCinematic({ seq: seq(), startMs: 1 })).not.toThrow();
    expect(got).toEqual(["b"]);
    a(); b();
  });
});

describe("activeCallout", () => {
  it("returns the muster caption at t=0 and the clash caption mid-clash", () => {
    const s = seq();
    expect(activeCallout(s, 0)?.kind).toBe("muster");
    const clash = s.beats.find((b) => b.kind === "clash")!;
    const c = activeCallout(s, clash.startMs + clash.durationMs / 2);
    expect(c?.kind).toBe("clash");
    expect(c?.caption).toContain("vs");
  });

  it("is null before the start and once settled", () => {
    const s = seq();
    expect(activeCallout(s, -1)).toBeNull();
    expect(activeCallout(s, s.durationMs)).toBeNull();
  });

  it("carries the active beat intensity in 0..1", () => {
    const s = seq();
    const c = activeCallout(s, 0)!;
    expect(c.intensity).toBeGreaterThanOrEqual(0);
    expect(c.intensity).toBeLessThanOrEqual(1);
  });
});
