import { useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import { useGameStore } from "../store/gameStore";
import { audio } from "../lib/audioEngine";
import { NAV_BEACON, BEACON_GLYPHS } from "../data/beacon";
import { remainingCount, type Code } from "../lib/beacon";

// ---------------------------------------------------------------------------
// Chapter 4 — the Signal Decode board.
//
// Mounted only during phase === "decode". A floating <Html> probe panel (like
// PowerBus): the player builds a 4-glyph guess (click a slot to cycle it), sends a
// probe and reads the beacon's feedback (exact / near), or asks for Aether's read
// (the trust beat). ALL rules live in the pure engine + store (both unit-tested);
// this is input + display. `remainingCount` surfaces the live uncertainty.
// ---------------------------------------------------------------------------

const Z = -2.2;
const { length: L, palette: P } = NAV_BEACON;

const slotBtn: React.CSSProperties = {
  pointerEvents: "auto",
  cursor: "pointer",
  width: 34,
  height: 38,
  fontSize: 20,
  lineHeight: "36px",
  textAlign: "center",
  color: "#7fe7ff",
  background: "rgba(8,20,32,0.9)",
  border: "1px solid #2f6f8f",
  borderRadius: 6,
  textShadow: "0 0 8px #7fe7ff",
};

const actionBtn = (enabled: boolean): React.CSSProperties => ({
  pointerEvents: "auto",
  cursor: enabled ? "pointer" : "not-allowed",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: enabled ? "#cfe3f5" : "#43607c",
  background: enabled ? "rgba(20,60,90,0.5)" : "rgba(10,20,30,0.5)",
  border: `1px solid ${enabled ? "#2f6f8f" : "#1c3147"}`,
  borderRadius: 4,
  padding: "6px 12px",
});

const glyph = (i: number) => BEACON_GLYPHS[i] ?? "·";

export function SignalDecode() {
  const probes = useGameStore((s) => s.probes);
  const submitProbe = useGameStore((s) => s.submitProbe);
  const acceptAetherProposal = useGameStore((s) => s.acceptAetherProposal);

  const [guess, setGuess] = useState<Code>(() => Array(L).fill(0));

  // Live uncertainty — memoized; enumerates the (small) code space against history.
  const remaining = useMemo(() => remainingCount(probes, L, P), [probes]);

  const cycle = (slot: number) => {
    audio.beep(540, 0.04, "sine", 0.07);
    setGuess((g) => g.map((v, i) => (i === slot ? (v + 1) % P : v)));
  };

  const onSubmit = () => {
    const r = submitProbe([...guess]);
    if (r.solved) {
      audio.confirm();
      audio.glitchBurst(0.3);
    } else {
      audio.beep(480, 0.05, "sine", 0.09);
    }
  };

  const onAether = () => {
    const r = acceptAetherProposal();
    if (r.solved) {
      audio.confirm();
      audio.glitchBurst(0.4);
    } else {
      // She offered a read; it wasn't the lock — feedback recorded, window ticks.
      audio.beep(360, 0.06, "sine", 0.1);
    }
  };

  return (
    <group>
      <Html position={[0, 0.15, Z]} center>
        <div
          style={{
            width: 376,
            fontFamily: "'JetBrains Mono', monospace",
            background: "rgba(4,14,24,0.84)",
            border: "1px solid #1c3147",
            borderRadius: 8,
            padding: "14px 16px",
            color: "#cfe3f5",
            pointerEvents: "auto",
            userSelect: "none",
            boxShadow: "0 0 26px rgba(10,40,70,0.5)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              letterSpacing: 2,
              color: "#7fe7ff",
              textShadow: "0 0 8px #7fe7ff",
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            Beacon · Signal Decode
          </div>

          {/* Probe history. */}
          <div style={{ margin: "10px 0", minHeight: 22 }}>
            {probes.length === 0 ? (
              <div style={{ fontSize: 10, color: "#5f7da0", textAlign: "center" }}>
                no probes yet — build a guess and send it
              </div>
            ) : (
              probes.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 13,
                    padding: "2px 0",
                    color: "#9fb4c9",
                  }}
                >
                  <span style={{ letterSpacing: 3, color: "#cfe3f5" }}>
                    {p.guess.map(glyph).join(" ")}
                  </span>
                  <span style={{ fontSize: 10 }}>
                    <span style={{ color: "#6ee7a0" }}>{p.score.exact}● exact</span>{" "}
                    <span style={{ color: "#ffd27f" }}>{p.score.partial}◑ near</span>
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Working guess — click a slot to cycle its glyph. */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "12px 0 10px" }}>
            {guess.map((v, i) => (
              <button key={i} onClick={() => cycle(i)} style={slotBtn}>
                {glyph(v)}
              </button>
            ))}
          </div>

          {/* Actions + uncertainty. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 10,
              borderTop: "1px solid #14283c",
              paddingTop: 10,
            }}
          >
            <div style={{ fontSize: 10, color: remaining <= 2 ? "#6ee7a0" : "#9fb4c9" }}>
              {remaining} possible{remaining === 1 ? " — locked in" : ""}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onAether} style={actionBtn(true)}>
                ◇ Aether&apos;s read
              </button>
              <button onClick={onSubmit} style={actionBtn(true)}>
                ▸ Send probe
              </button>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}
