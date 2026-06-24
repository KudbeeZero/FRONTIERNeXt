import { describe, it, expect } from "vitest";
import { BOARD_PHASES, panelHasCTA } from "./dialogueGate";

describe("panelHasCTA — dialogue panel must defer to interactive boards", () => {
  it("never shows a CTA / captures pointer on a board phase (the board owns the clicks)", () => {
    for (const phase of BOARD_PHASES) {
      expect(panelHasCTA(phase, true)).toBe(false);
    }
  });

  it("includes 'repair' — regression guard for the frozen end of Chapter 1", () => {
    // The neural-repair board mounts during `repair`; if the panel showed a CTA
    // it would eat the node clicks and strand the player at the end of Ch.1.
    expect(BOARD_PHASES).toContain("repair");
    expect(panelHasCTA("repair", true)).toBe(false);
  });

  it("shows a CTA on a waiting non-board gate (e.g. the Ch.1→Ch.2 handoff)", () => {
    expect(panelHasCTA("stabilized", true)).toBe(true);
    expect(panelHasCTA("waking", true)).toBe(true);
  });

  it("shows no CTA when the line is not waiting", () => {
    expect(panelHasCTA("stabilized", false)).toBe(false);
    expect(panelHasCTA("repair", false)).toBe(false);
  });
});
