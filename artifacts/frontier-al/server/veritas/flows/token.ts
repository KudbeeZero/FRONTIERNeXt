/**
 * server/veritas/flows/token.ts
 *
 * TOKEN FLOW — exercises the test wallet against the $FRNTR ASA on testnet:
 *   1. the wallet is funded enough to transact (auto top-up if a funder is set),
 *   2. opt-in to the ASA is idempotent (opt-in, then assert a second opt-in is a no-op),
 *   3. the on-chain ASA balance is readable (the foundation for DB↔chain reconciliation).
 *
 * Skips cleanly when no test wallet or ASA id is configured. Full DB↔chain balance
 * reconciliation (drift) lands once a player-by-address read is available to the harness.
 */

import type { FlowContext, StepResult } from "../types.js";
import { assert, skip } from "../assert.js";

// ALGO needed to cover an opt-in (min-balance bump) plus a couple of fees.
const MIN_MICRO_ALGO = 300_000n; // 0.3 ALGO

export const tokenFlow = {
  name: "token",
  async run(ctx: FlowContext): Promise<StepResult[]> {
    const steps: StepResult[] = [];
    const wallet = ctx.wallet;
    if (!wallet) return [skip("token flow", "no test wallet (set VERITAS_TEST_MNEMONIC)")];
    if (!ctx.frontierAsaId) return [skip("token flow", "no FRONTIER ASA id (set VERITAS_FRONTIER_ASA_ID)")];

    // 1. Funded enough to transact.
    let t = Date.now();
    try {
      const f = await wallet.ensureFunded(MIN_MICRO_ALGO);
      steps.push(assert(
        "wallet funded",
        f.funded,
        `balance ${Number(f.balanceMicro) / 1e6} ALGO < required ${Number(MIN_MICRO_ALGO) / 1e6}; set VERITAS_FUNDER_MNEMONIC or fund ${wallet.address}`,
        Date.now() - t,
      ));
      if (!f.funded) return steps; // can't opt-in without min balance
    } catch (err) {
      return [assert("wallet funded", false, err instanceof Error ? err.message : String(err), Date.now() - t)];
    }

    // 2. Opt-in is idempotent.
    t = Date.now();
    try {
      await wallet.optIn(ctx.frontierAsaId);
      const second = await wallet.optIn(ctx.frontierAsaId);
      steps.push(assert(
        "opt-in idempotent",
        second.alreadyOptedIn && second.txId === null,
        `second opt-in should be a no-op, got ${JSON.stringify(second)}`,
        Date.now() - t,
      ));
    } catch (err) {
      steps.push(assert("opt-in idempotent", false, err instanceof Error ? err.message : String(err), Date.now() - t));
      return steps;
    }

    // 3. On-chain ASA balance readable (basis for reconciliation).
    t = Date.now();
    try {
      const bal = await wallet.getAsaBalance(ctx.frontierAsaId);
      steps.push(assert(
        "on-chain ASA balance readable",
        bal !== null && bal >= 0n,
        `expected a non-negative balance after opt-in, got ${bal}`,
        Date.now() - t,
      ));
    } catch (err) {
      steps.push(assert("on-chain ASA balance readable", false, err instanceof Error ? err.message : String(err), Date.now() - t));
    }

    return steps;
  },
};
