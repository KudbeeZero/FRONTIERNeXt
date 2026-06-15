import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { audio } from "../lib/audioEngine";

// ---------------------------------------------------------------------------
// The cinematic bookends that frame the playable scene:
//   • StartGate — the black title screen + the BEGIN gesture that (required by
//     browsers) unlocks audio and starts the wake-up.
//   • WakeFade  — a full-screen black veil that fades off as you "open your eyes".
//   • EndCard   — the Phase-1 payoff / "to be continued" card.
// ---------------------------------------------------------------------------

export function StartGate() {
  const phase = useGameStore((s) => s.phase);
  const begin = useGameStore((s) => s.begin);
  if (phase !== "idle") return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#03060d] px-6 text-center">
      <div className="mb-2 font-mono text-xs uppercase tracking-[0.6em] text-[#5f7da0]">
        FRONTIER initiative · prologue
      </div>
      <h1 className="font-display text-4xl font-black uppercase tracking-[0.2em] text-aether-core text-glow sm:text-6xl">
        Aether&apos;s Journey
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-[#9fb4c9] sm:text-lg">
        You are the only human awake aboard the <em>Aether Voyager</em>. A solar
        storm has torn through the ship&apos;s AI companion. She is not
        hostile&nbsp;— she is hurt. Stabilize her. Reach Mars.
      </p>

      <button
        onClick={() => {
          audio.start();
          // Some voices only populate after the synth is touched.
          if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
          begin();
        }}
        className="mt-10 rounded border border-aether-core/60 bg-aether-core/10 px-10 py-3.5 font-display text-lg uppercase tracking-[0.35em] text-aether-core text-glow transition hover:bg-aether-core/25"
      >
        Begin
      </button>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-[#3f5872]">
        headphones recommended · audio + voice enabled on begin
      </p>
    </div>
  );
}

export function WakeFade() {
  const phase = useGameStore((s) => s.phase);
  const [opacity, setOpacity] = useState(1);
  const armed = useRef(false);

  useEffect(() => {
    if (phase === "waking" && !armed.current) {
      armed.current = true;
      // Eyes opening: hold black a beat, then fade the cabin in.
      const t = window.setTimeout(() => setOpacity(0), 400);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  if (phase === "idle" || opacity === 0) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 bg-black transition-opacity duration-[3500ms] ease-out"
      style={{ opacity }}
    />
  );
}

export function EndCard() {
  const journeyResumed = useGameStore((s) => s.journeyResumed);
  const ledgerCount = useGameStore((s) => s.ledger.length);
  const stability = useGameStore((s) => s.systems.aetherStability);
  if (!journeyResumed) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#03060d]/95 px-6 text-center backdrop-blur-sm">
      <div className="mb-3 font-mono text-xs uppercase tracking-[0.5em] text-aether-core">
        phase 01 complete
      </div>
      <h2 className="font-display text-3xl font-black uppercase tracking-[0.2em] text-[#e7f4ff] text-glow sm:text-5xl">
        First Watch
      </h2>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-[#9fb4c9] sm:text-lg">
        Aether is whole again — steady at <span className="text-aether-core">{Math.round(stability)}%</span>.
        The course to Mars is locked, and for the first time since the storm,
        neither of you is alone. The frontier waits.
      </p>

      <div className="mt-8 holo-panel rounded-md px-6 py-4 font-mono text-xs uppercase tracking-widest text-[#9fb4c9]">
        <span className="text-aether-core">{ledgerCount}</span> actions recorded ·
        ready to commit to Algorand
      </div>

      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.4em] text-[#5f7da0]">
        to be continued…
      </p>
    </div>
  );
}
