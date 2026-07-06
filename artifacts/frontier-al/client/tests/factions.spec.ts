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
  asPlayerFactionId,
  resolveEffectiveFaction,
  shouldShowFactionGate,
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

describe("asPlayerFactionId", () => {
  it("passes through the four known factions and rejects everything else", () => {
    expect(asPlayerFactionId("KRONOS")).toBe("KRONOS");
    expect(asPlayerFactionId("NOT-A-FACTION")).toBeNull();
    expect(asPlayerFactionId(null)).toBeNull();
    expect(asPlayerFactionId(undefined)).toBeNull();
    expect(asPlayerFactionId("")).toBeNull();
  });
});

describe("resolveEffectiveFaction — the server record is authoritative", () => {
  it("prefers the server faction over a divergent localStorage cache", () => {
    // The account (server) says VANGUARD; this browser's cache says KRONOS.
    // The wallet-keyed record wins so the player's identity stays with their account.
    expect(resolveEffectiveFaction("VANGUARD", "KRONOS")).toBe("VANGUARD");
  });

  it("falls back to the local cache only when the server has no faction", () => {
    expect(resolveEffectiveFaction(null, "KRONOS")).toBe("KRONOS");
    expect(resolveEffectiveFaction(undefined, "SPECTRE")).toBe("SPECTRE");
  });

  it("is null when neither source has a valid faction", () => {
    expect(resolveEffectiveFaction(null, null)).toBeNull();
    expect(resolveEffectiveFaction("garbage", null)).toBeNull();
  });
});

describe("shouldShowFactionGate — never re-prompt a player who already claimed", () => {
  it("hides the gate when the account already has a faction, even with empty localStorage (new device)", () => {
    expect(shouldShowFactionGate({ serverFaction: "VANGUARD", localFaction: null })).toBe(false);
  });

  it("hides the gate when localStorage remembers a pick (pre-auth / not-yet-connected visitor)", () => {
    expect(shouldShowFactionGate({ serverFaction: null, localFaction: "KRONOS" })).toBe(false);
  });

  it("shows the gate only when neither the account nor the cache has a faction", () => {
    expect(shouldShowFactionGate({ serverFaction: null, localFaction: null })).toBe(true);
    expect(shouldShowFactionGate({ serverFaction: "garbage", localFaction: null })).toBe(true);
  });
});
