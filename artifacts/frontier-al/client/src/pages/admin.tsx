/**
 * Admin dashboard — operational monitoring + safe control surface.
 *
 * Consumes the existing ADMIN_KEY-gated endpoints. The key is entered once and
 * kept in localStorage, sent as the `x-admin-key` header on every request.
 */
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const KEY_STORAGE = "ascendancy_admin_key";

function useAdminKey() {
  const [key, setKeyState] = useState<string>(() => localStorage.getItem(KEY_STORAGE) ?? "");
  const setKey = (k: string) => {
    localStorage.setItem(KEY_STORAGE, k);
    setKeyState(k);
  };
  const clearKey = () => {
    localStorage.removeItem(KEY_STORAGE);
    setKeyState("");
  };
  return { key, setKey, clearKey };
}

function adminFetch(path: string, key: string, init?: RequestInit) {
  return fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), "x-admin-key": key, "content-type": "application/json" },
  });
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xs uppercase tracking-widest text-primary">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs font-mono">
      <span className="text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const { key, setKey, clearKey } = useAdminKey();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const enabled = key.length > 0;
  const q = <T,>(name: string, path: string, refetchInterval = 10_000) =>
    useQuery<T>({
      queryKey: [path, key],
      queryFn: async () => {
        const r = await adminFetch(path, key);
        if (r.status === 403) throw new Error("Invalid admin key");
        if (!r.ok) throw new Error(`${name} unavailable (${r.status})`);
        return r.json();
      },
      enabled,
      refetchInterval,
    });

  const status = q<any>("status", "/api/admin/status");
  const economics = q<any>("economics", "/api/economics");
  const ai = q<any>("ai-activity", "/api/admin/ai-activity");
  const battles = q<any>("battles-live", "/api/admin/battles-live");
  const metrics = q<any>("metrics", "/api/admin/metrics");

  const runControl = useCallback(
    async (label: string, path: string, confirmText: string) => {
      if (!window.confirm(confirmText)) return;
      setBusy(label);
      setActionMsg(null);
      try {
        const r = await adminFetch(path, key, { method: "POST", body: "{}" });
        const data = await r.json().catch(() => ({}));
        setActionMsg(r.ok ? `${label}: ok` : `${label}: ${data?.error ?? r.status}`);
      } catch (e) {
        setActionMsg(`${label}: ${(e as Error).message}`);
      } finally {
        setBusy(null);
      }
    },
    [key],
  );

  if (!enabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-6 w-full max-w-sm space-y-3">
          <h1 className="font-display text-lg uppercase tracking-widest text-primary">Admin Access</h1>
          <p className="text-xs text-muted-foreground">Enter the ADMIN_KEY to view operations.</p>
          <Input
            type="password"
            placeholder="ADMIN_KEY"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && draft && setKey(draft)}
            data-testid="input-admin-key"
          />
          <Button className="w-full font-display uppercase" disabled={!draft} onClick={() => setKey(draft)}>
            Unlock
          </Button>
        </Card>
      </div>
    );
  }

  const network = status.data?.algorand?.network ?? "—";
  const isMainnet = network === "mainnet";

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-xl uppercase tracking-widest text-primary">Ascendancy Ops</h1>
        <div className="flex items-center gap-2">
          <Badge variant={isMainnet ? "destructive" : "secondary"} className="font-mono">{String(network)}</Badge>
          <Button variant="outline" size="sm" onClick={clearKey} className="font-display uppercase text-[10px]">Lock</Button>
        </div>
      </header>

      {actionMsg && <p className="text-xs font-mono text-primary">{actionMsg}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="System Status">
          {status.error && <p className="text-xs text-destructive">{(status.error as Error).message}</p>}
          {status.data && (
            <div className="space-y-1">
              <KV k="Algorand" v={<Badge variant={status.data.algorand?.connected ? "secondary" : "destructive"}>{status.data.algorand?.connected ? `ok ${status.data.algorand?.latencyMs ?? "?"}ms` : "down"}</Badge>} />
              <KV k="Last round" v={status.data.algorand?.lastRound ?? "—"} />
              <KV k="DB" v={<Badge variant={status.data.dbConnected ? "secondary" : "destructive"}>{status.data.dbConnected ? `ok ${status.data.dbPingMs ?? "?"}ms` : "down"}</Badge>} />
              <KV k="AI enabled" v={String(status.data.aiEnabled)} />
            </div>
          )}
        </Panel>

        <Panel title="Economy">
          {economics.data && (
            <div className="space-y-1">
              <KV k="Total supply" v={economics.data.totalSupply ?? "—"} />
              <KV k="Treasury" v={economics.data.treasury ?? "—"} />
              <KV k="Circulating" v={economics.data.circulating ?? "—"} />
              <KV k="Owned parcels" v={economics.data.ownedParcelCount ?? "—"} />
            </div>
          )}
        </Panel>

        <Panel title="AI Factions">
          {Array.isArray(ai.data?.factions) && ai.data.factions.length > 0 ? (
            <div className="space-y-1">
              {ai.data.factions.map((f: any) => (
                <KV key={f.id ?? f.name} k={f.name} v={`${f.parcels ?? f.ownedParcels ?? "?"} plots`} />
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">No AI faction data.</p>}
        </Panel>

        <Panel title="Live Battles">
          {Array.isArray(battles.data?.battles) ? (
            <p className="text-2xl font-mono">{battles.data.battles.length}<span className="text-xs text-muted-foreground ml-2">pending</span></p>
          ) : <p className="text-xs text-muted-foreground">No battle data.</p>}
        </Panel>

        <Panel title="Route Metrics">
          {Array.isArray(metrics.data?.routes) && metrics.data.routes.length > 0 ? (
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {metrics.data.routes.slice(0, 12).map((r: any) => (
                <KV key={r.route} k={r.route} v={`${r.count}× avg ${r.avgMs}ms${r.slowCount ? ` ⚠${r.slowCount}` : ""}`} />
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">No traffic recorded yet.</p>}
        </Panel>

        <Panel title="Controls">
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runControl("resolve-battles", "/api/game/resolve-battles", "Force-resolve due battles now?")} className="font-display uppercase text-[10px]">Resolve battles</Button>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runControl("ai-turn", "/api/game/ai-turn", "Run one AI faction turn now?")} className="font-display uppercase text-[10px]">AI turn</Button>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runControl("season-start", "/api/admin/season/start", "Start a new season?")} className="font-display uppercase text-[10px]">Season start</Button>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runControl("season-settle", "/api/admin/season/settle", "Settle the active season?")} className="font-display uppercase text-[10px]">Season settle</Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!!busy || isMainnet}
              title={isMainnet ? "Disabled on mainnet" : undefined}
              onClick={() => {
                if (isMainnet) return;
                runControl("reset", "/api/game/reset", "WIPE ALL GAME DATA and re-seed? This cannot be undone. Type OK in the next prompt.") ;
              }}
              className="font-display uppercase text-[10px] col-span-2"
            >
              {isMainnet ? "Reset (mainnet-disabled)" : "Reset game data"}
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
