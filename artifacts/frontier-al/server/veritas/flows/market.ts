/**
 * server/veritas/flows/market.ts
 *
 * MARKET FLOW — verifies the provably-fair prediction market end-to-end against the
 * live backend, and (the crown jewel) INDEPENDENTLY re-runs the published resolver on
 * the proof's public inputs to confirm the recorded outcome + hash. This is the LUT's
 * "anyone can re-run the function on the same public inputs and get the same answer"
 * guarantee, checked on a loop.
 *
 * Asserted properties:
 *   1. A market persists its immutable resolution source at creation.
 *   2. Resolution is refused before the cutoff ("Not yet resolvable").
 *   3. The admin resolve trigger DERIVES the outcome — a caller-supplied winningOutcome
 *      is ignored (the dev cannot pick the winner).
 *   4. The recorded outcome matches re-deriving it from the public inputs.
 *   5. The recorded hash matches recomputing sha256(source+inputs+outcome).
 */

import type { MarketOutcome, ResolutionSource, PredictionMarket } from "@shared/schema";
import {
  deriveOutcome,
  hashResolution,
  type ResolutionFact,
} from "../../engine/markets/resolve.js";
import type { FlowContext, StepResult } from "../types.js";
import { assert, assertEqual, skip } from "../assert.js";
import { HttpClient } from "../httpClient.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reconstruct the resolver's fact object from the public proof inputs, by source type. */
function factFromInputs(source: ResolutionSource, inputs: Record<string, unknown>): ResolutionFact {
  switch (source.type) {
    case "battle_outcome":
      return { attackerWon: Boolean(inputs.attackerWon) };
    case "ownership_at_turn":
      return { owner: (inputs.owner as string | null) ?? null };
    case "burn_threshold":
      return { burned: Number(inputs.burned ?? 0) };
    case "territory_count":
      return { count: Number(inputs.count ?? 0) };
  }
}

interface ProofResponse {
  resolutionSource: ResolutionSource | null;
  resolvedInputs: Record<string, unknown> | null;
  outcome: MarketOutcome | null;
  resolutionHash: string | null;
  resolved: boolean;
}

export const marketFlow = {
  name: "market",
  async run(ctx: FlowContext): Promise<StepResult[]> {
    const steps: StepResult[] = [];
    const http = new HttpClient(ctx.baseUrl, ctx.adminKey);

    if (!ctx.adminKey) {
      return [skip("create market", "no VERITAS_ADMIN_KEY configured — cannot create/resolve markets")];
    }

    // ── 1. CREATE — a burn_threshold market resolvable shortly after a near cutoff ──
    const now = Date.now();
    const cutoffTs = now + 4_000; // staking closes in 4s
    const source: ResolutionSource = { type: "burn_threshold", amount: 1, byTurn: 1 };
    let t = Date.now();
    const created = await http.post<PredictionMarket & { error?: string }>(
      "/api/admin/markets",
      {
        title: "VERITAS self-check market",
        description: "Automated provably-fair verification probe. Safe to ignore.",
        category: "economy",
        resolutionCriteria: "Resolves from total $FRNTR burned (>=1 by turn 1).",
        resolvesAt: now + 60_000,
        resolutionSource: source,
        resolutionCutoffTs: cutoffTs,
      },
      true,
    );
    if (!created.ok || !created.body || created.body.error || !created.body.id) {
      return [assert("create market", false, `create failed: status ${created.status} ${JSON.stringify(created.body)}`, Date.now() - t)];
    }
    const marketId = created.body.id;
    steps.push(assert("create market", true, undefined, Date.now() - t));
    steps.push(assert(
      "source persisted immutably",
      created.body.resolutionSource?.type === "burn_threshold",
      `expected resolutionSource.type 'burn_threshold', got ${JSON.stringify(created.body.resolutionSource)}`,
    ));

    // ── 2. EARLY RESOLVE refused before cutoff ──
    t = Date.now();
    const early = await http.post<{ error?: string }>(`/api/admin/markets/${marketId}/resolve`, {}, true);
    steps.push(assert(
      "resolution refused before cutoff",
      early.status === 400 && early.body?.error === "Not yet resolvable",
      `expected 400 'Not yet resolvable', got ${early.status} ${JSON.stringify(early.body)}`,
      Date.now() - t,
    ));

    // ── 3+4. RESOLVE after cutoff, with a BOGUS injected outcome to prove it's ignored ──
    await sleep(Math.max(0, cutoffTs - Date.now()) + 500);
    let resolved: PredictionMarket | undefined;
    t = Date.now();
    for (let i = 0; i < 8; i++) {
      const r = await http.post<PredictionMarket & { error?: string }>(
        `/api/admin/markets/${marketId}/resolve`,
        { winningOutcome: "b" }, // injected — the trustless resolver MUST ignore this
        true,
      );
      if (r.ok && r.body && !r.body.error) { resolved = r.body; break; }
      await sleep(1_000);
    }
    if (!resolved) {
      steps.push(assert("resolve after cutoff", false, "market did not resolve within timeout", Date.now() - t));
      return steps;
    }
    steps.push(assert("resolve after cutoff", true, undefined, Date.now() - t));

    // ── 5. VERIFY — re-run the published resolver on the proof's public inputs ──
    const proofRes = await http.get<ProofResponse>(`/api/markets/${marketId}/proof`);
    const proof = proofRes.body;
    if (!proofRes.ok || !proof?.resolved || !proof.resolutionSource || !proof.resolvedInputs || !proof.outcome || !proof.resolutionHash) {
      steps.push(assert("fetch proof", false, `incomplete proof: ${JSON.stringify(proof)}`));
      return steps;
    }
    steps.push(assert("fetch proof", true));

    const fact = factFromInputs(proof.resolutionSource, proof.resolvedInputs);
    const reDerived = deriveOutcome(proof.resolutionSource, fact);
    steps.push(assertEqual("outcome derived (injection ignored)", proof.outcome, reDerived));

    const reHashed = hashResolution(proof.resolutionSource, proof.resolvedInputs, proof.outcome);
    steps.push(assertEqual("proof hash reproducible", proof.resolutionHash, reHashed));

    return steps;
  },
};
