import { Html } from "@react-three/drei";
import { useGameStore } from "../store/gameStore";
import { audio } from "../lib/audioEngine";
import { VESTA_TRIAGE } from "../data/triage";
import {
  resolveTriage,
  availableBus,
  CONSUMERS,
  type Consumer,
  type Tier,
} from "../lib/powerTriage";

// ---------------------------------------------------------------------------
// Chapter 3 — the Power Bus triage board.
//
// Mounted only during phase === "triage". A floating control panel (an <Html>
// surface in 3D space, like the nav-circuit's controls): the player splits the
// scarce bus across the three consumers with +/- steppers, toggles whether VESTA
// is contained, and commits. ALL rules live in the pure engine + store (both
// unit-tested) — resolveTriage drives the live tier colours and budget readout,
// and commitTriage guards/applies the choice. This component is input + display.
// ---------------------------------------------------------------------------

const Z = -2.2;
const C = VESTA_TRIAGE;

const TIER_COLOR: Record<Tier, string> = {
  nominal: "#6ee7a0",
  strained: "#ffd27f",
  critical: "#ff6a6a",
};

const stepBtn: React.CSSProperties = {
  pointerEvents: "auto",
  cursor: "pointer",
  width: 22,
  height: 22,
  lineHeight: "20px",
  textAlign: "center",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 13,
  color: "#cfe3f5",
  background: "rgba(8,18,30,0.8)",
  border: "1px solid #1c3147",
  borderRadius: 4,
};

export function PowerBus() {
  const allocation = useGameStore((s) => s.triageAllocation);
  const containVesta = useGameStore((s) => s.containVesta);
  const setAllocation = useGameStore((s) => s.setAllocation);
  const toggleContainVesta = useGameStore((s) => s.toggleContainVesta);
  const commitTriage = useGameStore((s) => s.commitTriage);

  const outcome = resolveTriage(C, allocation, containVesta);
  const { available, used, remaining } = outcome;

  const inc = (c: Consumer) => {
    if (used >= available) return; // bus is full — free a unit first
    audio.beep(620, 0.04, "sine", 0.08);
    setAllocation({ ...allocation, [c]: allocation[c] + 1 });
  };
  const dec = (c: Consumer) => {
    if (allocation[c] <= 0) return;
    audio.beep(420, 0.04, "sine", 0.07);
    setAllocation({ ...allocation, [c]: allocation[c] - 1 });
  };

  const onToggleVesta = () => {
    audio.beep(300, 0.06, "sine", 0.1);
    // Re-fit the allocation to the new bus so the board is never stranded over-budget
    // (trim comms, then life-support, and her core last).
    const newAvail = availableBus(C, !containVesta);
    const alloc = { ...allocation };
    const order: Consumer[] = ["comms", "lifeSupport", "aetherCore"];
    let oi = 0;
    while (alloc.lifeSupport + alloc.comms + alloc.aetherCore > newAvail && oi < 100) {
      const c = order[oi % order.length];
      if (alloc[c] > 0) alloc[c] -= 1;
      oi += 1;
    }
    setAllocation(alloc);
    toggleContainVesta();
  };

  const onCommit = () => {
    const r = commitTriage();
    if (r.ok) {
      audio.confirm();
      audio.glitchBurst(0.3);
    } else {
      audio.beep(200, 0.12, "sawtooth", 0.12);
    }
  };

  return (
    <group>
      <Html position={[0, 0.15, Z]} center>
        <div
          style={{
            width: 372,
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
            Power Bus · Triage
          </div>

          {/* VESTA disposition — changes the available bus. */}
          <button
            onClick={onToggleVesta}
            style={{
              pointerEvents: "auto",
              cursor: "pointer",
              width: "100%",
              marginTop: 10,
              padding: "5px 8px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: containVesta ? "#6ee7a0" : "#ff9a6a",
              background: "rgba(8,18,30,0.7)",
              border: `1px solid ${containVesta ? "#1f4d3a" : "#4d2f1f"}`,
              borderRadius: 4,
            }}
          >
            {containVesta
              ? `▣ VESTA contained  (−${C.containCost} units)`
              : `▢ VESTA loose  (−${C.vestaDrain} drain · risk)`}
          </button>

          {/* The three consumers. */}
          {CONSUMERS.map((c) => {
            const tier = outcome.tiers[c];
            const spec = C.consumers[c];
            const pips = Math.max(spec.demand, allocation[c]);
            return (
              <div
                key={c}
                style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0" }}
              >
                <div style={{ width: 92, fontSize: 11, color: "#9fb4c9" }}>{spec.label}</div>
                <button onClick={() => dec(c)} style={stepBtn}>
                  −
                </button>
                <div style={{ display: "flex", gap: 3, flex: 1, justifyContent: "center" }}>
                  {Array.from({ length: pips }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 9,
                        height: 15,
                        borderRadius: 2,
                        background: i < allocation[c] ? TIER_COLOR[tier] : "transparent",
                        border: `1px solid ${i < spec.demand ? "#33506b" : "#7a3b2b"}`,
                        boxShadow: i < allocation[c] ? `0 0 6px ${TIER_COLOR[tier]}` : "none",
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => inc(c)}
                  style={{ ...stepBtn, opacity: used >= available ? 0.35 : 1 }}
                >
                  +
                </button>
                <div
                  style={{
                    width: 84,
                    textAlign: "right",
                    fontSize: 9,
                    color: TIER_COLOR[tier],
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {allocation[c]}/{spec.demand} {tier}
                </div>
              </div>
            );
          })}

          {/* Budget readout + commit. */}
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
            <div style={{ fontSize: 11, color: remaining < 0 ? "#ff6a6a" : "#9fb4c9" }}>
              bus {used}/{available} ·{" "}
              {remaining < 0 ? `${-remaining} over budget` : `${remaining} free`}
            </div>
            <button
              onClick={onCommit}
              disabled={!outcome.valid}
              style={{
                pointerEvents: "auto",
                cursor: outcome.valid ? "pointer" : "not-allowed",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: outcome.valid ? "#7fe7ff" : "#43607c",
                background: outcome.valid ? "rgba(20,60,90,0.5)" : "rgba(10,20,30,0.5)",
                border: `1px solid ${outcome.valid ? "#2f6f8f" : "#1c3147"}`,
                borderRadius: 4,
                padding: "5px 14px",
                textShadow: outcome.valid ? "0 0 8px #7fe7ff" : "none",
              }}
            >
              ▸ Commit
            </button>
          </div>
        </div>
      </Html>
    </group>
  );
}
