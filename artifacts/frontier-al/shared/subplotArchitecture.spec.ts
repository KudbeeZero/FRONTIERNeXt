/**
 * shared/subplotArchitecture.spec.ts
 *
 * Phase 1 contract tests for the canonical facility-archetype catalog.
 * These prove the catalog shape and adapters without touching gameplay.
 */
import { describe, it, expect } from "vitest";
import { ARCHETYPES } from "./weapons/archetypes";
import {
  FACILITY_ARCHETYPES,
  LEGACY_SUBPLOT_ARCHETYPES,
  listFacilityArchetypes,
  getFacilityArchetypeDefinition,
  getFacilityUpgradeBranch,
  isFacilityArchetypeId,
  normalizeFacilityArchetypeId,
  resolveLegacySubplotArchetype,
  validateFacilityCatalog,
  type FacilityArchetypeId,
  type FacilityEffectKey,
} from "./subplotArchitecture";

const CANONICAL_IDS: FacilityArchetypeId[] = [
  "assault_foundry",
  "siege_battery",
  "defense_bastion",
  "recon_array",
  "extraction_complex",
  "logistics_nexus",
];

describe("facility archetype catalog completeness", () => {
  it("has exactly six canonical facility archetypes", () => {
    const defs = listFacilityArchetypes();
    expect(defs).toHaveLength(6);
    expect(Object.keys(FACILITY_ARCHETYPES)).toHaveLength(6);
  });

  it("uses the exact approved stable IDs", () => {
    const ids = listFacilityArchetypes().map((d) => d.id).sort();
    expect(ids).toEqual([...CANONICAL_IDS].sort());
    for (const id of CANONICAL_IDS) {
      expect(isFacilityArchetypeId(id)).toBe(true);
    }
  });

  it("marks every definition catalog_only (no live effects)", () => {
    for (const def of listFacilityArchetypes()) {
      expect(def.implementationStatus).toBe("catalog_only");
    }
  });
});

