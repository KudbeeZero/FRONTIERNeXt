/**
 * shared/weapons/missiles.ts
 *
 * The twelve FRONTIER missiles, in three lines of four tiers each:
 *   • Ballistic   — high-apex tactical ballistic missiles (ATACMS/Iskander-class)
 *   • Cruise      — subsonic, terrain-following, very long range (Tomahawk-class)
 *   • Hypersonic  — boost-glide, fast and hard to intercept (Kinzhal-class)
 *
 * rangeKm / speedMps / flightProfile are grounded in real systems (see RESEARCH).
 * Names are FRONTIER-fictional; `realWorldRef` records the grounding reference.
 */

import type { WeaponSpec } from "./types";

// ── Ballistic line (firepower + range, steep terminal dive) ──────────────────
const BALLISTIC: WeaponSpec[] = [
  {
    id: "msl_ballistic_1", name: "Lancet TBM", category: "ballistic", tier: 1,
    realWorldRef: "MGM-140A ATACMS Block I",
    rangeKm: 165, speedMps: 1030, flightProfile: "ballistic", guidance: "inertial",
    payloadKg: 230, cepM: 250,
    damage: 120, splashRadius: 1.0, cooldownMs: 25 * 60_000, costAscend: 18,
    attributeAffinity: "firepower", unlock: { badge: "demolition", tier: "none" },
  },
  {
    id: "msl_ballistic_2", name: "Lancet-ER", category: "ballistic", tier: 2,
    realWorldRef: "MGM-140B ATACMS Block IA",
    rangeKm: 300, speedMps: 1200, flightProfile: "ballistic", guidance: "gps",
    payloadKg: 230, cepM: 50,
    damage: 165, splashRadius: 1.1, cooldownMs: 28 * 60_000, costAscend: 30,
    attributeAffinity: "firepower", unlock: { badge: "demolition", tier: "bronze" },
  },
  {
    id: "msl_ballistic_3", name: "Vanguard SRBM", category: "ballistic", tier: 3,
    realWorldRef: "9K720 Iskander-E (export)",
    rangeKm: 415, speedMps: 1700, flightProfile: "ballistic", guidance: "inertial",
    payloadKg: 480, cepM: 30,
    damage: 230, splashRadius: 1.3, cooldownMs: 32 * 60_000, costAscend: 48,
    attributeAffinity: "firepower", unlock: { badge: "demolition", tier: "silver" },
  },
  {
    id: "msl_ballistic_4", name: "Vanguard-M", category: "ballistic", tier: 4,
    realWorldRef: "9K720 Iskander-M",
    rangeKm: 500, speedMps: 2100, flightProfile: "ballistic", guidance: "gps",
    payloadKg: 700, cepM: 20,
    damage: 300, splashRadius: 1.5, cooldownMs: 36 * 60_000, costAscend: 70,
    attributeAffinity: "firepower", unlock: { badge: "demolition", tier: "gold" },
  },
];

// ── Cruise line (guidance + extreme range, low & survivable) ─────────────────
const CRUISE: WeaponSpec[] = [
  {
    id: "msl_cruise_1", name: "Gale TLAM", category: "cruise", tier: 1,
    realWorldRef: "BGM-109 Tomahawk Block III",
    rangeKm: 1600, speedMps: 240, flightProfile: "cruise_low", guidance: "terrain",
    payloadKg: 450, cepM: 10,
    damage: 130, splashRadius: 0.9, cooldownMs: 30 * 60_000, costAscend: 26,
    attributeAffinity: "guidance", unlock: { badge: "marksman", tier: "none" },
  },
  {
    id: "msl_cruise_2", name: "Gale Block IV", category: "cruise", tier: 2,
    realWorldRef: "Tomahawk Block IV (TACTOM)",
    rangeKm: 1800, speedMps: 245, flightProfile: "cruise_low", guidance: "gps",
    payloadKg: 450, cepM: 8,
    damage: 160, splashRadius: 1.0, cooldownMs: 30 * 60_000, costAscend: 38,
    attributeAffinity: "guidance", unlock: { badge: "marksman", tier: "bronze" },
  },
  {
    id: "msl_cruise_3", name: "Gale Maritime", category: "cruise", tier: 3,
    realWorldRef: "Tomahawk Block Va (Maritime Strike)",
    rangeKm: 2100, speedMps: 250, flightProfile: "cruise_low", guidance: "radar_homing",
    payloadKg: 450, cepM: 6,
    damage: 185, splashRadius: 1.0, cooldownMs: 32 * 60_000, costAscend: 52,
    attributeAffinity: "guidance", unlock: { badge: "marksman", tier: "silver" },
  },
  {
    id: "msl_cruise_4", name: "Gale-ER", category: "cruise", tier: 4,
    realWorldRef: "Tomahawk Block Vb (extended)",
    rangeKm: 2400, speedMps: 260, flightProfile: "cruise_low", guidance: "gps",
    payloadKg: 500, cepM: 5,
    damage: 215, splashRadius: 1.1, cooldownMs: 34 * 60_000, costAscend: 74,
    attributeAffinity: "guidance", unlock: { badge: "marksman", tier: "gold" },
  },
];

// ── Hypersonic line (firepower + guidance, hard to intercept) ────────────────
const HYPERSONIC: WeaponSpec[] = [
  {
    id: "msl_hyper_1", name: "Meteor HGV", category: "hypersonic", tier: 1,
    realWorldRef: "Kh-47M2 Kinzhal (short-range loadout)",
    rangeKm: 500, speedMps: 1700, flightProfile: "boost_glide", guidance: "inertial",
    payloadKg: 480, cepM: 30,
    damage: 260, splashRadius: 1.3, cooldownMs: 40 * 60_000, costAscend: 90,
    attributeAffinity: "firepower", unlock: { badge: "demolition", tier: "silver" },
  },
  {
    id: "msl_hyper_2", name: "Meteor-II", category: "hypersonic", tier: 2,
    realWorldRef: "Kinzhal-class boost-glide",
    rangeKm: 1000, speedMps: 2400, flightProfile: "boost_glide", guidance: "gps",
    payloadKg: 500, cepM: 20,
    damage: 320, splashRadius: 1.4, cooldownMs: 44 * 60_000, costAscend: 120,
    attributeAffinity: "firepower", unlock: { badge: "demolition", tier: "gold" },
  },
  {
    id: "msl_hyper_3", name: "Meteor Glide", category: "hypersonic", tier: 3,
    realWorldRef: "Avangard-class HGV",
    rangeKm: 1500, speedMps: 3000, flightProfile: "boost_glide", guidance: "radar_homing",
    payloadKg: 600, cepM: 15,
    damage: 380, splashRadius: 1.6, cooldownMs: 48 * 60_000, costAscend: 165,
    attributeAffinity: "firepower", unlock: { badge: "demolition", tier: "gold" },
  },
  {
    id: "msl_hyper_4", name: "Meteor Apex", category: "hypersonic", tier: 4,
    realWorldRef: "Avangard-class (apex loadout)",
    rangeKm: 2000, speedMps: 3400, flightProfile: "boost_glide", guidance: "gps",
    payloadKg: 800, cepM: 12,
    damage: 460, splashRadius: 1.9, cooldownMs: 55 * 60_000, costAscend: 230,
    attributeAffinity: "firepower", unlock: { badge: "demolition", tier: "hall_of_fame" },
  },
];

export const MISSILES: WeaponSpec[] = [...BALLISTIC, ...CRUISE, ...HYPERSONIC];
