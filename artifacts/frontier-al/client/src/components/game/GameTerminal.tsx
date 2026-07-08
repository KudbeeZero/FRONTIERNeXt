/**
 * client/src/components/game/GameTerminal.tsx
 *
 * A reusable CRT-styled terminal shell (same monospace/glow language as
 * PlotTerminalReadout) that adds two input modes on top of plain narration:
 *   1. A typed command line — type "mine" and press Enter.
 *   2. Clickable [bracketed] tokens inside `lines` — click the word "mine" instead
 *      of typing it. Both dispatch to the same `commands` list.
 *
 * Stays a thin presentation layer: callers own all game-state/mutation logic and
 * just hand this component a list of TerminalCommand entries (see
 * client/src/lib/terminalCommands.ts for the pure matching rules).
 */
import { useState, type ReactNode } from "react";
import { matchTerminalCommand, matchCommandByLabel, type TerminalCommand } from "@/lib/terminalCommands";
import { cn } from "@/lib/utils";

const ACCENT = {
  cyan: {
    border: "border-cyan-500/25",
    text: "text-cyan-300",
    dim: "text-cyan-500/60",
    dot: "bg-cyan-400",
    dotGlow: "0 0 6px #22d3ee",
    boxGlow: "inset 0 0 20px rgba(0,229,255,0.06)",
    token: "text-cyan-300 hover:text-cyan-100 border-cyan-500/40 hover:border-cyan-300/60",
    caret: "text-cyan-400",
  },
  amber: {
    border: "border-amber-500/30",
    text: "text-amber-300",
    dim: "text-amber-500/60",
    dot: "bg-amber-400",
    dotGlow: "0 0 6px #fbbf24",
    boxGlow: "inset 0 0 20px rgba(251,191,36,0.06)",
    token: "text-amber-300 hover:text-amber-100 border-amber-500/40 hover:border-amber-300/60",
    caret: "text-amber-400",
  },
} as const;

export interface GameTerminalProps {
  title: string;
  accent?: keyof typeof ACCENT;
  /** Narration lines. Wrap a word in [brackets] to make it a clickable command token. */
  lines?: string[];
  commands: TerminalCommand[];
  /** Extra content rendered between the lines and the command input (e.g. a row list). */
  children?: ReactNode;
  placeholder?: string;
  testId?: string;
}

function renderLineWithTokens(line: string, commands: TerminalCommand[], accent: (typeof ACCENT)[keyof typeof ACCENT], key: number) {
  const parts = line.split(/(\[[^\]]+\])/g);
  return (
    <p key={key} className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        const bracketed = part.match(/^\[([^\]]+)\]$/);
        if (!bracketed) return <span key={i}>{part}</span>;
        const cmd = matchCommandByLabel(bracketed[1], commands);
        if (!cmd) return <span key={i}>{part}</span>;
        return (
          <button
            key={i}
            type="button"
            onClick={cmd.run}
            className={cn("underline decoration-dotted underline-offset-2 border-b border-dashed px-0.5 transition-colors", accent.token)}
            data-testid={`terminal-token-${cmd.keyword.replace(/\s+/g, "-")}`}
          >
            {bracketed[1]}
          </button>
        );
      })}
    </p>
  );
}

export function GameTerminal({ title, accent = "cyan", lines = [], commands, children, placeholder, testId }: GameTerminalProps) {
  const a = ACCENT[accent];
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);

  function submit() {
    const raw = input.trim();
    if (!raw) return;
    const cmd = matchTerminalCommand(raw, commands);
    if (cmd) {
      cmd.run();
      setFeedback({ text: `> ${raw}`, ok: true });
    } else {
      setFeedback({ text: `> ${raw} — unrecognized command`, ok: false });
    }
    setInput("");
  }

  const availableHint = commands.filter((c) => !c.disabled).map((c) => c.label).join(" · ");

  return (
    <div
      className={cn("rounded-xl border bg-black/40 p-3 font-mono text-[11px] leading-relaxed", a.border, a.text)}
      style={{ boxShadow: a.boxGlow }}
      data-testid={testId ?? "game-terminal"}
    >
      <div className={cn("mb-1.5 flex items-center gap-1.5 text-[9px] uppercase tracking-widest", a.dim)}>
        <span className={cn("inline-block h-1.5 w-1.5 rounded-full", a.dot)} style={{ boxShadow: a.dotGlow }} />
        {title}
      </div>

      {lines.map((line, i) => renderLineWithTokens(line, commands, a, i))}

      {children}

      {commands.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <span className={cn("shrink-0", a.caret)}>{">"}</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder={placeholder ?? (availableHint ? `type ${availableHint}…` : undefined)}
              className={cn(
                "flex-1 min-w-0 bg-transparent outline-none font-mono text-[11px] placeholder:text-white/20",
                a.text,
              )}
              aria-label={`${title} command input`}
              data-testid="terminal-command-input"
            />
          </div>
          {feedback && (
            <p className={cn("mt-1 text-[10px]", feedback.ok ? a.dim : "text-red-400/70")}>{feedback.text}</p>
          )}
        </div>
      )}
    </div>
  );
}
