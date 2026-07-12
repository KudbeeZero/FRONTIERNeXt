/**
 * server/storage/factionTerritory.mem.spec.ts
 *
 * Integration proof that faction identity flows from the canonical owner through
 * MemStorage.getGameState() into each parcel's server-derived `effectiveFaction`
 * (defect #3): AI canonical faction accounts expose their faction; unaligned
 * players expose neutral. The same wiring runs in DbStorage in production.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { MemStorage } from "./mem";
import type { GameState } from "@shared/schema";

describe("faction territory — effectiveFaction exposed by getGameState (MemStorage)", () => {
  let state: GameState;

  beforeAll(async () => {
    const storage = new MemStorage();
    await storage.initialize();
    state = await storage.getGameState();
  });

  it("attaches each AI faction account's faction to its owned parcel", () => {
    const byName = new Map(state.players.map((p) => [p.name, p]));
    for (const faction of ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE"]) {
      const ai = byName.get(faction);
      expect(ai, `seeded AI faction account ${faction}`).toBeDefined();
      const parcel = state.parcels.find((p) => p.ownerId === ai!.id);
      expect(parcel, `parcel owned by ${faction}`).toBeDefined();
      expect(parcel!.effectiveFaction).toBe(faction);
    }
  });

  it("leaves unowned parcels neutral (no effectiveFaction)", () => {
    const unowned = state.parcels.filter((p) => !p.ownerId);
    expect(unowned.length).toBeGreaterThan(0);
    for (const p of unowned) expect(p.effectiveFaction ?? null).toBeNull();
  });
});
