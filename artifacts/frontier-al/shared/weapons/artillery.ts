/**
 * shared/weapons/artillery.ts
 *
 * The twelve FRONTIER artillery pieces, in three lines of four tiers each:
 *   • Towed          — short-range guns, cheap, high rate of fire (M777-class)
 *   • Rocket         — HIMARS/GMLRS-class guided rockets (medium range)
 *   • MLRS           — heavy multiple-launch rocket systems (long range)
 *
 * Artillery uses a lower-apex "parabolic" profile and is strictly shorter-ranged
 * than missiles — a deliberate realism contrast (a howitzer is local; an MLRS
 * reaches across a region; neither rivals a ballistic/cruise missile).
 */

import type { WeaponSpec } from "./types";

// ── Towed line (logistics + firepower, very short range) ─────────────────────
const TOWED: WeaponSpec[] = [
  {
    id: "art_towed_1", name: "Field Gun 105", category: "artillery", tier: 1,
    realWorldRef: "M119 105mm towed howitzer",
    rangeKm: 14, speedMps: 470, flightProfile: "parabolic", guidance: "inertial",
    payloadKg: 15, cepM: 120,
    damage: 45, splashRadius: 0.5, cooldownMs: 90_000, costAscend: 4,
    attributeAffinity: "logistics", unlock: { badge: "long_rifle", tier: "none" },
  },
  {
    id: "art_towed_2", name: "Howitzer 155", category: "artillery", tier: 2,
    realWorldRef: "M777 155mm (standard)",
    rangeKm: 24, speedMps: 560, flightProfile: "parabolic", guidance: "inertial",
    payloadKg: 43, cepM: 100,
    damage: 70, splashRadius: 0.7, cooldownMs: 120_000, costAscend: 7,
    attributeAffinity: "logistics", unlock: { badge: "long_rifle", tier: "none" },
  },
  {
    id: "art_towed_3", name: "Howitzer 155 PGM", category: "artillery", tier: 3,
    realWorldRef: "M777 + Excalibur guided shell",
    rangeKm: 40, speedMps: 580, flightProfile: "parabolic", guidance: "gps",
    payloadKg: 43, cepM: 5,
    damage: 90, splashRadius: 0.7, cooldownMs: 130_000, costAscend: 12,
    attributeAffinity: "logistics", unlock: { badge: "long_rifle", tier: "bronze" },
  },
  {
    id: "art_towed_4", name: "Howitzer 155 RAP", category: "artillery", tier: 4,
    realWorldRef: "M777ER rocket-assisted projectile",
    rangeKm: 70, speedMps: 600, flightProfile: "parabolic", guidance: "gps",
    payloadKg: 43, cepM: 10,
    damage: 110, splashRadius: 0.8, cooldownMs: 150_000, costAscend: 18,
    attributeAffinity: "logistics", unlock: { badge: "long_rifle", tier: "silver" },
  },
];

// ── Rocket line (range + firepower, salvo) ───────────────────────────────────
const ROCKET: WeaponSpec[] = [
  {
    id: "art_rocket_1", name: "Salvo MRL", category: "rocket_artillery", tier: 1,
    realWorldRef: "BM-21 Grad 122mm",
    rangeKm: 40, speedMps: 690, flightProfile: "parabolic", guidance: "inertial",
    payloadKg: 18, cepM: 300,
    damage: 95, splashRadius: 1.2, cooldownMs: 180_000, costAscend: 14,
    attributeAffinity: "range", unlock: { badge: "long_rifle", tier: "bronze" },
  },
  {
    id: "art_rocket_2", name: "GMLRS Strike", category: "rocket_artillery", tier: 2,
    realWorldRef: "M30/M31 GMLRS (HIMARS)",
    rangeKm: 84, speedMps: 1000, flightProfile: "parabolic", guidance: "gps",
    payloadKg: 90, cepM: 5,
    damage: 130, splashRadius: 1.1, cooldownMs: 210_000, costAscend: 24,
    attributeAffinity: "range", unlock: { badge: "long_rifle", tier: "silver" },
  },
  {
    id: "art_rocket_3", name: "GMLRS-ER", category: "rocket_artillery", tier: 3,
    realWorldRef: "Extended-Range GMLRS",
    rangeKm: 150, speedMps: 1100, flightProfile: "parabolic", guidance: "gps",
    payloadKg: 90, cepM: 5,
    damage: 160, splashRadius: 1.2, cooldownMs: 230_000, costAscend: 36,
    attributeAffinity: "range", unlock: { badge: "long_rifle", tier: "silver" },
  },
  {
    id: "art_rocket_4", name: "PrSM Tactical", category: "rocket_artillery", tier: 4,
    realWorldRef: "Precision Strike Missile (HIMARS)",
    rangeKm: 300, speedMps: 1500, flightProfile: "parabolic", guidance: "gps",
    payloadKg: 90, cepM: 5,
    damage: 200, splashRadius: 1.3, cooldownMs: 260_000, costAscend: 54,
    attributeAffinity: "range", unlock: { badge: "long_rifle", tier: "gold" },
  },
];

// ── Heavy MLRS line (range + firepower, area saturation) ─────────────────────
const MLRS: WeaponSpec[] = [
  {
    id: "art_mlrs_1", name: "Heavy MLRS", category: "rocket_artillery", tier: 1,
    realWorldRef: "M270 MLRS (227mm)",
    rangeKm: 165, speedMps: 1050, flightProfile: "parabolic", guidance: "gps",
    payloadKg: 159, cepM: 10,
    damage: 175, splashRadius: 1.6, cooldownMs: 300_000, costAscend: 40,
    attributeAffinity: "firepower", unlock: { badge: "long_rifle", tier: "gold" },
  },
  {
    id: "art_mlrs_2", name: "Heavy MLRS-ER", category: "rocket_artillery", tier: 2,
    realWorldRef: "M270A2 (ER rockets)",
    rangeKm: 300, speedMps: 1200, flightProfile: "parabolic", guidance: "gps",
    payloadKg: 159, cepM: 8,
    damage: 215, splashRadius: 1.7, cooldownMs: 330_000, costAscend: 60,
    attributeAffinity: "firepower", unlock: { badge: "long_rifle", tier: "gold" },
  },
  {
    id: "art_mlrs_3", name: "Heavy MLRS-TBM", category: "rocket_artillery", tier: 3,
    realWorldRef: "M270 firing ATACMS",
    rangeKm: 400, speedMps: 1400, flightProfile: "parabolic", guidance: "gps",
    payloadKg: 230, cepM: 8,
    damage: 255, splashRadius: 1.8, cooldownMs: 360_000, costAscend: 82,
    attributeAffinity: "firepower", unlock: { badge: "long_rifle", tier: "hall_of_fame" },
  },
  {
    id: "art_mlrs_4", name: "Heavy MLRS Apex", category: "rocket_artillery", tier: 4,
    realWorldRef: "M270 firing PrSM Increment",
    rangeKm: 480, speedMps: 1550, flightProfile: "parabolic", guidance: "gps",
    payloadKg: 230, cepM: 6,
    damage: 300, splashRadius: 2.0, cooldownMs: 400_000, costAscend: 110,
    attributeAffinity: "firepower", unlock: { badge: "long_rifle", tier: "hall_of_fame" },
  },
];

export const ARTILLERY: WeaponSpec[] = [...TOWED, ...ROCKET, ...MLRS];
