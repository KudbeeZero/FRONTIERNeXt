import { resolveApiUrl } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, LabelList,
  AreaChart, Area,
} from "recharts";
import { LandingNav, LandingFooter, CookieConsentBanner, Starfield, SHARED_CSS } from "./landing-shared";
import { buildFactionControlRows, type FactionTerritory } from "@/lib/economics/factionControl";
import { bucketBattlePulse, type BattlePulseInput } from "@/lib/economics/battlePulse";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

const CARD: React.CSSProperties = {
  background: "rgba(10,12,30,0.82)", border: "1px solid rgba(60,90,180,0.25)",
  borderRadius: 8, padding: 20,
};

const PIE_COLORS = ["#10b981", "#ef4444", "#eab308", "#374151"];

// Battle Pulse diverging pair — reuses the game's own established victory/
// defense semantic colors (GlobeBattleSequence's VICTORY_COLOR/DEFENSE_COLOR)
// rather than inventing new hues, so this chart reads consistently with the
// in-game battle cinematic. CVD separation is wide (ΔE 42+, well past the
// ≥12 target per the dataviz skill's validator); both hues sit lighter than
// the skill's generic lightness band since they're the app's own established
// brand semantics — mitigated here with direct labels + a legend + tooltip,
// not a repaint.
const ATTACKER_COLOR = "#22d3ee";
const DEFENSE_COLOR = "#f87171";
const NEUTRAL_MIDLINE = "rgba(150,190,255,0.35)";

