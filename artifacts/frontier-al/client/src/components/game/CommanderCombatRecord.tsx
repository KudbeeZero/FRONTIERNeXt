/**
 * CommanderCombatRecord — surfaces each commander's derived combat record
 * (from GET /api/players/:id/commander-stats — server: computeCommanderStats).
 *
 * Self-contained + additive: fetches its own data, renders nothing until there's
 * a commander with a fought battle, and joins commanderId → name from the roster
 * passed in. Pure formatting lives in `combatRecordFormat` (tested).
 */
import { useQuery } from "@tanstack/react-query";
import { Swords } from "lucide-react";
import { formatCommanderRecord, type CommanderRecord } from "@/lib/battle/combatRecordFormat";

export function CommanderCombatRecord({
  playerId,
  commanders,
}: {
  playerId: string;
  commanders: Array<{ id: string; name: string }>;
}) {
  const { data } = useQuery<CommanderRecord[]>({
    queryKey: ["/api/players", playerId, "commander-stats"],
    queryFn: async () => {
      const r = await fetch(`/api/players/${playerId}/commander-stats`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30_000,
    retry: false,
  });

  const rows = (data ?? []).filter((s) => s.battles.total > 0);
  if (rows.length === 0) return null;

  const nameOf = (id: string) => commanders.find((c) => c.id === id)?.name ?? "Commander";

  return (
    <div className="mb-3 rounded-md border border-white/10 bg-white/[0.02] p-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-display uppercase tracking-wide text-white/40">
        <Swords className="h-3 w-3" /> Combat Record
      </p>
      <div className="space-y-1.5">
        {rows.map((s) => {
          const d = formatCommanderRecord(s);
          return (
            <div key={s.commanderId} className="flex items-baseline justify-between gap-2 text-[10px]">
              <span className="truncate font-display uppercase tracking-wide text-white/70">{nameOf(s.commanderId)}</span>
              <span className="flex shrink-0 items-center gap-2 font-mono">
                <span className="text-white/85">{d.record}</span>
                {d.streak && <span className="text-amber-400/80">{d.streak}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
