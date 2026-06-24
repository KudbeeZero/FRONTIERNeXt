/**
 * client/tests/battle-sequence-playback.spec.ts
 *
 * Proves the pure globe-cinematic playback mapping: arc travel tracks transit,
 * the telegraph line ramps in on lock and out on impact, the impact/​swing
 * envelopes peak mid-beat, the outcome ring lives resolve→aftermath, capture
 * fill only happens on a win, and everything is bounded 0…1 and settles.
 */
import { describe, it, expect } from "vitest";
import { buildBattleSequence, type BattleSequenceInput } from "@shared/battle-sequence";
import { playbackAt } from "../src/lib/globe/battleSequencePlayback";

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

const seq = buildBattleSequence(seqInput());
const beat = (k: string) => seq.beats.find((b) => b.kind === k)!;

describe("playbackAt — arc travel", () => {
  it("is 0 before launch, ~0.5 mid-transit, 1 after impact", () => {
    expect(playbackAt(seq, 0).arcProgress).toBe(0);
    const transit = beat("transit");
    expect(playbackAt(seq, transit.startMs + transit.durationMs / 2).arcProgress).toBeCloseTo(0.5, 5);
    expect(playbackAt(seq, beat("impact").startMs).arcProgress).toBe(1);
  });
});

describe("playbackAt — telegraph line", () => {
  it("is 0 before lock, full while the strike flies, and fades out across impact", () => {
    expect(playbackAt(seq, 0).telegraphOpacity).toBe(0);
    const transit = beat("transit");
    expect(playbackAt(seq, transit.startMs + 1).telegraphOpacity).toBe(1);
    const impact = beat("impact");
    expect(playbackAt(seq, impact.startMs + impact.durationMs / 2).telegraphOpacity).toBeCloseTo(0.5, 5);
    expect(playbackAt(seq, impact.startMs + impact.durationMs).telegraphOpacity).toBe(0);
  });
});

describe("playbackAt — impact + swing envelopes", () => {
  it("the impact flash peaks in the middle of the impact beat", () => {
    const impact = beat("impact");
    const peak = playbackAt(seq, impact.startMs + impact.durationMs / 2).impactFlash;
    const early = playbackAt(seq, impact.startMs + impact.durationMs * 0.05).impactFlash;
    expect(peak).toBeGreaterThan(early);
    expect(peak).toBeLessThanOrEqual(1);
  });

  it("swing pulse is non-zero only when the swing decided the result", () => {
    const flip = buildBattleSequence(
      seqInput({ attackerPower: 102.6, defenderPower: 100, randFactor: 8 }),
    );
    expect(flip.swingDecided).toBe(true);
    const sb = flip.beats.find((b) => b.kind === "swing")!;
    expect(playbackAt(flip, sb.startMs + sb.durationMs / 2).swingPulse).toBeGreaterThan(0);

    // a clear favourite win → no decided swing → no pulse
    const noFlip = buildBattleSequence(seqInput({ attackerPower: 206, defenderPower: 80 }));
    expect(noFlip.swingDecided).toBe(false);
    const sb2 = noFlip.beats.find((b) => b.kind === "swing")!;
    expect(playbackAt(noFlip, sb2.startMs + sb2.durationMs / 2).swingPulse).toBe(0);
  });
});

describe("playbackAt — outcome ring + capture", () => {
  it("ring is dark before resolve, lit during resolve→aftermath, gone at the end", () => {
    expect(playbackAt(seq, 0).ringOpacity).toBe(0);
    const resolve = beat("resolve");
    expect(playbackAt(seq, resolve.startMs + resolve.durationMs / 2).ringOpacity).toBeGreaterThan(0);
    expect(playbackAt(seq, seq.durationMs).ringOpacity).toBe(0);
  });

  it("capture fill ramps over aftermath ONLY on a win", () => {
    const after = beat("aftermath");
    expect(playbackAt(seq, after.startMs).captureProgress).toBe(0);
    expect(playbackAt(seq, after.startMs + after.durationMs).captureProgress).toBe(1);

    const loss = buildBattleSequence(seqInput({ outcome: "defender_wins", pillagedIron: 0, pillagedFuel: 0 }));
    const afterL = loss.beats.find((b) => b.kind === "aftermath")!;
    expect(playbackAt(loss, afterL.startMs + afterL.durationMs).captureProgress).toBe(0);
  });
});

describe("playbackAt — bounds + settle", () => {
  it("every channel stays within 0…1 across the whole timeline", () => {
    for (let t = -200; t <= seq.durationMs + 200; t += 50) {
      const s = playbackAt(seq, t);
      for (const v of [
        s.arcProgress,
        s.telegraphOpacity,
        s.strikeOpacity,
        s.impactFlash,
        s.swingPulse,
        s.ringOpacity,
        s.captureProgress,
      ]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("reports the dominant beat while playing and settles at the end", () => {
    expect(playbackAt(seq, 0).beatKind).toBe("muster");
    expect(playbackAt(seq, 0).settled).toBe(false);
    const end = playbackAt(seq, seq.durationMs);
    expect(end.settled).toBe(true);
    expect(end.beatKind).toBeNull();
  });

  it("tolerates non-finite input without throwing", () => {
    expect(() => playbackAt(seq, NaN)).not.toThrow();
    expect(playbackAt(seq, NaN).arcProgress).toBe(0);
  });
});
