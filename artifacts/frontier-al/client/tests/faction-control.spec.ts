/**
 * client/tests/faction-control.spec.ts
 *
 * Proves the pure Faction Control shaping: fixed faction order/colors
 * (matching PLAYER_FACTIONS, the faction-select gate), a correctly computed
 * Unclaimed remainder, and defensive floors against bad/negative input.
 */
import { describe, it, expect } from "vitest";
import { buildFactionControlRows } from "../src/lib/economics/factionControl";
import { PLAYER_FACTIONS } from "../src/lib/factions";
import { TOTAL_PLOTS } from "@shared/schema";

describe("buildFactionControlRows", () => {
  it("returns rows in the fixed PLAYER_FACTIONS order, plus Unclaimed last", () => {
    const rows = buildFactionControlRows(
      PLAYER_FACTIONS.map((f) => ({ name: f.name, territoryCount: 100 })),
      500,
    );
    expect(rows.map((r) => r.name)).toEqual([...PLAYER_FACTIONS.map((f) => f.name), "Unclaimed"]);
  });

  it("uses each faction's real brand color (matches the faction-select gate)", () => {
    const rows = buildFactionControlRows(
      PLAYER_FACTIONS.map((f) => ({ name: f.name, territoryCount: 10 })),
      0,
    );
    for (const f of PLAYER_FACTIONS) {
      expect(rows.find((r) => r.name === f.name)?.color).toBe(f.color);
    }
  });

  it("computes Unclaimed as the true remainder of total plots", () => {
    const rows = buildFactionControlRows(
      [
        { name: "NEXUS-7", territoryCount: 1000 },
        { name: "KRONOS", territoryCount: 2000 },
        { name: "VANGUARD", territoryCount: 500 },
        { name: "SPECTRE", territoryCount: 1500 },
      ],
      3000, // player-owned parcels
      21000,
    );
    const unclaimed = rows.find((r) => r.name === "Unclaimed")!;
    // 21000 - (1000+2000+500+1500) - 3000 = 13000
    expect(unclaimed.territoryCount).toBe(13000);
  });

  it("floors Unclaimed at 0 rather than going negative", () => {
    const rows = buildFactionControlRows(
      PLAYER_FACTIONS.map((f) => ({ name: f.name, territoryCount: 999999 })),
      999999,
      21000,
    );
    expect(rows.find((r) => r.name === "Unclaimed")!.territoryCount).toBe(0);
  });

  it("treats a missing/unknown faction as 0 territory rather than throwing", () => {
    const rows = buildFactionControlRows([{ name: "NEXUS-7", territoryCount: 50 }], 0);
    expect(rows.find((r) => r.name === "KRONOS")!.territoryCount).toBe(0);
  });

  it("floors negative input territory at 0", () => {
    const rows = buildFactionControlRows([{ name: "NEXUS-7", territoryCount: -10 }], -5);
    expect(rows.find((r) => r.name === "NEXUS-7")!.territoryCount).toBe(0);
  });

  it("defaults totalParcels to the real TOTAL_PLOTS constant", () => {
    const rows = buildFactionControlRows([], 0);
    expect(rows.find((r) => r.name === "Unclaimed")!.territoryCount).toBe(TOTAL_PLOTS);
  });
});