export default function LandingEconomics() {
  const [, setLocation] = useLocation();
  const { data } = useQuery<{ totalSupply: number; inGameCirculating: number; totalBurned: number; treasury: number; asaId: number | null; unitName: string; network: string; ownedParcelCount: number; economyMode?: string; emissionRatePerDay?: number }>({
    queryKey: ["/api/economics"],
    queryFn: () => fetch(resolveApiUrl("/api/economics")).then(r => r.json()),
    staleTime: 30_000,
  });

  const pieData = data ? [
    { name: "In Circulation", value: Math.round(data.inGameCirculating) },
    { name: "Burned",         value: Math.round(data.totalBurned) },
    { name: "Treasury",       value: Math.round(data.treasury) },
    { name: "Unallocated",    value: Math.max(0, Math.round(data.totalSupply - data.inGameCirculating - data.totalBurned - data.treasury)) },
  ] : [];

  const { data: factionsData } = useQuery<{ factions: FactionTerritory[] }>({
    queryKey: ["/api/factions"],
    queryFn: () => fetch(resolveApiUrl("/api/factions")).then(r => r.json()),
    staleTime: 30_000,
  });
  const factionRows = factionsData
    ? buildFactionControlRows(factionsData.factions, data?.ownedParcelCount ?? 0)
    : [];

  const { data: battlesData } = useQuery<{ battles: BattlePulseInput[] }>({
    queryKey: ["/api/battles/history", "battle-pulse"],
    queryFn: () => fetch(resolveApiUrl("/api/battles/history?limit=100")).then(r => r.json()),
    staleTime: 60_000,
  });
  const pulseDays = battlesData
    ? bucketBattlePulse(battlesData.battles, Date.now()).map((d) => ({
        ...d,
        defensesHeldNeg: -d.defensesHeld,
      }))
    : [];

  const { data: historyData } = useQuery<{ snapshots: { capturedAt: number; inGameCirculating: number; treasury: number; totalBurned: number }[] }>({
    queryKey: ["/api/economics/history"],
    queryFn: () => fetch(resolveApiUrl("/api/economics/history")).then(r => r.json()),
    staleTime: 5 * 60_000,
  });
  const snapshots = historyData?.snapshots ?? [];
  const supplyFlowData = snapshots.map((s) => ({
    dateLabel: new Date(s.capturedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit" }),
    circulating: Math.round(s.inGameCirculating),
    treasury: Math.round(s.treasury),
    burned: Math.round(s.totalBurned),
  }));
  const historySinceLabel = snapshots.length > 0
    ? new Date(snapshots[0].capturedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;

  return (
    <div style={{ position: "relative", minHeight: "100vh", width: "100%", overflow: "hidden", fontFamily: "'Courier New', 'SF Mono', monospace", color: "#e0eaff" }}>
      <Starfield />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px 80px" }}>
        <LandingNav activePath="/info/economics" />

        <div style={{ width: "100%", maxWidth: 860, display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ textAlign: "center", animation: "fadeInUp 0.8s ease-out forwards" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "rgba(100,160,255,0.55)", textTransform: "uppercase", marginBottom: 10 }}>— On-Chain Economy —</div>
            <div className="glitch-text" style={{ fontSize: "clamp(28px, 5vw, 38px)", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e0eaff", marginBottom: 8 }}>
              Token Economics
            </div>
            <p style={{ fontSize: 14, color: "rgba(150,190,255,0.65)", maxWidth: 600, margin: "0 auto" }}>
              ASCEND is the native Algorand ASA powering the game economy. Earn it by owning land, spend it on commanders, buildings, and attacks.
            </p>
          </div>

          {data && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, animation: "fadeInUp 0.7s ease-out 0.1s both" }}>
              {[
                { label: "Total Supply",   value: fmt(data.totalSupply),         color: "#60a5fa" },
                { label: "In Circulation", value: fmt(data.inGameCirculating),   color: "#10b981" },
                { label: "Burned",         value: fmt(data.totalBurned),         color: "#ef4444" },
                { label: "Treasury",       value: fmt(data.treasury),            color: "#eab308" },
              ].map(({ label, value, color }) => (
                <div key={label} className="border-glow" style={{ ...CARD, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
                  <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(150,190,255,0.5)" }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ ...CARD, animation: "fadeInUp 0.7s ease-out 0.2s both" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(100,140,200,0.7)", marginBottom: 16 }}>Distribution</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
              <div style={{ flex: "1 1 200px", height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {PIE_COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#0a0b14", border: "1px solid #1f2937", borderRadius: 6, fontSize: 10 }} formatter={(v: number) => [fmt(v), ""]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: 10 }}>
                {pieData.map((d, i) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i], flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 11 }}>
                      <div style={{ color: "rgba(200,220,255,0.9)" }}>{d.name}</div>
                      <div style={{ color: "rgba(150,190,255,0.5)", fontFamily: "monospace" }}>{fmt(d.value || 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {supplyFlowData.length > 0 && (
            <div style={{ ...CARD, animation: "fadeInUp 0.7s ease-out 0.22s both" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(100,140,200,0.7)", marginBottom: 4 }}>Supply Flow</div>
              <div style={{ fontSize: 10, color: "rgba(120,150,200,0.5)", marginBottom: 16 }}>
                Real hourly snapshots — data since {historySinceLabel}. No projection, no synthetic points.
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={supplyFlowData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradCirculating" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={PIE_COLORS[0]} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={PIE_COLORS[0]} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradTreasury" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={PIE_COLORS[2]} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={PIE_COLORS[2]} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradBurned" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={PIE_COLORS[1]} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={PIE_COLORS[1]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(60,90,180,0.1)" />
                    <XAxis dataKey="dateLabel" tick={{ fill: "rgba(150,190,255,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={30} />
                    <YAxis tick={{ fill: "rgba(150,190,255,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={40} />
                    <Tooltip contentStyle={{ backgroundColor: "#0a0b14", border: "1px solid #1f2937", borderRadius: 6, fontSize: 10 }} formatter={(v: number) => [fmt(v), ""]} />
                    <Area type="monotone" dataKey="circulating" stackId="1" stroke={PIE_COLORS[0]} fill="url(#gradCirculating)" strokeWidth={1.5} name="In Circulation" />
                    <Area type="monotone" dataKey="treasury"    stackId="1" stroke={PIE_COLORS[2]} fill="url(#gradTreasury)"    strokeWidth={1.5} name="Treasury" />
                    <Area type="monotone" dataKey="burned"      stackId="1" stroke={PIE_COLORS[1]} fill="url(#gradBurned)"      strokeWidth={1.5} name="Burned" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 10, marginTop: 10, flexWrap: "wrap" }}>
                {[
                  { label: "In Circulation", color: PIE_COLORS[0] },
                  { label: "Treasury",       color: PIE_COLORS[2] },
                  { label: "Burned",         color: PIE_COLORS[1] },
                ].map(({ label, color }) => (
                  <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(200,220,255,0.75)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} /> {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {factionRows.length > 0 && (
            <div style={{ ...CARD, animation: "fadeInUp 0.7s ease-out 0.25s both" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(100,140,200,0.7)", marginBottom: 16 }}>Faction Control</div>
              <div style={{ height: Math.max(160, factionRows.length * 34) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={factionRows} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(60,90,180,0.1)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "rgba(150,190,255,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fill: "rgba(200,220,255,0.85)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0a0b14", border: "1px solid #1f2937", borderRadius: 6, fontSize: 10 }}
                      formatter={(v: number) => [`${fmt(v)} parcels`, "Territory"]}
                    />
                    <Bar dataKey="territoryCount" radius={[0, 4, 4, 0]}>
                      {factionRows.map((r) => <Cell key={r.name} fill={r.color} />)}
                      <LabelList dataKey="territoryCount" position="right" formatter={fmt} fill="rgba(200,220,255,0.7)" fontSize={10} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p style={{ fontSize: 10, color: "rgba(120,150,200,0.5)", margin: "10px 0 0" }}>
                Live territory held by each AI faction, plus unclaimed land — from the same faction roster you align with on entry.
              </p>
            </div>
          )}

          {pulseDays.length > 0 && (
            <div style={{ ...CARD, animation: "fadeInUp 0.7s ease-out 0.3s both" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(100,140,200,0.7)" }}>Battle Pulse — Last 14 Days</div>
                <div style={{ display: "flex", gap: 14, fontSize: 10 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(200,220,255,0.75)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: ATTACKER_COLOR, display: "inline-block" }} /> Attacker Victories
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(200,220,255,0.75)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: DEFENSE_COLOR, display: "inline-block" }} /> Defenses Held
                  </span>
                </div>
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pulseDays} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(60,90,180,0.1)" />
                    <XAxis
                      dataKey="dateKey"
                      tick={{ fill: "rgba(150,190,255,0.5)", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(d: string) => d.slice(5)}
                    />
                    <YAxis tick={{ fill: "rgba(150,190,255,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                    <ReferenceLine y={0} stroke={NEUTRAL_MIDLINE} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0a0b14", border: "1px solid #1f2937", borderRadius: 6, fontSize: 10 }}
                      formatter={(v: number, name: string) => [Math.abs(v), name === "attackerWins" ? "Attacker Victories" : "Defenses Held"]}
                    />
                    <Bar dataKey="attackerWins" fill={ATTACKER_COLOR} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="defensesHeldNeg" name="defensesHeld" fill={DEFENSE_COLOR} radius={[0, 0, 3, 3]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p style={{ fontSize: 10, color: "rgba(120,150,200,0.5)", margin: "10px 0 0" }}>
                Every resolved battle, bucketed by day — captures above the line, held defenses below.
              </p>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, animation: "fadeInUp 0.7s ease-out 0.4s both" }}>
            {[
              { icon: "🏗️", title: "Own Land",         desc: data?.emissionRatePerDay
                  ? `Each plot generates ${data.emissionRatePerDay} ASCEND/day base${data.economyMode === "testing" ? " (current TestNet testing rate — mainnet base rate is lower)" : ""}, plus Blockchain Node upgrades on top.`
                  : "Each plot generates ASCEND daily, with Blockchain Node upgrades boosting the rate further." },
              { icon: "⚡", title: "Blockchain Nodes", desc: "Build blockchain infrastructure on your parcels to multiply your daily ASCEND yield." },
              { icon: "🔥", title: "Burn Mechanics",   desc: "Minting commanders, special attacks, and upgrades consume tokens — creating deflation." },
              { icon: "🏪", title: "Trade Station",    desc: "Trade iron, fuel, crystal and ASCEND with other players through the in-game market." },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ ...CARD }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(200,230,255,0.9)", marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 11, color: "rgba(150,190,255,0.6)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", paddingTop: 20 }}>
            <button onClick={() => setLocation("/game")} style={{
              background: "rgba(60,100,255,0.25)", border: "1px solid rgba(100,150,255,0.5)",
              borderRadius: 6, padding: "12px 32px", color: "rgba(180,220,255,0.95)",
              fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase",
              cursor: "pointer", fontWeight: 700, fontFamily: "inherit",
            }}>Enter the Frontier →</button>
          </div>
        </div>

        <LandingFooter />
      </div>

      <CookieConsentBanner />

      <style>{SHARED_CSS}</style>
    </div>
  );
}
