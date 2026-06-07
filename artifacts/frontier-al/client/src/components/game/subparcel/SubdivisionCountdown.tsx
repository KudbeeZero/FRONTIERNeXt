// Extracted from LandSheet.tsx into the dedicated sub-parcel panel directory
// (feat/subparcel-ui, DORMANT LUT 1.1). Behavior identical — drives the existing
// /api/sub-parcels/* + /api/plots/:id/* endpoints. No server routes changed.

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { SUB_PARCEL_HOLD_HOURS } from "@shared/schema";

export function SubdivisionCountdown({ heldSince }: { heldSince: number }) {
  const holdMs = SUB_PARCEL_HOLD_HOURS * 60 * 60 * 1000;
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, heldSince + holdMs - Date.now()));

  useEffect(() => {
    const initial = Math.max(0, heldSince + holdMs - Date.now());
    setTimeLeft(initial);
    if (initial === 0) return;
    const id = setInterval(() => {
      const r = Math.max(0, heldSince + holdMs - Date.now());
      setTimeLeft(r);
      if (r === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [heldSince, holdMs]);

  if (timeLeft === 0) return null;

  const hours = Math.floor(timeLeft / 3600000);
  const mins  = Math.floor((timeLeft % 3600000) / 60000);
  const secs  = Math.floor((timeLeft % 60000) / 1000);
  const progress = ((holdMs - timeLeft) / holdMs) * 100;

  return (
    <div className="space-y-1 mb-2">
      <div className="flex items-center justify-between text-[9px]">
        <span className="text-muted-foreground font-display uppercase tracking-wide flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" /> Unlocks in
        </span>
        <span className="font-mono text-amber-400">{hours}h {String(mins).padStart(2,"0")}m {String(secs).padStart(2,"0")}s</span>
      </div>
      <Progress value={progress} className="h-1" />
    </div>
  );
}
