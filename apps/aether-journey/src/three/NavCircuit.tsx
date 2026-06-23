import { useMemo, useState } from "react";
import { Html, Line } from "@react-three/drei";
import { useGameStore } from "../store/gameStore";
import { audio } from "../lib/audioEngine";
import { boardForStage } from "../data/circuits";
import {
  evaluate,
  findPath,
  inputSlotCount,
  type Cell,
  type CircuitNode,
} from "../lib/navCircuit";

// ---------------------------------------------------------------------------
// Chapter 2 — the Nav-Circuit Reroute board (click-to-route).
//
// Mounted only during phase === "rewiring". The player clicks a producer (source
// or gate output) then a consumer (gate input or the core); the ship auto-routes
// the wire around damage (lib/navCircuit.findPath) and the store validates it —
// charging drift on a short. Solving stage 1 advances to stage 2; solving stage 2
// brings the nav core online and enters transit. All puzzle rules live in the pure
// lib + store (both unit-tested); this component is presentation + input only.
// ---------------------------------------------------------------------------

const CELL = 0.34;
const Z = -2.2;
const Y_OFFSET = 0.15;

const COLOR = {
  source: "#6ee7a0",
  sink: "#ffd27f",
  sinkOn: "#7fe7ff",
  gate: "#c9a8ff",
  gateOn: "#7fe7ff",
  damaged: "#ff5a5a",
  wireOff: "#46618a",
  wireOn: "#7fe7ff",
  pending: "#ffffff",
};

const gateGlyph = (t: CircuitNode["type"]) =>
  t === "and" ? "&" : t === "or" ? "≥1" : t === "not" ? "!" : "";

