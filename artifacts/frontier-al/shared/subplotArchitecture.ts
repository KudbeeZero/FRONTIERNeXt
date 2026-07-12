/**
 * shared/subplotArchitecture.ts
 *
 * Canonical, typed catalog of FRONTIER sub-plot FACILITY archetypes and their
 * upgrade trees (Phase 1 of the sub-plot combat architecture).
 *
 * This module is a CONTRACT-FOUNDATION lane. It defines stable identifiers,
 * shapes, and the read-only catalog. It has ZERO gameplay effect:
 *
 *  - No facility effect is consumed by any resolver, route, AI, or UI.
 *  - `implementationStatus` is `"catalog_only"` on every definition.
 *  - No schema, migration, seed, route, or persistence is touched.
 *  - Effect keys describe INTENT only (e.g. `troop_production`); they are never
 *    read by gameplay in this phase.
 *
 * Later phases (energy grid, CombatProfile, doctrines, battle effects) will
 * consume this catalog. Weapon/alignment compatibility here is DESCRIPTIVE
 * until those phases land (see Phase 5/6/7 in the architecture memory).
 */

import type { EnergyAlignment } from "./schema";
import { ARCHETYPES } from "./weapons/archetypes";

// ---------------------------------------------------------------------------
// Stable identifiers
// ---------------------------------------------------------------------------

/** The six canonical facility archetype IDs. */
export type FacilityArchetypeId =
  | "assault_foundry"
  | "siege_battery"
  | "defense_bastion"
  | "recon_array"
  | "extraction_complex"
  | "logistics_nexus";

/** High-level role a facility plays on the grid. */
export type FacilityStrategicRole =
  | "offense"
  | "defense"
  | "intel"
  | "production"
  | "logistics";

/**
 * Semantic effect keys describing what an upgrade node is INTENDED to change.
 * These are catalog metadata only — not consumed by gameplay in Phase 1.
 */
export type FacilityEffectKey =
  | "troop_production"
  | "reinforcement_capacity"
  | "armor_quality"
  | "attack_range"
  | "fortification_penetration"
  | "shield_capacity"
  | "emp_resistance"
  | "sensor_range"
  | "stealth_detection"
  | "iron_output"
  | "fuel_output"
  | "crystal_output"
  | "energy_efficiency"
  | "repair_speed"
  | "transfer_capacity";

/** Qualitative energy-demand categories (no numeric values in Phase 1). */
export type EnergyDemand = "low" | "medium" | "high";
export type BurstDemand = "none" | "low" | "medium" | "high" | "extreme";

/** How well an energy alignment fits a facility (descriptive only). */
export type AlignmentCompatibility = "preferred" | "compatible" | "inefficient";

/** Marker that no battle/economy effect is active yet. */
export type ImplementationStatus = "catalog_only";

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

export interface FacilityEnergyProfile {
  idleDemand: EnergyDemand;
  activeDemand: EnergyDemand;
  burstDemand: BurstDemand;
  /** Free-text design note; never a balance number. */
  note?: string;
}

export interface FacilityCompatibility {
  /** Alignment → fit. May be partial (only documented fits listed). */
  alignments: Partial<Record<EnergyAlignment, AlignmentCompatibility>>;
  /** References to existing `shared/weapons/archetypes` IDs (descriptive). */
  weaponArchetypeIds: string[];
}

export interface FacilityUpgradeNode {
  /** Globally-unique stable semantic id: `${archetypeId}.${branchId}.t${tier}`. */
  id: string;
  tier: number;
  name: string;
  description: string;
  /** Intent-only effect keys (not consumed in Phase 1). */
  effects: FacilityEffectKey[];
  /** Prerequisite node ids (empty = root). */
  prerequisites: string[];
  capstone?: boolean;
}

export interface FacilityUpgradeBranch {
  /** Stable semantic branch id (not display text). */
  id: string;
  name: string;
  description: string;
  nodes: FacilityUpgradeNode[];
}

export interface FacilityCapstone {
  /** Direction/name of the capstone (e.g. "Spearhead Command"). */
  direction: string;
  description: string;
}

