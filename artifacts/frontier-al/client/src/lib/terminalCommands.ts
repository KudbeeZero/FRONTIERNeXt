/**
 * client/src/lib/terminalCommands.ts
 *
 * Pure command-matching logic for GameTerminal (client/src/components/game/GameTerminal.tsx).
 * Kept separate from the component so the matching rules are unit-testable without React.
 */

export interface TerminalCommand {
  /** Canonical keyword, e.g. "mine". Matched case-insensitively. */
  keyword: string;
  /** Extra phrasings that also trigger this command, e.g. ["m", "extract"]. */
  aliases?: string[];
  /** Display text used both for the typed-command hint and for [bracket] tokens in lines. */
  label: string;
  run: () => void;
  disabled?: boolean;
}

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Resolve free-text terminal input against the available commands. Returns null for
 * empty input, no match, or a match against a disabled command (typing a disabled
 * command's name should not silently no-op-succeed).
 */
export function matchTerminalCommand(
  input: string,
  commands: TerminalCommand[],
): TerminalCommand | null {
  const norm = normalize(input);
  if (!norm) return null;
  const hit = commands.find((c) => {
    if (normalize(c.keyword) === norm) return true;
    return c.aliases?.some((a) => normalize(a) === norm) ?? false;
  });
  if (!hit || hit.disabled) return null;
  return hit;
}

/** Find the command (if any) whose label matches a [bracketed] token's inner text. */
export function matchCommandByLabel(
  label: string,
  commands: TerminalCommand[],
): TerminalCommand | null {
  const norm = normalize(label);
  if (!norm) return null;
  const hit = commands.find((c) => normalize(c.label) === norm);
  if (!hit || hit.disabled) return null;
  return hit;
}
