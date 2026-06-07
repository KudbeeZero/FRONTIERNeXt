import { describe, it, expect } from "vitest";
import { canAssignArchetype, computeArchetypeFactionBonus } from "./game-rules.js";
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
    purchasePriceFrontier: partial.purchasePriceFrontier ?? 50,
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
