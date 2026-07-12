/**
 * server/util/debuffCleanup.spec.ts
 *
 * Pins the structure of the combined debuff-cleanup UPDATE so a future
 * refactor cannot accidentally drop the WHERE coverage of either debuff
 * type or the conditional field-clearing (which prevents clearing an
 * *active* sabotage timer when only EMP is expired, and vice versa).
 *
 * Pure unit test: inspects the exported SQL builders' column references
 * (Drizzle column refs expose a `name` field). The real `runDebuffCleanup`
 * is exercised on Neon in the integration suite.
 */
import { describe, it, expect } from "vitest";
import {
  buildDebuffCleanupSet,
  buildDebuffCleanupWhere,
} from "./debuffCleanup.js";

/**
 * Flat, non-recursive scan of a Drizzle SQL object's `queryChunks` for
 * column references. Column refs expose `.name`; strings/numbers/params
 * are ignored. Deliberately avoids walking the full object graph to
 * prevent the test from recursing into Drizzle's table/column circular
 * references (which would otherwise cause a stack overflow / hang).
 */
function columnNamesFromQueryChunks(sqlObj: any): string[] {
  const chunks: any[] = (sqlObj && sqlObj.queryChunks) || [];
  const out: string[] = [];
  for (const c of chunks) {
    if (c && typeof c === "object" && typeof c.name === "string" && /^[a-z][a-z0-9_]{2,}$/.test(c.name) && c.name !== "sql") {
      out.push(c.name);
    }
  }
  return out;
}

describe("debuff cleanup: combined UPDATE structure", () => {
  it("WHERE clause references BOTH emp_debuff_until and sabotage_debuff_until", () => {
    const cols = columnNamesFromQueryChunks(buildDebuffCleanupWhere());
    expect(cols).toContain("emp_debuff_until");
    expect(cols).toContain("sabotage_debuff_until");
  });

  it("SET clears defenseLevel + empDebuffUntil and yields to ELSE (conditional EMP clear)", () => {
    const set = buildDebuffCleanupSet() as unknown as Record<string, any>;
    const empSetCols = columnNamesFromQueryChunks(set.empDebuffUntil);
    const defCols = columnNamesFromQueryChunks(set.defenseLevel);
    // The CASE-when-emp-expired branches reference the EMP column and defense_level.
    expect(empSetCols).toContain("emp_debuff_until");
    expect(defCols).toContain("defense_level");
    // The sabotage column must NOT appear in the EMP-only branch.
    expect(empSetCols).not.toContain("sabotage_debuff_until");
    expect(defCols).not.toContain("sabotage_debuff_until");
  });

  it("SET clears yieldMultiplier + sabotageDebuffUntil and yields to ELSE (conditional sabotage clear)", () => {
    const set = buildDebuffCleanupSet() as unknown as Record<string, any>;
    const sabSetCols = columnNamesFromQueryChunks(set.sabotageDebuffUntil);
    const yldCols = columnNamesFromQueryChunks(set.yieldMultiplier);
    expect(sabSetCols).toContain("sabotage_debuff_until");
    expect(yldCols).toContain("yield_multiplier");
    // The EMP column must NOT appear in the sabotage-only branch.
    expect(sabSetCols).not.toContain("emp_debuff_until");
    expect(yldCols).not.toContain("emp_debuff_until");
  });
});
