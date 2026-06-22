/**
 * globe-v2-sunmodel.spec.ts
 *
 * Pins the v2 lighting core (the SINGLE source of truth for the sun). Per
 * REBUILD_NOTES.md the old globe failed because nothing agreed on the sun
 * direction; v2 derives it here and feeds every layer. These tests lock the
 * invariants the surface/tiles/atmosphere shaders rely on:
 *   - the sun direction is always a unit vector and is deterministic
 *   - dayFactor is 1 facing the sun, 0 facing away, 0.5 at the terminator
 *   - the GLSL snippet bakes in the same terminator softness as the JS path
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  computeSunDirection,
  dayFactor,
  TERMINATOR_SOFTNESS,
  SUN_GLSL,
} from "../src/components/game/globe/v2/sunModelV2";

describe("sunModelV2.computeSunDirection", () => {
  it("always returns a unit vector", () => {
    for (const t of [0, 1.7, 5, 42, 1000]) {
      expect(computeSunDirection(t).length()).toBeCloseTo(1, 6);
    }
  });

  it("is deterministic in (time, phase)", () => {
    const a = computeSunDirection(12.5, 0.3);
    const b = computeSunDirection(12.5, 0.3);
    expect(a.equals(b)).toBe(true);
  });

  it("advances as time advances (the sun actually orbits)", () => {
    const a = computeSunDirection(0);
    const b = computeSunDirection(3);
    expect(a.equals(b)).toBe(false);
  });

  it("writes into the provided target without allocating", () => {
    const out = new THREE.Vector3();
    const ret = computeSunDirection(2, 0, out);
    expect(ret).toBe(out);
  });
});

describe("sunModelV2.dayFactor", () => {
  const sun = new THREE.Vector3(1, 0, 0);

  it("is 1 where the normal faces the sun", () => {
    expect(dayFactor(new THREE.Vector3(1, 0, 0), sun)).toBeCloseTo(1, 6);
  });

  it("is 0 where the normal faces away", () => {
    expect(dayFactor(new THREE.Vector3(-1, 0, 0), sun)).toBeCloseTo(0, 6);
  });

  it("is 0.5 exactly at the terminator", () => {
    expect(dayFactor(new THREE.Vector3(0, 1, 0), sun)).toBeCloseTo(0.5, 6);
  });

  it("is monotonic across the terminator band", () => {
    const justNight = dayFactor(new THREE.Vector3(-TERMINATOR_SOFTNESS / 2, 1, 0).normalize(), sun);
    const justDay = dayFactor(new THREE.Vector3(TERMINATOR_SOFTNESS / 2, 1, 0).normalize(), sun);
    expect(justDay).toBeGreaterThan(justNight);
  });
});

describe("sunModelV2.SUN_GLSL", () => {
  it("bakes the same terminator softness the JS path uses", () => {
    expect(SUN_GLSL).toContain(TERMINATOR_SOFTNESS.toFixed(3));
    expect(SUN_GLSL).toContain("dayFactorV2");
  });
});
