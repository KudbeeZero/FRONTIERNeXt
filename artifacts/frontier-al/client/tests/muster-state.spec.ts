/**
 * client/tests/muster-state.spec.ts
 *
 * Proves the attacker-side muster build-up timing: active for the whole
 * pending window (not just a lead-in), troop-scaled intensity that saturates
 * (matching the cinematic's own muster-beat curve), a glow that ramps in then
 * holds, and a monotonic creep progress toward resolution.
 */
import { describe, it, expect } from "vitest";
import { musterState } from "../src/lib/battle/musterState";

describe("musterState", () => {
  it("is inactive before the battle starts", () => {
    const s = musterState(100_000, 200_000, 99_999, 50);
    expect(s.active).toBe(false);
    expect(s.glowIntensity).toBe(0);
  });

  it("is active immediately at battle start", () => {
    const s = musterState(100_000, 200_000, 100_000, 50);
    expect(s.active).toBe(true);
  });

  it("is active for the whole pending window, not just a lead-in", () => {
    const start = 100_000;
    const resolve = 700_000; // 10 minutes
    const early = musterState(start, resolve, start + 1000, 50);
    const mid = musterState(start, resolve, start + 300_000, 50);
    expect(early.active).toBe(true);
    expect(mid.active).toBe(true);
  });

  it("is inactive at and after resolution (the cinematic takes over)", () => {
    expect(musterState(100_000, 200_000, 200_000, 50).active).toBe(false);
    expect(musterState(100_000, 200_000, 200_500, 50).active).toBe(false);
  });

  it("troop scale increases with more troops and saturates toward 1", () => {
    const few = musterState(100_000, 700_000, 400_000, 1);
    const some = musterState(100_000, 700_000, 400_000, 60);
    const many = musterState(100_000, 700_000, 400_000, 1000);
    expect(some.troopScale).toBeGreaterThan(few.troopScale);
    expect(many.troopScale).toBeGreaterThan(some.troopScale);
    expect(many.troopScale).toBeLessThan(1);
    expect(many.troopScale).toBeGreaterThan(0.9);
  });

  it("glow ramps in over glowRampMs then holds at the troop-scaled level", () => {
    const start = 100_000;
    const resolve = 700_000;
    const troops = 60;
    const justStarted = musterState(start, resolve, start + 10, troops, 2000);
    const midRamp = musterState(start, resolve, start + 1000, troops, 2000);
    const heldLater = musterState(start, resolve, start + 5000, troops, 2000);
    const heldMuchLater = musterState(start, resolve, start + 300_000, troops, 2000);
    expect(justStarted.glowIntensity).toBeLessThan(midRamp.glowIntensity);
    expect(midRamp.glowIntensity).toBeLessThan(heldLater.glowIntensity);
    expect(heldLater.glowIntensity).toBeCloseTo(heldMuchLater.glowIntensity, 5);
  });

  it("floors glowIntensity so the effect never fully disappears once ramped in", () => {
    const s = musterState(100_000, 700_000, 400_000, 0);
    expect(s.glowIntensity).toBeGreaterThan(0);
  });

  it("creep progress rises monotonically toward 1 as resolution nears", () => {
    const start = 100_000;
    const resolve = 700_000;
    const p1 = musterState(start, resolve, start + 50_000, 50).creepProgress;
    const p2 = musterState(start, resolve, start + 300_000, 50).creepProgress;
    const p3 = musterState(start, resolve, resolve - 1, 50).creepProgress;
    expect(p1).toBeGreaterThan(0);
    expect(p2).toBeGreaterThan(p1);
    expect(p3).toBeGreaterThan(p2);
    expect(p3).toBeLessThanOrEqual(1);
  });

  it("tolerates non-finite and degenerate input", () => {
    expect(musterState(NaN, 200_000, 100_000, 50).active).toBe(false);
    expect(musterState(200_000, 100_000, 150_000, 50).active).toBe(false); // resolve before start
    expect(musterState(100_000, 100_000, 100_000, 50).active).toBe(false); // zero-length window
  });
});