describe("upgrade tree structure", () => {
  it("has exactly three branches per facility", () => {
    for (const def of listFacilityArchetypes()) {
      expect(def.upgradeBranches).toHaveLength(3);
    }
  });

  it("branch IDs are unique within an archetype", () => {
    for (const def of listFacilityArchetypes()) {
      const ids = def.upgradeBranches.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("node IDs are globally unique across the catalog", () => {
    const all: string[] = [];
    for (const def of listFacilityArchetypes()) {
      for (const b of def.upgradeBranches) all.push(...b.nodes.map((n) => n.id));
    }
    expect(new Set(all).size).toBe(all.length);
  });

  it("nodes have a valid prerequisite chain and no self/cross-cycle", () => {
    for (const def of listFacilityArchetypes()) {
      for (const branch of def.upgradeBranches) {
        const ids = branch.nodes.map((n) => n.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const node of branch.nodes) {
          // no self-prerequisite
          expect(node.prerequisites).not.toContain(node.id);
          for (const pre of node.prerequisites) {
            // prereq must be a real node in this branch
            expect(ids).toContain(pre);
            // chain integrity: tier i requires tier i-1
            if (node.tier > 1) {
              expect(node.prerequisites).toContain(`${branch.id}.t${node.tier - 1}`);
            } else {
              expect(node.prerequisites).toHaveLength(0);
            }
          }
        }
      }
    }
  });

  it("effect keys are recognized intent keys and not consumed here", () => {
    const valid = new Set<FacilityEffectKey>([
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
    for (const def of listFacilityArchetypes()) {
      for (const branch of def.upgradeBranches) {
        for (const node of branch.nodes) {
          for (const eff of node.effects) {
            expect(valid.has(eff)).toBe(true);
          }
        }
      }
    }
  });

  it("accessors resolve by id and branch id", () => {
    expect(getFacilityArchetypeDefinition("siege_battery").name).toBe("Siege Battery");
    expect(getFacilityUpgradeBranch("siege_battery", "siege_battery.range_targeting")?.nodes.length).toBeGreaterThan(0);
    expect(getFacilityUpgradeBranch("siege_battery", "nope")).toBeUndefined();
  });
});

describe("compatibility metadata", () => {
  it("alignments are restricted to helios/aegis/nexus with valid fit", () => {
    const fits = new Set(["preferred", "compatible", "inefficient"]);
    for (const def of listFacilityArchetypes()) {
      for (const [align, fit] of Object.entries(def.compatibility.alignments)) {
        expect(["helios", "aegis", "nexus"]).toContain(align);
        expect(fits.has(fit as string)).toBe(true);
      }
    }
  });

  it("weapon references resolve to existing weapon archetypes", () => {
    const weaponIds = new Set(Object.keys(ARCHETYPES));
    for (const def of listFacilityArchetypes()) {
      for (const w of def.compatibility.weaponArchetypeIds) {
        expect(weaponIds.has(w)).toBe(true);
      }
    }
  });

  it("energy profiles use qualitative categories only", () => {
    const e = new Set(["low", "medium", "high"]);
    const b = new Set(["none", "low", "medium", "high", "extreme"]);
    for (const def of listFacilityArchetypes()) {
      const p = def.energyProfile;
      expect(e.has(p.idleDemand)).toBe(true);
      expect(e.has(p.activeDemand)).toBe(true);
      expect(b.has(p.burstDemand)).toBe(true);
    }
  });

  it("Assault Foundry / Siege Battery / Defense Bastion match the approved qualitative profiles", () => {
    expect(getFacilityArchetypeDefinition("assault_foundry").energyProfile).toMatchObject({
      idleDemand: "medium",
      activeDemand: "high",
      burstDemand: "high",
    });
    expect(getFacilityArchetypeDefinition("siege_battery").energyProfile).toMatchObject({
      idleDemand: "low",
      activeDemand: "high",
      burstDemand: "extreme",
    });
    expect(getFacilityArchetypeDefinition("defense_bastion").energyProfile).toMatchObject({
      idleDemand: "medium",
      activeDemand: "high",
      burstDemand: "high",
    });
  });
});

describe("legacy compatibility adapters", () => {
  it("normalizeFacilityArchetypeId accepts canonical ids, never coerces legacy", () => {
    expect(normalizeFacilityArchetypeId("assault_foundry")).toBe("assault_foundry");
    expect(normalizeFacilityArchetypeId("resource")).toBeUndefined();
    expect(normalizeFacilityArchetypeId("fortress")).toBeUndefined();
    expect(normalizeFacilityArchetypeId("garbage")).toBeUndefined();
    expect(normalizeFacilityArchetypeId(null)).toBeUndefined();
    expect(normalizeFacilityArchetypeId(undefined)).toBeUndefined();
  });

  it("resolveLegacySubplotArchetype validates the four legacy values only", () => {
    expect(resolveLegacySubplotArchetype("fortress")).toBe("fortress");
    expect(resolveLegacySubplotArchetype("energy")).toBe("energy");
    // canonical facility ids are NOT legacy sub-parcel archetypes
    expect(resolveLegacySubplotArchetype("assault_foundry")).toBeUndefined();
    expect(resolveLegacySubplotArchetype("garbage")).toBeUndefined();
  });

  it("legacy values do not collide with canonical facility ids", () => {
    const facilityIds = new Set<string>(listFacilityArchetypes().map((d) => d.id));
    for (const legacy of LEGACY_SUBPLOT_ARCHETYPES) {
      expect(facilityIds.has(legacy)).toBe(false);
    }
  });
});

describe("catalog validation", () => {
  it("validateFacilityCatalog() returns zero errors", () => {
    expect(validateFacilityCatalog()).toEqual([]);
  });

  it("serialized catalog shape is deterministic", () => {
    const a = JSON.stringify(listFacilityArchetypes());
    const b = JSON.stringify(listFacilityArchetypes());
    expect(a).toBe(b);
    // stable key order: canonical id is first key of each entry
    expect(JSON.parse(a)[0].id).toBe("assault_foundry");
  });
});