export interface FacilityArchetypeDefinition {
  id: FacilityArchetypeId;
  name: string;
  description: string;
  strategicRole: FacilityStrategicRole;
  strategicPurpose: string;
  resourceRole: string;
  combatRole: string;
  /** Exactly three upgrade branches. */
  upgradeBranches: FacilityUpgradeBranch[];
  capstone: FacilityCapstone;
  energyProfile: FacilityEnergyProfile;
  strengths: string[];
  counters: string[];
  risks: string[];
  compatibility: FacilityCompatibility;
  implementationStatus: ImplementationStatus;
}

// ---------------------------------------------------------------------------
// Branch builder (keeps node ids/prereqs consistent and unique)
// ---------------------------------------------------------------------------

function makeBranch(
  branchId: string,
  name: string,
  description: string,
  tiers: Array<{
    tier: number;
    name: string;
    description: string;
    effects: FacilityEffectKey[];
    capstone?: boolean;
  }>,
): FacilityUpgradeBranch {
  const nodes: FacilityUpgradeNode[] = tiers.map((t, i) => ({
    id: `${branchId}.t${t.tier}`,
    tier: t.tier,
    name: t.name,
    description: t.description,
    effects: t.effects,
    prerequisites: i === 0 ? [] : [`${branchId}.t${tiers[i - 1].tier}`],
    capstone: t.capstone,
  }));
  return { id: branchId, name, description, nodes };
}

// ---------------------------------------------------------------------------
// Canonical catalog
// ---------------------------------------------------------------------------

