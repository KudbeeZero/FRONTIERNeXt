/**
 * client/src/components/game/BattleSequenceTimeline.tsx
 *
 * Plays a resolved battle as the real, deterministic Battle Sequence — the
 * cinematic spine (`@shared/battle-sequence`) driven off one playhead. Replaces
 * the modal's fabricated mock-event feed: every beat here is derived from the
 * actual battle result, so muster → lock → launch → transit → brace → impact →
 * clash → swing → resolve → aftermath read as one connected sequence.
 *
 * Pure rendering over a self-advancing clock; all sequence logic lives in the
 * tested shared engine + adapter, not here.
 */
import { useEffect, useRef, useState } from "react";
import {
  Zap,
  Crosshair,
  Rocket,
  Send,
  Shield,
  Flame,
  Swords,
  Dices,
  Trophy,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  beatAt,
  progressAt,
  type BattleSequence,
  type BattleBeatKind,
} from "@shared/battle-sequence";
import { revealedBeats } from "@/lib/battle/sequenceFromReplay";

const BEAT_ICON: Record<BattleBeatKind, typeof Zap> = {
  muster: Zap,
  lock: Crosshair,
  launch: Rocket,
  transit: Send,
  brace: Shield,
  impact: Flame,
  clash: Swords,
  swing: Dices,
  resolve: Trophy,
  aftermath: Sparkles,
};

/** Which side a beat leans toward, for colour. */
function beatTone(kind: BattleBeatKind, captured: boolean): "attacker" | "defender" | "swing" {
  if (kind === "brace") return "defender";
  if (kind === "swing") return "swing";
  if (kind === "resolve" || kind === "aftermath") return captured ? "attacker" : "defender";
  return "attacker";
}

export function BattleSequenceTimeline({ seq }: { seq: BattleSequence }) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Self-advancing playhead 0 → durationMs, then settle on the full sequence.
  useEffect(() => {
    let raf = 0;
    startRef.current = null;
    const tick = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const e = t - startRef.current;
      if (e < seq.durationMs) {
        setElapsed(e);
        raf = requestAnimationFrame(tick);
      } else {
        setElapsed(seq.durationMs);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seq]);

  // Keep the live beat in view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [elapsed]);

  const revealed = revealedBeats(seq, elapsed);
  const active = beatAt(seq, elapsed)?.beat ?? null;
  const progress = progressAt(seq, elapsed) * 100;

  return (
    <div className="space-y-2" data-testid="battle-sequence-timeline">
      {/* Playhead */}
      <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full bg-primary/70 transition-[width] duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {revealed.map((beat) => {
          const Icon = BEAT_ICON[beat.kind];
          const tone = beatTone(beat.kind, seq.captured);
          const isActive = active?.kind === beat.kind;
          return (
            <div
              key={beat.kind}
              ref={isActive ? activeRef : undefined}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md border text-xs transition-all duration-200",
                tone === "attacker" && "bg-primary/5 border-primary/20",
                tone === "defender" && "bg-destructive/5 border-destructive/20",
                tone === "swing" && "bg-amber-500/5 border-amber-500/20",
                isActive && "ring-1 ring-offset-1 ring-offset-background scale-[1.01]",
                isActive && tone === "attacker" && "ring-primary/40",
                isActive && tone === "defender" && "ring-destructive/40",
                isActive && tone === "swing" && "ring-amber-500/40",
              )}
            >
              <Icon
                className={cn(
                  "w-3.5 h-3.5 shrink-0",
                  tone === "attacker" && "text-primary",
                  tone === "defender" && "text-destructive",
                  tone === "swing" && "text-amber-400",
                  isActive && "animate-pulse",
                )}
              />
              <span className="leading-snug flex-1">{beat.caption}</span>
              {/* Intensity pip */}
              <span
                className={cn(
                  "h-1.5 rounded-full shrink-0",
                  tone === "attacker" && "bg-primary/50",
                  tone === "defender" && "bg-destructive/50",
                  tone === "swing" && "bg-amber-400/60",
                )}
                style={{ width: `${Math.round(8 + beat.intensity * 28)}px` }}
                aria-hidden
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
