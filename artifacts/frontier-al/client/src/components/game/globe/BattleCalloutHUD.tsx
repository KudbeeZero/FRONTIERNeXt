/**
 * BattleCalloutHUD — the verbal half of the battle telegraphy.
 *
 * A DOM overlay (mount OUTSIDE the <Canvas>, in the HUD layer). Subscribes to the
 * cinematic bus and, while a battle plays on the globe, tickers the engine's beat
 * captions off the SAME clock — "Target lock → Inbound → Impact → Fortune swings
 * → VICTORY". The globe draws the lines; this names what's happening, so the two
 * read as one connected sequence. Idle (renders nothing) until a battle resolves.
 *
 * Pure logic is the tested engine + `activeCallout`; this is a thin renderer.
 */
import { useEffect, useRef, useState } from "react";
import { onCinematic, activeCallout, type CinematicHandle, type Callout } from "@/lib/battle/cinematicBus";

const VICTORY_COLOR = "#22d3ee";
const DEFENSE_COLOR = "#f87171";
const SWING_COLOR = "#fbbf24";

export function BattleCalloutHUD() {
  const [handle, setHandle] = useState<CinematicHandle | null>(null);
  const [callout, setCallout] = useState<Callout | null>(null);
  const rafRef = useRef(0);

  // Latest cinematic wins (one callout strip at a time).
  useEffect(() => onCinematic(setHandle), []);

  useEffect(() => {
    if (!handle) return;
    const tick = () => {
      const c = activeCallout(handle.seq, Date.now() - handle.startMs);
      setCallout(c);
      if (c) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setHandle(null);
        setCallout(null);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [handle]);

  if (!handle || !callout) return null;

  const { seq } = handle;
  const tone =
    callout.kind === "swing"
      ? SWING_COLOR
      : callout.kind === "brace"
        ? DEFENSE_COLOR
        : callout.kind === "resolve" || callout.kind === "aftermath"
          ? seq.captured ? VICTORY_COLOR : DEFENSE_COLOR
          : VICTORY_COLOR;

  return (
    <div
      data-testid="battle-callout"
      style={{
        position: "absolute",
        top: 52,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 31,
        pointerEvents: "none",
        maxWidth: "90vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        fontFamily: "monospace",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
          whiteSpace: "nowrap",
        }}
      >
        ⊳ {seq.attacker.name} → plot #{seq.plotId}
      </div>
      <div
        style={{
          fontSize: 13,
          letterSpacing: "0.1em",
          padding: "5px 14px",
          borderRadius: 5,
          background: "rgba(2,4,14,0.82)",
          border: `1px solid ${tone}`,
          boxShadow: `0 0 18px ${tone}55`,
          color: tone,
          // Bigger, more urgent for higher-intensity beats.
          fontWeight: callout.intensity > 0.6 ? 700 : 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "88vw",
        }}
      >
        {callout.caption}
      </div>
    </div>
  );
}
