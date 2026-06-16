/**
 * server/veritas/run.ts
 *
 * VERITAS CLI entry. Runs the registered flows against a live backend, prints the
 * LUT-style report, and (optionally) alerts a Discord webhook on FAIL/DRIFT. Runs once
 * by default, or on a loop when VERITAS_INTERVAL_MS is set (the always-on grind).
 *
 * Read/test-only — point it at TESTNET. Never run against mainnet.
 *
 * Env:
 *   VERITAS_TARGET_URL     base URL of the backend under test (default http://localhost:5000)
 *   VERITAS_ADMIN_KEY      admin key (x-admin-key) for market create/resolve
 *   VERITAS_PLAYER_ID      optional player id for flows that need an actor
 *   VERITAS_FLOWS          optional comma list to filter flows (e.g. "market")
 *   VERITAS_INTERVAL_MS    if set, loop every N ms instead of running once
 *   VERITAS_DISCORD_WEBHOOK  optional alert webhook
 *   VERITAS_JSON           "1" (or --json flag): machine-readable JSON report on
 *                          stdout, text report on stderr (for Kestra/orchestrators)
 *
 * Usage:  tsx server/veritas/run.ts        (or: pnpm run veritas)
 */

import type { FlowContext, FlowResult, RunResult, StepResult } from "./types.js";
import { toFlowResult, tally } from "./assert.js";
import { formatReport, shouldAlert, postDiscordAlert, toJsonReport } from "./reporter.js";
import { FLOWS } from "./flows/index.js";
import { TestWallet } from "./wallet.js";

function buildContext(): FlowContext {
  const wallet = TestWallet.fromEnv();
  if (wallet && !process.env.VERITAS_TEST_MNEMONIC_LOGGED) {
    // Surface the address once so it can be funded; never log the mnemonic.
    console.log(`[veritas] test wallet: ${wallet.address}`);
  }
  const asaId = Number(process.env.VERITAS_FRONTIER_ASA_ID ?? 0) || undefined;
  return {
    baseUrl: process.env.VERITAS_TARGET_URL ?? "http://localhost:5000",
    adminKey: process.env.VERITAS_ADMIN_KEY,
    playerId: process.env.VERITAS_PLAYER_ID,
    wallet,
    ascendAsaId: asaId,
    log: (msg) => console.log(`[veritas] ${msg}`),
  };
}

async function runOnce(): Promise<RunResult> {
  const ctx = buildContext();
  const filter = (process.env.VERITAS_FLOWS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const flows = filter.length ? FLOWS.filter((f) => filter.includes(f.name)) : FLOWS;

  const startedAt = Date.now();
  const results: FlowResult[] = [];
  for (const flow of flows) {
    const t = Date.now();
    let steps: StepResult[];
    try {
      steps = await flow.run(ctx);
    } catch (err) {
      // A thrown flow is itself a finding, not a crash of the harness.
      steps = [{ step: `${flow.name} flow`, status: "FAIL", detail: err instanceof Error ? err.message : String(err) }];
    }
    results.push(toFlowResult(flow.name, steps, Date.now() - t));
  }

  return { startedAt, ms: Date.now() - startedAt, flows: results, totals: tally(results) };
}

/** JSON mode: stdout carries only the machine-readable report (for Kestra et al). */
const JSON_MODE = process.env.VERITAS_JSON === "1" || process.argv.includes("--json");

async function report(run: RunResult): Promise<void> {
  if (JSON_MODE) {
    // Humans (and Kestra task logs) still get the text report — on stderr,
    // so stdout stays parseable.
    console.error(formatReport(run));
    console.log(JSON.stringify(toJsonReport(run)));
  } else {
    console.log(formatReport(run));
  }
  if (shouldAlert(run)) {
    const sent = await postDiscordAlert(process.env.VERITAS_DISCORD_WEBHOOK, run);
    if (sent) console.error("[veritas] alert sent");
  }
}

async function main(): Promise<void> {
  const intervalMs = Number(process.env.VERITAS_INTERVAL_MS ?? 0);

  if (!intervalMs) {
    const run = await runOnce();
    await report(run);
    // Non-zero exit on a broken run so CI / schedulers notice.
    process.exit(shouldAlert(run) ? 1 : 0);
  }

  console.log(`[veritas] grind engine started — every ${(intervalMs / 1000).toFixed(0)}s against ${buildContext().baseUrl}`);
  // Loop forever; never overlap runs.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const run = await runOnce();
    await report(run);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((err) => {
  console.error("[veritas] fatal:", err);
  process.exit(2);
});
