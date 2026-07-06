import { resolveApiUrl } from "@/lib/queryClient";
import { useState, useEffect, useCallback } from "react";
import {
  Swords, Shield, TrendingUp, Clock, ChevronRight,
  ArrowLeft, Loader2, Trophy, Zap, BarChart3, Search,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface BattleRecord {
  id: string;
  attackerName: string;
  defenderName: string;
  plotId: number;
  biome: string;
  outcome: "attacker_wins" | "defender_wins";
  attackerPower: number;
  defenderPower: number;
  randFactor: number;
  pillagedIron: number;
  pillagedFuel: number;
  pillagedCrystal: number;
  resolvedAt: number;
  startTs: number;
  resolveTs: number;
}

interface LeaderEntry {
  name: string;
  wins?: number;
  losses?: number;
  territoriesCaptured?: number;
  attacksWon?: number;
  attacksLost?: number;
}

interface HistoryResponse {
  battles: BattleRecord[];
  total: number;
  hasMore: boolean;
}

interface LiveBattle {
  id: string;
  attackerName: string;
  defenderName: string;
  plotId: number;
  resolveTs: number;
}

const BIOME_COLOR: Record<string, string> = {
  mountain: "text-slate-300",
  forest:   "text-green-400",
  desert:   "text-amber-400",
  tundra:   "text-blue-300",
  volcanic: "text-red-400",
  plains:   "text-lime-400",
  swamp:    "text-emerald-600",
  water:    "text-cyan-400",
};

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function countdown(ts: number): string {
  const ms = ts - Date.now();
  if (ms <= 0) return "resolving…";
  const secs = Math.ceil(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.ceil(secs / 60)}m ${secs % 60}s`;
}

function WinChance({ attacker, defender }: { attacker: number; defender: number }) {
  const total = attacker + defender;
  const pct   = total > 0 ? Math.round((attacker / total) * 100) : 50;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden flex">
        <div className="bg-primary h-full rounded-l-full" style={{ width: `${pct}%` }} />
        <div className="bg-red-500/60 h-full rounded-r-full flex-1" />
      </div>
      <span className="font-mono text-muted-foreground w-8 shrink-0">{pct}%</span>
    </div>
  );
}

export default function BattlesPage() {
  const [battles, setBattles]       = useState<BattleRecord[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<"history" | "leaderboard" | "live">("history");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "attacker_wins" | "defender_wins">("all");
  const [search, setSearch]         = useState("");
  const [page, setPage]             = useState(0);
  const [leaders, setLeaders]       = useState<LeaderEntry[]>([]);
  const [live, setLive]             = useState<LiveBattle[]>([]);
  const [, setTick]                 = useState(0);

  const PAGE_SIZE = 20;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (outcomeFilter !== "all") params.set("outcome", outcomeFilter);
      if (search.trim()) params.set("player", search.trim());
      const res = await fetch(resolveApiUrl(`/api/battles/history?${params}`));
      if (!res.ok) throw new Error("non-200");
      const data: HistoryResponse = await res.json();
      setBattles(data.battles);
      setTotal(data.total);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [page, outcomeFilter, search]);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch(resolveApiUrl("/api/admin/battles-live"));
      if (res.ok) setLive(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchLeaders = useCallback(async () => {
    try {
      const res = await fetch(resolveApiUrl("/api/leaderboard"));
      if (res.ok) {
        const data = await res.json();
        setLeaders((data.players ?? []).slice(0, 10));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  useEffect(() => { fetchLive(); fetchLeaders(); }, [fetchLive, fetchLeaders]);
  useEffect(() => {
    const t = setInterval(() => { setTick(n => n + 1); fetchLive(); }, 5000);
    return () => clearInterval(t);
  }, [fetchLive]);

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--primary)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-display uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Game
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="font-display text-5xl sm:text-6xl font-bold uppercase tracking-widest leading-none mb-3">
            WAR<br /><span className="text-primary">ROOM</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            Complete battle history for all engagements on the frontier. Filter by outcome, search by player, and track the ongoing war.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border pb-0">
          {([
            { id: "history",     label: "Battle Log",   icon: Swords    },
            { id: "live",        label: `Live ${live.length > 0 ? `(${live.length})` : ""}`, icon: Zap },
            { id: "leaderboard", label: "Leaderboard",  icon: Trophy    },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-display uppercase tracking-wider border-b-2 -mb-px transition-colors",
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── LIVE TAB ──────────────────────────────────────────────── */}
        {tab === "live" && (
          <div className="space-y-2">
            {live.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Swords className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="font-display uppercase tracking-wider text-sm">No active battles</p>
              </div>
            ) : live.map((b) => (
              <div key={b.id} className="border border-primary/30 bg-primary/5 rounded-md p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 font-display font-bold uppercase tracking-wider text-sm">
                    <span className="text-primary">{b.attackerName}</span>
                    <Swords className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{b.defenderName}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono text-primary">Plot #{b.plotId}</div>
                    <div className="text-[10px] font-mono text-amber-400">
                      ⏱ {countdown(b.resolveTs)}
                    </div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary animate-pulse rounded-full"
                    style={{ width: `${Math.max(5, Math.min(95, 100 - ((b.resolveTs - Date.now()) / 30000) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── HISTORY TAB ────────────────────────────────────────────── */}
        {tab === "history" && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Search by player…"
                  className="w-full pl-8 pr-3 py-2 bg-muted/20 border border-border rounded text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                />
              </div>
              <div className="flex gap-1">
                {([
                  { val: "all",            label: "All"      },
                  { val: "attacker_wins",  label: "Victories" },
                  { val: "defender_wins",  label: "Defenses" },
                ] as const).map(({ val, label }) => (
                  <button
                    key={val}
                    onClick={() => { setOutcomeFilter(val); setPage(0); }}
                    className={cn(
                      "px-3 py-2 text-xs font-display uppercase tracking-wider rounded border transition-all",
                      outcomeFilter === val
                        ? "bg-primary/20 border-primary/50 text-primary"
                        : "bg-muted/10 border-border text-muted-foreground hover:border-primary/30",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Battle count */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-muted-foreground">
                {total.toLocaleString()} total battles
              </span>
              {pages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                    className="px-2 py-1 text-xs border border-border rounded disabled:opacity-30 hover:border-primary/50 transition-colors"
                  >
                    ←
                  </button>
                  <span className="text-xs font-mono text-muted-foreground px-2">
                    {page + 1} / {pages}
                  </span>
                  <button
                    disabled={page >= pages - 1}
                    onClick={() => setPage(p => p + 1)}
                    className="px-2 py-1 text-xs border border-border rounded disabled:opacity-30 hover:border-primary/50 transition-colors"
                  >
                    →
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-display uppercase tracking-wider text-sm">Loading…</span>
              </div>
            ) : battles.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Swords className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="font-display uppercase tracking-wider text-sm">No battles found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {battles.map((b) => {
                  const attackerWon = b.outcome === "attacker_wins";
                  const hasPillage  = b.pillagedIron > 0 || b.pillagedFuel > 0 || b.pillagedCrystal > 0;
                  return (
                    <div
                      key={b.id}
                      className={cn(
                        "border rounded-md p-4 transition-colors",
                        attackerWon
                          ? "border-primary/25 bg-primary/5"
                          : "border-blue-500/25 bg-blue-500/5",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Combatants */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "shrink-0 w-7 h-7 rounded flex items-center justify-center",
                            attackerWon ? "bg-primary/15" : "bg-muted/30",
                          )}>
                            {attackerWon
                              ? <Swords className="w-3.5 h-3.5 text-primary" />
                              : <Shield className="w-3.5 h-3.5 text-blue-400" />
                            }
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "font-display font-bold uppercase tracking-wider text-sm",
                                attackerWon ? "text-primary" : "text-muted-foreground",
                              )}>
                                {b.attackerName}
                              </span>
                              <span className="text-muted-foreground text-xs">vs</span>
                              <span className={cn(
                                "font-display font-bold uppercase tracking-wider text-sm",
                                !attackerWon ? "text-blue-400" : "text-muted-foreground",
                              )}>
                                {b.defenderName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-mono flex-wrap">
                              <span className={BIOME_COLOR[b.biome] ?? "text-muted-foreground"}>
                                {b.biome.toUpperCase()} #{b.plotId}
                              </span>
                              {hasPillage && (
                                <span className="text-amber-400">
                                  ⚡ {b.pillagedIron}Fe {b.pillagedFuel}Fu {b.pillagedCrystal}Cr pillaged
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: power + time */}
                        <div className="shrink-0 text-right">
                          <div className={cn(
                            "text-xs font-display uppercase tracking-wider px-2 py-0.5 rounded border inline-block mb-1",
                            attackerWon
                              ? "text-primary border-primary/30 bg-primary/10"
                              : "text-blue-400 border-blue-500/30 bg-blue-500/10",
                          )}>
                            {attackerWon ? "CONQUERED" : "REPELLED"}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {timeAgo(b.resolvedAt)}
                          </div>
                        </div>
                      </div>

                      {/* Power bar */}
                      <div className="mt-3">
                        <WinChance attacker={b.attackerPower} defender={b.defenderPower} />
                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-0.5">
                          <span>ATK {Math.round(b.attackerPower)}</span>
                          <span>DEF {Math.round(b.defenderPower)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── LEADERBOARD TAB ────────────────────────────────────────── */}
        {tab === "leaderboard" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg font-bold uppercase tracking-wider">Top Combatants</h2>
              <div className="h-px flex-1 bg-border" />
            </div>

            {leaders.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Trophy className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="font-display uppercase tracking-wider text-sm">No data yet</p>
              </div>
            ) : leaders.map((p, i) => (
              <div
                key={p.name}
                className={cn(
                  "border rounded-md p-4 flex items-center gap-4",
                  i === 0 ? "border-amber-500/40 bg-amber-500/5"
                    : i === 1 ? "border-slate-400/40 bg-slate-400/5"
                    : i === 2 ? "border-amber-700/40 bg-amber-700/5"
                    : "border-border bg-card",
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded flex items-center justify-center font-display font-bold text-sm shrink-0",
                  i === 0 ? "bg-amber-500/20 text-amber-400"
                    : i === 1 ? "bg-slate-400/20 text-slate-300"
                    : i === 2 ? "bg-amber-700/20 text-amber-600"
                    : "bg-muted/20 text-muted-foreground",
                )}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold uppercase tracking-wider text-sm">{p.name}</div>
                  <div className="flex gap-3 mt-0.5 text-xs font-mono text-muted-foreground flex-wrap">
                    <span className="text-primary">{p.attacksWon ?? 0} wins</span>
                    <span>{p.attacksLost ?? 0} losses</span>
                    <span>{p.territoriesCaptured ?? 0} territories</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border pt-6 mt-12 flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">
            FRONTIER WAR ROOM // {new Date().getFullYear()}
          </span>
          <Link href="/game">
            <Button variant="outline" size="sm" className="font-display uppercase tracking-wider text-xs">
              Enter Game
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
