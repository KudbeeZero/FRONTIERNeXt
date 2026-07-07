import { describe, it, expect } from "vitest";
import { isRailTab, resolveRailTab } from "./panelNav";

describe("isRailTab", () => {
  it("is true for every panel the desktop rail can render", () => {
    for (const t of [
      "battles", "armory", "university", "commander", "inventory",
      "leaderboard", "trade", "factions", "markets", "economics", "intel",
    ] as const) {
      expect(isRailTab(t)).toBe(true);
    }
  });

  it("is false for the one mobile-only concept ('map' has no desktop-rail panel)", () => {
    expect(isRailTab("map")).toBe(false);
  });
});

describe("resolveRailTab", () => {
  it("shows the active tab directly when it's rail-eligible", () => {
    expect(resolveRailTab("commander", "battles")).toBe("commander");
  });

  it("falls back to the last rail tab when the active tab is 'map'", () => {
    expect(resolveRailTab("map", "armory")).toBe("armory");
  });

  it("shows 'inventory' directly now that it has a desktop-rail panel (was mobile-only)", () => {
    expect(resolveRailTab("inventory", "markets")).toBe("inventory");
  });
});
