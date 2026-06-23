/**
 * navCircuit — pure logic for Chapter 2's "Nav-Circuit Reroute" wiring puzzle.
 *
 * No React, no three.js, no store: just the board model + validators + a logic
 * evaluator, so the puzzle's rules are unit-tested (navCircuit.spec.ts) and the R3F
 * component / store stay thin. See docs/CHAPTER_2_DESIGN.md.
 *
 * Model: a grid of nodes (sources ▸, sinks ◂, and AND/OR/NOT gates). The player lays
 * orthogonal wire `Connection`s from a producer's output to a consumer's input slot.
 * A board is solved when every sink is powered through valid (non-shorting) wires.
 */

export interface Cell {
  x: number;
  y: number;
}

export type NodeType = "source" | "sink" | "and" | "or" | "not";

export interface CircuitNode {
  id: string;
  type: NodeType;
  pos: Cell;
  /** sources only: false = dead/unpowered line (default true). */
  live?: boolean;
  /** sinks only: a protected core won't accept a raw source — must be fed by a gate. */
  requiresGate?: boolean;
}

export interface Connection {
  id: string;
  /** producer node id (anything except a sink). */
  fromId: string;
  /** consumer node id (anything except a source). */
  toId: string;
  /** which input slot of `toId` this wire feeds (0-based). */
  toSlot: number;
  /** orthogonal cell path, inclusive of both endpoint node cells. */
  path: Cell[];
}

export interface CircuitBoard {
  id: string;
  title: string;
  width: number;
  height: number;
  nodes: CircuitNode[];
  /** cells a wire may not cross (storm-damaged traces). */
  damaged: Cell[];
  /** starting drift/fuel budget. */
  fuelBudget: number;
  /** fuel lost per short (invalid wiring attempt). */
  shortCost: number;
}

export interface Validation {
  ok: boolean;
  /** populated when ok === false — the short reason, surfaced to the player + fuel cost. */
  reason?: string;
}

export const cellsEqual = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;

/** Input slots each node type accepts. */
export function inputSlotCount(type: NodeType): number {
  switch (type) {
    case "source": return 0;
    case "sink":   return 1;
    case "not":    return 1;
    case "and":
    case "or":     return 2;
  }
}

const adjacent = (a: Cell, b: Cell): boolean => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
const inBounds = (c: Cell, b: CircuitBoard): boolean => c.x >= 0 && c.y >= 0 && c.x < b.width && c.y < b.height;
const interior = (path: Cell[]): Cell[] => path.slice(1, -1);

/**
 * Validate a single wire against the board + already-placed connections.
 * Returns ok, or a reason string used both to reject the wire and to charge a "short".
 */
export function validateConnection(
  board: CircuitBoard,
  conn: Connection,
  existing: Connection[],
): Validation {
  const from = board.nodes.find((n) => n.id === conn.fromId);
  const to = board.nodes.find((n) => n.id === conn.toId);
  if (!from || !to) return { ok: false, reason: "unknown terminal" };
  if (from.type === "sink") return { ok: false, reason: "cannot draw from a sink" };
  if (to.type === "source") return { ok: false, reason: "cannot feed a source" };
  if (to.type === "sink" && to.requiresGate && from.type === "source") {
    return { ok: false, reason: "core won't accept a raw bus — route through the logic array" };
  }
  if (conn.toSlot < 0 || conn.toSlot >= inputSlotCount(to.type)) {
    return { ok: false, reason: "no such input slot" };
  }
  if (existing.some((e) => e.toId === conn.toId && e.toSlot === conn.toSlot)) {
    return { ok: false, reason: "input already wired" };
  }

  const { path } = conn;
  if (path.length < 2) return { ok: false, reason: "wire too short" };
  if (!cellsEqual(path[0], from.pos) || !cellsEqual(path[path.length - 1], to.pos)) {
    return { ok: false, reason: "wire must run end to end" };
  }
  for (let i = 0; i < path.length; i++) {
    if (!inBounds(path[i], board)) return { ok: false, reason: "off the board" };
    if (i > 0 && !adjacent(path[i - 1], path[i])) return { ok: false, reason: "wire must be continuous" };
    // self-intersection
    for (let j = 0; j < i; j++) if (cellsEqual(path[i], path[j])) return { ok: false, reason: "wire crosses itself" };
  }

  const nodeCells = board.nodes.map((n) => n.pos);
  const existingInterior = existing.flatMap((e) => interior(e.path));
  for (const c of interior(path)) {
    if (board.damaged.some((d) => cellsEqual(d, c))) return { ok: false, reason: "short: damaged trace" };
    if (nodeCells.some((p) => cellsEqual(p, c))) return { ok: false, reason: "short: runs through a node" };
    if (existingInterior.some((p) => cellsEqual(p, c))) return { ok: false, reason: "short: wires crossed" };
  }
  return { ok: true };
}

