/**
 * server/veritas/flows/battle.ts
 *
 * BATTLE FLOW — verifies provable-fairness for battles end-to-end against the live
 * backend, and (the crown jewel) INDEPENDENTLY re-runs the published resolver on a
 * battle's public inputs to confirm the recorded randFactor + outcome. Same "anyone
 * can re-run the function on the same public inputs and get the same answer"
 * guarantee as the market flow — here on `GET /api/battle/:id/proof`.
 *
 * Read-only: needs no admin key (it probes public endpoints only). It sources the
 * public inputs from /api/battles/history (an INDEPENDENT endpoint), then re-derives
 * via the same verifyBattleProof the proof route uses — so a tampered randFactor or
 * outcome, or a proof that doesn't match the rule, would fail here.
 *
 * Asserted properties:
 *   1. A resolved battle's proof is fetchable.
 *   2. The server's own proof self-check reports valid.
 *   3. Re-deriving from the history record's public inputs reproduces the SAME
 *      randFactor + outcome (valid), and the SAME proof hash.
 */

import type { FlowContext, StepResult } from "../types.js";
import { assert, assertEqual, skip } from "../assert.js";
import { HttpClient } from "../httpClient.js";
import { verifyBattleProof, type BattleOutcome } from "../../engine/battle/verify.js";

interface HistoryBattle {
  id: string;
  startTs: number;
  attackerPower: number;
  defenderPower: number;
  outcome: BattleOutcome;
  randFactor: number;
}

interface BattleProofResponse {
  battleId: string;
  seed: number;
  attackerPower: number;
  defenderPower: number;
  expectedRandFactor: number;
  expectedOutcome: BattleOutcome;
  proofHash: string;
  valid: boolean;
}

export const battleFlow = {
  name: "battle",
  async run(ctx: FlowContext): Promise<StepResult[]> {
    const steps: StepResult[] = [];
    const http = new HttpClient(ctx.baseUrl, ctx.adminKey);

    // ── Source a resolved battle from the public history feed ──
    const hist = await http.get<{ battles?: HistoryBattle[] }>("/api/battles/history?limit=1");
    const battle = hist.body?.battles?.[0];
    if (!hist.ok || !battle) {
      return [skip("battle proof", "no resolved battle available to verify yet")];
    }
    steps.push(assert("fetch resolved battle", true));

    // ── 1. The proof endpoint returns a complete proof ──
    const proofRes = await http.get<BattleProofResponse>(`/api/battle/${battle.id}/proof`);
    const proof = proofRes.body;
    if (!proofRes.ok || !proof || typeof proof.valid !== "boolean" || !proof.proofHash) {
      steps.push(assert("fetch battle proof", false, `incomplete proof: ${JSON.stringify(proof)}`));
      return steps;
    }
    steps.push(assert("fetch battle proof", true));

    // ── 2. The server's own self-check must report a valid (honest) resolution ──
    steps.push(assert(
      "server proof valid",
      proof.valid === true,
      `server reported proof.valid=${proof.valid} for battle ${battle.id}`,
    ));

    // ── 3. INDEPENDENTLY re-derive from the history record's public inputs ──
    const local = verifyBattleProof({
      battleId: battle.id,
      startTs: Number(battle.startTs),
      attackerPower: battle.attackerPower,
      defenderPower: battle.defenderPower,
      recordedOutcome: battle.outcome,
      recordedRandFactor: battle.randFactor,
    });
    steps.push(assert(
      "independently re-derived valid",
      local.valid === true,
      `re-derivation invalid: expected randFactor=${local.expectedRandFactor} outcome=${local.expectedOutcome} vs recorded ${battle.randFactor}/${battle.outcome}`,
    ));
    steps.push(assertEqual("randFactor reproducible", proof.expectedRandFactor, local.expectedRandFactor));
    steps.push(assertEqual("proof hash reproducible", proof.proofHash, local.proofHash));

    return steps;
  },
};
