import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommanderTier } from "@shared/schema";
import { COMPANION } from "./shared";

// ── Battle Result Display ─────────────────────────────────────────────────────

export interface BattleResult {
  outcome: "attacker_wins" | "defender_wins";
  attackerPower: number;
  defenderPower: number;
  log: { phase: string; message: string }[];
  commanderTier?: CommanderTier;
}

export function BattleResultCard({ result }: { result: BattleResult }) {
  const won = result.outcome === "attacker_wins";
  const companion = result.commanderTier ? COMPANION[result.commanderTier] : null;
  return (
    <div className={cn("rounded-md border p-3 text-xs", won ? "border-green-500/40 bg-green-500/5" : "border-destructive/40 bg-destructive/5")}>
      <div className="flex items-center gap-2 mb-2">
        {won ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-destructive" />}
        <span className="font-display uppercase tracking-wide font-bold">{won ? "Victory" : "Repelled"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <p className="text-[9px] text-muted-foreground uppercase">Your Power</p>
          <p className="font-mono font-bold text-primary">{Math.round(result.attackerPower)}</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground uppercase">Defender</p>
          <p className="font-mono font-bold text-destructive">{Math.round(result.defenderPower)}</p>
        </div>
      </div>
      {companion && (
        <p className="text-[9px] text-muted-foreground italic border-t border-border/30 pt-1.5">
          {companion.emoji} {won ? companion.winMsg : companion.loseMsg}
        </p>
      )}
    </div>
  );
}
