/**
 * shared/weapons/scale.ts
 *
 * The single source of truth for converting real-world units into game units,
 * plus the great-circle geometry the simulation and range checks rely on.
 *
 * Pure — no client (three.js) or server imports. The render layer maps these
 * km/altitude values onto the visual GLOBE_RADIUS separately.
 */

// ── Distance scale ────────────────────────────────────────────────────────────

/** 1 abstract "game unit" of damage-splash etc. corresponds to this many km. */
export const KM_PER_GAME_UNIT = 50;

/**
 * Radius of the FRONTIER game planet, in km. Deliberately far smaller than
 * Earth (6,371 km) so that real weapon ranges feel meaningful across a compact,
 * fully-traversable world: a ~300 km tactical ballistic missile crosses a useful
 * slice of the globe, while a 30 km howitzer is strictly local.
 */
export const PLANET_RADIUS_KM = 1200;

export function kmToGameUnits(km: number): number {
  return km / KM_PER_GAME_UNIT;
}

export function gameUnitsToKm(units: number): number {
  return units * KM_PER_GAME_UNIT;
}

/** Convert a km distance into an angular arc (radians) on the game planet. */
export function kmToArcRadians(km: number): number {
  return km / PLANET_RADIUS_KM;
}

/** Convert an angular arc (radians) back into a km surface distance. */
export function arcRadiansToKm(radians: number): number {
  return radians * PLANET_RADIUS_KM;
}

// ── Geo primitives ────────────────────────────────────────────────────────────

export interface GeoPoint {
  lat: number; // degrees, -90..90
  lng: number; // degrees, -180..180
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** Convert a lat/lng to a unit vector on the sphere. */
export function geoToUnitVec(p: GeoPoint): [number, number, number] {
  const latR = p.lat * DEG2RAD;
  const lngR = p.lng * DEG2RAD;
  const cosLat = Math.cos(latR);
  return [cosLat * Math.cos(lngR), Math.sin(latR), cosLat * Math.sin(lngR)];
}

/** Convert a unit vector back to lat/lng. */
export function unitVecToGeo(v: [number, number, number]): GeoPoint {
  const [x, y, z] = v;
  const lat = Math.asin(Math.max(-1, Math.min(1, y))) * RAD2DEG;
  const lng = Math.atan2(z, x) * RAD2DEG;
  return { lat, lng };
}

/** Central angle (radians) between two geo points. */
export function angularDistance(a: GeoPoint, b: GeoPoint): number {
  const [ax, ay, az] = geoToUnitVec(a);
  const [bx, by, bz] = geoToUnitVec(b);
  const dot = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz));
  return Math.acos(dot);
}

/** Great-circle surface distance between two geo points, in km. */
export function greatCircleKm(a: GeoPoint, b: GeoPoint): number {
  return arcRadiansToKm(angularDistance(a, b));
}

/**
 * Spherical-linear interpolation (slerp) along the great circle from `a` to `b`.
 * `t` in [0,1]. Returns the intermediate lat/lng. Falls back to linear lerp when
 * the points are nearly identical (avoids division by ~0).
 */
export function slerpGeo(a: GeoPoint, b: GeoPoint, t: number): GeoPoint {
  const va = geoToUnitVec(a);
  const vb = geoToUnitVec(b);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) {
    return {
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    };
  }
  const sinOmega = Math.sin(omega);
  const k0 = Math.sin((1 - t) * omega) / sinOmega;
  const k1 = Math.sin(t * omega) / sinOmega;
  const v: [number, number, number] = [
    va[0] * k0 + vb[0] * k1,
    va[1] * k0 + vb[1] * k1,
    va[2] * k0 + vb[2] * k1,
  ];
  // re-normalize
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return unitVecToGeo([v[0] / len, v[1] / len, v[2] / len]);
}
