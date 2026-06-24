/**
 * shared/battle-sequence.spec.ts
 *
 * Proves the FRONTIER Battle Sequence Engine — the timed cinematic spine.
 * It must: be deterministic; emit exactly the 10 canonical beats, gaplessly,
 * starting at 0; scale beat durations with real data (troops, arc distance,
 * luck swing); derive capture/spoils/swing-flip from the resolver's result;
 * keep every intensity in 0…1; sample correctly off a single clock; and never
 * leak wallet addresses or raw UUIDs in any caption.
 */
import { describe, it, expect } from "vitest";
import {
  buildBattleSequence,
  sampleSequence,
  beatAt,
  progressAt,
  greatCircleRadians,
  BEAT_ORDER,
  type BattleSequenceInput,
  type BattleSequence,
} from "./battle-sequence";

function baseInput(over: Partial<BattleSequenceInput> = {}): BattleSequenceInput {
  return {
    battleId: "battle-1",
    source: { lat: 10, lng: 20 },
    target: { lat: -15, lng: 95 },
    plotId: 1234,
    biome: "mountain",
    attackerName: "NEXUS-7",
    defenderName: "KRONOS",
    attackerColor: "#22d3ee",
    defenderColor: "#f87171",
    attackerPower: 103,
    defenderPower: 80,
    randFactor: 3,
    outcome: "attacker_wins",
    troopsCommitted: 50,
    hasCommander: false,
    fortificationLevel: 0,
    pillagedIron: 25,
    pillagedFuel: 10,
    pillagedCrystal: 0,
    ...over,
  };
}

describe("buildBattleSequence — structure", () => {
  it("emits exactly the 10 canonical beats, in canonical order", () => {
    const seq = buildBattleSequence(baseInput());
    expect(seq.beats).toHaveLength(10);
    expect(seq.beats.map((b) => b.kind)).toEqual([...BEAT_ORDER]);
  });

  it("is gapless: first beat starts at 0, each starts exactly where the last ended", () => {
    const seq = buildBattleSequence(baseInput());
    expect(seq.beats[0].startMs).toBe(0);
    for (let i = 1; i < seq.beats.length; i++) {
      const prev = seq.beats[i - 1];
      expect(seq.beats[i].startMs).toBe(prev.startMs + prev.durationMs);
    }
  });

  it("total duration equals the end of the last beat", () => {
    const seq = buildBattleSequence(baseInput());
    const last = seq.beats[seq.beats.length - 1];
    expect(seq.durationMs).toBe(last.startMs + last.durationMs);
  });

  it("every beat has a positive duration and an intensity in [0,1]", () => {
    const seq = buildBattleSequence(baseInput());
    for (const b of seq.beats) {
      expect(b.durationMs).toBeGreaterThan(0);
      expect(b.intensity).toBeGreaterThanOrEqual(0);
      expect(b.intensity).toBeLessThanOrEqual(1);
    }
  });
});

describe("buildBattleSequence — determinism", () => {
  it("identical input ⇒ identical sequence", () => {
    const a = buildBattleSequence(baseInput());
    const b = buildBattleSequence(baseInput());
    expect(a).toEqual(b);
  });
});

describe("buildBattleSequence — data scaling", () => {
  it("more committed troops ⇒ a longer muster (up to the cap)", () => {
    const few = buildBattleSequence(baseInput({ troopsCommitted: 1 }));
    const many = buildBattleSequence(baseInput({ troopsCommitted: 100 }));
    const musterFew = few.beats.find((b) => b.kind === "muster")!;
    const musterMany = many.beats.find((b) => b.kind === "muster")!;
    expect(musterMany.durationMs).toBeGreaterThan(musterFew.durationMs);
  });

  it("a farther target ⇒ a longer transit", () => {
    const near = buildBattleSequence(
      baseInput({ source: { lat: 0, lng: 0 }, target: { lat: 1, lng: 1 } }),
    );
    const far = buildBattleSequence(
      baseInput({ source: { lat: 80, lng: -170 }, target: { lat: -80, lng: 170 } }),
    );
    const transitNear = near.beats.find((b) => b.kind === "transit")!;
    const transitFar = far.beats.find((b) => b.kind === "transit")!;
    expect(transitFar.durationMs).toBeGreaterThan(transitNear.durationMs);
    expect(far.arcRadians).toBeGreaterThan(near.arcRadians);
  });

  it("a bigger luck swing ⇒ a longer swing beat", () => {
    const small = buildBattleSequence(baseInput({ randFactor: 0 }));
    const big = buildBattleSequence(baseInput({ randFactor: 9 }));
    const swingSmall = small.beats.find((b) => b.kind === "swing")!;
    const swingBig = big.beats.find((b) => b.kind === "swing")!;
    expect(swingBig.durationMs).toBeGreaterThan(swingSmall.durationMs);
  });
});