/**
 * Power state of every node given the placed connections. Sources are ON (unless dead),
 * gates compute from their wired inputs (unconnected input = OFF). Assumes an acyclic
 * board; iterates to a fixed point (depth ≤ node count).
 */
export function evaluate(board: CircuitBoard, connections: Connection[]): Map<string, boolean> {
  const values = new Map<string, boolean>();
  for (const n of board.nodes) values.set(n.id, n.type === "source" ? n.live !== false : false);

  const inputsOf = (nodeId: string): boolean[] => {
    const slots = inputSlotCount(board.nodes.find((n) => n.id === nodeId)!.type);
    const arr: boolean[] = new Array(slots).fill(false);
    for (const c of connections) {
      if (c.toId === nodeId && c.toSlot >= 0 && c.toSlot < slots) {
        arr[c.toSlot] = values.get(c.fromId) ?? false;
      }
    }
    return arr;
  };

  for (let iter = 0; iter <= board.nodes.length; iter++) {
    for (const n of board.nodes) {
      if (n.type === "source") continue;
      const ins = inputsOf(n.id);
      let v = false;
      switch (n.type) {
        case "sink": v = ins[0]; break;
        case "not":  v = !ins[0]; break;
        case "and":  v = ins.every(Boolean); break;
        case "or":   v = ins.some(Boolean); break;
      }
      values.set(n.id, v);
    }
  }
  return values;
}

/**
 * A board is solved when every connection is valid, no input slot is double-wired,
 * and every sink is powered.
 */
export function isBoardSolved(board: CircuitBoard, connections: Connection[]): boolean {
  const seen = new Set<string>();
  for (let i = 0; i < connections.length; i++) {
    const slotKey = `${connections[i].toId}#${connections[i].toSlot}`;
    if (seen.has(slotKey)) return false;
    seen.add(slotKey);
    if (!validateConnection(board, connections[i], connections.slice(0, i)).ok) return false;
  }
  const values = evaluate(board, connections);
  return board.nodes.filter((n) => n.type === "sink").every((s) => values.get(s.id) === true);
}

/** Reason an attempted wire shorts (charges fuel), or null if it's clean. */
export function shortReason(board: CircuitBoard, conn: Connection, existing: Connection[]): string | null {
  const v = validateConnection(board, conn, existing);
  return v.ok ? null : (v.reason ?? "short");
}

/**
 * Shortest valid orthogonal path from one node to another (BFS), avoiding damaged
 * cells, every other node, and existing wires' interiors. Returns the cell path
 * inclusive of both endpoints, or null if no route exists. Powers the click-to-route
 * interaction: the player picks two nodes, the ship finds the wire.
 */
export function findPath(
  board: CircuitBoard,
  fromId: string,
  toId: string,
  existing: Connection[],
): Cell[] | null {
  const from = board.nodes.find((n) => n.id === fromId);
  const to = board.nodes.find((n) => n.id === toId);
  if (!from || !to) return null;

  const key = (c: Cell) => `${c.x},${c.y}`;
  const blocked = new Set<string>();
  for (const d of board.damaged) blocked.add(key(d));
  for (const n of board.nodes) if (n.id !== fromId && n.id !== toId) blocked.add(key(n.pos));
  for (const e of existing) for (const c of interior(e.path)) blocked.add(key(c));

  const goal = key(to.pos);
  const start = from.pos;
  const queue: Cell[] = [start];
  const cameFrom = new Map<string, string>();
  const seen = new Set<string>([key(start)]);

  while (queue.length) {
    const cur = queue.shift()!;
    if (key(cur) === goal) {
      // reconstruct
      const path: Cell[] = [];
      let k: string | undefined = goal;
      while (k) {
        const [x, y] = k.split(",").map(Number);
        path.unshift({ x, y });
        k = cameFrom.get(k);
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nxt: Cell = { x: cur.x + dx, y: cur.y + dy };
      const nk = key(nxt);
      if (seen.has(nk)) continue;
      if (!inBounds(nxt, board)) continue;
      if (blocked.has(nk) && nk !== goal) continue;
      seen.add(nk);
      cameFrom.set(nk, key(cur));
      queue.push(nxt);
    }
  }
  return null;
}
