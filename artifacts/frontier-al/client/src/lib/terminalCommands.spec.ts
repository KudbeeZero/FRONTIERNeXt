import { describe, it, expect, vi } from "vitest";
import { matchTerminalCommand, matchCommandByLabel, type TerminalCommand } from "./terminalCommands";

function mineCmd(overrides: Partial<TerminalCommand> = {}): TerminalCommand {
  return { keyword: "mine", aliases: ["m", "extract"], label: "mine", run: vi.fn(), ...overrides };
}

describe("matchTerminalCommand", () => {
  it("matches the exact keyword", () => {
    const mine = mineCmd();
    expect(matchTerminalCommand("mine", [mine])).toBe(mine);
  });

  it("matches an alias", () => {
    const mine = mineCmd();
    expect(matchTerminalCommand("extract", [mine])).toBe(mine);
  });

  it("is case-insensitive and trims surrounding whitespace", () => {
    const mine = mineCmd();
    expect(matchTerminalCommand("  MINE  ", [mine])).toBe(mine);
  });

  it("collapses internal whitespace before matching", () => {
    const claimAll: TerminalCommand = { keyword: "claim all", label: "claim all", run: vi.fn() };
    expect(matchTerminalCommand("claim   all", [claimAll])).toBe(claimAll);
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(matchTerminalCommand("", [mineCmd()])).toBeNull();
    expect(matchTerminalCommand("   ", [mineCmd()])).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(matchTerminalCommand("attack", [mineCmd()])).toBeNull();
  });

  it("does not match a disabled command — typing its name is not a silent success", () => {
    const mine = mineCmd({ disabled: true });
    expect(matchTerminalCommand("mine", [mine])).toBeNull();
  });
});

describe("matchCommandByLabel", () => {
  it("matches by label case-insensitively", () => {
    const mine = mineCmd();
    expect(matchCommandByLabel("Mine", [mine])).toBe(mine);
  });

  it("returns null for a disabled command's label", () => {
    const mine = mineCmd({ disabled: true });
    expect(matchCommandByLabel("mine", [mine])).toBeNull();
  });

  it("returns null when no command has that label", () => {
    expect(matchCommandByLabel("upgrade", [mineCmd()])).toBeNull();
  });
});
