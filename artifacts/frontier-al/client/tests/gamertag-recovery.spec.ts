/**
 * client/tests/gamertag-recovery.spec.ts
 *
 * Unit coverage for the gamertag "unnamed" detection + recovery decision used
 * by the recovery flow (GameLayout re-prompts any human player whose tag was
 * never saved). This is the smallest-safe, schema-free recovery: a player who
 * never set a gamertag keeps the server-generated default name
 * `<first6>...<last4>` of their wallet address (server/storage/db.ts
 * getOrCreatePlayerByAddress). We re-prompt when the player's name still
 * matches that default (or is null/empty), but never for AI factions or
 * service accounts.
 *
 * `shouldRecoverGamerTag` is the EXACT decision the GameLayout recovery effect
 * calls, so these tests prove the behavioral contract:
 *  - an authenticated unnamed player is prompted on a later login (fresh mount,
 *    dismissed=false, not already showing);
 *  - a failed first attempt does not permanently suppress the modal (the player
 *    stays unnamed, so the next fresh mount prompts again);
 *  - a named player is not prompted;
 *  - an AI faction is not prompted;
 *  - dismissal does not create an immediate reopen loop (dismissed=true blocks);
 *  - a modal already showing is not doubled-up;
 *  - after a successful save the name is no longer the default, so future
 *    mounts prompt nothing.
 */
import { describe, it, expect } from "vitest";
import {
  isDefaultUnnamedName,
  needsGamertag,
  shouldRecoverGamerTag,
} from "@/lib/gamertag";

const ADDR = "ABCDEFGEHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345";
const DEFAULT_NAME = `${ADDR.slice(0, 6)}...${ADDR.slice(-4)}`; // ABCDEF...2345

describe("isDefaultUnnamedName", () => {
  it("treats null / empty as unnamed", () => {
    expect(isDefaultUnnamedName(null, ADDR)).toBe(true);
    expect(isDefaultUnnamedName(undefined, ADDR)).toBe(true);
    expect(isDefaultUnnamedName("", ADDR)).toBe(true);
    expect(isDefaultUnnamedName("   ", ADDR)).toBe(true);
  });

  it("treats the server default display name as unnamed (case-insensitive)", () => {
    expect(isDefaultUnnamedName(DEFAULT_NAME, ADDR)).toBe(true);
    expect(isDefaultUnnamedName(DEFAULT_NAME.toLowerCase(), ADDR)).toBe(true);
  });

  it("treats a real chosen gamertag as named", () => {
    expect(isDefaultUnnamedName("Nova Commander", ADDR)).toBe(false);
    expect(isDefaultUnnamedName("abc", ADDR)).toBe(false);
    expect(isDefaultUnnamedName(DEFAULT_NAME, ADDR + "9")).toBe(false);
  });

  it("does not prompt short/non-address identities (dev/test sentinels)", () => {
    expect(isDefaultUnnamedName("short...xy", "shortaddr")).toBe(false);
  });
});

describe("needsGamertag", () => {
  it("prompts an unnamed human player", () => {
    expect(needsGamertag({ name: DEFAULT_NAME, address: ADDR, isAi: false })).toBe(true);
  });
  it("does NOT prompt a named human player", () => {
    expect(needsGamertag({ name: "VanguardPrime", address: ADDR, isAi: false })).toBe(false);
  });
  it("does NOT prompt an AI faction even if its name matches the default pattern", () => {
    expect(needsGamertag({ name: DEFAULT_NAME, address: ADDR, isAi: true })).toBe(false);
  });
  it("does NOT prompt when no player is supplied", () => {
    expect(needsGamertag(null)).toBe(false);
    expect(needsGamertag(undefined)).toBe(false);
  });
});

describe("shouldRecoverGamerTag (GameLayout recovery decision)", () => {
  const base = { player: { name: DEFAULT_NAME, address: ADDR, isAi: false } };

  it("prompts an authenticated unnamed player on a later login (fresh mount)", () => {
    expect(shouldRecoverGamerTag({ ...base, dismissed: false, showGamerTag: false })).toBe(true);
  });

  it("a failed first attempt does not permanently suppress the modal (still unnamed)", () => {
    // The save never persisted, so name is still the default; a fresh mount
    // (dismissed=false) must prompt again — no new wallet / purchase / DB edit.
    expect(shouldRecoverGamerTag({ ...base, dismissed: false, showGamerTag: false })).toBe(true);
  });

  it("does NOT prompt a player who already has a gamertag", () => {
    expect(
      shouldRecoverGamerTag({
        player: { name: "Nova Commander", address: ADDR, isAi: false },
        dismissed: false,
        showGamerTag: false,
      }),
    ).toBe(false);
  });

  it("does NOT prompt an AI faction even with a default-style name", () => {
    expect(
      shouldRecoverGamerTag({
        player: { name: DEFAULT_NAME, address: ADDR, isAi: true },
        dismissed: false,
        showGamerTag: false,
      }),
    ).toBe(false);
  });

  it("dismissal does not create an immediate reopen loop (dismissed blocks)", () => {
    expect(shouldRecoverGamerTag({ ...base, dismissed: true, showGamerTag: false })).toBe(false);
  });

  it("does not double-up an already-open modal", () => {
    expect(shouldRecoverGamerTag({ ...base, dismissed: false, showGamerTag: true })).toBe(false);
  });

  it("after a successful save the name is set, so future mounts prompt nothing", () => {
    // Simulates the post-save player record: name no longer matches the default.
    expect(
      shouldRecoverGamerTag({
        player: { name: "Nova Commander", address: ADDR, isAi: false },
        dismissed: false,
        showGamerTag: false,
      }),
    ).toBe(false);
  });
});
