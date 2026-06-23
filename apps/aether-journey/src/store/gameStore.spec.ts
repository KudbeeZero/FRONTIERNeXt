import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "./gameStore";
import type { Connection } from "../lib/navCircuit";
import { allCodes, score, remainingCount, type Probe } from "../lib/beacon";
import { NAV_BEACON } from "../data/beacon";
import { DESCENT_STAGES } from "../lib/descent";

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

  it("completeTransit logs the payoff and advances — but does NOT end the run (Ch.3 follows)", () => {
    useGameStore.setState({ phase: "transit", navOnline: true, journeyResumed: false });
    const before = g().journeyProgress;
    g().completeTransit();
    expect(g().journeyProgress).toBeGreaterThan(before);
    expect(g().ledger.some((e) => e.kind === "TRANSIT_COMPLETE")).toBe(true);
    expect(g().journeyResumed).toBe(false); // terminus moved to concludeRun
  });

  it("concludeRun is the end-of-content terminus that surfaces the EndCard", () => {
    useGameStore.setState({ journeyResumed: false });
    g().concludeRun();
    expect(g().journeyResumed).toBe(true);
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

describe("gameStore — Chapter 3 power triage", () => {
  beforeEach(() => {
    useGameStore.setState({
      phase: "transit", dialogueIndex: 0, ledger: [],
      trust: 50, flags: [],
      systems: { power: 50, navigation: 50, lifeSupport: 50, aetherStability: 88 },
      containVesta: true, triageCommitted: false, trustSeeded: false,
      triageAllocation: { lifeSupport: 0, comms: 0, aetherCore: 0 },
    });
  });

  it("beginMutiny enters the briefing and seeds trust from stability", () => {
    g().beginMutiny();
    expect(g().phase).toBe("mutiny");
    expect(g().trust).toBe(88); // seeded — trust hasn't been seeded before
    expect(g().trustSeeded).toBe(true);
  });

  it("does not reseed trust once it has been seeded (no clobber of a diverged value)", () => {
    // A decision moved trust without setting a flag; seeding must not overwrite it.
    useGameStore.setState({ trustSeeded: true, trust: 40 });
    g().beginMutiny();
    expect(g().trust).toBe(40);
  });

  it("enterTriage opens the board in a valid, committable state", () => {
    g().enterTriage();
    expect(g().phase).toBe("triage");
    expect(g().commitTriage().ok).toBe(true); // balanced default is within budget
  });

  it("committing a valid allocation that keeps her whole raises trust + advances", () => {
    g().beginMutiny(); // trust → 88
    g().enterTriage();
    g().setAllocation({ lifeSupport: 2, comms: 2, aetherCore: 4 }); // 8 == contained bus
    const r = g().commitTriage();
    expect(r.ok).toBe(true);
    expect(g().phase).toBe("aftermath");
    expect(g().triageCommitted).toBe(true);
    expect(g().trust).toBe(96); // +8 for a nominal core
    expect(g().flags).toContain("vesta_contained");
    const kinds = g().ledger.map((e) => e.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(["POWER_ALLOCATED", "VESTA_CONTAINED", "DECISION_MADE", "TRUST_SHIFT"]),
    );
  });

  it("rejects an over-budget allocation without changing trust or phase", () => {
    g().beginMutiny();
    g().enterTriage();
    g().setAllocation({ lifeSupport: 4, comms: 3, aetherCore: 4 }); // 11 > 8
    const r = g().commitTriage();
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
    expect(g().phase).toBe("triage"); // not advanced
    expect(g().trust).toBe(88); // unchanged
    expect(g().triageCommitted).toBe(false);
  });

  it("sacrificing her core is the big negative swing + fragments her", () => {
    g().beginMutiny(); // 88
    g().enterTriage();
    g().setAllocation({ lifeSupport: 4, comms: 3, aetherCore: 1 }); // core critical
    const r = g().commitTriage();
    expect(r.ok).toBe(true);
    expect(g().trust).toBe(76); // -12
    expect(g().flags).toEqual(expect.arrayContaining(["aether_starved", "sacrificed_aether"]));
    expect(g().aetherMood).toBe("fragmented");
  });

  it("is idempotent — a second commit re-applies nothing and doesn't duplicate the ledger", () => {
    g().beginMutiny();
    g().enterTriage();
    g().setAllocation({ lifeSupport: 2, comms: 2, aetherCore: 4 });
    expect(g().commitTriage().ok).toBe(true);
    const trustAfter = g().trust;
    const ledgerLen = g().ledger.length;

    const second = g().commitTriage();
    expect(second.ok).toBe(false); // guarded by triageCommitted
    expect(g().trust).toBe(trustAfter); // trust shift NOT re-applied
    expect(g().ledger.length).toBe(ledgerLen); // no duplicate ledger entries
  });
});

describe("gameStore — Chapter 4 signal decode", () => {
  const { secret, length: L, palette: P } = NAV_BEACON;

  // Build a NON-exact probe history that uniquely pins the secret (so Aether's
  // proposal becomes the secret without us pre-solving it).
  const pinningHistory = (): Probe[] => {
    const hist: Probe[] = [];
    for (const gcode of allCodes(L, P)) {
      if (gcode.every((v, i) => v === secret[i])) continue; // never the exact secret
      hist.push({ guess: gcode, score: score(gcode, secret) });
      if (remainingCount(hist, L, P) === 1) break;
    }
    return hist;
  };

  beforeEach(() => {
    useGameStore.setState({
      phase: "aftermath", dialogueIndex: 0, ledger: [],
      trust: 50, flags: [], trustSeeded: true,
      probes: [], signalLocked: false,
    });
  });

  it("beginBlackout enters the briefing with a fresh board", () => {
    useGameStore.setState({ probes: [{ guess: [0, 0, 0, 0], score: { exact: 0, partial: 0 } }] });
    g().beginBlackout();
    expect(g().phase).toBe("blackout");
    expect(g().probes).toHaveLength(0);
    expect(g().signalLocked).toBe(false);
  });

  it("a non-solving probe records feedback + logs PROBE_SENT, no lock", () => {
    g().enterDecode();
    const r = g().submitProbe([0, 0, 0, 0]); // all-absent glyphs vs secret
    expect(r.solved).toBe(false);
    expect(g().probes).toHaveLength(1);
    expect(g().signalLocked).toBe(false);
    expect(g().ledger.some((e) => e.kind === "PROBE_SENT")).toBe(true);
  });

  it("an exact solo probe locks the signal (+4 trust, solo_decode)", () => {
    g().enterDecode();
    const r = g().submitProbe([...secret]);
    expect(r.solved).toBe(true);
    expect(g().signalLocked).toBe(true);
    expect(g().phase).toBe("fix");
    expect(g().trust).toBe(54); // +4
    expect(g().flags).toContain("solo_decode");
    expect(g().ledger.some((e) => e.kind === "SIGNAL_LOCKED")).toBe(true);
  });

  it("accepting Aether's read when it's right is the trust beat (+9, trusted_aether)", () => {
    // Pin the secret with non-exact probes so her proposal == secret, low uncertainty.
    useGameStore.setState({ probes: pinningHistory() });
    const r = g().acceptAetherProposal();
    expect(r.solved).toBe(true);
    expect(r.blind).toBe(false); // only the secret remained → not a blind leap
    expect(g().signalLocked).toBe(true);
    expect(g().trust).toBe(59); // +9
    expect(g().flags).toContain("trusted_aether");
  });

  it("accepting her read while still uncertain does not lock if she's wrong", () => {
    // Empty history → her proposal is the first consistent code, almost surely not the secret.
    g().enterDecode();
    const r = g().acceptAetherProposal();
    expect(r.blind).toBe(true); // whole space still open
    expect(r.solved).toBe(false);
    expect(g().signalLocked).toBe(false);
    expect(g().trust).toBe(50); // no trust change on a non-locking read
  });

  it("is idempotent — no probes accepted after the signal is locked", () => {
    g().enterDecode();
    g().submitProbe([...secret]); // locks
    const ledgerLen = g().ledger.length;
    const trustAfter = g().trust;
    expect(g().submitProbe([0, 1, 2, 3]).locked).toBe(true);
    expect(g().acceptAetherProposal().locked).toBe(true);
    expect(g().ledger.length).toBe(ledgerLen);
    expect(g().trust).toBe(trustAfter);
  });
});

describe("gameStore — Chapter 5 descent (finale)", () => {
  beforeEach(() => {
    useGameStore.setState({
      phase: "fix", dialogueIndex: 0, ledger: [],
      trust: 80, flags: [],
      stageIndex: 0, stageFails: 0, ending: null,
    });
  });

  it("beginDescent enters the burn with a reset sequence", () => {
    useGameStore.setState({ stageIndex: 3, stageFails: 2 });
    g().beginDescent();
    expect(g().phase).toBe("descent");
    expect(g().stageIndex).toBe(0);
    expect(g().stageFails).toBe(0);
    expect(g().ending).toBeNull();
  });

  it("passStage advances through the sequence, logging each clear", () => {
    g().beginDescent();
    g().passStage();
    expect(g().stageIndex).toBe(1);
    expect(g().ledger.filter((e) => e.kind === "STAGE_PASSED")).toHaveLength(1);
  });

  it("failStage retries in place (no advance) and counts the fail", () => {
    g().beginDescent();
    g().passStage(); // at stage 1
    g().failStage();
    expect(g().stageIndex).toBe(1); // did NOT advance
    expect(g().stageFails).toBe(1);
    expect(g().ledger.some((e) => e.kind === "STAGE_FAILED")).toBe(true);
  });

  it("passing the last stage completes the descent and resolves the ending", () => {
    g().beginDescent();
    for (let i = 0; i < DESCENT_STAGES.length; i++) g().passStage();
    expect(g().phase).toBe("arrival");
    expect(g().ending).toBe("bonded"); // trust 80, no flags
    expect(g().ledger.some((e) => e.kind === "DESCENT_COMPLETE")).toBe(true);
  });

  it("the ending honors the accumulated flags (sacrifice → severance)", () => {
    useGameStore.setState({ trust: 90, flags: ["sacrificed_aether"] });
    g().beginDescent();
    for (let i = 0; i < DESCENT_STAGES.length; i++) g().passStage();
    expect(g().ending).toBe("severance"); // override beats high trust
  });

  it("stage actions no-op once the descent is over (idempotent)", () => {
    g().beginDescent();
    for (let i = 0; i < DESCENT_STAGES.length; i++) g().passStage(); // → arrival
    const ledgerLen = g().ledger.length;
    g().passStage();
    g().failStage();
    expect(g().ledger.length).toBe(ledgerLen); // guarded by phase !== "descent"
  });

  it("completeDescent does not double-resolve if called again directly", () => {
    g().beginDescent();
    for (let i = 0; i < DESCENT_STAGES.length; i++) g().passStage(); // → arrival
    const ledgerLen = g().ledger.length;
    g().completeDescent(); // direct re-call — guarded
    expect(g().ledger.filter((e) => e.kind === "DESCENT_COMPLETE")).toHaveLength(1);
    expect(g().ledger.length).toBe(ledgerLen);
  });
});
