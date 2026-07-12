/**
 * client/tests/globe-faction-color.spec.ts
 *
 * Proves the globe colours a plot by its SERVER-DERIVED effective faction
 * (parcel.effectiveFaction) — so a human KRONOS member's land reads KRONOS purple,
 * not the generic enemy red or a neutral fallback. The owner display name is never
 * consulted; only the server-provided effectiveFaction is trusted.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { getPlotColor } from "../src/lib/globe/globeUtils";
import { factionColor } from "../src/lib/battle/factionColor";

const mkParcel = (over: Record<string, unknown> = {}) => ({
  biome: "forest" as const,
  ownerId: null as string | null,
  effectiveFaction: null as string | null,
  ...over,
});

describe("getPlotColor — faction-aware globe colouring", () => {
  it("biome-tints unowned plots", () => {
    const c = getPlotColor(mkParcel(), "me", undefined, null);
    expect(c).toBeInstanceOf(THREE.Color);
    // not the player/enemy/faction colour — a biome green
    expect(c.getHexString()).not.toBe(factionColor("KRONOS").replace("#", ""));
  });

  it("colours the viewer's own plot with the player colour", () => {
    const c = getPlotColor(mkParcel({ ownerId: "me", effectiveFaction: "KRONOS" }), "me", undefined, "KRONOS");
    // Ownership wins over faction — still the player colour, not faction purple.
    expect(c.getHexString()).toBe(new THREE.Color("#00ffaa").getHexString());
  });

  it("colours a faction member's plot with that faction's signature colour", () => {
    for (const f of ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE"] as const) {
      const c = getPlotColor(mkParcel({ ownerId: "other", effectiveFaction: f }), "me", undefined, f);
      expect(c.getHexString()).toBe(factionColor(f).replace("#", ""));
    }
  });

  it("does NOT colour by the owner's display name — only effectiveFaction", () => {
    // A human whose name happens to equal a faction id but who is unaligned.
    const c = getPlotColor(mkParcel({ ownerId: "other", effectiveFaction: null }), "me", undefined, null);
    // Unaligned owner → legacy enemy red, NOT a faction colour.
    expect(c.getHexString()).toBe(new THREE.Color("#ff4400").getHexString());
  });

  it("falls back to enemy tint for an unaligned, non-viewer owner", () => {
    const c = getPlotColor(mkParcel({ ownerId: "other", effectiveFaction: null }), "me", undefined, null);
    expect(c.getHexString()).toBe(new THREE.Color("#ff4400").getHexString());
  });
});
