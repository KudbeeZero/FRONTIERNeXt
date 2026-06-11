/**
 * server/veritas/reporter.ts
 *
 * Formats a VERITAS run into the LUT-style report and (optionally) posts an alert to a
 * Discord webhook when something breaks. Each failure line is specific enough to hand
 * straight to Claude Code as a targeted fix prompt.
 */

import type { RunResult, StepStatus } from "./types.js";

const ICON: Record<StepStatus, string> = { PASS: "✅", FAIL: "❌", DRIFT: "⚠️", SKIP: "⏭️" };

/** Render a run as a plain-text report (matches the LUT example layout). */
export function formatReport(run: RunResult): string {
  const lines: string[] = [];
  lines.push(`VERITAS RUN [${new Date(run.startedAt).toISOString()}]`);
  lines.push("─".repeat(50));
  for (const flow of run.flows) {
    const name = `${flow.flow.toUpperCase()} FLOW`.padEnd(18);
    lines.push(`${name} ${ICON[flow.status]} ${flow.status.padEnd(5)} (${(flow.ms / 1000).toFixed(1)}s)`);
    // Detail lines for anything that isn't a clean pass.
    for (const s of flow.steps) {
      if (s.status === "FAIL" || s.status === "DRIFT") {
        lines.push(`    ↳ ${s.step}: ${s.detail ?? s.status}`);
      }
    }
  }
  lines.push("─".repeat(50));
  const t = run.totals;
  lines.push(`${t.FAIL} FAIL, ${t.DRIFT} DRIFT, ${t.PASS} PASS, ${t.SKIP} SKIP — ${(run.ms / 1000).toFixed(1)}s`);
  return lines.join("\n");
}

/**
 * Incident severity for the first-responder tiers (see ops/kestra/README.md).
 *  - SEV1 : any DRIFT — DB and chain disagree, the on-chain-game nightmare case.
 *  - SEV2 : any FAIL — a flow assertion broke; player-visible breakage likely.
 *  - OK   : nothing alertable (PASS/SKIP only).
 * SEV3 (degraded-but-working) is assigned by the health-check flows, not veritas.
 */
export type Severity = "OK" | "SEV3" | "SEV2" | "SEV1";

export function severityOf(run: RunResult): Severity {
  if (run.totals.DRIFT > 0) return "SEV1";
  if (run.totals.FAIL > 0) return "SEV2";
  return "OK";
}

/** True when the run contains anything worth alerting on. */
export function shouldAlert(run: RunResult): boolean {
  return severityOf(run) !== "OK";
}

/**
 * Machine-readable report for orchestrators (Kestra parses this off stdout).
 * Shape is stable: { severity, startedAt, ms, totals, flows }.
 */
export function toJsonReport(run: RunResult): { severity: Severity } & RunResult {
  return { severity: severityOf(run), ...run };
}

/** Post an alert to a Discord webhook. No-op (returns false) if no URL is configured. */
export async function postDiscordAlert(webhookUrl: string | undefined, run: RunResult): Promise<boolean> {
  if (!webhookUrl) return false;
  const body = JSON.stringify({ content: "```\n" + formatReport(run) + "\n```" });
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return res.ok;
  } catch {
    return false;
  }
}
