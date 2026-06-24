/**
 * client/tests/faction-color.spec.ts
 *
 * Proves the faction → hex mapping used to colour the battle cinematic by the
 * conqueror's identity: known factions get their signature hue, everything else
 * (player handles, "Unclaimed", null) falls back to the neutral colour.
 */
import { describe, it, expect } from "vitest";
import { factionColor, isKnownFaction, NEUTRAL_COLOR } from "../src/lib/battle/factionColor";

describe("factionColor", () => {
  it("maps each known faction to a distinct hex", () => {
    const colors = ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE"].map(factionColor);
    for (const c of colors) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    expect(new Set(colors).size).toBe(4); // all distinct
  });

  it("falls back to neutral for unknown names, 'Unclaimed', and nullish", () => {
    expect(factionColor("Unclaimed")).toBe(NEUTRAL_COLOR);
    expect(factionColor("some-player-uuid")).toBe(NEUTRAL_COLOR);
    expect(factionColor(null)).toBe(NEUTRAL_COLOR);
    expect(factionColor(undefined)).toBe(NEUTRAL_COLOR);
    expect(factionColor("")).toBe(NEUTRAL_COLOR);
  });

  it("isKnownFaction distinguishes factions from player handles", () => {
    expect(isKnownFaction("VANGUARD")).toBe(true);
    expect(isKnownFaction("Unclaimed")).toBe(false);
    expect(isKnownFaction(null)).toBe(false);
  });
});
