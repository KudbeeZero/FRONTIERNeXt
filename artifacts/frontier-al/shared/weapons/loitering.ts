/**
 * shared/weapons/loitering.ts
 *
 * The loitering-munition line — the LOGISTICS discipline's offensive payoff, and
 * the weapons gated behind the `quartermaster` badge (which previously unlocked
 * nothing). These are one-way attack drones: cheap, slow, attritable, with short
 * relaunch cooldowns. The fantasy is sustained VOLUME of fire — you don't out-hit
 * a hypersonic, you out-LAST and out-mass the enemy. Grounded in Switchblade /
 * Lancet / Harop / Shahed-class systems.
 *
 * Deliberate balance contrast with the missile lines: low per-shot damage and
 * modest accuracy, but the lowest ASCEND cost and the fastest cooldown in the
 * game, so logistics builds win the attrition war. flightProfile is `cruise_low`
 * (terrain-following), so the existing sim/ballistics path handles them unchanged.
 */

import type { WeaponSpec } from "./types";

export const LOITERING: WeaponSpec[] = [
  {
    id: "loiter_1", name: "Switchblade Loiter", category: "loitering", tier: 1,
    realWorldRef: "AeroVironment Switchblade 300",
    rangeKm: 10, speedMps: 45, flightProfile: "cruise_low", guidance: "infrared",
    payloadKg: 1, cepM: 1,
    damage: 40, splashRadius: 0.4, cooldownMs: 30_000, costAscend: 5,
    attributeAffinity: "logistics", unlock: { badge: "quartermaster", tier: "none" },
  },
  {
    id: "loiter_2", name: "Switchblade-600", category: "loitering", tier: 2,
    realWorldRef: "AeroVironment Switchblade 600 (anti-armor)",
    rangeKm: 40, speedMps: 50, flightProfile: "cruise_low", guidance: "gps",
    payloadKg: 5, cepM: 1,
    damage: 70, splashRadius: 0.6, cooldownMs: 40_000, costAscend: 9,
    attributeAffinity: "logistics", unlock: { badge: "quartermaster", tier: "bronze" },
  },
  {
    id: "loiter_3", name: "Lancet Swarm", category: "loitering", tier: 3,
    realWorldRef: "ZALA Lancet-3 / IAI Harop loitering munition",
    rangeKm: 70, speedMps: 80, flightProfile: "cruise_low", guidance: "radar_homing",
    payloadKg: 5, cepM: 2,
    damage: 100, splashRadius: 0.7, cooldownMs: 50_000, costAscend: 14,
    attributeAffinity: "logistics", unlock: { badge: "quartermaster", tier: "silver" },
  },
  {
    id: "loiter_4", name: "Geran Mass Strike", category: "loitering", tier: 4,
    realWorldRef: "HESA Shahed-136 / Geran-2 long-range OWA drone",
    rangeKm: 900, speedMps: 50, flightProfile: "cruise_low", guidance: "gps",
    payloadKg: 50, cepM: 8,
    damage: 140, splashRadius: 1.0, cooldownMs: 60_000, costAscend: 22,
    attributeAffinity: "logistics", unlock: { badge: "quartermaster", tier: "gold" },
  },
];
