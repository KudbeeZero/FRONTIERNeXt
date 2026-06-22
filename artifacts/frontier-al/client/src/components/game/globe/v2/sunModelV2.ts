/**
 * sunModelV2 — the SINGLE source of truth for the sun.
 *
 * Per REBUILD_NOTES.md, the old globe had *two* competing day/night systems and a
 * fake decorative "SUN" readout, so nothing agreed on where the sun was. v2 fixes
 * that by deriving one world-space sun direction here and feeding it to every layer
 * (surface, tiles, atmosphere, the visible disc + directional light).
 *
 * Pure + deterministic: no three.js scene state, no React. This is unit-tested
 * (client/tests/globe-v2-sunmodel.spec.ts) so the lighting math is test-backed.
 */

import * as THREE from "three";

/** Angular speed of the sun's orbit, radians/second (visual). */
export const SUN_ORBIT_SPEED = 0.08;

/** Where the visible sun disc + directional light sit, in globe units. */
export const SUN_DISTANCE = 30;

/**
 * Half-width of the terminator's soft edge, measured on dot(normal, sunDir).
 * The SAME value is baked into the GLSL of PlanetSurfaceV2 + PlotTilesV2 so the
 * surface and the tiles share one terminator — there is no second darkening pass.
 */
export const TERMINATOR_SOFTNESS = 0.1;

/** Fixed northward tilt of the sun so the terminator isn't a perfectly vertical line. */
const SUN_TILT_Y = 0.35;

/** GLSL smoothstep (matches THREE/GLSL semantics) for the JS side. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * World-space unit direction pointing FROM the planet center TOWARD the sun.
 * Deterministic in (timeSec, phase): same inputs → same vector.
 *
 * @param timeSec elapsed seconds (the auto-orbit clock)
 * @param phase   manual scrub offset in radians (the debug-panel slider)
 * @param out     optional target to avoid allocation in the render loop
 */
export function computeSunDirection(
  timeSec: number,
  phase = 0,
  out: THREE.Vector3 = new THREE.Vector3(),
): THREE.Vector3 {
  const a = timeSec * SUN_ORBIT_SPEED + phase;
  return out.set(Math.cos(a), SUN_TILT_Y, Math.sin(a)).normalize();
}

/**
 * Day factor in [0,1] for a surface point: 0 = full night, 1 = full day, 0.5 at the
 * terminator. `normal` must be the outward world normal (unit); `sunDir` the value
 * from computeSunDirection. This is the JS mirror of the GPU terminator.
 */
export function dayFactor(normal: THREE.Vector3, sunDir: THREE.Vector3): number {
  return smoothstep(-TERMINATOR_SOFTNESS, TERMINATOR_SOFTNESS, normal.dot(sunDir));
}

/**
 * GLSL snippet exporting `float dayFactorV2(vec3 n, vec3 sunDir)` — injected into
 * every layer's shader so the CPU dayFactor() above and the GPU agree exactly.
 */
export const SUN_GLSL = /* glsl */ `
float dayFactorV2(vec3 n, vec3 sunDir) {
  return smoothstep(-${TERMINATOR_SOFTNESS.toFixed(3)}, ${TERMINATOR_SOFTNESS.toFixed(3)}, dot(normalize(n), sunDir));
}
`;
