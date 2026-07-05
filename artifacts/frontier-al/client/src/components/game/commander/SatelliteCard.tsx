import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { serverNow } from "@/lib/serverClock";
import type { Player } from "@shared/schema";
import { SATELLITE_ORBIT_DURATION_MS } from "@shared/schema";
import { formatCountdown } from "./shared";

export function SatelliteCard({ satellite, index }: { satellite: Player["satellites"][0]; index: number }) {
  const now = serverNow();
  const remaining = Math.max(0, satellite.expiresAt - now);
  const elapsed = now - satellite.deployedAt;
  const progressPct = satellite.status === "active" ? Math.min(100, (elapsed / SATELLITE_ORBIT_DURATION_MS) * 100) : 100;
  const isExpired = satellite.status === "expired" || remaining === 0;
  const [, tick] = useState(0);
  useEffect(() => {
    if (isExpired) return;
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [isExpired]);

  return (
    <Card className={cn("p-2 border text-xs", isExpired ? "border-muted opacity-60" : "border-yellow-500/50 bg-yellow-500/5")}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-display uppercase tracking-wide text-[10px]">SAT-{String(index + 1).padStart(2, "0")}</span>
        <Badge variant={isExpired ? "secondary" : "default"} className="text-[9px] px-1 py-0">{isExpired ? "expired" : "orbiting"}</Badge>
      </div>
      {!isExpired && (
        <>
          <div className="w-full bg-muted rounded-full h-1 mb-1">
            <div className="h-1 rounded-full bg-yellow-500 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-2.5 h-2.5" /><span>{formatCountdown(remaining)} remaining</span>
          </div>
        </>
      )}
    </Card>
  );
}