export const FACILITY_ARCHETYPES: Record<FacilityArchetypeId, FacilityArchetypeDefinition> = {
  assault_foundry: {
    id: "assault_foundry",
    name: "Assault Foundry",
    description: "Rapid generation and commitment of offensive ground strength.",
    strategicRole: "offense",
    strategicPurpose: "Sustained pressure via fast troop commitment and pushes.",
    resourceRole: "Converts iron + fuel into troop readiness; spends crystal for elite muster.",
    combatRole: "High-frequency attacks; fast troop commitment; pressure gameplay.",
    upgradeBranches: [
      makeBranch("assault_foundry.mobilization", "Mobilization", "Faster, larger troop commitment.", [
        { tier: 1, name: "Conscription", description: "Establish basic recruit throughput.", effects: ["troop_production"] },
        { tier: 2, name: "Reserve Call-up", description: "Expand standing readiness.", effects: ["troop_production", "reinforcement_capacity"] },
        { tier: 3, name: "Total Mobilization", description: "Peak muster rate.", effects: ["troop_production", "reinforcement_capacity"], capstone: true },
      ]),
      makeBranch("assault_foundry.armor_fabrication", "Armor Fabrication", "Harden committed forces.", [
        { tier: 1, name: "Plate Works", description: "Basic vehicle plating.", effects: ["armor_quality"] },
        { tier: 2, name: "Composite Armor", description: "Improved survivability.", effects: ["armor_quality"] },
        { tier: 3, name: "Reactive Plating", description: "Best-in-class protection.", effects: ["armor_quality", "emp_resistance"] },
      ]),
      makeBranch("assault_foundry.reinforcement_logistics", "Reinforcement Logistics", "Get forces to the front faster.", [
        { tier: 1, name: "Supply Lines", description: "Steady reinforcement flow.", effects: ["reinforcement_capacity"] },
        { tier: 2, name: "Forward Depots", description: "Pre-positioned reserves.", effects: ["reinforcement_capacity", "transfer_capacity"] },
        { tier: 3, name: "Spearhead Corridor", description: "Rapid spearhead sustain.", effects: ["reinforcement_capacity", "transfer_capacity"] },
      ]),
    ],
    capstone: { direction: "Spearhead Command", description: "Grants adjacent-plot attack-speed bonus." },
    energyProfile: { idleDemand: "medium", activeDemand: "high", burstDemand: "high", note: "Energy-starved under brownout; weak vs fortified targets." },
    strengths: ["Tempo", "Sustained pressure", "Cheap per-hit"],
    counters: ["Siege Battery", "Defense Bastion"],
    risks: ["Energy-hungry", "Weak vs fortifications"],
    compatibility: {
      alignments: { helios: "preferred" },
      weaponArchetypeIds: ["hypersonic_striker", "swarm_commodore"],
    },
    implementationStatus: "catalog_only",
  },

  siege_battery: {
    id: "siege_battery",
    name: "Siege Battery",
    description: "Long-range, high-yield destruction of fortifications.",
    strategicRole: "offense",
    strategicPurpose: "Break Defense Bastions and high-defenseLevel targets.",
    resourceRole: "Consumes crystal + fuel heavily per volley.",
    combatRole: "Slow cadence, high damage, large support radius.",
    upgradeBranches: [
      makeBranch("siege_battery.range_targeting", "Range & Targeting", "Extend reach and accuracy.", [
        { tier: 1, name: "Spotting Post", description: "Baseline ranging.", effects: ["attack_range", "sensor_range"] },
        { tier: 2, name: "Fire Control", description: "Improved targeting.", effects: ["attack_range", "stealth_detection"] },
        { tier: 3, name: "Overwatch Net", description: "Maximum ranging.", effects: ["attack_range", "stealth_detection"], capstone: true },
      ]),
      makeBranch("siege_battery.fortification_breaking", "Fortification Breaking", "Punch through defenses.", [
        { tier: 1, name: "Shaped Charge", description: "Basic penetration.", effects: ["fortification_penetration"] },
        { tier: 2, name: "Bunker Buster", description: "Deep penetration.", effects: ["fortification_penetration"] },
        { tier: 3, name: "Siege Breaker", description: "Hardened-target specialist.", effects: ["fortification_penetration", "attack_range"] },
      ]),
      makeBranch("siege_battery.firing_cycle", "Firing Cycle", "Reduce self-cooldown.", [
        { tier: 1, name: "Auto-loader", description: "Faster reload.", effects: ["reinforcement_capacity"] },
        { tier: 2, name: "Rapid Siege", description: "Shorter cooldown.", effects: ["reinforcement_capacity"] },
        { tier: 3, name: "Suppression Barrage", description: "Sustained firing.", effects: ["reinforcement_capacity", "fortification_penetration"] },
      ]),
    ],
    capstone: { direction: "Orbital Link", description: "Enables a one-shot precision barrage." },
    energyProfile: { idleDemand: "low", activeDemand: "high", burstDemand: "extreme", note: "Immobile, expensive, vulnerable while cooling down." },
    strengths: ["Best vs fortifications", "Large reach"],
    counters: ["Mobile Raid", "Recon-blindness"],
    risks: ["Immobile", "Expensive", "Cooldown window"],
    compatibility: {
      alignments: { helios: "preferred", aegis: "compatible" },
      weaponArchetypeIds: ["siege_baron", "artillery_marshal"],
    },
    implementationStatus: "catalog_only",
  },

  defense_bastion: {
    id: "defense_bastion",
    name: "Defense Bastion",
    description: "Anchor territorial defense and shield generation.",
    strategicRole: "defense",
    strategicPurpose: "Raise defender power, shields, and EMP resistance for the grid.",
    resourceRole: "Consumes iron for plating; stores reserves.",
    combatRole: "Defense, shielding, denial.",
    upgradeBranches: [
      makeBranch("defense_bastion.fortress", "Fortress", "Harden the structure.", [
        { tier: 1, name: "Emplacement", description: "Basic fortification.", effects: ["armor_quality"] },
        { tier: 2, name: "Redoubt", description: "Layered defense.", effects: ["armor_quality", "emp_resistance"] },
        { tier: 3, name: "Citadel Core", description: "Maximum hardening.", effects: ["armor_quality", "emp_resistance"], capstone: true },
      ]),
      makeBranch("defense_bastion.shield_grid", "Shield Grid", "Generate and share shields.", [
        { tier: 1, name: "Screen Generator", description: "Local shield.", effects: ["shield_capacity"] },
        { tier: 2, name: "Harmonizer", description: "Shield regeneration.", effects: ["shield_capacity", "energy_efficiency"] },
        { tier: 3, name: "Aegis Lattice", description: "Grid-wide shields.", effects: ["shield_capacity", "emp_resistance"] },
      ]),
      makeBranch("defense_bastion.defensive_support", "Defensive Support", "Boost adjacent defenses.", [
        { tier: 1, name: "Overwatch", description: "Local support.", effects: ["stealth_detection"] },
        { tier: 2, name: "Force Multiplier", description: "Adjacent bonus.", effects: ["armor_quality"] },
        { tier: 3, name: "Bastion Network", description: "Networked defense.", effects: ["armor_quality", "shield_capacity"] },
      ]),
    ],
    capstone: { direction: "Aegis Citadel", description: "Grid-wide shield even during brownout." },
    energyProfile: { idleDemand: "medium", activeDemand: "high", burstDemand: "high", note: "Benefits from Aegis alignment; passive; prime Sabotage target." },
    strengths: ["Survivability", "Denial", "Synergy with fortifications"],
    counters: ["Siege Battery", "Precision Strike"],
    risks: ["Passive", "Little offense"],
    compatibility: {
      alignments: { aegis: "preferred" },
      weaponArchetypeIds: ["aegis_interceptor"],
    },
    implementationStatus: "catalog_only",
  },

  recon_array: {
    id: "recon_array",
    name: "Recon Array",
    description: "Intelligence, targeting, and sensor coverage.",
    strategicRole: "intel",
    strategicPurpose: "Extend sensor coverage and improve friendly accuracy/range.",
    resourceRole: "Minimal; small crystal upkeep.",
    combatRole: "Detection, range uplift, force multiplier.",
    upgradeBranches: [
      makeBranch("recon_array.sensor_range", "Sensor Range", "See farther.", [
        { tier: 1, name: "Listening Post", description: "Baseline sensors.", effects: ["sensor_range"] },
        { tier: 2, name: "Radar Net", description: "Extended coverage.", effects: ["sensor_range", "stealth_detection"] },
        { tier: 3, name: "Overhorizon Array", description: "Maximum reach.", effects: ["sensor_range", "stealth_detection"], capstone: true },
      ]),
      makeBranch("recon_array.intelligence_analysis", "Intelligence Analysis", "Turn data into advantage.", [
        { tier: 1, name: "Signal Shop", description: "Basic analysis.", effects: ["stealth_detection"] },
        { tier: 2, name: "Fusion Cell", description: "Combined intel.", effects: ["stealth_detection", "sensor_range"] },
        { tier: 3, name: "Prediction Engine", description: "Forecast enemy moves.", effects: ["stealth_detection", "attack_range"] },
      ]),
      makeBranch("recon_array.precision_targeting", "Precision Targeting", "Improve friendly fires.", [
        { tier: 1, name: "Designator", description: "Mark targets.", effects: ["attack_range"] },
        { tier: 2, name: "Fire Support", description: "Uplink to weapons.", effects: ["attack_range", "stealth_detection"] },
        { tier: 3, name: "Omniscient Link", description: "Grid-wide targeting.", effects: ["attack_range", "sensor_range"] },
      ]),
    ],
    capstone: { direction: "Omniscient Grid", description: "Grid-wide target sharing." },
    energyProfile: { idleDemand: "medium", activeDemand: "medium", burstDemand: "high", note: "Near-zero direct defense; must be protected." },
    strengths: ["Vision", "Force multiplier", "Counters stealth"],
    counters: ["Stealth / EMP that blinds sensors"],
    risks: ["No direct defense"],
    compatibility: {
      alignments: { nexus: "preferred" },
      weaponArchetypeIds: ["ghost_marksman", "hypersonic_striker"],
    },
    implementationStatus: "catalog_only",
  },

  extraction_complex: {
    id: "extraction_complex",
    name: "Extraction Complex",
    description: "Sustained resource production feeding the grid.",
    strategicRole: "production",
    strategicPurpose: "Economic engine of the plot.",
    resourceRole: "Generates iron / fuel / crystal.",
    combatRole: "None direct; light self-defense only.",
    upgradeBranches: [
      makeBranch("extraction_complex.iron_operations", "Iron Operations", "Mine more iron.", [
        { tier: 1, name: "Open Pit", description: "Baseline iron.", effects: ["iron_output"] },
        { tier: 2, name: "Deep Mine", description: "Higher iron yield.", effects: ["iron_output"] },
        { tier: 3, name: "Automated Ironworks", description: "Peak iron output.", effects: ["iron_output", "energy_efficiency"], capstone: true },
      ]),
      makeBranch("extraction_complex.fuel_refining", "Fuel Refining", "Refine more fuel.", [
        { tier: 1, name: "Still", description: "Baseline fuel.", effects: ["fuel_output"] },
        { tier: 2, name: "Cracker", description: "Higher fuel yield.", effects: ["fuel_output"] },
        { tier: 3, name: "Synthetic Plant", description: "Peak fuel output.", effects: ["fuel_output", "energy_efficiency"] },
      ]),
      makeBranch("extraction_complex.crystal_processing", "Crystal Processing", "Process more crystal.", [
        { tier: 1, name: "Lapidary", description: "Baseline crystal.", effects: ["crystal_output"] },
        { tier: 2, name: "Purifier", description: "Higher crystal yield.", effects: ["crystal_output"] },
        { tier: 3, name: "Lattice Forge", description: "Peak crystal output.", effects: ["crystal_output", "energy_efficiency"] },
      ]),
    ],
    capstone: { direction: "Mega-Harvester", description: "Plot-wide yield multiplier." },
    energyProfile: { idleDemand: "high", activeDemand: "high", burstDemand: "low", note: "Prime raid target; no offense of its own." },
    strengths: ["Economy", "Sustains everything else"],
    counters: ["Raid / Sabotage", "Capture"],
    risks: ["Prime raid target", "No standalone punch"],
    compatibility: {
      alignments: { nexus: "compatible" },
      weaponArchetypeIds: [],
    },
    implementationStatus: "catalog_only",
  },

  logistics_nexus: {
    id: "logistics_nexus",
    name: "Logistics Nexus",
    description: "Movement, storage, and reinforcement across the grid.",
    strategicRole: "logistics",
    strategicPurpose: "Faster reinforcement, extended support radius, reserve pooling.",
    resourceRole: "Transfers/stores resources; speeds reinforcement.",
    combatRole: "Sustain, reach, recovery.",
    upgradeBranches: [
      makeBranch("logistics_nexus.grid_distribution", "Grid Distribution", "Move resources across the grid.", [
        { tier: 1, name: "Depot", description: "Local storage.", effects: ["transfer_capacity"] },
        { tier: 2, name: "Transit Hub", description: "Faster transfer.", effects: ["transfer_capacity", "energy_efficiency"] },
        { tier: 3, name: "Distribution Web", description: "Grid-wide logistics.", effects: ["transfer_capacity", "reinforcement_capacity"], capstone: true },
      ]),
      makeBranch("logistics_nexus.repair_network", "Repair Network", "Recover damaged facilities faster.", [
        { tier: 1, name: "Field Repair", description: "Basic repair.", effects: ["repair_speed"] },
        { tier: 2, name: "Auto-Mender", description: "Faster repair.", effects: ["repair_speed", "energy_efficiency"] },
        { tier: 3, name: "Regeneration Grid", description: "Networked recovery.", effects: ["repair_speed", "reinforcement_capacity"] },
      ]),
      makeBranch("logistics_nexus.resource_mobility", "Resource Mobility", "Pre-position reserves near the front.", [
        { tier: 1, name: "Convoy", description: "Mobile reserves.", effects: ["transfer_capacity"] },
        { tier: 2, name: "Forward Cache", description: "Pre-positioned buffer.", effects: ["transfer_capacity", "reinforcement_capacity"] },
        { tier: 3, name: "Continental Web", description: "Instant reinforcement.", effects: ["transfer_capacity", "reinforcement_capacity"] },
      ]),
    ],
    capstone: { direction: "Continental Web", description: "Grid-wide instant reinforcement." },
    energyProfile: { idleDemand: "medium", activeDemand: "high", burstDemand: "medium", note: "Indirect; little standalone punch." },
    strengths: ["Sustain", "Reach", "Recovery"],
    counters: ["Isolation (cut supply lines)"],
    risks: ["Indirect"],
    compatibility: {
      alignments: { nexus: "preferred" },
      weaponArchetypeIds: ["swarm_commodore", "aegis_interceptor"],
    },
    implementationStatus: "catalog_only",
  },
};

