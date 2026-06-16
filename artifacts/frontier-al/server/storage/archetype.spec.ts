import { describe, it, expect } from "vitest";
import { canAssignArchetype, computeArchetypeFactionBonus } from "./game-rules.js";
import { isImprovementAllowedForArchetype } from "../../shared/schema.js";
import type { SubParcel, SubParcelArchetype } from "../../shared/schema.js";

// Minimal SubParcel factory — only the fields the archetype rules read matter.
function mk(partial: Partial<SubParcel> & { id: string }): SubParcel {
  return {
    id: partial.id,
    parentPlotId: partial.parentPlotId ?? 1,
    subIndex: partial.subIndex ?? 0,
    ownerId: partial.ownerId ?? null,
    ownerType: partial.ownerType ?? null,
    improvements: partial.improvements ?? [],
    resourceYieldFraction: partial.resourceYieldFraction ?? 1 / 9,
    purchasePriceAscend: partial.purchasePriceAscend ?? 50,
    acquiredAt: partial.acquiredAt ?? null,
    activeBattleId: partial.activeBattleId ?? null,
    archetype: partial.archetype ?? null,
    archetypeLevel: partial.archetypeLevel ?? 0,
    energyAlignment: partial.energyAlignment ?? null,
  } as SubParcel;
}

const ME = "player-1";

describe("canAssignArchetype", () => {
  it("rejects when the player does not own the sub-parcel", () => {
    const sp = mk({ id: "a", ownerId: "someone-else" });
    expect(canAssignArchetype(sp, [sp], ME, "resource", 1)).toMatch(/don't own/i);
  });

  it("allows a valid assignment on an owned sub-parcel", () => {
    const sp = mk({ id: "a", ownerId: ME });
    expect(canAssignArchetype(sp, [sp], ME, "resource", 1)).toBeNull();
  });

  it("enforces the max-same-archetype-per-grid limit (3)", () => {
    const target = mk({ id: "target", ownerId: ME });
    const grid: SubParcel[] = [
      target,
      mk({ id: "b", ownerId: ME, archetype: "resource" as SubParcelArchetype }),
      mk({ id: "c", ownerId: ME, archetype: "resource" as SubParcelArchetype }),
      mk({ id: "d", ownerId: ME, archetype: "resource" as SubParcelArchetype }),
    ];
    expect(canAssignArchetype(target, grid, ME, "resource", 1)).toMatch(/maximum/i);
    // A different archetype is still allowed.
    expect(canAssignArchetype(target, grid, ME, "trade", 1)).toBeNull();
  });

  it("rejects an out-of-range fortress level", () => {
    const sp = mk({ id: "a", ownerId: ME });
    expect(canAssignArchetype(sp, [sp], ME, "fortress", 4)).toMatch(/fortress level/i);
    expect(canAssignArchetype(sp, [sp], ME, "fortress", 2)).toBeNull();
  });

  it("rejects energyAlignment on a non-energy archetype", () => {
    const sp = mk({ id: "a", ownerId: ME });
    expect(canAssignArchetype(sp, [sp], ME, "resource", 1, "helios")).toMatch(/energyAlignment/i);
    expect(canAssignArchetype(sp, [sp], ME, "energy", 1, "helios")).toBeNull();
  });
});

describe("computeArchetypeFactionBonus", () => {
  it("returns the documented faction bonuses", () => {
    expect(computeArchetypeFactionBonus("fortress", "KRONOS")).toBeCloseTo(0.25);
    expect(computeArchetypeFactionBonus("resource", "SPECTRE")).toBeCloseTo(0.15);
    expect(computeArchetypeFactionBonus("trade", "SPECTRE")).toBeCloseTo(0.2);
    expect(computeArchetypeFactionBonus("energy", "NEXUS-7")).toBeCloseTo(0.2);
  });

  it("returns 0 for non-matching or missing factions", () => {
    expect(computeArchetypeFactionBonus("fortress", "SPECTRE")).toBe(0);
    expect(computeArchetypeFactionBonus("resource", null)).toBe(0);
    expect(computeArchetypeFactionBonus("trade", undefined)).toBe(0);
  });
});

describe("isImprovementAllowedForArchetype", () => {
  it("an unassigned sub-parcel can build anything", () => {
    expect(isImprovementAllowedForArchetype(null, "turret")).toBe(true);
    expect(isImprovementAllowedForArchetype(null, "blockchain_node")).toBe(true);
    expect(isImprovementAllowedForArchetype(undefined, "ai_lab")).toBe(true);
  });

  it("fortress allows defenses but not facilities", () => {
    expect(isImprovementAllowedForArchetype("fortress", "turret")).toBe(true);
    expect(isImprovementAllowedForArchetype("fortress", "fortress")).toBe(true);
    expect(isImprovementAllowedForArchetype("fortress", "radar")).toBe(true);
    expect(isImprovementAllowedForArchetype("fortress", "electricity")).toBe(false);
    expect(isImprovementAllowedForArchetype("fortress", "blockchain_node")).toBe(false);
  });

  it("resource allows yield facilities + storage but not weapons or token gen", () => {
    expect(isImprovementAllowedForArchetype("resource", "data_centre")).toBe(true);
    expect(isImprovementAllowedForArchetype("resource", "ai_lab")).toBe(true);
    expect(isImprovementAllowedForArchetype("resource", "storage_depot")).toBe(true);
    expect(isImprovementAllowedForArchetype("resource", "turret")).toBe(false);
    expect(isImprovementAllowedForArchetype("resource", "blockchain_node")).toBe(false);
  });

  it("energy and trade gate to their themes", () => {
    expect(isImprovementAllowedForArchetype("energy", "blockchain_node")).toBe(true);
    expect(isImprovementAllowedForArchetype("energy", "turret")).toBe(false);
    expect(isImprovementAllowedForArchetype("trade", "blockchain_node")).toBe(true);
    expect(isImprovementAllowedForArchetype("trade", "ai_lab")).toBe(false);
  });

  it("every archetype that permits a prereq-gated facility also permits electricity", () => {
    for (const a of ["resource", "trade", "energy"] as SubParcelArchetype[]) {
      const needsElec = ["blockchain_node", "data_centre", "ai_lab"].some(
        t => isImprovementAllowedForArchetype(a, t as any),
      );
      if (needsElec) expect(isImprovementAllowedForArchetype(a, "electricity")).toBe(true);
    }
  });
});
