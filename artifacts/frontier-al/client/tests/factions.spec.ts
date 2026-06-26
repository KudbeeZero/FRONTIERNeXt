/**
 * Guards the player-faction metadata + the localStorage choice round-trip that
 * backs the faction-select entry gate (shows once, remembers your pick).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PLAYER_FACTION_IDS } from "@shared/waitlist";
import {
  PLAYER_FACTIONS,
  chosenFaction,
  chooseFaction,
  clearFaction,
  nextFactionSync,
} from "@/lib/factions";

// The client suite runs in node (no jsdom). Stub a minimal window.localStorage so
// the choice helpers — which guard on `typeof window` — have something to talk to.
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
});
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("PLAYER_FACTIONS metadata", () => {
  it("has exactly the four faction ids, fully populated", () => {
    expect(PLAYER_FACTIONS.map((f) => f.id).sort()).toEqual([...PLAYER_FACTION_IDS].sort());
    for (const f of PLAYER_FACTIONS) {
      for (const field of [f.name, f.tagline, f.blurb, f.color, f.behavior]) {
        expect(field, `${f.id} field`).toBeTruthy();
      }
    }
  });
});

describe("faction choice persistence", () => {
  beforeEach(() => clearFaction());

  it("returns null before a choice, then the chosen id", () => {
    expect(chosenFaction()).toBeNull();
    chooseFaction("VANGUARD");
    expect(chosenFaction()).toBe("VANGUARD");
  });

  it("ignores a garbage stored value (fail-safe to null)", () => {
    window.localStorage.setItem("frontier_faction", "NOT-A-FACTION");
    expect(chosenFaction()).toBeNull();
  });

  it("clearFaction resets the gate", () => {
    chooseFaction("KRONOS");
    clearFaction();
    expect(chosenFaction()).toBeNull();
  });
});

describe("nextFactionSync", () => {
  it("joins when a faction is picked and differs from the player's current", () => {
    expect(nextFactionSync(null, "VANGUARD")).toEqual({ shouldJoin: true, faction: "VANGUARD" });
    expect(nextFactionSync("KRONOS", "VANGUARD")).toEqual({ shouldJoin: true, faction: "VANGUARD" });
  });

  it("does not join when nothing picked or already aligned (no redundant write / cooldown hit)", () => {
    expect(nextFactionSync("KRONOS", null)).toEqual({ shouldJoin: false, faction: null });
    expect(nextFactionSync("VANGUARD", "VANGUARD")).toEqual({ shouldJoin: false, faction: "VANGUARD" });
  });
});
