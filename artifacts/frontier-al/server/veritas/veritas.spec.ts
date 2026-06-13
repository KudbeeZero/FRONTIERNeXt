/**
 * server/veritas/veritas.spec.ts
 *
 * Unit tests for the VERITAS pure core (assertion engine + reporter). DB- and
 * network-free, so it runs in the single-process server suite.
 */

import { describe, it, expect } from "vitest";
import {
  assert,
  assertEqual,
  assertReconciled,
  worstStatus,
  toFlowResult,
  tally,
  skip,
} from "./assert.js";
import { formatReport, shouldAlert, severityOf, toJsonReport } from "./reporter.js";
import type { FlowResult } from "./types.js";

describe("assertions", () => {
  it("assert → PASS/FAIL with detail only on failure", () => {
    expect(assert("ok", true)).toMatchObject({ status: "PASS", detail: undefined });
    expect(assert("bad", false, "nope")).toMatchObject({ status: "FAIL", detail: "nope" });
  });

  it("assertEqual reports expected vs actual on mismatch", () => {
    expect(assertEqual("eq", 1, 1).status).toBe("PASS");
    const f = assertEqual("eq", "a", "b");
    expect(f.status).toBe("FAIL");
    expect(f.detail).toContain("expected");
  });

  it("assertReconciled distinguishes DRIFT from FAIL", () => {
    expect(assertReconciled("rec", { db: 5, chain: 5, expected: 5 }).status).toBe("PASS");
    // DB and chain disagree → the dangerous case.
    expect(assertReconciled("rec", { db: 5, chain: 4 }).status).toBe("DRIFT");
    // They agree but not with expectation → FAIL.
    expect(assertReconciled("rec", { db: 5, chain: 5, expected: 6 }).status).toBe("FAIL");
  });
});

describe("rollup", () => {
  it("worstStatus: FAIL > DRIFT > SKIP > PASS", () => {
    expect(worstStatus([assert("a", true), skip("b", "x")])).toBe("SKIP");
    expect(worstStatus([assert("a", true), assertReconciled("b", { db: 1, chain: 2 })])).toBe("DRIFT");
    expect(worstStatus([assertReconciled("b", { db: 1, chain: 2 }), assert("c", false)])).toBe("FAIL");
    expect(worstStatus([])).toBe("SKIP");
  });

  it("tally counts every step status across flows", () => {
    const flows: FlowResult[] = [
      toFlowResult("x", [assert("a", true), assert("b", false)], 10),
      toFlowResult("y", [skip("c", "r"), assertReconciled("d", { db: 1, chain: 2 })], 20),
    ];
    expect(tally(flows)).toEqual({ PASS: 1, FAIL: 1, DRIFT: 1, SKIP: 1 });
  });
});

describe("reporter", () => {
  const flows: FlowResult[] = [
    toFlowResult("market", [assert("create", true)], 1200),
    toFlowResult("commander", [assert("deliver", false, "NFT transferred on-chain but DB not updated. DRIFT.")], 800),
  ];
  const run = { startedAt: 0, ms: 2000, flows, totals: tally(flows) };

  it("renders flow lines and surfaces failure detail", () => {
    const text = formatReport(run);
    expect(text).toContain("MARKET FLOW");
    expect(text).toContain("✅");
    expect(text).toContain("❌");
    expect(text).toContain("DB not updated"); // detail shown for the failing step
  });

  it("shouldAlert is true when there is any FAIL or DRIFT", () => {
    expect(shouldAlert(run)).toBe(true);
    const clean = { startedAt: 0, ms: 1, flows: [toFlowResult("market", [assert("ok", true)], 1)], totals: tally([toFlowResult("market", [assert("ok", true)], 1)]) };
    expect(shouldAlert(clean)).toBe(false);
  });
});

describe("severity", () => {
  const makeRun = (flows: FlowResult[]) => ({ startedAt: 0, ms: 1, flows, totals: tally(flows) });

  it("maps clean/skipped runs to OK", () => {
    expect(severityOf(makeRun([toFlowResult("market", [assert("ok", true)], 1)]))).toBe("OK");
    expect(severityOf(makeRun([toFlowResult("land", [skip("land", "not implemented")], 1)]))).toBe("OK");
  });

  it("maps FAIL to SEV2 and any DRIFT to SEV1 (DRIFT dominates)", () => {
    const failed = makeRun([toFlowResult("market", [assert("create", false, "boom")], 1)]);
    expect(severityOf(failed)).toBe("SEV2");
    const drifted = makeRun([
      toFlowResult("market", [assert("create", false, "boom")], 1),
      toFlowResult("token", [assertReconciled("balance", { db: 1, chain: 2 })], 1),
    ]);
    expect(severityOf(drifted)).toBe("SEV1");
  });

  it("toJsonReport emits a stable, parseable shape with severity", () => {
    const run = makeRun([toFlowResult("market", [assert("create", false, "boom")], 1)]);
    const parsed = JSON.parse(JSON.stringify(toJsonReport(run)));
    expect(parsed.severity).toBe("SEV2");
    expect(parsed.totals).toEqual({ PASS: 0, FAIL: 1, DRIFT: 0, SKIP: 0 });
    expect(parsed.flows[0]).toMatchObject({ flow: "market", status: "FAIL" });
    expect(parsed.flows[0].steps[0]).toMatchObject({ step: "create", detail: "boom" });
  });
});
