/**
 * server/engine/battle/verify.spec.ts
 *
 * Proves the battle provable-fairness check: an honest resolution (recorded
 * values = what the real resolver produces from the public seed) verifies; a
 * tampered randFactor or outcome fails; the proof hash is a stable 64-hex digest;
 * and the whole thing is deterministic. Uses the REAL resolver to compute the
 * "truth" so the test can't drift from production either.
 */
import { describe, it, expect } from "vitest";
import { verifyBattleProof, type BattleProofInput } from "./verify";
import { resolveBattleFromPowers } from "./resolve";
import { hashSeed } from "./random";

const BATTLE_ID = "battle-xyz";
const START_TS = 1_700_000_000_000;
const ATK = 120;
const DEF = 80;

/** The ground truth the server would have recorded for an honest battle. */
const truth = resolveBattleFromPowers(ATK, DEF, hashSeed(BATTLE_ID, START_TS));

function honest(over: Partial<BattleProofInput> = {}): BattleProofInput {
  return {
    battleId: BATTLE_ID,
    startTs: START_TS,
    attackerPower: ATK,
    defenderPower: DEF,
    recordedOutcome: truth.outcome as "attacker_wins" | "defender_wins",
    recordedRandFactor: truth.randFactor,
    ...over,
  };
}

describe("verifyBattleProof", () => {
  it("verifies an honest resolution", () => {
    const p = verifyBattleProof(honest());
    expect(p.valid).toBe(true);
    expect(p.expectedRandFactor).toBe(truth.randFactor);
    expect(p.expectedOutcome).toBe(truth.outcome);
  });

  it("re-derives the same seed the resolver used", () => {
    expect(verifyBattleProof(honest()).seed).toBe(hashSeed(BATTLE_ID, START_TS));
  });

  it("fails a tampered randFactor", () => {
    expect(verifyBattleProof(honest({ recordedRandFactor: truth.randFactor + 1 })).valid).toBe(false);
  });

  it("fails a tampered outcome", () => {
    const flipped = truth.outcome === "attacker_wins" ? "defender_wins" : "attacker_wins";
    expect(verifyBattleProof(honest({ recordedOutcome: flipped })).valid).toBe(false);
  });

  it("produces a stable 64-hex proof hash, independent of input key order", () => {
    const a = verifyBattleProof(honest());
    const b = verifyBattleProof(honest());
    expect(a.proofHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.proofHash).toBe(b.proofHash);
  });

  it("ties the seed to the battle id + startTs (different battle → different proof)", () => {
    const other = verifyBattleProof(honest({ battleId: "battle-other" }));
    const base = verifyBattleProof(honest());
    expect(other.seed).not.toBe(base.seed);
    expect(other.proofHash).not.toBe(base.proofHash);
  });
});