export function NavCircuit() {
  const navStage = useGameStore((s) => s.navStage);
  const navConnections = useGameStore((s) => s.navConnections);
  const addNavConnection = useGameStore((s) => s.addNavConnection);
  const clearNavBoard = useGameStore((s) => s.clearNavBoard);

  const board = useMemo(() => boardForStage(navStage), [navStage]);
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Reset the half-made wire whenever the board changes (stage 1 → 2).
  const powered = useMemo(() => evaluate(board, navConnections), [board, navConnections]);

  const worldPos = (c: Cell): [number, number, number] => [
    c.x * CELL - ((board.width - 1) * CELL) / 2,
    Y_OFFSET + ((board.height - 1) * CELL) / 2 - c.y * CELL,
    Z,
  ];

  const handleClick = (id: string) => {
    const node = board.nodes.find((n) => n.id === id)!;
    if (pending === null) {
      if (node.type === "sink") {
        setFeedback("Start from a source or a gate output.");
        return;
      }
      setPending(id);
      setFeedback(null);
      audio.beep(560, 0.05, "sine", 0.1);
      return;
    }
    if (id === pending) {
      setPending(null);
      return;
    }
    const to = board.nodes.find((n) => n.id === id)!;
    if (to.type === "source") {
      setFeedback("Can't feed a source — pick a gate input or the core.");
      return;
    }
    const slots = inputSlotCount(to.type);
    const used = new Set(navConnections.filter((c) => c.toId === id).map((c) => c.toSlot));
    let slot = -1;
    for (let s = 0; s < slots; s++) if (!used.has(s)) { slot = s; break; }
    if (slot < 0) {
      setFeedback("That input is already wired.");
      setPending(null);
      return;
    }
    const path = findPath(board, pending, id, navConnections);
    if (!path) {
      setFeedback("No clear route — clear a wire and try again.");
      setPending(null);
      return;
    }
    const res = addNavConnection({
      id: `${pending}->${id}#${slot}:${navConnections.length}`,
      fromId: pending,
      toId: id,
      toSlot: slot,
      path,
    });
    if (!res.ok) {
      setFeedback(res.reason ?? "short");
      audio.glitchBurst(0.3);
    } else {
      setFeedback(null);
      audio.confirm();
    }
    setPending(null);
  };

  return (
    <group>
      {/* Backing panel for readability. */}
      <mesh position={[0, Y_OFFSET, Z - 0.05]}>
        <planeGeometry args={[board.width * CELL + 0.5, board.height * CELL + 0.7]} />
        <meshBasicMaterial color="#04101c" transparent opacity={0.62} toneMapped={false} />
      </mesh>

      {/* Damaged traces. */}
      {board.damaged.map((d, i) => (
        <mesh key={`d${i}`} position={worldPos(d)}>
          <boxGeometry args={[CELL * 0.7, CELL * 0.7, 0.02]} />
          <meshBasicMaterial color={COLOR.damaged} transparent opacity={0.35} toneMapped={false} />
        </mesh>
      ))}

      {/* Placed wires. */}
      {navConnections.map((c) => {
        const on = powered.get(c.fromId) === true;
        return (
          <Line
            key={c.id}
            points={c.path.map(worldPos)}
            color={on ? COLOR.wireOn : COLOR.wireOff}
            lineWidth={on ? 3 : 2}
            transparent
            opacity={on ? 0.95 : 0.6}
          />
        );
      })}

      {/* Nodes. */}
      {board.nodes.map((n) => {
        const isPending = pending === n.id;
        const on = powered.get(n.id) === true;
        let color = COLOR.gate;
        if (n.type === "source") color = COLOR.source;
        else if (n.type === "sink") color = on ? COLOR.sinkOn : COLOR.sink;
        else color = on ? COLOR.gateOn : COLOR.gate;
        if (isPending) color = COLOR.pending;
        const label =
          n.type === "source" ? (n.live === false ? "DEAD" : "SRC")
            : n.type === "sink" ? "CORE"
            : gateGlyph(n.type);
        return (
          <group key={n.id} position={worldPos(n.pos)}>
            <mesh
              onClick={(e) => { e.stopPropagation(); handleClick(n.id); }}
              onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
              onPointerOut={() => { document.body.style.cursor = "default"; }}
            >
              {n.type === "sink"
                ? <sphereGeometry args={[CELL * 0.34, 20, 20]} />
                : <boxGeometry args={[CELL * 0.5, CELL * 0.5, CELL * 0.5]} />}
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={isPending ? 2.4 : on ? 1.8 : 1.0}
                toneMapped={false}
                roughness={0.3}
                metalness={0.2}
              />
            </mesh>
            <Html position={[0, -CELL * 0.5, 0]} center>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 1,
                color, textShadow: "0 0 6px currentColor", whiteSpace: "nowrap",
                pointerEvents: "none", userSelect: "none",
              }}>{label}</div>
            </Html>
          </group>
        );
      })}

      {/* Title + feedback + clear, anchored above the board. */}
      <Html position={[0, Y_OFFSET + ((board.height - 1) * CELL) / 2 + 0.42, Z]} center>
        <div style={{ textAlign: "center", pointerEvents: "none", userSelect: "none", whiteSpace: "nowrap" }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 2,
            color: "#7fe7ff", textShadow: "0 0 8px #7fe7ff", textTransform: "uppercase",
          }}>{board.title}</div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, marginTop: 3,
            color: feedback ? "#ff8a8a" : "#9fb4c9", minHeight: 13,
          }}>
            {feedback ?? (pending ? "now pick where it connects ▸" : "click a source, then where it connects")}
          </div>
          <button
            onClick={() => { audio.beep(420, 0.05, "sine", 0.08); clearNavBoard(); setPending(null); setFeedback(null); }}
            style={{
              marginTop: 6, pointerEvents: "auto", cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 2,
              textTransform: "uppercase", color: "#9fb4c9",
              background: "rgba(8,18,30,0.7)", border: "1px solid #1c3147",
              borderRadius: 4, padding: "3px 10px",
            }}
          >↺ clear board</button>
        </div>
      </Html>
    </group>
  );
}
