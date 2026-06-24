/**
 * client/tests/sequence-from-battle.spec.ts
 *
 * Proves the globe-side sequence builders: reconstruct the adjusted attacker
 * power from the snapshot + randFactor (so swing-flip detection matches the
 * resolver), default a missing randFactor to 0, and merge a cached Battle row +
 * outcome + parcel facts into the cinematic facts.
 */
import { describe, it, expect } from "vitest";
import type { Battle } from "@shared/schema";
import {
  buildSequenceFromFacts,
  factsFromBattle,
  factsFromResolvedEvent,
  type ResolvedBattleFacts,
  type ResolvedEventLike,
} from "../src/lib/battle/sequenceFromBattle";

function facts(over: Partial<ResolvedBattleFacts> = {}): ResolvedBattleFacts {
  return {
    battleId: "b-1",
    source: { lat: 10, lng: 20 },
    target: { lat: -15, lng: 95 },
    plotId: 1234,
    biome: "mountain",
    attackerName: "NEXUS-7",
    defenderName: "KRONOS",
    attackerPowerSnapshot: 100,
    defenderPower: 80,
    randFactor: 3,
    outcome: "attacker_wins",
    troopsCommitted: 50,
    ...over,
  };
}

describe("buildSequenceFromFacts", () => {
  it("reconstructs adjusted attacker power = snapshot × (1 + rf/100)", () => {
    const seq = buildSequenceFromFacts(facts({ attackerPowerSnapshot: 100, randFactor: 8 }));
    expect(seq.attacker.power).toBeCloseTo(108, 5);
  });

  it("detects a swing that flipped the result via the reconstructed power", () => {
    // snapshot 95 < defender 100 (would lose); +8% → 102.6 > 100 (wins) ⇒ decided swing
    const seq = buildSequenceFromFacts(
      facts({ attackerPowerSnapshot: 95, defenderPower: 100, randFactor: 8, outcome: "attacker_wins" }),
    );
    expect(seq.swingDecided).toBe(true);
  });

  it("defaults a missing randFactor to 0 (flat swing, power unchanged)", () => {
    const seq = buildSequenceFromFacts(facts({ attackerPowerSnapshot: 120, randFactor: undefined }));
    expect(seq.attacker.power).toBe(120);
    expect(seq.randFactor).toBe(0);
  });

  it("produces the full 10-beat sequence with the right outcome", () => {
    const seq = buildSequenceFromFacts(facts({ outcome: "defender_wins" }));
    expect(seq.beats).toHaveLength(10);
    expect(seq.captured).toBe(false);
  });
});

describe("factsFromBattle", () => {
  const battle: Battle = {
    id: "b-9",
    attackerId: "p-a",
    defenderId: "p-d",
    targetParcelId: "parcel-t",
    attackerPower: 140,
    defenderPower: 90,
    troopsCommitted: 30,
    resourcesBurned: { iron: 100, fuel: 40 },
    startTs: 1000,
    resolveTs: 5000,
    status: "resolved",
    outcome: "attacker_wins",
    randFactor: 5,
    commanderId: "cmd-1",
    sourceParcelId: "parcel-s",
  };

  it("pulls snapshot power, troops, commander from the row and positions from the parcel", () => {
    const f = factsFromBattle(
      battle,
      "attacker_wins",
      {
        source: { lat: 1, lng: 2 },
        target: { lat: 3, lng: 4 },
        plotId: 777,
        biome: "desert",
        improvements: [{ type: "turret", level: 2 }],
      },
      { attackerName: "VANGUARD", defenderName: "SPECTRE" },
      { attackerColor: "#abc" },
    );
    expect(f.attackerPowerSnapshot).toBe(140);
    expect(f.troopsCommitted).toBe(30);
    expect(f.hasCommander).toBe(true);
    expect(f.plotId).toBe(777);
    expect(f.source).toEqual({ lat: 1, lng: 2 });
    expect(f.attackerColor).toBe("#abc");

    // and it round-trips through the engine
    const seq = buildSequenceFromFacts(f);
    expect(seq.attacker.power).toBeCloseTo(140 * 1.05, 5);
    expect(seq.biome).toBe("desert");
  });

  it("marks no commander when the row has none", () => {
    const f = factsFromBattle(
      { ...battle, commanderId: undefined },
      "defender_wins",
      { source: { lat: 0, lng: 0 }, target: { lat: 0, lng: 0 }, plotId: 1, biome: "plains" },
      { attackerName: "A" },
    );
    expect(f.hasCommander).toBe(false);
    expect(f.defenderName).toBeNull();
  });
});

describe("factsFromResolvedEvent", () => {
  const event: ResolvedEventLike = {
    battleId: "b-7",
    outcome: "attacker_wins",
    plotId: 555,
    biome: "volcanic",
    attackerName: "VANGUARD",
    defenderName: "KRONOS",
    attackerPower: 95, // snapshot (pre-randFactor)
    defenderPower: 100,
    randFactor: 8,
  };

  it("carries the REAL randFactor so a decided swing is detected on the globe", () => {
    const f = factsFromResolvedEvent(event, {
      source: { lat: 1, lng: 2 },
      target: { lat: 3, lng: 4 },
    });
    expect(f.randFactor).toBe(8);
    expect(f.attackerPowerSnapshot).toBe(95);
    const seq = buildSequenceFromFacts(f);
    // 95 < 100 raw, but 95×1.08 = 102.6 > 100 ⇒ the swing decided it
    expect(seq.swingDecided).toBe(true);
    expect(seq.attacker.power).toBeCloseTo(102.6, 5);
  });

  it("merges troops/commander/fortifications from context (event omits them)", () => {
    const f = factsFromResolvedEvent(event, {
      source: { lat: 1, lng: 2 },
      target: { lat: 3, lng: 4 },
      troopsCommitted: 40,
      hasCommander: true,
      improvements: [{ type: "turret", level: 3 }],
    });
    expect(f.troopsCommitted).toBe(40);
    expect(f.hasCommander).toBe(true);
    const seq = buildSequenceFromFacts(f);
    expect(seq.beats.find((b) => b.kind === "brace")!.caption).toContain("L3");
  });

  it("defaults troops/commander to 0/false when context omits them", () => {
    const f = factsFromResolvedEvent(event, { source: { lat: 0, lng: 0 }, target: { lat: 1, lng: 1 } });
    expect(f.troopsCommitted).toBe(0);
    expect(f.hasCommander).toBe(false);
  });
});