// ---------------------------------------------------------------------------
// Legacy compatibility (do NOT coerce; preserve as documented legacy values)
// ---------------------------------------------------------------------------

/**
 * The legacy persisted sub-parcel "archetype" (build-category axis) that
 * already exists in production (`SubParcelArchetype` in shared/schema.ts).
 * It is a DIFFERENT axis from the facility archetype and does not map cleanly
 * to any of the six canonical facility IDs, so we preserve it rather than
 * guess. Kept here only to document non-collision and for adapters.
 */
export const LEGACY_SUBPLOT_ARCHETYPES = ["resource", "trade", "fortress", "energy"] as const;
export type LegacySubplotArchetype = (typeof LEGACY_SUBPLOT_ARCHETYPES)[number];

/** True iff `id` is one of the six canonical facility archetype IDs. */
export function isFacilityArchetypeId(id: string): id is FacilityArchetypeId {
  return id in FACILITY_ARCHETYPES;
}

/**
 * Normalize a candidate facility id. Returns the canonical id when it matches;
 * otherwise `undefined` — legacy/sub-parcel archetypes are NOT silently turned
 * into a facility archetype.
 */
export function normalizeFacilityArchetypeId(id: string | null | undefined): FacilityArchetypeId | undefined {
  if (!id) return undefined;
  return isFacilityArchetypeId(id) ? id : undefined;
}

