import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "./gameStore";
import type { Connection } from "../lib/navCircuit";

const conn = (id: string, fromId: string, toId: string, toSlot: number, path: [number, number][]): Connection => ({
  id, fromId, toId, toSlot, path: path.map(([x, y]) => ({ x, y })),
});

// Reference solutions (mirror navCircuit.spec.ts).
const S1_A = conn("a", "s1", "k1", 0, [[0,0],[1,0],[2,0],[2,1],[3,1],[4,1],[4,0],[5,0],[6,0]]);
const S1_B = conn("b", "s2", "k2", 0, [[0,4],[1,4],[2,4],[2,3],[3,3],[4,3],[4,4],[5,4],[6,4]]);
const S2_A = conn("a", "sA", "g2", 0, [[0,1],[1,1],[2,1],[3,1],[4,1],[4,2],[4,3]]);
const S2_B = conn("b", "sB", "g2", 1, [[0,5],[1,5],[2,5],[3,5],[4,5],[4,4],[4,3]]);
const S2_G = conn("g", "g2", "k1", 0, [[4,3],[5,3],[6,3]]);

const g = () => useGameStore.getState();

describe("gameStore — Chapter 2 nav-circuit flow", () => {
  beforeEach(() => {
    useGameStore.setState({
      phase: "stabilized", dialogueIndex: 0,
      navStage: 1, navConnections: [], navFuel: 0, navOnline: false,
      ledger: [], journeyResumed: false, journeyProgress: 0.34,
    });
  });

  it("beginApproach → approach phase", () => {
    g().beginApproach();
    expect(g().phase).toBe("approach");
  });

  it("enterRewiring seeds stage 1 with full fuel and no wires", () => {
    g().enterRewiring();
    expect(g().phase).toBe("rewiring");
    expect(g().navStage).toBe(1);
    expect(g().navConnections).toHaveLength(0);
    expect(g().navFuel).toBe(100); // STAGE_1_POWER.fuelBudget
  });

  it("a short is rejected and vents fuel (soft cost, no hard fail)", () => {
    g().enterRewiring();
    const before = g().navFuel;
    const damaged = conn("x", "s1", "k1", 0, [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0]]); // through (3,0)
    const res = g().addNavConnection(damaged);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/damaged/);
    expect(g().navFuel).toBe(before - 8); // STAGE_1_POWER.shortCost
    expect(g().navConnections).toHaveLength(0); // not added
  });

  it("solving stage 1 advances to stage 2 with a fresh board + fuel", () => {
    g().enterRewiring();
    expect(g().addNavConnection(S1_A).ok).toBe(true);
    expect(g().navStage).toBe(1); // not solved yet
    expect(g().addNavConnection(S1_B).ok).toBe(true);
    expect(g().navStage).toBe(2);
    expect(g().navConnections).toHaveLength(0); // board reset
    expect(g().navFuel).toBe(80); // STAGE_2_LOGIC.fuelBudget
    expect(g().ledger.some((e) => e.kind === "NAV_STAGE_CLEARED")).toBe(true);
  });

  it("solving stage 2 brings nav online and enters transit", () => {
    g().enterRewiring();
    g().addNavConnection(S1_A); g().addNavConnection(S1_B); // clear stage 1
    g().addNavConnection(S2_A);
    g().addNavConnection(S2_B);
    expect(g().phase).toBe("rewiring"); // not solved until the gate feeds the core
    g().addNavConnection(S2_G);
    expect(g().navOnline).toBe(true);
    expect(g().phase).toBe("transit");
    expect(g().ledger.filter((e) => e.kind === "NAV_STAGE_CLEARED")).toHaveLength(2);
    expect(g().ledger.some((e) => e.kind === "NAV_ONLINE")).toBe(true);
  });

  it("completeTransit logs the payoff and resumes the journey", () => {
    useGameStore.setState({ phase: "transit", navOnline: true });
    const before = g().journeyProgress;
    g().completeTransit();
    expect(g().journeyResumed).toBe(true);
    expect(g().journeyProgress).toBeGreaterThan(before);
    expect(g().ledger.some((e) => e.kind === "TRANSIT_COMPLETE")).toBe(true);
  });

  it("clearNavBoard wipes wires but keeps drift/fuel", () => {
    g().enterRewiring();
    g().addNavConnection(S1_A);
    const fuel = g().navFuel;
    g().clearNavBoard();
    expect(g().navConnections).toHaveLength(0);
    expect(g().navFuel).toBe(fuel);
  });
});

describe("gameStore — decision system", () => {
  beforeEach(() => {
    useGameStore.setState({
      trust: 50, flags: [], ledger: [],
      systems: { power: 50, navigation: 50, lifeSupport: 50, aetherStability: 88 },
    });
  });

  it("seedTrustFromStability seeds trust from Aether's stability", () => {
    g().seedTrustFromStability();
    expect(g().trust).toBe(88);
  });

  it("makeChoice applies trust + flags and logs DECISION_MADE + TRUST_SHIFT", () => {
    g().makeChoice("d1", { id: "give", label: "Give Aether the power", trust: 12, flags: ["chose_aether"] });
    expect(g().trust).toBe(62);
    expect(g().flags).toContain("chose_aether");
    expect(g().ledger.some((e) => e.kind === "DECISION_MADE")).toBe(true);
    expect(g().ledger.some((e) => e.kind === "TRUST_SHIFT")).toBe(true);
  });

  it("makeChoice with no trust delta logs the decision but no TRUST_SHIFT", () => {
    g().makeChoice("d2", { id: "neutral", label: "Wait" });
    expect(g().trust).toBe(50);
    expect(g().ledger.some((e) => e.kind === "DECISION_MADE")).toBe(true);
    expect(g().ledger.some((e) => e.kind === "TRUST_SHIFT")).toBe(false);
  });
});
