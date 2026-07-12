/**
 * shared/factionIdentity.spec.ts
 *
 * Proves the canonical server-authoritative faction derivation used for territory
 * totals, globe colouring, and (future) Battle Planner ally/enemy targeting:
 *   - no owner                       → neutral
 *   - AI canonical faction account   → that faction
 *   - human with durable playerFactionId (server-provided) → that faction
 *   - human with no faction          → neutral
 *   - human faction is NEVER inferred from the display name
 */
import { describe, it, expect } from "vitest";
import {
  resolvePlayerFaction,
  resolveParcelFaction,
  classifyRelationship,
  computeFactionTerritory,
  sanitizeFaction,
  isKnownFaction,
  NEUTRAL_FACTION,
} from "./factionIdentity";
import type { FactionOwnerLike, ParcelOwnerLike } from "./factionIdentity";

const human = (over: Partial<FactionOwnerLike> = {}): FactionOwnerLike => ({ isAi: false, ...over });
const ai = (over: Partial<FactionOwnerLike> = {}): FactionOwnerLike => ({ isAi: true, ...over });

describe("resolvePlayerFaction", () => {
  it("returns neutral for null / missing owner", () => {
    expect(resolvePlayerFaction(null)).toBe(NEUTRAL_FACTION);
    expect(resolvePlayerFaction(undefined)).toBe(NEUTRAL_FACTION);
  });

  it("resolves a human's durable playerFactionId", () => {
    expect(resolvePlayerFaction(human({ playerFactionId: "KRONOS" }))).toBe("KRONOS");
    expect(resolvePlayerFaction(human({ playerFactionId: "SPECTRE" }))).toBe("SPECTRE");
  });

  it("treats a faction-less human as neutral", () => {
    expect(resolvePlayerFaction(human({ playerFactionId: null }))).toBe(NEUTRAL_FACTION);
    expect(resolvePlayerFaction(human({ name: "CoolGamer99" }))).toBe(NEUTRAL_FACTION);
  });

  it("NEVER infers a human's faction from their display name", () => {
    expect(resolvePlayerFaction(human({ name: "NEXUS-7" }))).toBe(NEUTRAL_FACTION);
    expect(resolvePlayerFaction(human({ name: "KRONOS", playerFactionId: null }))).toBe(NEUTRAL_FACTION);
  });

  it("resolves a canonical AI faction account by name", () => {
    expect(resolvePlayerFaction(ai({ name: "NEXUS-7" }))).toBe("NEXUS-7");
    expect(resolvePlayerFaction(ai({ name: "VANGUARD" }))).toBe("VANGUARD");
  });

  it("treats a non-faction AI account as neutral", () => {
    expect(resolvePlayerFaction(ai({ name: "some-ai-bot" }))).toBe(NEUTRAL_FACTION);
    expect(resolvePlayerFaction(ai({ name: null }))).toBe(NEUTRAL_FACTION);
  });

  it("accepts the shared Player shape (isAI capitalised)", () => {
    expect(resolvePlayerFaction({ isAI: true, name: "KRONOS" } as any)).toBe("KRONOS");
    expect(resolvePlayerFaction({ isAI: false, playerFactionId: "SPECTRE" } as any)).toBe("SPECTRE");
  });
});

describe("resolveParcelFaction", () => {
  it("is neutral when unowned", () => {
    const parcel: ParcelOwnerLike = { ownerId: null };
    expect(resolveParcelFaction(parcel, null)).toBe(NEUTRAL_FACTION);
  });

  it("derives the faction from the canonical owner player", () => {
    const parcel: ParcelOwnerLike = { ownerId: "p1" };
    expect(resolveParcelFaction(parcel, human({ playerFactionId: "KRONOS" }))).toBe("KRONOS");
    expect(resolveParcelFaction(parcel, ai({ name: "NEXUS-7" }))).toBe("NEXUS-7");
    expect(resolveParcelFaction(parcel, human({ name: "Gamer" }))).toBe(NEUTRAL_FACTION);
  });

  it("is neutral for an owned parcel whose owner is unknown", () => {
    const parcel: ParcelOwnerLike = { ownerId: "ghost" };
    expect(resolveParcelFaction(parcel, null)).toBe(NEUTRAL_FACTION);
  });
});

describe("classifyRelationship (ally/enemy/neutral)", () => {
  it("is neutral when either side is unaligned", () => {
    expect(classifyRelationship(null, "KRONOS")).toBe("neutral");
    expect(classifyRelationship("KRONOS", null)).toBe("neutral");
    expect(classifyRelationship(null, null)).toBe("neutral");
  });

  it("is ally for the same faction, enemy for different factions", () => {
    expect(classifyRelationship("KRONOS", "KRONOS")).toBe("ally");
    expect(classifyRelationship("KRONOS", "NEXUS-7")).toBe("enemy");
    expect(classifyRelationship("SPECTRE", "VANGUARD")).toBe("enemy");
  });
});

describe("sanitizeFaction / isKnownFaction", () => {
  it("sanitises arbitrary strings to known factions or null", () => {
    expect(sanitizeFaction("KRONOS")).toBe("KRONOS");
    expect(sanitizeFaction("not-a-faction")).toBe(NEUTRAL_FACTION);
    expect(sanitizeFaction("")).toBe(NEUTRAL_FACTION);
    expect(sanitizeFaction(undefined)).toBe(NEUTRAL_FACTION);
  });
  it("recognises known factions", () => {
    expect(isKnownFaction("VANGUARD")).toBe(true);
    expect(isKnownFaction("nope")).toBe(false);
  });
});

describe("computeFactionTerritory", () => {
  const players = new Map<string, FactionOwnerLike>([
    ["ai-nexus", ai({ name: "NEXUS-7" })],
    ["ai-kronos", ai({ name: "KRONOS" })],
    ["human-kronos", human({ playerFactionId: "KRONOS" })],
    ["human-unaligned", human({ name: "Gamer" })],
    ["ai-generic", ai({ name: "some-bot" })],
  ]);
  const parcels: ParcelOwnerLike[] = [
    { ownerId: "ai-nexus" },
    { ownerId: "ai-nexus" },
    { ownerId: "ai-kronos" },
    { ownerId: "human-kronos" },
    { ownerId: "human-kronos" },
    { ownerId: "human-kronos" },
    { ownerId: "human-unaligned" },
    { ownerId: "ai-generic" },
    { ownerId: null },
  ];

  it("attributes parcels to their owner's effective faction (incl. humans)", () => {
    const counts = computeFactionTerritory(parcels, players);
    expect(counts["NEXUS-7"]).toBe(2);
    expect(counts["KRONOS"]).toBe(4); // 1 AI + 3 human
    expect(counts["VANGUARD"]).toBeUndefined();
    expect(counts["SPECTRE"]).toBeUndefined();
  });

  it("excludes unowned, unaligned, and non-faction AI parcels", () => {
    const counts = computeFactionTerritory(parcels, players);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(6); // 8 owned − (1 unaligned human + 1 generic AI)
  });
});