/** Validate a legacy sub-parcel archetype string; returns undefined if unknown. */
export function resolveLegacySubplotArchetype(id: string | null | undefined): LegacySubplotArchetype | undefined {
  if (!id) return undefined;
  return (LEGACY_SUBPLOT_ARCHETYPES as readonly string[]).includes(id) ? (id as LegacySubplotArchetype) : undefined;
}

// ---------------------------------------------------------------------------
// Read-only accessors
// ---------------------------------------------------------------------------

export function getFacilityArchetypeDefinition(id: FacilityArchetypeId): FacilityArchetypeDefinition {
  return FACILITY_ARCHETYPES[id];
}

export function listFacilityArchetypes(): FacilityArchetypeDefinition[] {
  return Object.values(FACILITY_ARCHETYPES);
}

export function getFacilityUpgradeBranch(
  archetypeId: FacilityArchetypeId,
  branchId: string,
): FacilityUpgradeBranch | undefined {
  return FACILITY_ARCHETYPES[archetypeId].upgradeBranches.find((b) => b.id === branchId);
}

// ---------------------------------------------------------------------------
// Validation (prefer tests over throwing in production paths)
// ---------------------------------------------------------------------------

const VALID_EFFECT_KEYS = new Set<string>([
  "troop_production",
  "reinforcement_capacity",
  "armor_quality",
  "attack_range",
  "fortification_penetration",
  "shield_capacity",
  "emp_resistance",
  "sensor_range",
  "stealth_detection",
  "iron_output",
  "fuel_output",
  "crystal_output",
  "energy_efficiency",
  "repair_speed",
  "transfer_capacity",
]);

