/**
 * shared/weapons/antiAir.ts
 *
 * Anti-aircraft / surface-to-air interceptor missiles. These are deployed to a
 * parcel and engage incoming offensive missiles within their envelope. Grounded
 * in NASAMS / Patriot / S-400-class systems.
 *
 * Every entry carries an `intercept` envelope (see InterceptEnvelope) which the
 * sim/intercept.ts solver reads. They span short point-defense to long-range
 * area-defense.
 */

import type { WeaponSpec } from "./types";

export const ANTI_AIR: WeaponSpec[] = [
  {
    id: "aa_short_1", name: "Stinger MANPADS", category: "anti_air", tier: 1,
    realWorldRef: "FIM-92 Stinger",
    rangeKm: 8, speedMps: 750, flightProfile: "boost_glide", guidance: "infrared",
    payloadKg: 3, cepM: 1,
    damage: 60, splashRadius: 0.3, cooldownMs: 45_000, costFrntr: 8,
    attributeAffinity: "interception", unlock: { badge: "aegis", tier: "none" },
    intercept: { interceptRangeKm: 8, maxAltKm: 4, interceptorSpeedMps: 750, reactionMs: 4000, basePk: 0.45, magazine: 4 },
  },
  {
    id: "aa_short_2", name: "NASAMS AMRAAM", category: "anti_air", tier: 2,
    realWorldRef: "NASAMS (AIM-120)",
    rangeKm: 30, speedMps: 1020, flightProfile: "boost_glide", guidance: "radar_homing",
    payloadKg: 23, cepM: 1,
    damage: 95, splashRadius: 0.4, cooldownMs: 60_000, costFrntr: 16,
    attributeAffinity: "interception", unlock: { badge: "aegis", tier: "bronze" },
    intercept: { interceptRangeKm: 30, maxAltKm: 14, interceptorSpeedMps: 1020, reactionMs: 5000, basePk: 0.6, magazine: 6 },
  },
  {
    id: "aa_med_1", name: "NASAMS-ER", category: "anti_air", tier: 2,
    realWorldRef: "NASAMS (AMRAAM-ER)",
    rangeKm: 50, speedMps: 1200, flightProfile: "boost_glide", guidance: "radar_homing",
    payloadKg: 23, cepM: 1,
    damage: 110, splashRadius: 0.4, cooldownMs: 70_000, costFrntr: 22,
    attributeAffinity: "interception", unlock: { badge: "aegis", tier: "silver" },
    intercept: { interceptRangeKm: 50, maxAltKm: 20, interceptorSpeedMps: 1200, reactionMs: 6000, basePk: 0.62, magazine: 6 },
  },
  {
    id: "aa_med_2", name: "Patriot PAC-2", category: "anti_air", tier: 3,
    realWorldRef: "MIM-104 Patriot PAC-2",
    rangeKm: 96, speedMps: 1400, flightProfile: "boost_glide", guidance: "command",
    payloadKg: 90, cepM: 2,
    damage: 140, splashRadius: 0.5, cooldownMs: 90_000, costFrntr: 38,
    attributeAffinity: "interception", unlock: { badge: "aegis", tier: "silver" },
    intercept: { interceptRangeKm: 96, maxAltKm: 24, interceptorSpeedMps: 1400, reactionMs: 7000, basePk: 0.68, magazine: 8 },
  },
  {
    id: "aa_long_1", name: "Patriot PAC-3 MSE", category: "anti_air", tier: 4,
    realWorldRef: "MIM-104 Patriot PAC-3 MSE",
    rangeKm: 120, speedMps: 1700, flightProfile: "boost_glide", guidance: "radar_homing",
    payloadKg: 74, cepM: 0.5,
    damage: 170, splashRadius: 0.5, cooldownMs: 100_000, costFrntr: 56,
    attributeAffinity: "interception", unlock: { badge: "aegis", tier: "gold" },
    intercept: { interceptRangeKm: 120, maxAltKm: 35, interceptorSpeedMps: 1700, reactionMs: 7000, basePk: 0.75, magazine: 8 },
  },
  {
    id: "aa_long_2", name: "S-400 48N6", category: "anti_air", tier: 3,
    realWorldRef: "S-400 (48N6 series)",
    rangeKm: 250, speedMps: 2000, flightProfile: "boost_glide", guidance: "command",
    payloadKg: 180, cepM: 3,
    damage: 200, splashRadius: 0.6, cooldownMs: 110_000, costFrntr: 78,
    attributeAffinity: "interception", unlock: { badge: "aegis", tier: "gold" },
    intercept: { interceptRangeKm: 250, maxAltKm: 27, interceptorSpeedMps: 2000, reactionMs: 8000, basePk: 0.7, magazine: 10 },
  },
  {
    id: "aa_long_3", name: "S-400 40N6", category: "anti_air", tier: 4,
    realWorldRef: "S-400 (40N6E)",
    rangeKm: 400, speedMps: 2200, flightProfile: "boost_glide", guidance: "radar_homing",
    payloadKg: 180, cepM: 2,
    damage: 240, splashRadius: 0.6, cooldownMs: 130_000, costFrntr: 104,
    attributeAffinity: "interception", unlock: { badge: "aegis", tier: "hall_of_fame" },
    intercept: { interceptRangeKm: 400, maxAltKm: 30, interceptorSpeedMps: 2200, reactionMs: 9000, basePk: 0.72, magazine: 12 },
  },
  {
    id: "aa_exo_1", name: "Arrow-3 Exo", category: "anti_air", tier: 4,
    realWorldRef: "Arrow-3 exoatmospheric interceptor",
    rangeKm: 300, speedMps: 3000, flightProfile: "boost_glide", guidance: "radar_homing",
    payloadKg: 150, cepM: 1,
    damage: 260, splashRadius: 0.7, cooldownMs: 140_000, costFrntr: 130,
    attributeAffinity: "interception", unlock: { badge: "aegis", tier: "hall_of_fame" },
    intercept: { interceptRangeKm: 300, maxAltKm: 100, interceptorSpeedMps: 3000, reactionMs: 9000, basePk: 0.8, magazine: 6 },
  },
];
