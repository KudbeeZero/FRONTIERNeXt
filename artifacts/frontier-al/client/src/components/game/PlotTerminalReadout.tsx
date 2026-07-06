/**
 * client/src/components/game/PlotTerminalReadout.tsx
 *
 * The "command terminal" readout shown inside the plot-select panel — replaces
 * the old static "Your Territory" / "Hostile Territory" hint blocks with a
 * live, in-character tactical briefing fetched from GET
 * /api/plots/:plotId/terminal-brief (server/engine/narrative/plotTerminal.ts).
 * Renders with a typewriter reveal + blinking cursor so the panel feels alive
 * instead of a stationary card. Honors prefers-reduced-motion (reveals
 * instantly instead of animating).
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface TerminalBrief {
  lines: string[];
  source: "heuristic" | "llm";
}

const CHARS_PER_TICK = 2;
const TICK_MS = 16;

function useTypewriter(fullText: string, enabled: boolean): { shown: string; done: boolean } {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    if (!enabled || fullText.length === 0) {
      setCount(fullText.length);
      return;
    }
    const id = setInterval(() => {
      setCount((c) => {
        const next = c + CHARS_PER_TICK;
        if (next >= fullText.length) clearInterval(id);
        return Math.min(next, fullText.length);
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [fullText, enabled]);

  return { shown: fullText.slice(0, count), done: count >= fullText.length };
}

export function PlotTerminalReadout({ plotId }: { plotId: number }) {
  const query = useQuery<TerminalBrief>({
    queryKey: ["plot-terminal-brief", plotId],
    queryFn: async () => (await apiRequest("GET", `/api/plots/${plotId}/terminal-brief`)).json(),
    staleTime: 60_000,
  });

  const reducedMotion =
    typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const fullText = query.data?.lines.join("\n") ?? "";
  const { shown, done } = useTypewriter(fullText, !reducedMotion && query.isSuccess);

  return (
    <div
      className="rounded-xl border border-cyan-500/25 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-cyan-300"
      style={{ boxShadow: "inset 0 0 20px rgba(0,229,255,0.06)" }}
      data-testid="plot-terminal-readout"
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-cyan-500/60">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400"
          style={{ boxShadow: "0 0 6px #22d3ee", animation: query.isLoading ? "pulse 1s ease-in-out infinite" : "none" }}
        />
        Tactical AI Terminal
      </div>
      {query.isLoading && <p className="text-cyan-500/50">{"> connecting…"}</p>}
      {query.isError && <p className="text-cyan-500/50">{"> uplink failed — no readout available."}</p>}
      {query.isSuccess && (
        <pre className="whitespace-pre-wrap break-words font-mono">
          {shown}
          {!done && <span className="animate-pulse">▋</span>}
        </pre>
      )}
    </div>
  );
}