const VALID_ENERGY = new Set<string>(["low", "medium", "high"]);
const VALID_BURST = new Set<string>(["none", "low", "medium", "high", "extreme"]);

/**
 * Validate the whole catalog shape. Returns a list of human-readable errors;
 * an empty list means the contract is satisfied. Intended for tests and
 * startup self-checks, not for per-request throwing.
 */
export function validateFacilityCatalog(): string[] {
  const errors: string[] = [];
  const defs = listFacilityArchetypes();

  if (defs.length !== 6) errors.push(`expected exactly 6 facility archetypes, got ${defs.length}`);

  const allIds = new Set<string>();
  const weaponIds = new Set(Object.keys(ARCHETYPES));

  for (const def of defs) {
    if (allIds.has(def.id)) errors.push(`duplicate facility id: ${def.id}`);
    allIds.add(def.id);

    if (def.implementationStatus !== "catalog_only") {
      errors.push(`facility ${def.id} must be catalog_only, got ${def.implementationStatus}`);
    }

    if (def.upgradeBranches.length !== 3) {
      errors.push(`facility ${def.id} must have exactly 3 branches, got ${def.upgradeBranches.length}`);
    }

    const branchIds = new Set<string>();
    const nodeIds = new Set<string>();

    for (const branch of def.upgradeBranches) {
      if (branchIds.has(branch.id)) errors.push(`facility ${def.id}: duplicate branch id ${branch.id}`);
      branchIds.add(branch.id);

      for (const node of branch.nodes) {
        if (nodeIds.has(node.id)) errors.push(`facility ${def.id}: duplicate node id ${node.id}`);
        nodeIds.add(node.id);

        for (const eff of node.effects) {
          if (!VALID_EFFECT_KEYS.has(eff)) errors.push(`facility ${def.id}: unknown effect key ${eff}`);
        }

        for (const pre of node.prerequisites) {
          if (!nodeIds.has(pre)) {
            // prereq may reference an earlier node in the same branch
            const exists = branch.nodes.some((n) => n.id === pre);
            if (!exists) errors.push(`facility ${def.id}: node ${node.id} prereq ${pre} not found`);
          }
        }

        // no cycle: a node must not prerequisite itself or a later tier
        if (node.prerequisites.includes(node.id)) errors.push(`facility ${def.id}: self-prerequisite on ${node.id}`);
      }

      // prerequisite chain integrity (tier i requires tier i-1)
      const byTier = new Map<number, FacilityUpgradeNode>();
      for (const n of branch.nodes) byTier.set(n.tier, n);
      for (const n of branch.nodes) {
        if (n.tier > 1) {
          const expected = `${branch.id}.t${n.tier - 1}`;
          if (!n.prerequisites.includes(expected)) {
            errors.push(`facility ${def.id}: node ${n.id} missing chain prereq ${expected}`);
          }
        }
      }
    }

    const ep = def.energyProfile;
    if (!VALID_ENERGY.has(ep.idleDemand)) errors.push(`facility ${def.id}: bad idleDemand ${ep.idleDemand}`);
    if (!VALID_ENERGY.has(ep.activeDemand)) errors.push(`facility ${def.id}: bad activeDemand ${ep.activeDemand}`);
    if (!VALID_BURST.has(ep.burstDemand)) errors.push(`facility ${def.id}: bad burstDemand ${ep.burstDemand}`);

    for (const [align, fit] of Object.entries(def.compatibility.alignments)) {
      if (align !== "helios" && align !== "aegis" && align !== "nexus") {
        errors.push(`facility ${def.id}: bad alignment ${align}`);
      }
      if (fit !== "preferred" && fit !== "compatible" && fit !== "inefficient") {
        errors.push(`facility ${def.id}: bad alignment fit ${fit}`);
      }
    }

    for (const w of def.compatibility.weaponArchetypeIds) {
      if (!weaponIds.has(w)) errors.push(`facility ${def.id}: weapon ref ${w} not an existing weapon archetype`);
    }
  }

  // legacy aliases must not collide with canonical facility ids
  for (const legacy of LEGACY_SUBPLOT_ARCHETYPES) {
    if (allIds.has(legacy)) errors.push(`legacy sub-parcel archetype "${legacy}" collides with a facility id`);
  }

  return errors;
}
