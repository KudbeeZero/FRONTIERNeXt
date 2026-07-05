import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { serverNow } from "@/lib/serverClock";
import type { Player, CommanderTier } from "@shared/schema";
import { COMMANDER_INFO } from "@shared/schema";
import { CommanderNftStatus } from "./CommanderNftStatus";
import { COMPANION, COMMANDER_IMAGES, TIER_COLORS, formatCountdown } from "./shared";

// ── Avatar Card (2-column gallery style) ─────────────────────────────────────

export function AvatarCard({ cmd, isActive, onDeploy, onClaim, isClaiming, walletConnected }: {
  cmd: Player["commanders"][0]; isActive: boolean;
  onDeploy: () => void; onClaim?: (id: string) => void; isClaiming?: boolean; walletConnected?: boolean;
}) {
  const [countdown, setCountdown] = useState(0);
  const companion = COMPANION[cmd.tier as CommanderTier];

  useEffect(() => {
    const update = () => {
      const rem = cmd.lockedUntil ? Math.max(0, cmd.lockedUntil - serverNow()) : 0;
      setCountdown(rem);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [cmd.lockedUntil]);

  const isLocked = countdown > 0;
  const tierColor = TIER_COLORS[cmd.tier as CommanderTier];

  return (
    <div
      className={cn(
        "rounded-xl flex flex-col overflow-hidden transition-all cursor-pointer select-none",
        isLocked && "opacity-60"
      )}
      style={{
        background: isActive
          ? "linear-gradient(160deg, rgba(6,2,20,0.97) 0%, rgba(20,4,8,0.97) 100%)"
          : "linear-gradient(160deg, rgba(4,2,16,0.95) 0%, rgba(8,4,20,0.95) 100%)",
        border: isActive
          ? "1px solid rgba(239,68,68,0.6)"
          : "1px solid rgba(60,80,180,0.2)",
        boxShadow: isActive
          ? "0 0 15px rgba(239,68,68,0.15), inset 0 0 20px rgba(239,68,68,0.04)"
          : "0 0 8px rgba(0,0,60,0.4)",
      }}
    >
      {/* Active top stripe */}
      {isActive && (
        <div
          className="h-0.5 w-full shrink-0"
          style={{ background: "linear-gradient(90deg, transparent, rgba(239,68,68,0.9), transparent)" }}
        />
      )}

      {/* Image area */}
      <div className="relative aspect-square w-full overflow-hidden">
        <img
          src={COMMANDER_IMAGES[cmd.tier as CommanderTier]}
          alt={cmd.name}
          className="w-full h-full object-cover"
        />
        {/* Online dot */}
        <span
          className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full border border-black"
          style={{ background: isActive ? "#22c55e" : "#6b7280" }}
        />
        {/* Lock overlay */}
        {isLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
            <Lock className="w-5 h-5 text-white/80" />
            <span className="text-[9px] font-mono text-white/80 mt-1">{formatCountdown(countdown)}</span>
          </div>
        )}
      </div>

      {/* Info + button */}
      <div className="px-2.5 py-2 flex flex-col gap-1.5">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-wide text-white leading-tight truncate">
            {cmd.name}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[9px] capitalize" style={{ color: tierColor }}>{cmd.tier}</span>
            <span className="text-[9px] text-white/30">·</span>
            <span className="text-[9px] text-white/50 truncate">{COMMANDER_INFO[cmd.tier as CommanderTier]?.specialAbility ?? "operative"}</span>
          </div>
          {/* Combat impact — makes the tier's effect on battle explicit (was a
              near-invisible micro-row); the attackBonus is added to attacker power. */}
          <div className="mt-1 grid grid-cols-2 gap-1">
            <div className="rounded bg-red-500/10 border border-red-500/25 px-1.5 py-1 text-center">
              <div className="text-[7px] uppercase tracking-wide text-white/40">Attack</div>
              <div className="text-xs font-mono font-bold text-red-300 leading-none">+{cmd.attackBonus}</div>
            </div>
            <div className="rounded bg-blue-500/10 border border-blue-500/25 px-1.5 py-1 text-center">
              <div className="text-[7px] uppercase tracking-wide text-white/40">Defense</div>
              <div className="text-xs font-mono font-bold text-blue-300 leading-none">+{cmd.defenseBonus}</div>
            </div>
          </div>
          <p className="text-[8px] text-white/50 leading-snug mt-0.5">
            Adds <span className="text-red-300 font-semibold">+{cmd.attackBonus} attack power</span> to every battle you launch · ☠ {cmd.totalKills} kills
          </p>
        </div>

        {/* NFT status */}
        <CommanderNftStatus commanderId={cmd.id} onClaim={onClaim} isClaiming={isClaiming} walletConnected={walletConnected} />

        {/* Deploy button */}
        {!isLocked && (
          <button
            onClick={onDeploy}
            className={cn(
              "w-full py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-colors",
              isActive
                ? "commander-selected-btn bg-red-600 text-white border border-red-500/80"
                : "bg-transparent text-red-400 border border-red-500/40 hover:bg-red-500/10 hover:border-red-500/70"
            )}
          >
            {isActive ? "SELECTED" : "SELECT TO PLAY"}
          </button>
        )}
      </div>
    </div>
  );
}
