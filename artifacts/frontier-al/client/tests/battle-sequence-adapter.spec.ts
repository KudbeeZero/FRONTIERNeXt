/**
 * client/tests/battle-sequence-adapter.spec.ts
 *
 * Proves the client adapter that turns a public battle replay record into a
 * Battle Sequence: defensive-only fortification summing (mirrors resolve.ts),
 * safe defaults for fields the record omits, faithful pass-through of powers /
 * outcome / spoils, and the `revealedBeats` playhead helper.
 */
import { describe, it, expect } from "vitest";
import {
  buildSequenceFromReplay,
  fortificationLevel,
  revealedBeats,
  type ReplayRecordLike,
  type SequenceContext,
} from "../src/lib/battle/sequenceFromReplay";

function replay(over: Partial<ReplayRecordLike> = {}): ReplayRecordLike {
  return {
    battleId: "b-1",
    attackerName: "NEXUS-7",
    defenderName: "KRONOS",
    attackerPower: 103,
    defenderPower: 80,
    randFactor: 3,
    outcome: "attacker_wins",
    plotId: 1234,
    biome: "mountain",
    pillagedIron: 25,
    pillagedFuel: 10,
    pillagedCrystal: 0,
    ...over,
  };
}

const ctx: SequenceContext = { troopsCommitted: 50 };

describe("fortificationLevel", () => {
  it("sums ONLY defensive improvement levels (turret/shield_gen/fortress)", () => {
    expect(
      fortificationLevel([
        { type: "turret", level: 3 },
        { type: "shield_gen", level: 2 },
        { type: "fortress", level: 1 },
        { type: "mine", level: 9 }, // non-defensive — excluded
        { type: "radar", level: 1 }, // detection, not defender power — excluded
      ]),
    ).toBe(6);
  });

  it("is 0 for none / nullish / negative levels", () => {
    expect(fortificationLevel([])).toBe(0);
    expect(fortificationLevel(undefined)).toBe(0);
    expect(fortificationLevel(null)).toBe(0);
    expect(fortificationLevel([{ type: "turret", level: -5 }])).toBe(0);
  });
});

describe("buildSequenceFromReplay", () => {
  it("passes powers, outcome, plot, biome and spoils through to the sequence", () => {
    const seq = buildSequenceFromReplay(replay(), ctx);
    expect(seq.attacker.power).toBe(103);
    expect(seq.defender.power).toBe(80);
    expect(seq.outcome).toBe("attacker_wins");
    expect(seq.captured).toBe(true);
    expect(seq.plotId).toBe(1234);
    expect(seq.biome).toBe("mountain");
    expect(seq.spoils).toEqual({ iron: 25, fuel: 10, crystal: 0 });
    expect(seq.beats).toHaveLength(10);
  });

  it("feeds injected fortifications into the defender brace caption", () => {
    const seq = buildSequenceFromReplay(replay(), {
      troopsCommitted: 50,
      improvements: [{ type: "turret", level: 2 }, { type: "fortress", level: 1 }],
    });
    const brace = seq.beats.find((b) => b.kind === "brace")!;
    expect(brace.caption).toContain("L3");
  });

  it("uses safe defaults when the record omits optional fields", () => {
    const sparse: ReplayRecordLike = {
      attackerPower: 50,
      defenderPower: 50,
      randFactor: 0,
      outcome: "defender_wins",
    };
    const seq = buildSequenceFromReplay(sparse, { troopsCommitted: 0 });
    expect(seq.plotId).toBe(0);
    expect(seq.biome).toBe("plains");
    expect(seq.attacker.name).toBe("Attacker");
    expect(seq.defender.name).toBe("the garrison"); // null defender → neutral
    expect(seq.durationMs).toBeGreaterThan(0);
  });

  it("threads colours through for the renderer", () => {
    const seq = buildSequenceFromReplay(replay(), {
      troopsCommitted: 10,
      attackerColor: "#abc",
      defenderColor: "#def",
    });
    expect(seq.attacker.color).toBe("#abc");
    expect(seq.victorColor).toBe("#abc"); // attacker won
  });
});

describe("revealedBeats", () => {
  it("reveals beats as the playhead passes their start", () => {
    const seq = buildSequenceFromReplay(replay(), ctx);
    expect(revealedBeats(seq, -1)).toHaveLength(0);
    expect(revealedBeats(seq, 0).map((b) => b.kind)).toEqual(["muster"]);
    expect(revealedBeats(seq, seq.durationMs)).toHaveLength(10);
    expect(revealedBeats(seq, seq.durationMs * 4)).toHaveLength(10);
  });

  it("is monotonic — count never decreases as elapsed grows", () => {
    const seq = buildSequenceFromReplay(replay(), ctx);
    let prev = 0;
    for (let t = 0; t <= seq.durationMs; t += 100) {
      const n = revealedBeats(seq, t).length;
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });
});
