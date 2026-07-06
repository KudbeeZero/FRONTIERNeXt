/**
 * client/tests/brace-dome-playback.spec.ts
 *
 * Proves the Unit B2 "Shield Wall" brace-dome channel: rises over the brace
 * beat, holds solid through impact, then either shatters (attacker wins) or
 * flares once and settles solid (defense held) — driven by the same real
 * defender-power/fortification intensity as the brace beat itself.
 */
import { describe, it, expect } from "vitest";
import { buildBattleSequence, type BattleSequenceInput } from "@shared/battle-sequence";
import { braceDomeAt } from "../src/lib/globe/battleSequencePlayback";

function seqInput(over: Partial<BattleSequenceInput> = {}): BattleSequenceInput {
  return {
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
    pillagedIron: 25,
    pillagedFuel: 10,
    pillagedCrystal: 0,
    ...over,
  };
}

const won = buildBattleSequence(seqInput({ outcome: "attacker_wins" }));
const held = buildBattleSequence(seqInput({ outcome: "defender_wins", defenderPower: 200 }));
const beat = (seq: typeof won, k: string) => seq.beats.find((b) => b.kind === k)!;

describe("braceDomeAt — rise and hold", () => {
  it("is invisible before the brace beat starts", () => {
    expect(braceDomeAt(won, 0).opacity).toBe(0);
  });

  it("rises 0→1 across the brace beat", () => {
    const brace = beat(won, "brace");
    const early = braceDomeAt(won, brace.startMs + 1);
    const late = braceDomeAt(won, brace.startMs + brace.durationMs - 1);
    expect(early.opacity).toBeGreaterThanOrEqual(0);
    expect(late.opacity).toBeGreaterThan(early.opacity);
  });

  it("holds fully solid through the impact beat", () => {
    const impact = beat(won, "impact");
    const mid = braceDomeAt(won, impact.startMs + impact.durationMs / 2);
    expect(mid.opacity).toBe(1);
  });
});

describe("braceDomeAt — strength tracks real defender power/fortification", () => {
  it("scales with the brace beat's own intensity (same source as the cinematic)", () => {
    const braceWon = beat(won, "brace");
    const braceHeld = beat(held, "brace");
    expect(braceDomeAt(won, 0).strength).toBeCloseTo(braceWon.intensity, 5);
    expect(braceDomeAt(held, 0).strength).toBeCloseTo(braceHeld.intensity, 5);
    // held has a much higher defenderPower input, so its brace intensity is higher.
    expect(braceHeld.intensity).toBeGreaterThan(braceWon.intensity);
  });
});

describe("braceDomeAt — capture shatters the dome", () => {
  it("cracks apart and fades after impact when the attacker wins", () => {
    const impactEnd = beat(won, "impact").startMs + beat(won, "impact").durationMs;
    const justAfter = braceDomeAt(won, impactEnd + 1);
    const wellAfter = braceDomeAt(won, won.durationMs - 1);
    expect(justAfter.shatterProgress).toBeGreaterThan(0);
    expect(wellAfter.shatterProgress).toBeGreaterThan(justAfter.shatterProgress);
    expect(wellAfter.opacity).toBeLessThan(justAfter.opacity);
    expect(wellAfter.flareIntensity).toBe(0);
  });
});

describe("braceDomeAt — held defense flares then settles solid", () => {
  it("never shatters, flares once after impact, and stays solid", () => {
    const impactEnd = beat(held, "impact").startMs + beat(held, "impact").durationMs;
    const postSpan = held.durationMs - impactEnd;
    const flarePeak = braceDomeAt(held, impactEnd + postSpan * 0.15); // mid-flare window
    const wellAfter = braceDomeAt(held, held.durationMs - 1);

    expect(flarePeak.shatterProgress).toBe(0);
    expect(flarePeak.flareIntensity).toBeGreaterThan(0);
    expect(wellAfter.shatterProgress).toBe(0);
    expect(wellAfter.opacity).toBe(1);
    expect(wellAfter.flareIntensity).toBe(0); // flare pulse has settled by the end
  });
});

describe("braceDomeAt — bounds and degenerate input", () => {
  it("is always within 0…1 across the whole sequence", () => {
    for (const seq of [won, held]) {
      for (let t = 0; t <= seq.durationMs; t += Math.max(1, Math.floor(seq.durationMs / 50))) {
        const s = braceDomeAt(seq, t);
        for (const v of [s.opacity, s.strength, s.shatterProgress, s.flareIntensity]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("tolerates non-finite elapsed time", () => {
    const s = braceDomeAt(won, NaN);
    expect(s.opacity).toBe(0);
  });
});
