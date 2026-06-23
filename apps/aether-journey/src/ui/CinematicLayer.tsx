import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { useSettingsStore } from "../store/settingsStore";
import { audio } from "../lib/audioEngine";
import { SettingsToggles } from "./MenuLayer";
import { ClaimPanel } from "./ClaimPanel";
import { ENDING_COPY } from "../lib/descent";

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
  const [showSettings, setShowSettings] = useState(false);
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
          // Background intro cue under the title dissolve into the wake-up.
          audio.playMusic("title_intro");
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

      {/* Settings accessible before you start. */}
      <button
        onClick={() => setShowSettings((v) => !v)}
        className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[#5f7da0] transition hover:text-aether-core"
      >
        {showSettings ? "× close settings" : "⚙ settings"}
      </button>
      {showSettings && (
        <div className="mt-4">
          <SettingsToggles />
        </div>
      )}
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
  const ledger = useGameStore((s) => s.ledger);
  const stability = useGameStore((s) => s.systems.aetherStability);
  const ending = useGameStore((s) => s.ending);
  const trust = useGameStore((s) => s.trust);
  const stats = useSettingsStore((s) => s.stats);
  if (!journeyResumed) return null;
  const fmtMs = (ms: number | null) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);

  // After the descent, the run resolves to a trust-gated ending; if the EndCard is
  // ever reached before the finale, fall back to the neutral hand-off copy.
  const copy = ending ? ENDING_COPY[ending] : null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#03060d]/95 px-6 text-center backdrop-blur-sm">
      <div className="mb-3 font-mono text-xs uppercase tracking-[0.5em] text-aether-core">
        {ending ? "the journey's end" : "journey complete"}
      </div>
      <h2 className="font-display text-3xl font-black uppercase tracking-[0.2em] text-[#e7f4ff] text-glow sm:text-5xl">
        {copy ? copy.title : "First Watch"}
      </h2>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-[#9fb4c9] sm:text-lg">
        {copy
          ? copy.line
          : `Aether is whole again — steady at ${Math.round(stability)}% — and the course to Mars holds. The frontier waits.`}{" "}
        <span className="text-aether-core">Trust in Aether: {Math.round(trust)}.</span>
      </p>

      {/* Commit the run to Algorand (testnet), then hand off to FRONTIER-AL. */}
      <ClaimPanel events={ledger} />

      {/* Local (on-device) run stats — a personal scoreboard, no backend. */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-[#7d93a8]">
        <span>
          repair <span className="text-[#cfe3f5]">{fmtMs(stats.lastRepairMs)}</span>
          {stats.bestRepairMs != null && (
            <> · best <span className="text-aether-core">{fmtMs(stats.bestRepairMs)}</span></>
          )}
        </span>
        <span>
          stability{" "}
          <span className="text-[#cfe3f5]">{stats.lastStability ?? Math.round(stability)}%</span>
          {stats.bestStability != null && (
            <> · best <span className="text-aether-core">{stats.bestStability}%</span></>
          )}
        </span>
        <span>
          run <span className="text-[#cfe3f5]">#{stats.runs}</span>
        </span>
      </div>

      {/* The prologue ends by committing the run on-chain and handing off to the
          main game (see ClaimPanel above). Replay stays available as a clean
          page reload (restarts the store from scratch without touching it). */}
      <p className="mt-6 max-w-md text-sm leading-relaxed text-[#7d93a8]">
        That&apos;s the end of <span className="text-[#9fb4c9]">First Watch</span>.
        Commit your run above, then continue into{" "}
        <span className="text-aether-core">FRONTIER-AL</span> — where the frontier
        truly begins.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="mt-6 font-mono text-[10px] uppercase tracking-widest text-[#5f7da0] underline decoration-dotted transition hover:text-aether-core"
      >
        ↻ replay prologue
      </button>
    </div>
  );
}
