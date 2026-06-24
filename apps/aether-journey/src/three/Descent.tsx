import { useEffect, useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import { useGameStore } from "../store/gameStore";
import { audio } from "../lib/audioEngine";
import { DESCENT_STAGES, descentTuning } from "../lib/descent";

// ---------------------------------------------------------------------------
// Chapter 5 — the Descent (finale) board.
//
// Mounted only during phase === "descent". A staged insertion burn: each stage is
// a fast reflex beat under a countdown (descentTuning scales the window + Aether's
// assist by accumulated trust). Pick the correct vector before the window closes;
// a wrong pick or a timeout FAILS the stage and retries it in place (passStage /
// failStage in the store, both unit-tested). Clearing the last stage resolves the
// ending. This component is input + the real-time timer only.
// ---------------------------------------------------------------------------

const Z = -2.2;
const VECTORS = ["◄ PORT", "● HOLD", "STARBOARD ►"];

export function Descent() {
  const stageIndex = useGameStore((s) => s.stageIndex);
  const stageFails = useGameStore((s) => s.stageFails);
  const trust = useGameStore((s) => s.trust);
  const passStage = useGameStore((s) => s.passStage);
  const failStage = useGameStore((s) => s.failStage);

  const tuning = useMemo(() => descentTuning(trust), [trust]);
  const stage = DESCENT_STAGES[stageIndex];
  // Deterministic "correct vector" per stage — stable across a retry of the same stage.
  const correct = stageIndex % VECTORS.length;

  const [remaining, setRemaining] = useState(tuning.secondsPerStage);

  // Per-stage countdown. Resets whenever the stage advances (stageIndex) or is
  // retried (stageFails). Timing out fails the stage → retry.
  useEffect(() => {
    setRemaining(tuning.secondsPerStage);
    const start = Date.now();
    const id = window.setInterval(() => {
      const left = tuning.secondsPerStage - (Date.now() - start) / 1000;
      if (left <= 0) {
        window.clearInterval(id);
        audio.glitchBurst(0.4);
        failStage();
      } else {
        setRemaining(left);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [stageIndex, stageFails, tuning.secondsPerStage, failStage]);

  const pick = (idx: number) => {
    if (idx === correct) {
      audio.confirm();
      passStage();
    } else {
      audio.glitchBurst(0.5);
      failStage();
    }
  };

  const frac = Math.max(0, Math.min(1, remaining / tuning.secondsPerStage));
  const urgent = frac < 0.34;

  return (
    <group>
      <Html position={[0, 0.15, Z]} center>
        <div
          className="anim-board-in"
          style={{
            width: 372,
            fontFamily: "'JetBrains Mono', monospace",
            background: "rgba(6,10,20,0.86)",
            border: `1px solid ${urgent ? "#5a2030" : "#1c3147"}`,
            borderRadius: 8,
            padding: "14px 16px",
            color: "#cfe3f5",
            pointerEvents: "auto",
            userSelect: "none",
            boxShadow: "0 0 28px rgba(40,20,60,0.5)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              letterSpacing: 2,
              color: "#ff9a6a",
              textShadow: "0 0 8px #ff7a4a",
              textTransform: "uppercase",
            }}
          >
            <span>Descent · Insertion</span>
            <span>
              {stageIndex + 1}/{DESCENT_STAGES.length}
            </span>
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 15,
              letterSpacing: 1,
              color: "#e7f4ff",
              textShadow: "0 0 8px #7fe7ff",
            }}
          >
            {stage.label}
          </div>
          <div style={{ fontSize: 11, color: "#9fb4c9", marginTop: 3, minHeight: 28 }}>
            {stage.prompt}
            {tuning.assist && (
              <span style={{ color: "#6ee7a0" }}> — Aether: take {VECTORS[correct]}.</span>
            )}
          </div>

          {/* Countdown bar. */}
          <div
            style={{
              height: 6,
              margin: "10px 0",
              borderRadius: 3,
              background: "rgba(20,30,44,0.9)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${frac * 100}%`,
                height: "100%",
                background: urgent ? "#ff5a5a" : "#7fe7ff",
                boxShadow: `0 0 8px ${urgent ? "#ff5a5a" : "#7fe7ff"}`,
                transition: "width 0.1s linear",
              }}
            />
          </div>

          {/* Vector choices. */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {VECTORS.map((v, i) => {
              const lit = tuning.assist && i === correct;
              return (
                <button
                  key={i}
                  onClick={() => pick(i)}
                  style={{
                    pointerEvents: "auto",
                    cursor: "pointer",
                    flex: 1,
                    padding: "8px 4px",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    letterSpacing: 1,
                    color: lit ? "#6ee7a0" : "#cfe3f5",
                    background: lit ? "rgba(30,80,50,0.55)" : "rgba(12,24,38,0.85)",
                    border: `1px solid ${lit ? "#3a8f5f" : "#2f4f6f"}`,
                    borderRadius: 5,
                    textShadow: lit ? "0 0 8px #6ee7a0" : "none",
                  }}
                >
                  {v}
                </button>
              );
            })}
          </div>

          {stageFails > 0 && (
            <div
              style={{
                marginTop: 8,
                textAlign: "center",
                fontSize: 9,
                letterSpacing: 1,
                color: "#ff8a8a",
                textTransform: "uppercase",
              }}
            >
              {stageFails} miss{stageFails === 1 ? "" : "es"} — hold together
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
