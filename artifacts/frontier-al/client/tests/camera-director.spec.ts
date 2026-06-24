/**
 * client/tests/camera-director.spec.ts
 *
 * Proves the pure camera director: dormant at the muster, follows the strike
 * across transit (arcT tracks progress), holds on the target (arcT=1) through
 * impact/resolution, eases its bias out over the aftermath, and releases once
 * the sequence settles — all weights bounded 0…1.
 */
import { describe, it, expect } from "vitest";
import { buildBattleSequence, type BattleSequenceInput } from "@shared/battle-sequence";
import { cameraDirectorAt } from "../src/lib/battle/cameraDirector";

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
    ...over,
  };
}

const seq = buildBattleSequence(seqInput());
const beat = (k: string) => seq.beats.find((b) => b.kind === k)!;

describe("cameraDirectorAt", () => {
  it("does not bias during the muster", () => {
    const d = cameraDirectorAt(seq, beat("muster").startMs + 1);
    expect(d.weight).toBe(0);
    expect(d.active).toBe(false);
  });

  it("follows the strike across transit — arcT tracks progress, weight high", () => {
    const transit = beat("transit");
    const mid = cameraDirectorAt(seq, transit.startMs + transit.durationMs / 2);
    expect(mid.arcT).toBeCloseTo(0.5, 5);
    expect(mid.weight).toBeGreaterThan(0.5);
    const late = cameraDirectorAt(seq, transit.startMs + transit.durationMs * 0.9);
    expect(late.arcT).toBeGreaterThan(mid.arcT);
  });

  it("holds on the target (arcT=1) at impact with full weight", () => {
    const d = cameraDirectorAt(seq, beat("impact").startMs + 1);
    expect(d.arcT).toBe(1);
    expect(d.weight).toBe(1);
  });

  it("eases the bias out over the aftermath", () => {
    const after = beat("aftermath");
    const early = cameraDirectorAt(seq, after.startMs + 1).weight;
    const late = cameraDirectorAt(seq, after.startMs + after.durationMs * 0.9).weight;
    expect(late).toBeLessThan(early);
  });

  it("releases once the sequence settles", () => {
    const d = cameraDirectorAt(seq, seq.durationMs);
    expect(d.active).toBe(false);
    expect(d.weight).toBe(0);
  });

  it("keeps weight and arcT within 0…1 across the whole timeline", () => {
    for (let t = -100; t <= seq.durationMs + 100; t += 50) {
      const d = cameraDirectorAt(seq, t);
      expect(d.weight).toBeGreaterThanOrEqual(0);
      expect(d.weight).toBeLessThanOrEqual(1);
      expect(d.arcT).toBeGreaterThanOrEqual(0);
      expect(d.arcT).toBeLessThanOrEqual(1);
    }
  });

  it("tolerates non-finite input", () => {
    expect(() => cameraDirectorAt(seq, NaN)).not.toThrow();
  });
});
