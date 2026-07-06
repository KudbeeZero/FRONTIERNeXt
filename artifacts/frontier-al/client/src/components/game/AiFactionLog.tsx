import { resolveApiUrl } from "@/lib/queryClient";
import { useEffect, useState, useCallback } from "react";
import { Bot, Activity, Clock, Pickaxe, Swords, TrendingUp, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FactionEntry {
  name: string;
  behavior: string;
  iron: number;
  fuel: number;
  crystal: number;
  plotCount: number;
  status: "ACTIVE" | "MONITORING";
  lastAction: { description: string; timestamp: number } | null;
}

interface AiActivityData {
  factions: FactionEntry[];
  aiEnabled: boolean;
  tickIntervalSecs: number;
}

const FACTION_COLORS: Record<string, string> = {
  "NEXUS-7":  "text-cyan-400   border-cyan-500/40   bg-cyan-500/5",
  "KRONOS":   "text-purple-400 border-purple-500/40 bg-purple-500/5",
  "VANGUARD": "text-amber-400  border-amber-500/40  bg-amber-500/5",
  "SPECTRE":  "text-rose-400   border-rose-500/40   bg-rose-500/5",
};

const BEHAVIOR_ICON: Record<string, typeof Bot> = {
  expansionist: TrendingUp,
  defensive:    AlertCircle,
  raider:       Swords,
  economic:     Pickaxe,
};

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export function AiFactionLog() {
  const [data, setData]       = useState<AiActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [, setTick]           = useState(0);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(resolveApiUrl("/api/admin/ai-activity"));
      if (!res.ok) throw new Error("non-200");
      setData(await res.json());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const poll = setInterval(fetch_, 20_000);
    const tick = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [fetch_]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm font-display uppercase tracking-wider">Loading faction data…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-4 text-center text-sm text-red-400 font-display uppercase tracking-wider">
        Failed to load faction data
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center gap-3 mb-1">
        <div className={cn(
          "flex items-center gap-1.5 text-xs font-display uppercase tracking-wider px-2 py-1 rounded border",
          data.aiEnabled
            ? "text-green-400 border-green-500/30 bg-green-500/10"
            : "text-red-400 border-red-500/30 bg-red-500/10",
        )}>
          <div className={cn("w-1.5 h-1.5 rounded-full", data.aiEnabled ? "bg-green-400 animate-pulse" : "bg-red-400")} />
          {data.aiEnabled ? "ENGINE ACTIVE" : "ENGINE DISABLED"}
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          tick every {data.tickIntervalSecs}s · 40% chance per faction per tick
        </span>
      </div>

      {/* Faction rows */}
      {data.factions.map((f) => {
        const colors      = FACTION_COLORS[f.name] ?? "text-primary border-primary/40 bg-primary/5";
        const [textColor] = colors.split(" ");
        const BehaviorIcon = BEHAVIOR_ICON[f.behavior] ?? Bot;

        return (
          <div
            key={f.name}
            className={cn(
              "border rounded-md p-4 transition-colors duration-300",
              colors.split(" ").slice(1).join(" "),
            )}
          >
            <div className="flex items-start justify-between gap-3">
              {/* Left: name + status */}
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("w-8 h-8 rounded flex items-center justify-center border shrink-0", colors.split(" ").slice(1).join(" "))}>
                  <BehaviorIcon className={cn("w-4 h-4", textColor)} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("font-display font-bold uppercase tracking-wider text-sm", textColor)}>
                      {f.name}
                    </span>
                    <span className={cn(
                      "text-[10px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded border",
                      f.status === "ACTIVE"
                        ? "text-green-400 border-green-500/30 bg-green-500/10"
                        : "text-muted-foreground border-border bg-muted/20",
                    )}>
                      {f.status === "ACTIVE" ? (
                        <span className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-green-400 inline-block animate-pulse" />
                          ACTIVE
                        </span>
                      ) : "MONITORING"}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground capitalize">
                      {f.behavior}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-mono">
                    <span>🗺 {f.plotCount} plots</span>
                    <span>⚙ {f.iron} iron</span>
                    <span>⛽ {f.fuel} fuel</span>
                    <span>💎 {f.crystal} crystal</span>
                  </div>
                </div>
              </div>

              {/* Right: activity indicator */}
              <Activity className={cn("w-4 h-4 shrink-0 mt-1", f.status === "ACTIVE" ? "text-green-400" : "text-muted-foreground/40")} />
            </div>

            {/* Last action */}
            <div className="mt-3 pt-3 border-t border-border/50">
              {f.lastAction ? (
                <div className="flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-foreground/80 leading-snug">
                      {f.lastAction.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {timeAgo(f.lastAction.timestamp)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No actions recorded yet — waiting for first AI tick
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
