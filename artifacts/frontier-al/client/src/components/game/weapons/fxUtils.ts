/**
 * client/src/components/game/weapons/fxUtils.ts
 *
 * Small shared helpers for the weapon render layer: mapping a flight altitude (km)
 * onto the visual globe radius, and a procedural soft-particle sprite for additive
 * fire/smoke. No new dependencies — built from three.js primitives, matching the
 * style of GlobeEvents.tsx.
 */

import * as THREE from "three";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";
import { PLANET_RADIUS_KM } from "@shared/weapons";

/** Visual exaggeration so even modest apexes read as a clear arc above the globe. */
export const ALT_EXAGGERATION = 2.5;

/** Map a flight altitude (km) to a render radius from the globe center. */
export function radiusForAltKm(altKm: number): number {
  return GLOBE_RADIUS * (1.002 + (altKm / PLANET_RADIUS_KM) * ALT_EXAGGERATION);
}

let cachedSprite: THREE.Texture | null = null;

/**
 * A soft radial-gradient sprite for additive particles. Cached — one texture is
 * reused across every trail. White core so per-particle color tints it.
 */
export function getParticleSprite(): THREE.Texture {
  if (cachedSprite) return cachedSprite;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.85)");
  g.addColorStop(0.6, "rgba(255,255,255,0.25)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cachedSprite = tex;
  return tex;
}

/** Hot exhaust color near the nozzle, cooling to smoke as particles age. */
export const FIRE_COLOR = new THREE.Color("#ffd24a");
export const FIRE_HOT = new THREE.Color("#ff5a1f");
export const SMOKE_COLOR = new THREE.Color("#555560");
