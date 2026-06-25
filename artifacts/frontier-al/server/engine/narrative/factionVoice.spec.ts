/**
 * Pins the AI faction VOICE engine: deterministic, in-character, fail-safe.
 *
 * Properties guarded:
 *  - every known faction has a non-empty line for every moment;
 *  - selection is deterministic (same faction+moment+seed → same line) and total
 *    over seeds (always lands inside that faction's line set, never throws);
 *  - the four factions are genuinely distinct (no two share an identical line set);
 *  - unknown factions fail safe (null line; withFactionVoice returns the base
 *    description unchanged, so wiring it in can never blank out the event log).
 */
import { describe, it, expect } from "vitest";
import {
  FACTION_VOICES,
  factionVoiceLine,
  withFactionVoice,
  type FactionMoment,
} from "./factionVoice";

const FACTIONS = ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE"];
const MOMENTS: FactionMoment[] = ["expand", "assault", "reconquest", "raid", "suppressed"];

describe("factionVoiceLine", () => {
  it("returns a non-empty in-set line for every faction × moment", () => {
    for (const f of FACTIONS) {
      for (const m of MOMENTS) {
        const line = factionVoiceLine(f, m, 0);
        expect(line, `${f}/${m}`).toBeTruthy();
        expect(FACTION_VOICES[f].lines[m]).toContain(line);
      }
    }
  });

  it("is deterministic for a fixed faction+moment+seed", () => {
    expect(factionVoiceLine("KRONOS", "assault", 7)).toBe(
      factionVoiceLine("KRONOS", "assault", 7),
    );
  });

  it("is total over seeds — any seed lands in the line set, never throws", () => {
    const set = FACTION_VOICES["SPECTRE"].lines.expand;
    for (const seed of [0, 1, 2, 5, 99, -3, 1_000_000, 2.9]) {
      expect(set).toContain(factionVoiceLine("SPECTRE", "expand", seed));
    }
  });

  it("the seed actually varies the delivery across a multi-line moment", () => {
    // NEXUS-7 'expand' has 3 variants; seeds 0/1/2 must hit each index.
    const picks = new Set([0, 1, 2].map((s) => factionVoiceLine("NEXUS-7", "expand", s)));
    expect(picks.size).toBe(3);
  });

  it("each faction has a distinct voice (no shared line set for a moment)", () => {
    for (const m of MOMENTS) {
      const sets = FACTIONS.map((f) => JSON.stringify(FACTION_VOICES[f].lines[m]));
      expect(new Set(sets).size, `moment ${m} should be unique per faction`).toBe(FACTIONS.length);
    }
  });

  it("returns null for an unknown faction (fail-safe)", () => {
    expect(factionVoiceLine("DEV-TEST-COMMANDER", "assault", 0)).toBeNull();
    expect(factionVoiceLine("", "expand", 0)).toBeNull();
  });
});

describe("withFactionVoice", () => {
  it("appends a quoted taunt for a known faction, preserving the factual base", () => {
    const out = withFactionVoice("VANGUARD", "raid", 0, "VANGUARD raided plot #42 and withdrew");
    expect(out).toContain("VANGUARD raided plot #42 and withdrew");
    expect(out).toContain("💬");
    expect(out).toContain(factionVoiceLine("VANGUARD", "raid", 0)!);
  });

  it("returns the base description unchanged for an unknown faction", () => {
    const base = "Someone did something";
    expect(withFactionVoice("UNKNOWN", "expand", 3, base)).toBe(base);
  });
});
