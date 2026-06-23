import { describe, it, expect } from "vitest";
import {
  inputSlotCount,
  validateConnection,
  evaluate,
  isBoardSolved,
  shortReason,
  type CircuitBoard,
  type Connection,
} from "./navCircuit";
import { STAGE_1_POWER, STAGE_2_LOGIC, boardForStage } from "../data/circuits";

const conn = (id: string, fromId: string, toId: string, toSlot: number, path: [number, number][]): Connection => ({
  id, fromId, toId, toSlot, path: path.map(([x, y]) => ({ x, y })),
});

// ── Stage 1 reference solution (thread the two gaps) ─────────────────────────────
const S1_A = conn("a", "s1", "k1", 0, [[0,0],[1,0],[2,0],[2,1],[3,1],[4,1],[4,0],[5,0],[6,0]]);
const S1_B = conn("b", "s2", "k2", 0, [[0,4],[1,4],[2,4],[2,3],[3,3],[4,3],[4,4],[5,4],[6,4]]);

// ── Stage 2 reference solution (sA AND sB → core) ────────────────────────────────
const S2_A = conn("a", "sA", "g2", 0, [[0,1],[1,1],[2,1],[3,1],[4,1],[4,2],[4,3]]);
const S2_B = conn("b", "sB", "g2", 1, [[0,5],[1,5],[2,5],[3,5],[4,5],[4,4],[4,3]]);
const S2_G = conn("g", "g2", "k1", 0, [[4,3],[5,3],[6,3]]);

describe("inputSlotCount", () => {
  it("matches each node type's arity", () => {
    expect(inputSlotCount("source")).toBe(0);
    expect(inputSlotCount("sink")).toBe(1);
    expect(inputSlotCount("not")).toBe(1);
    expect(inputSlotCount("and")).toBe(2);
    expect(inputSlotCount("or")).toBe(2);
  });
});

describe("validateConnection", () => {
  it("accepts a clean Stage 1 wire", () => {
    expect(validateConnection(STAGE_1_POWER, S1_A, []).ok).toBe(true);
  });

  it("rejects a diagonal / discontinuous wire", () => {
    const bad = conn("x", "s1", "k1", 0, [[0,0],[1,1],[6,0]]);
    expect(validateConnection(STAGE_1_POWER, bad, []).ok).toBe(false);
  });

  it("rejects a wire that runs through a damaged trace", () => {
    const bad = conn("x", "s1", "k1", 0, [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0]]); // (3,0) is damaged
    const v = validateConnection(STAGE_1_POWER, bad, []);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/damaged/);
  });

  it("rejects endpoints that don't match the nodes", () => {
    const bad = conn("x", "s1", "k1", 0, [[0,1],[0,0]]);
    expect(validateConnection(STAGE_1_POWER, bad, []).ok).toBe(false);
  });

  it("rejects drawing from a sink and feeding a source", () => {
    expect(validateConnection(STAGE_1_POWER, conn("x","k1","s1",0,[[6,0],[0,0]]), []).ok).toBe(false);
  });

  it("rejects an out-of-range input slot", () => {
    expect(validateConnection(STAGE_1_POWER, conn("x","s1","k1",1,[[0,0],[6,0]]), []).ok).toBe(false);
  });

  it("rejects a second wire into an occupied input slot", () => {
    expect(validateConnection(STAGE_1_POWER, conn("c","s2","k1",0,[[0,4],[6,0]]), [S1_A]).ok).toBe(false);
  });

  it("rejects two wires whose interiors cross", () => {
    const cross: CircuitBoard = {
      id: "x", title: "x", width: 5, height: 3,
      nodes: [
        { id: "a", type: "source", pos: { x: 0, y: 0 } },
        { id: "k", type: "sink", pos: { x: 4, y: 0 } },
        { id: "b", type: "source", pos: { x: 0, y: 2 } },
        { id: "k2", type: "sink", pos: { x: 4, y: 2 } },
      ],
      damaged: [], fuelBudget: 100, shortCost: 5,
    };
    const existing = conn("a", "a", "k", 0, [[0,0],[1,0],[2,0],[2,1],[3,1],[3,0],[4,0]]);
    const crosses = conn("b", "b", "k2", 0, [[0,2],[1,2],[2,2],[2,1],[3,1],[3,2],[4,2]]); // shares (2,1),(3,1)
    expect(validateConnection(cross, existing, []).ok).toBe(true);
    const v = validateConnection(cross, crosses, [existing]);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/crossed/);
  });

  it("flags the protected core: a raw source cannot feed it", () => {
    const raw = conn("x", "sA", "k1", 0, [[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[6,2],[6,3]]);
    const v = validateConnection(STAGE_2_LOGIC, raw, []);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/core|logic array/);
  });

  it("allows a gate to feed the protected core", () => {
    expect(validateConnection(STAGE_2_LOGIC, S2_G, [S2_A, S2_B]).ok).toBe(true);
  });
});

