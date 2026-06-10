/**
 * shared/weapons/ballistics.ts
 *
 * Deterministic flight model. Given a weapon spec and a from→to pair of geo
 * points, it produces time-of-flight, apex altitude, and a position(t) along the
 * great circle with a profile-appropriate altitude curve. Pure + seedless, in
 * keeping with the repo's replayable battle-sim philosophy.
 *
 * The render layer maps `altKm` onto the visual globe radius; the intercept
 * solver samples `positionAt` to find an engagement point.
 */

import type { FlightProfile, WeaponSpec } from "./types";
import type { GeoPoint } from "./scale";
import { greatCircleKm, slerpGeo } from "./scale";

/** A point in flight: surface position plus altitude above the surface (km). */
export interface FlightPoint {
  lat: number;
  lng: number;
  altKm: number;
}

/** Extra path/time the profile adds versus a straight surface skim. */
const PROFILE_PATH_FACTOR: Record<FlightProfile, number> = {
  ballistic: 1.18, // long lofted arc
  parabolic: 1.10, // shorter arc
  boost_glide: 1.06,
  cruise_low: 1.0, // hugs the surface
};

/** Fraction of ground range that becomes apex altitude, per profile. */
const PROFILE_APEX_FRACTION: Record<FlightProfile, number> = {
  ballistic: 0.25,
  parabolic: 0.12,
  boost_glide: 0.10,
  cruise_low: 0.0,
};

/** Hard ceilings (km) so very long shots don't produce absurd apexes. */
const PROFILE_APEX_CAP_KM: Record<FlightProfile, number> = {
  ballistic: 150,
  parabolic: 40,
  boost_glide: 90,
  cruise_low: 0.2,
};

/** Time of flight (ms) over a given surface distance. */
export function timeOfFlightMs(spec: WeaponSpec, distanceKm: number): number {
  const pathKm = distanceKm * PROFILE_PATH_FACTOR[spec.flightProfile];
  const seconds = (pathKm * 1000) / spec.speedMps;
  return Math.round(seconds * 1000);
}

/** Apex altitude (km) for a shot covering `distanceKm` of ground range. */
export function apexAltitudeKm(spec: WeaponSpec, distanceKm: number): number {
  if (spec.flightProfile === "cruise_low") return PROFILE_APEX_CAP_KM.cruise_low;
  const raw = distanceKm * PROFILE_APEX_FRACTION[spec.flightProfile];
  return Math.min(raw, PROFILE_APEX_CAP_KM[spec.flightProfile]);
}

/** Altitude (km) at normalized flight progress `t` ∈ [0,1] for a given apex. */
export function altitudeAt(profile: FlightProfile, apexKm: number, t: number): number {
  const u = Math.max(0, Math.min(1, t));
  switch (profile) {
    case "ballistic":
    case "parabolic":
      // symmetric parabola peaking at apex when t = 0.5
      return 4 * apexKm * u * (1 - u);
    case "boost_glide":
      // climbs fast, glides down — skewed peak before mid-flight
      return apexKm * Math.pow(Math.sin(Math.PI * u), 0.7);
    case "cruise_low":
      // stays low the whole way, lifting only slightly off the deck
      return apexKm * Math.sin(Math.PI * u);
    default: {
      // Exhaustiveness guard: a new FlightProfile becomes a compile error here
      // rather than silently returning undefined → NaN altitudes downstream.
      const _exhaustive: never = profile;
      return _exhaustive;
    }
  }
}

/**
 * Position along the flight at normalized progress `t` ∈ [0,1]. lat/lng follow
 * the great circle (slerp); altitude follows the profile curve.
 */
export function positionAt(
  spec: WeaponSpec,
  from: GeoPoint,
  to: GeoPoint,
  t: number,
  distanceKm?: number,
): FlightPoint {
  const dist = distanceKm ?? greatCircleKm(from, to);
  const apex = apexAltitudeKm(spec, dist);
  const surface = slerpGeo(from, to, Math.max(0, Math.min(1, t)));
  return { lat: surface.lat, lng: surface.lng, altKm: altitudeAt(spec.flightProfile, apex, t) };
}

/** True when the target lies within the weapon's maximum range. */
export function inRange(spec: WeaponSpec, from: GeoPoint, to: GeoPoint): boolean {
  return greatCircleKm(from, to) <= spec.rangeKm;
}
