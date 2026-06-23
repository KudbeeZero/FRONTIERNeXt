import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/gameStore";

// ---------------------------------------------------------------------------
// A brief luminous cross-fade veil that pulses whenever the phase (chapter beat)
// changes, so transitions feel cinematic instead of snapping. Pure DOM, pointer-
// transparent. Base opacity 0 means it stays invisible under reduced motion (the
// .reduce-motion root class disables the keyframe).
// ---------------------------------------------------------------------------

export function PhaseFlash() {
  const phase = useGameStore((s) => s.phase);
  const [pulse, setPulse] = useState(0);
  const prev = useRef(phase);

  useEffect(() => {
    if (phase !== prev.current && phase !== "idle") setPulse((p) => p + 1);
    prev.current = phase;
  }, [phase]);

  if (phase === "idle" || pulse === 0) return null;
  return (
    <div
      key={pulse}
      className="anim-phase-flash pointer-events-none absolute inset-0 z-40"
      style={{
        opacity: 0,
        background:
          "radial-gradient(circle at 50% 45%, rgba(127,231,255,0.16), rgba(127,231,255,0.04) 42%, transparent 70%)",
      }}
    />
  );
}
