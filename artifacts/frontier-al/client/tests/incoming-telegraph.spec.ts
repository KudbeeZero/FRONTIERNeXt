/**
 * client/tests/incoming-telegraph.spec.ts
 *
 * Proves the pre-resolution telegraph timing: inactive outside the lead-in
 * window, ramping 0→1 as resolution nears, off once resolved, with a correct
 * seconds-left readout and bounded intensity.
 */
import { describe, it, expect } from "vitest";
import { incomingTelegraph } from "../src/lib/battle/incomingTelegraph";

const LEAD = 8000;

describe("incomingTelegraph", () => {
  it("is inactive before the lead-in window", () => {
    const t = incomingTelegraph(100_000, 100_000 - (LEAD + 1), LEAD);
    expect(t.active).toBe(false);
    expect(t.intensity).toBe(0);
  });

  it("activates and ramps up as resolution approaches", () => {
    const resolveTs = 100_000;
    const far = incomingTelegraph(resolveTs, resolveTs - LEAD + 1, LEAD); // just entered window
    const near = incomingTelegraph(resolveTs, resolveTs - 500, LEAD); // almost there
    expect(far.active).toBe(true);
    expect(near.active).toBe(true);
    expect(near.intensity).toBeGreaterThan(far.intensity);
    expect(far.intensity).toBeGreaterThanOrEqual(0);
    expect(near.intensity).toBeLessThanOrEqual(1);
  });

  it("intensity is ~0.5 at the window midpoint", () => {
    const resolveTs = 100_000;
    const t = incomingTelegraph(resolveTs, resolveTs - LEAD / 2, LEAD);
    expect(t.intensity).toBeCloseTo(0.5, 5);
  });

  it("is inactive at and after resolution (the cinematic takes over)", () => {
    expect(incomingTelegraph(100_000, 100_000, LEAD).active).toBe(false);
    expect(incomingTelegraph(100_000, 100_500, LEAD).active).toBe(false);
  });

  it("reports whole seconds left, never negative", () => {
    expect(incomingTelegraph(100_000, 100_000 - 3200, LEAD).secondsLeft).toBe(4);
    expect(incomingTelegraph(100_000, 100_000 + 999, LEAD).secondsLeft).toBe(0);
  });

  it("tolerates non-finite input", () => {
    expect(incomingTelegraph(NaN, 0, LEAD).active).toBe(false);
  });
});