describe("evaluate (logic)", () => {
  const gateBoard = (type: "and" | "or" | "not", aLive: boolean, bLive: boolean): CircuitBoard => ({
    id: "t", title: "t", width: 5, height: 5,
    nodes: [
      { id: "a", type: "source", pos: { x: 0, y: 0 }, live: aLive },
      { id: "b", type: "source", pos: { x: 0, y: 2 }, live: bLive },
      { id: "g", type, pos: { x: 2, y: 1 } },
      { id: "k", type: "sink", pos: { x: 4, y: 1 } },
    ],
    damaged: [], fuelBudget: 100, shortCost: 5,
  });
  const wires = (type: "and" | "or" | "not"): Connection[] => {
    const base: Connection[] = [conn("ga","a","g",0,[[0,0],[1,0],[2,0],[2,1]])];
    if (type !== "not") base.push(conn("gb","b","g",1,[[0,2],[1,2],[2,2],[2,1]]));
    base.push(conn("gk","g","k",0,[[2,1],[3,1],[4,1]]));
    return base;
  };

  it("a dead source is OFF, a live source is ON", () => {
    const v = evaluate(gateBoard("or", true, false), wires("or"));
    expect(v.get("a")).toBe(true);
    expect(v.get("b")).toBe(false);
  });
  it("AND powers the sink only when both inputs are live", () => {
    expect(evaluate(gateBoard("and", true, true), wires("and")).get("k")).toBe(true);
    expect(evaluate(gateBoard("and", true, false), wires("and")).get("k")).toBe(false);
  });
  it("OR powers the sink when either input is live", () => {
    expect(evaluate(gateBoard("or", true, false), wires("or")).get("k")).toBe(true);
    expect(evaluate(gateBoard("or", false, false), wires("or")).get("k")).toBe(false);
  });
  it("NOT inverts a dead line into power", () => {
    expect(evaluate(gateBoard("not", false, false), wires("not")).get("k")).toBe(true);
    expect(evaluate(gateBoard("not", true, false), wires("not")).get("k")).toBe(false);
  });
});

describe("isBoardSolved", () => {
  it("Stage 1 is solved when both buses reach their sinks", () => {
    expect(isBoardSolved(STAGE_1_POWER, [S1_A, S1_B])).toBe(true);
  });
  it("Stage 1 is NOT solved with only one bus wired", () => {
    expect(isBoardSolved(STAGE_1_POWER, [S1_A])).toBe(false);
  });
  it("Stage 2 is solved by the AND interlock (sA AND sB → core)", () => {
    expect(isBoardSolved(STAGE_2_LOGIC, [S2_A, S2_B, S2_G])).toBe(true);
  });
  it("Stage 2 is NOT solved when the AND has only one input", () => {
    expect(isBoardSolved(STAGE_2_LOGIC, [S2_A, S2_G])).toBe(false);
  });
});

describe("shortReason", () => {
  it("returns null for a clean wire and a reason for a short", () => {
    expect(shortReason(STAGE_1_POWER, S1_A, [])).toBeNull();
    const damaged = conn("x", "s1", "k1", 0, [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0]]);
    expect(shortReason(STAGE_1_POWER, damaged, [])).toMatch(/damaged/);
  });
});

describe("boardForStage", () => {
  it("maps 1→power, 2→logic, falls back to stage 1", () => {
    expect(boardForStage(1).id).toBe(STAGE_1_POWER.id);
    expect(boardForStage(2).id).toBe(STAGE_2_LOGIC.id);
    expect(boardForStage(9).id).toBe(STAGE_1_POWER.id);
  });
});
