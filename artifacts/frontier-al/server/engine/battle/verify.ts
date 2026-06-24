/**
 * server/engine/battle/verify.ts
 *
 * Provable-fairness verification for a resolved battle — the battle analogue of
 * the market proof (engine/markets/resolve.ts). A battle's randomness is fully
 * determined by a seed derived from immutable, already-public facts
 * (`hashSeed(battleId, startTs)`), and resolution is deterministic
 * (`resolveBattleFromPowers` — same powers + seed → same result). So anyone can
 * RE-DERIVE the randFactor + outcome from the public battle row and confirm the
 * server recorded exactly what the rule produces — no trust required.
 *
 * Re-uses the REAL resolver (not a re-implementation) so the proof can never
 * drift from how battles actually resolve. Pure — no DB, no IO.
 */
import { createHash } from "crypto";
import { hashSeed } from "./random";
import { resolveBattleFromPowers } from "./resolve";
import { stableStringify } from "../markets/resolve";

export type BattleOutcome = "attacker_wins" | "defender_wins";

export interface BattleProofInput {
  battleId: string;
  /** Immutable battle start timestamp (ms) — half of the public seed. */
  startTs: number;
  /** The pre-randFactor powers snapshotted on the battle row at deploy. */
  attackerPower: number;
  defenderPower: number;
  /** What the server actually recorded for this battle. */
  recordedOutcome: BattleOutcome;
  recordedRandFactor: number;
}

export interface BattleProof {
  battleId: string;
  /** The deterministic seed = hashSeed(battleId, startTs) — public, re-derivable. */
  seed: number;
  attackerPower: number;
  defenderPower: number;
  /** Independently re-derived from the seed + powers via the real resolver. */
  expectedRandFactor: number;
  expectedOutcome: BattleOutcome;
  /** sha256 over the stable proof payload — a verifier recomputes the same string. */
  proofHash: string;
  /** True iff the recorded randFactor + outcome match the re-derived values. */
  valid: boolean;
}

export function verifyBattleProof(input: BattleProofInput): BattleProof {
  const seed = hashSeed(input.battleId, input.startTs);
  const r = resolveBattleFromPowers(input.attackerPower, input.defenderPower, seed);
  const expectedRandFactor = r.randFactor;
  const expectedOutcome = r.outcome as BattleOutcome;

  const proofHash = createHash("sha256")
    .update(
      stableStringify({
        battleId: input.battleId,
        seed,
        attackerPower: input.attackerPower,
        defenderPower: input.defenderPower,
        randFactor: expectedRandFactor,
        outcome: expectedOutcome,
      }),
    )
    .digest("hex");

  const valid =
    input.recordedRandFactor === expectedRandFactor && input.recordedOutcome === expectedOutcome;

  return {
    battleId: input.battleId,
    seed,
    attackerPower: input.attackerPower,
    defenderPower: input.defenderPower,
    expectedRandFactor,
    expectedOutcome,
    proofHash,
    valid,
  };
}
