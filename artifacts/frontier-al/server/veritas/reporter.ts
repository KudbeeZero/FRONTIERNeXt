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

/** True when the run contains anything worth alerting on. */
export function shouldAlert(run: RunResult): boolean {
  return run.totals.FAIL > 0 || run.totals.DRIFT > 0;
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
