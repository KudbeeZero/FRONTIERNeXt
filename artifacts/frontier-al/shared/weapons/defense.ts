/**
 * shared/weapons/defense.ts
 *
 * Dedicated missile-defense batteries — the "missile defense system" that detects
 * incoming fire and shoots it down. These differ from anti_air interceptors in
 * that they model a full battery (radar + C2 + magazine) tuned for a specific
 * layer of a layered defense (point → area → terminal-high → exo), grounded in
 * Iron Dome / David's Sling / THAAD / Aegis-class systems.
 *
 * Each layer trades off: low layers are cheap, fast-reacting, low-ceiling, and
 * great vs short-range/artillery threats; high layers are expensive, high-ceiling,
 * and built to catch ballistic/hypersonic threats in the terminal/exo phase.
 */

import type { WeaponSpec } from "./types";

export const DEFENSE_SYSTEMS: WeaponSpec[] = [
  {
    id: "def_pointiron", name: "Iron Dome Battery", category: "missile_defense", tier: 1,
    realWorldRef: "Iron Dome (Tamir)",
    rangeKm: 70, speedMps: 700, flightProfile: "boost_glide", guidance: "radar_homing",
    payloadKg: 11, cepM: 1,
    damage: 80, splashRadius: 0.4, cooldownMs: 20_000, costAscend: 30,
    attributeAffinity: "interception", unlock: { badge: "aegis", tier: "bronze" },
    intercept: { interceptRangeKm: 70, maxAltKm: 10, interceptorSpeedMps: 700, reactionMs: 3000, basePk: 0.65, magazine: 20 },
  },
  {
    id: "def_cram", name: "C-RAM Point Defense", category: "missile_defense", tier: 1,
    realWorldRef: "Phalanx C-RAM (20mm)",
    rangeKm: 4, speedMps: 1100, flightProfile: "boost_glide", guidance: "radar_homing",
    payloadKg: 0.1, cepM: 1,
    damage: 50, splashRadius: 0.2, cooldownMs: 8_000, costAscend: 18,
    attributeAffinity: "interception", unlock: { badge: "aegis", tier: "none" },
    intercept: { interceptRangeKm: 4, maxAltKm: 2, interceptorSpeedMps: 1100, reactionMs: 1500, basePk: 0.55, magazine: 40 },
  },
  {
    id: "def_sling", name: "David's Sling", category: "missile_defense", tier: 2,
    realWorldRef: "David's Sling (Stunner)",
    rangeKm: 300, speedMps: 2400, flightProfile: "boost_glide", guidance: "radar_homing",
    payloadKg: 90, cepM: 0.5,
    damage: 180, splashRadius: 0.5, cooldownMs: 40_000, costAscend: 70,
    attributeAffinity: "interception", unlock: { badge: "aegis", tier: "silver" },
    intercept: { interceptRangeKm: 300, maxAltKm: 50, interceptorSpeedMps: 2400, reactionMs: 6000, basePk: 0.74, magazine: 12 },
  },
  {
    id: "def_thaad", name: "THAAD Terminal", category: "missile_defense", tier: 3,
    realWorldRef: "THAAD (terminal high-altitude)",
    rangeKm: 200, speedMps: 2800, flightProfile: "boost_glide", guidance: "infrared",
    payloadKg: 60, cepM: 0.3,
    damage: 230, splashRadius: 0.6, cooldownMs: 60_000, costAscend: 110,
    attributeAffinity: "interception", unlock: { badge: "aegis", tier: "gold" },
    intercept: { interceptRangeKm: 200, maxAltKm: 150, interceptorSpeedMps: 2800, reactionMs: 7000, basePk: 0.8, magazine: 8 },
  },
  {
    id: "def_aegis", name: "Aegis SM-6", category: "missile_defense", tier: 3,
    realWorldRef: "Aegis BMD (SM-6)",
    rangeKm: 370, speedMps: 3500, flightProfile: "boost_glide", guidance: "radar_homing",
    payloadKg: 64, cepM: 0.3,
    damage: 250, splashRadius: 0.6, cooldownMs: 70_000, costAscend: 140,
    attributeAffinity: "interception", unlock: { badge: "aegis", tier: "gold" },
    intercept: { interceptRangeKm: 370, maxAltKm: 110, interceptorSpeedMps: 3500, reactionMs: 7000, basePk: 0.82, magazine: 10 },
  },
  {
    id: "def_arrow_exo", name: "Arrow-3 Shield", category: "missile_defense", tier: 4,
    realWorldRef: "Arrow-3 exoatmospheric BMD",
    rangeKm: 600, speedMps: 4500, flightProfile: "boost_glide", guidance: "radar_homing",
    payloadKg: 150, cepM: 0.2,
    damage: 300, splashRadius: 0.8, cooldownMs: 90_000, costAscend: 200,
    attributeAffinity: "interception", unlock: { badge: "aegis", tier: "hall_of_fame" },
    intercept: { interceptRangeKm: 600, maxAltKm: 1000, interceptorSpeedMps: 4500, reactionMs: 8000, basePk: 0.88, magazine: 6 },
  },
];
