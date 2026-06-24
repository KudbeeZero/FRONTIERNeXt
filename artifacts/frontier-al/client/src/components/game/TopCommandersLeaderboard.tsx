/**
 * TopCommandersLeaderboard — global "top-killers" board.
 *
 * Self-contained + additive: fetches GET /api/commanders/leaderboard (server:
 * topCommanders, ranked by wins) and renders ranked rows. Renders NOTHING until
 * a commander has fought, so it's safe to drop into the leaderboard scroll area.
 * Labels by the public commander NFT id (no global name source); record
 * formatting is the tested pure helper.
 */
import { useQuery } from "@tanstack/react-query";
import { Swords } from "lucide-react";
import { formatCommanderRecord, shortCommanderId, type CommanderRecord } from "@/lib/battle/combatRecordFormat";

export function TopCommandersLeaderboard() {
  const { data } = useQuery<CommanderRecord[]>({
    queryKey: ["/api/commanders/leaderboard", 10],
    queryFn: async () => {
      const r = await fetch("/api/commanders/leaderboard?top=10");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  const rows = (data ?? []).filter((s) => s.battles.total > 0);
  if (rows.length === 0) return null;

  return (
    <div className="mt-1 border-t border-border/40" data-testid="top-commanders">
      <div className="flex items-center gap-2 px-3 py-2">
        <Swords className="h-4 w-4 text-destructive" />
        <h3 className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">Top Commanders</h3>
      </div>
      {rows.map((s, i) => {
        const d = formatCommanderRecord(s);
        return (
          <div
            key={s.commanderId}
            className="flex items-center gap-3 border-b border-border/20 px-3 py-2 last:border-0"
            data-testid={`top-commander-${s.commanderId}`}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-bold text-muted-foreground">
              #{i + 1}
            </div>
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/80">{shortCommanderId(s.commanderId)}</span>
            <div className="flex shrink-0 items-center gap-2 font-mono text-xs">
              <span className="font-bold">{d.record}</span>
              {d.streak && <span className="text-amber-400/80">{d.streak}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
