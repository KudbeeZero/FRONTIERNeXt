/**
 * client/src/components/game/ObjectiveHud.tsx
 *
 * Live "AI Battle Test" objective readout. Once you've picked a faction
 * (FactionSelectGate), this small top-center widget polls GET /api/factions,
 * reads your RIVAL's current outpost count, and shows progress toward clearing
 * them — win when the rival hits zero. Pure objective math lives in
 * shared/battleObjective.ts (tested); this is just the thin live wiring.
 *
 * A fixed, pointer-events:none overlay mounted at the page level — it never
 * intercepts clicks or touches the globe/combat canvas.
 */
import { resolveApiUrl } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { chosenFaction } from "@/lib/factions";
import {
  rivalStanding,
  evaluateObjective,
  rivalOf,
  type FactionStanding,
} from "@shared/battleObjective";

interface FactionsResponse { factions: FactionStanding[] }

// Remember the rival's outpost count at the moment the objective began, so
// progress is measured against the starting line (per rival, this browser).
function rivalStartCount(rival: string, current: number): number {
  if (typeof window === "undefined") return current;
  const key = `frontier_objective_start_${rival}`;
  const prev = window.localStorage.getItem(key);
  if (prev != null) {
    const n = Number(prev);
    if (Number.isFinite(n)) return Math.max(n, current);
  }
  window.localStorage.setItem(key, String(current));
  return current;
}

export function ObjectiveHud() {
  const faction = chosenFaction();

  const { data } = useQuery<FactionsResponse>({
    queryKey: ["/api/factions"],
    queryFn: async () => {
      const r = await fetch(resolveApiUrl("/api/factions"));
      if (!r.ok) throw new Error("factions fetch failed");
      return r.json();
    },
    enabled: faction != null,
    refetchInterval: 30_000,
    staleTime: 20_000,
    retry: false,
  });

  if (!faction || !data?.factions) return null;
  const rival = rivalOf(faction);
  const standing = rivalStanding(data.factions, faction);
  if (!rival || !standing) return null;

  const rivalNow = standing.territoryCount;
  const rivalStart = rivalStartCount(rival, rivalNow);
  const state = evaluateObjective({ rivalStart, rivalNow, playerNow: 1 });
  const pct = Math.round(state.progress * 100);

  const accent =
    state.status === "won" ? "#34d399" : state.status === "lost" ? "#f87171" : "#ffd166";

  return (
    <div
      style={{
        position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)",
        zIndex: 60, pointerEvents: "none",
        background: "rgba(6,12,32,0.78)", border: `1px solid ${accent}55`,
        borderRadius: 10, padding: "7px 14px", minWidth: 230, maxWidth: 320,
        fontFamily: "'Courier New', 'SF Mono', monospace", color: "#e0eaff",
        boxShadow: "0 4px 18px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: `${accent}cc`, marginBottom: 3 }}>
        ⚔ Mission · {faction} vs {rival}
      </div>
      <div style={{ fontSize: 11, color: "rgba(215,225,255,0.9)", marginBottom: 5 }}>{state.headline}</div>
      <div style={{ height: 4, background: "rgba(70,90,150,0.3)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: accent, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}
