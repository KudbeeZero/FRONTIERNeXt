// SeasonBanner — HUD chip showing the current season, time remaining, and the
// $ASCEND prize pool (feat/seasons-hud, DORMANT LUT 1.3). Self-contained: drives
// the existing GET /api/season/current endpoint and runs its own 1s countdown.
// The settle scheduler (server/engine/season/manager.ts, initSeasonManager in
// server/index.ts) handles auto-expiry server-side. Renders nothing when there
// is no active season.

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import type { Season } from "@shared/schema";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "ENDED";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

const DEFAULT_POS =
  "absolute top-full left-1/2 -translate-x-1/2 mt-1 pointer-events-none select-none flex items-center gap-2 px-3 py-1 rounded-full z-50";

export function SeasonBanner({ className }: { className?: string }) {
  const { data } = useQuery<{ season: Season | null }>({
    queryKey: ["/api/season/current"],
    refetchInterval: 60_000,
  });
  const season = data?.season ?? null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!season) return null;

  const remaining = season.endsAt - now;
  const ended = remaining <= 0 || season.status === "complete";
  const label = season.name ? season.name.toUpperCase() : `SEASON ${season.number}`;

  return (
    <div
      className={className ?? DEFAULT_POS}
      style={{
        background: "rgba(4,8,20,0.85)",
        border: "1px solid rgba(0,229,255,0.25)",
        backdropFilter: "blur(8px)",
        fontFamily: "monospace",
        fontSize: 10,
        letterSpacing: "0.2em",
        color: "rgba(0,229,255,0.8)",
      }}
      data-testid="season-banner"
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: ended ? "#ff6464" : "#00e5ff",
          display: "inline-block",
          boxShadow: ended ? "0 0 6px #ff6464" : "0 0 6px #00e5ff",
        }}
      />
      <span>{label} · {ended ? "ENDED" : formatRemaining(remaining)}</span>
      {season.rewardPool > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "rgba(255,210,90,0.9)" }}>
          <Trophy style={{ width: 9, height: 9 }} />
          {season.rewardPool.toLocaleString()} ASCEND
        </span>
      )}
    </div>
  );
}
