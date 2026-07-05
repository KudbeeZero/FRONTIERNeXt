import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { MINE_COOLDOWN_MS } from "@shared/schema";

export function CooldownTimer({ lastMineTs }: { lastMineTs: number }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, MINE_COOLDOWN_MS - (Date.now() - lastMineTs))
  );

  useEffect(() => {
    const initial = Math.max(0, MINE_COOLDOWN_MS - (Date.now() - lastMineTs));
    setRemaining(initial);
    if (initial === 0) return;
    const id = setInterval(() => {
      const r = Math.max(0, MINE_COOLDOWN_MS - (Date.now() - lastMineTs));
      setRemaining(r);
      if (r === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [lastMineTs]);

  const progress = ((MINE_COOLDOWN_MS - remaining) / MINE_COOLDOWN_MS) * 100;
  const canMine = remaining === 0;

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-1.5" data-testid="cooldown-timer">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-display uppercase tracking-wide flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> Mine Cooldown
        </span>
        <span className={cn("font-mono text-xs", canMine ? "text-primary" : "text-warning")} data-testid="text-cooldown-status">
          {canMine ? "READY" : formatTime(remaining)}
        </span>
      </div>
      <Progress value={progress} className="h-1.5" data-testid="progress-cooldown" />
    </div>
  );
}