describe("buildBattleSequence — outcome derivation", () => {
  it("marks capture + carries spoils on an attacker win", () => {
    const seq = buildBattleSequence(baseInput({ outcome: "attacker_wins" }));
    expect(seq.captured).toBe(true);
    expect(seq.spoils).toEqual({ iron: 25, fuel: 10, crystal: 0 });
    expect(seq.victorColor).toBe("#22d3ee"); // attacker colour
  });

  it("no capture, no spoils, defender colour on a defender win", () => {
    const seq = buildBattleSequence(
      baseInput({ outcome: "defender_wins", pillagedIron: 0, pillagedFuel: 0 }),
    );
    expect(seq.captured).toBe(false);
    expect(seq.spoils).toEqual({ iron: 0, fuel: 0, crystal: 0 });
    expect(seq.victorColor).toBe("#f87171"); // defender colour
  });

  it("detects a luck swing that FLIPPED the result (underdog wins on randFactor)", () => {
    // base attacker power 95 < defender 100 ⇒ would lose; +8% randFactor pushes
    // adjusted to 102.6 > 100 ⇒ attacker actually wins. That is a decided swing.
    const seq = buildBattleSequence(
      baseInput({ attackerPower: 102.6, defenderPower: 100, randFactor: 8, outcome: "attacker_wins" }),
    );
    expect(seq.swingDecided).toBe(true);
    const swing = seq.beats.find((b) => b.kind === "swing")!;
    expect(swing.caption).toContain("flips the battle");
  });

  it("does NOT flag a swing when the favourite wins anyway", () => {
    const seq = buildBattleSequence(
      baseInput({ attackerPower: 206, defenderPower: 80, randFactor: 3, outcome: "attacker_wins" }),
    );
    expect(seq.swingDecided).toBe(false);
  });

  it("falls back to a neutral defender name when none is given", () => {
    const seq = buildBattleSequence(baseInput({ defenderName: null }));
    expect(seq.defender.name).toBe("the garrison");
    const brace = seq.beats.find((b) => b.kind === "brace")!;
    expect(brace.caption).toContain("the garrison");
  });
});

describe("sampleSequence / beatAt / progressAt", () => {
  const seq: BattleSequence = buildBattleSequence(baseInput());

  it("returns the muster beat at t=0", () => {
    const active = sampleSequence(seq, 0);
    expect(active).toHaveLength(1);
    expect(active[0].beat.kind).toBe("muster");
    expect(active[0].progress).toBe(0);
  });

  it("samples the right beat mid-way through, with correct local progress", () => {
    const clash = seq.beats.find((b) => b.kind === "clash")!;
    const mid = clash.startMs + clash.durationMs / 2;
    const active = sampleSequence(seq, mid);
    expect(active).toHaveLength(1);
    expect(active[0].beat.kind).toBe("clash");
    expect(active[0].progress).toBeCloseTo(0.5, 5);
  });

  it("uses half-open intervals — a boundary belongs to the next beat", () => {
    const lock = seq.beats.find((b) => b.kind === "lock")!;
    const active = sampleSequence(seq, lock.startMs);
    expect(active).toHaveLength(1);
    expect(active[0].beat.kind).toBe("lock");
    // the muster that ends exactly at lock.startMs is no longer active
    expect(active.some((a) => a.beat.kind === "muster")).toBe(false);
  });

  it("returns nothing before 0 and at/after the end (settled)", () => {
    expect(sampleSequence(seq, -1)).toEqual([]);
    expect(sampleSequence(seq, seq.durationMs)).toEqual([]);
    expect(sampleSequence(seq, seq.durationMs + 9999)).toEqual([]);
    expect(beatAt(seq, seq.durationMs)).toBeNull();
  });

  it("beatAt returns the dominant beat; progressAt tracks the whole cinematic", () => {
    expect(beatAt(seq, 0)!.beat.kind).toBe("muster");
    expect(progressAt(seq, 0)).toBe(0);
    expect(progressAt(seq, seq.durationMs / 2)).toBeCloseTo(0.5, 5);
    expect(progressAt(seq, seq.durationMs)).toBe(1);
    expect(progressAt(seq, seq.durationMs * 2)).toBe(1); // clamped
  });
});

describe("greatCircleRadians", () => {
  it("is 0 for identical points and π for antipodes", () => {
    expect(greatCircleRadians({ lat: 12, lng: 34 }, { lat: 12, lng: 34 })).toBeCloseTo(0, 6);
    expect(greatCircleRadians({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(Math.PI, 6);
  });

  it("a quarter way round the equator is π/2", () => {
    expect(greatCircleRadians({ lat: 0, lng: 0 }, { lat: 0, lng: 90 })).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe("buildBattleSequence — robustness", () => {
  it("handles zero powers without NaN / divide-by-zero", () => {
    const seq = buildBattleSequence(
      baseInput({ attackerPower: 0, defenderPower: 0, troopsCommitted: 0, randFactor: 0 }),
    );
    for (const b of seq.beats) {
      expect(Number.isFinite(b.intensity)).toBe(true);
      expect(Number.isFinite(b.durationMs)).toBe(true);
      expect(b.intensity).toBeGreaterThanOrEqual(0);
    }
    expect(Number.isFinite(seq.durationMs)).toBe(true);
  });

  it("clamps negative randFactor magnitude correctly in the swing duration", () => {
    const neg = buildBattleSequence(baseInput({ randFactor: -9 }));
    const pos = buildBattleSequence(baseInput({ randFactor: 9 }));
    const swingNeg = neg.beats.find((b) => b.kind === "swing")!.durationMs;
    const swingPos = pos.beats.find((b) => b.kind === "swing")!.durationMs;
    // magnitude drives duration, so −9 and +9 give the same swing length here
    expect(swingNeg).toBe(swingPos);
  });
});

describe("security — no id/address leakage in captions", () => {
  it("never emits a UUID or an Algorand address in any caption", () => {
    const seq = buildBattleSequence(
      baseInput({ hasCommander: true, fortificationLevel: 3, pillagedCrystal: 7 }),
    );
    const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i;
    const algoAddr = /[A-Z2-7]{58}/;
    for (const b of seq.beats) {
      expect(b.caption).not.toMatch(uuid);
      expect(b.caption).not.toMatch(algoAddr);
    }
  });
});
