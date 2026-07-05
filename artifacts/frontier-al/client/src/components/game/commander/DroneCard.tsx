import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { serverNow } from "@/lib/serverClock";
import type { Player } from "@shared/schema";
import { DRONE_SCOUT_DURATION_MS } from "@shared/schema";
import droneImg from "@assets/image_1771570514563.png";

export function DroneCard({ drone, index }: { drone: Player["drones"][0]; index: number }) {
  const elapsed = serverNow() - drone.deployedAt;
  const remaining = Math.max(0, DRONE_SCOUT_DURATION_MS - elapsed);
  const isExpired = remaining === 0 && drone.status === "scouting";
  const progressPct = drone.status === "scouting" ? Math.min(100, (elapsed / DRONE_SCOUT_DURATION_MS) * 100) : 0;
  const [, tick] = useState(0);
  useEffect(() => {
    if (isExpired || drone.status !== "scouting") return;
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [isExpired, drone.status]);

  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return (
    <div className="p-2.5 border border-border rounded-md">
      <div className="flex items-center gap-2 mb-1.5">
        <img src={droneImg} alt="Recon Drone" className="w-8 h-8 rounded-md object-cover" />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-display uppercase tracking-wide block">Drone #{index + 1}</span>
          <Badge variant={isExpired || drone.status === "returned" ? "secondary" : "outline"} className="text-[9px]">
            {isExpired ? "Report Ready" : drone.status === "scouting" ? `Scouting ${m}:${String(s).padStart(2, "0")}` : drone.status}
          </Badge>
        </div>
      </div>
      {(isExpired || drone.scoutReportReady) && drone.discoveredResources && (
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <span>+{drone.discoveredResources.iron}I</span>
          <span>+{drone.discoveredResources.fuel}F</span>
          <span>+{drone.discoveredResources.crystal}C</span>
        </div>
      )}
      {drone.status === "scouting" && !isExpired && (
        <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      )}
    </div>
  );
}
