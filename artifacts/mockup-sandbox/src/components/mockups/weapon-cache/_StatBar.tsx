// Segmented stat bar (████████░░) used for the nine weapon stats and the card
// hover preview. Presentation-only.

import { cn } from "@/lib/utils";

const SEGMENTS = 10;

interface StatBarProps {
  label: string;
  /** 0..100 */
  value: number;
  /** Accent hex for filled segments. */
  hex: string;
  /** Compact variant for the card hover preview. */
  compact?: boolean;
}

export function StatBar({ label, value, hex, compact = false }: StatBarProps) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * SEGMENTS);

  return (
    <div className={cn("flex items-center gap-3", compact && "gap-2")}>
      <span
        className={cn(
          "shrink-0 text-zinc-400 tabular-nums",
          compact ? "w-20 text-[10px]" : "w-28 text-xs",
        )}
      >
        {label}
      </span>
      <div className={cn("flex flex-1 items-center", compact ? "gap-[2px]" : "gap-[3px]")}>
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const on = i < filled;
          return (
            <span
              key={i}
              className={cn(
                "flex-1 rounded-[2px] transition-all duration-300",
                compact ? "h-1.5" : "h-2.5",
              )}
              style={{
                backgroundColor: on ? hex : "rgba(255,255,255,0.07)",
                boxShadow: on ? `0 0 6px -2px ${hex}` : "none",
              }}
            />
          );
        })}
      </div>
      {!compact && (
        <span className="w-8 shrink-0 text-right text-xs font-medium tabular-nums text-zinc-300">
          {Math.round(value)}
        </span>
      )}
    </div>
  );
}
