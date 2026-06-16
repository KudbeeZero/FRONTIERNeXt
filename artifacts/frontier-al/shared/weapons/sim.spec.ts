import { describe, it, expect } from "vitest";
import { getWeapon } from "./catalog";
import {
  timeOfFlightMs,
  apexAltitudeKm,
  positionAt,
  inRange,
} from "./ballistics";
import { solveIntercept, rollIntercept } from "./intercept";
import { greatCircleKm, type GeoPoint } from "./scale";

const A: GeoPoint = { lat: 0, lng: 0 };
const B: GeoPoint = { lat: 0, lng: 2 }; // ~42 km apart on the game planet

describe("ballistics", () => {
  it("time of flight grows with distance and shrinks with speed", () => {
    const cruise = getWeapon("msl_cruise_1")!; // slow, subsonic
    const hyper = getWeapon("msl_hyper_4")!; // very fast
    const near = timeOfFlightMs(cruise, 100);
    const far = timeOfFlightMs(cruise, 400);
    expect(far).toBeGreaterThan(near);
    // over the same distance the hypersonic arrives sooner than the cruise missile
    expect(timeOfFlightMs(hyper, 400)).toBeLessThan(timeOfFlightMs(cruise, 400));
  });

  it("apex reflects flight profile: ballistic lofts, cruise stays low", () => {
    const ballistic = getWeapon("msl_ballistic_3")!;
    const cruise = getWeapon("msl_cruise_1")!;
    expect(apexAltitudeKm(ballistic, 400)).toBeGreaterThan(apexAltitudeKm(cruise, 400));
    expect(apexAltitudeKm(cruise, 2000)).toBeLessThan(1); // hugs the deck
  });

  it("positionAt starts at the launch point, ends at the target, peaks mid-flight", () => {
    const spec = getWeapon("msl_ballistic_2")!;
    const start = positionAt(spec, A, B, 0);
    const end = positionAt(spec, A, B, 1);
    const mid = positionAt(spec, A, B, 0.5);
    expect(start.altKm).toBeCloseTo(0, 5);
    expect(end.altKm).toBeCloseTo(0, 5);
    expect(mid.altKm).toBeGreaterThan(start.altKm);
    expect(Math.abs(end.lng - B.lng)).toBeLessThan(0.01);
  });

  it("range gate respects max range", () => {
    const howitzer = getWeapon("art_towed_1")!; // 14 km
    expect(inRange(howitzer, A, B)).toBe(false); // B is ~42 km away
    expect(inRange(getWeapon("msl_ballistic_1")!, A, B)).toBe(true);
  });
});

describe("interception", () => {
  const launch: GeoPoint = { lat: 0, lng: 0 };
  const target: GeoPoint = { lat: 0, lng: 5 }; // ~105 km away

  it("a capable battery near the target detects and can engage", () => {
    const incoming = getWeapon("msl_ballistic_2")!;
    const patriot = getWeapon("aa_long_1")!; // PAC-3 MSE
    const res = solveIntercept({
      incoming,
      from: launch,
      to: target,
      defense: patriot,
      defenseAt: target, // sited on the defended point
    });
    expect(res.detected).toBe(true);
    expect(res.intercepted).toBe(true);
    expect(res.pk).toBeGreaterThan(0.1);
    expect(res.interceptAt).toBeDefined();
    expect(res.timeToInterceptMs).toBeGreaterThanOrEqual(0);
  });

  it("a tiny point-defense gun far from the track cannot engage", () => {
    const incoming = getWeapon("msl_cruise_4")!;
    const cram = getWeapon("def_cram")!; // 4 km bubble
    const farAway: GeoPoint = { lat: 40, lng: 40 };
    const res = solveIntercept({
      incoming,
      from: launch,
      to: target,
      defense: cram,
      defenseAt: farAway,
    });
    expect(res.intercepted).toBe(false);
    expect(res.pk).toBe(0);
  });

  it("hypersonic threats are harder to kill than a slow cruise missile", () => {
    const defense = getWeapon("def_aegis")!;
    const slow = solveIntercept({
      incoming: getWeapon("msl_cruise_1")!,
      from: launch, to: target, defense, defenseAt: target,
    });
    const fast = solveIntercept({
      incoming: getWeapon("msl_hyper_4")!,
      from: launch, to: target, defense, defenseAt: target,
    });
    expect(fast.pk).toBeLessThan(slow.pk);
  });

  it("rollIntercept is deterministic for a given seed", () => {
    expect(rollIntercept(0.7, 12345)).toBe(rollIntercept(0.7, 12345));
    expect(rollIntercept(0, 1)).toBe(false);
    expect(rollIntercept(1, 1)).toBe(true);
  });

  it("sanity: the two reference points are about 105 km apart", () => {
    expect(greatCircleKm(launch, target)).toBeGreaterThan(90);
    expect(greatCircleKm(launch, target)).toBeLessThan(120);
  });
});
