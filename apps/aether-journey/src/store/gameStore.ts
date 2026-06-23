import { create } from "zustand";
import type { AetherMood, OnchainEvent, Phase, ShipSystems } from "./types";
import { boardForStage } from "../data/circuits";
import { isBoardSolved, shortReason, type Connection } from "../lib/navCircuit";
import { applyOption, seedTrust } from "../lib/decisions";
import {
  resolveTriage,
  balancedAllocation,
  type Allocation,
} from "../lib/powerTriage";
import { VESTA_TRIAGE } from "../data/triage";
import type { DecisionOption } from "./types";

// ---------------------------------------------------------------------------
// Central game store (zustand).
//
// One small, flat store holds the whole Phase-1 session. Components subscribe
// to the slices they care about. The store is the canonical record of player
// progress — structured so a future phase can serialize it straight onto
// Algorand without reshaping anything (see types.ts).
// ---------------------------------------------------------------------------

const TOTAL_REPAIR_NODES = 4;

interface GameState {
  phase: Phase;
  systems: ShipSystems;
  /** 0..1 progress of the Aether Voyager toward Mars. */
  journeyProgress: number;

  aetherMood: AetherMood;
  /** True while Aether is "speaking" — UI uses this to drive glitch FX. */
  aetherSpeaking: boolean;

  /** Index into the active dialogue track (see data/dialogue.ts). */
  dialogueIndex: number;

  /** How many neural nodes the player has realigned during the repair task. */
  nodesAligned: number;
  totalNodes: number;

  /** Append-only audited action log (on-chain-ready). */
  ledger: OnchainEvent[];

  /** Set once the player chooses to continue past the Phase-1 payoff. */
  journeyResumed: boolean;

  // --- Chapter 2: nav-circuit reroute --------------------------------------
  /** Active board stage (1 = power routing, 2 = logic restoration). */
  navStage: number;
  /** Wires laid on the current board. */
  navConnections: Connection[];
  /** Drift/fuel remaining on the current board. */
  navFuel: number;
  /** True once both stages are solved (nav core back online). */
  navOnline: boolean;

  // --- Decision system (Ch.3+) ---------------------------------------------
  /** Persistent trust axis (0–100), seeded from Aether's healed stability. */
  trust: number;
  /** Story flags set by decisions; drive later dialogue + the ending. */
  flags: string[];

  // --- Chapter 3: power triage ---------------------------------------------
  /** Working allocation of the power bus across the three consumers. */
  triageAllocation: Allocation;
  /** Whether VESTA is locked off the bus (costs units) or left loose (drains). */
  containVesta: boolean;
  /** True once the triage has been committed (locks the choice + trust shift). */
  triageCommitted: boolean;

  // --- actions -------------------------------------------------------------
  begin: () => void;
  setPhase: (phase: Phase) => void;
  setAetherSpeaking: (speaking: boolean) => void;
  setAetherMood: (mood: AetherMood) => void;
  advanceDialogue: () => void;
  resetDialogue: () => void;

  enterDiagnostic: () => void;
  enterRepair: () => void;
  alignNode: () => void;
  setSystem: (key: keyof ShipSystems, value: number) => void;

  // Chapter 2 transitions
  beginApproach: () => void;
  enterRewiring: () => void;
  /** Attempt to lay a wire. Returns ok, or a short reason (and charges fuel). */
  addNavConnection: (conn: Connection) => { ok: boolean; reason?: string };
  /** Clear the current board's wires to retry (drift/fuel is permanent). */
  clearNavBoard: () => void;
  completeTransit: () => void;

  // Decision system
  /** Seed trust from Aether's current healed stability (call entering Ch.3). */
  seedTrustFromStability: () => void;
  /** Apply a chosen option: shift trust, set flags + systems, log it. */
  makeChoice: (decisionId: string, option: DecisionOption) => void;

  // Chapter 3 transitions
  /** Enter the Ch.3 briefing (from Ch.2 transit) and seed trust from stability. */
  beginMutiny: () => void;
  /** Open the power-triage board. */
  enterTriage: () => void;
  /** Set the working allocation (live preview; not yet committed). */
  setAllocation: (allocation: Allocation) => void;
  /** Toggle whether VESTA is contained (changes the available bus). */
  toggleContainVesta: () => void;
  /**
   * Commit the current allocation: applies the trust shift + flags via the
   * decision path and advances to aftermath. Rejected (returns a reason) if the
   * allocation is invalid (overspent / negative).
   */
  commitTriage: () => { ok: boolean; reason?: string };

  logOnchain: (event: Omit<OnchainEvent, "seq" | "ts">) => void;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export const useGameStore = create<GameState>((set, get) => ({
  phase: "idle",
  // The ship has already been through hell — systems are stressed but holding.
  systems: {
    power: 58,
    navigation: 41,
    lifeSupport: 72,
    aetherStability: 17, // critically low: Aether is hurt
  },
  journeyProgress: 0.34,

  aetherMood: "fragmented",
  aetherSpeaking: false,

  dialogueIndex: 0,

  nodesAligned: 0,
  totalNodes: TOTAL_REPAIR_NODES,

  ledger: [],

  journeyResumed: false,

  navStage: 1,
  navConnections: [],
  navFuel: 0,
  navOnline: false,

  trust: 50,
  flags: [],

  // Default to a balanced, contained allocation so the board opens in a legal state.
  triageAllocation: balancedAllocation(VESTA_TRIAGE, true),
  containVesta: true,
  triageCommitted: false,

  begin: () => {
    set({ phase: "waking", dialogueIndex: 0 });
    get().logOnchain({
      kind: "AWAKENING",
      label: "Cryo-wake confirmed — operator conscious",
      payload: { aetherStability: get().systems.aetherStability },
    });
  },

  setPhase: (phase) => set({ phase }),
  setAetherSpeaking: (speaking) => set({ aetherSpeaking: speaking }),
  setAetherMood: (mood) => set({ aetherMood: mood }),

  advanceDialogue: () => set((s) => ({ dialogueIndex: s.dialogueIndex + 1 })),
  resetDialogue: () => set({ dialogueIndex: 0 }),

  enterDiagnostic: () => {
    set({ aetherMood: "focused", phase: "diagnostic", dialogueIndex: 0 });
    get().logOnchain({
      kind: "DIAGNOSTIC_RUN",
      label: "Neural matrix diagnostic complete — fault isolated",
      payload: { faultNodes: TOTAL_REPAIR_NODES },
    });
  },

  enterRepair: () => set({ phase: "repair", dialogueIndex: 0, aetherMood: "focused" }),

  alignNode: () => {
    const next = Math.min(get().totalNodes, get().nodesAligned + 1);
    // Each realigned node measurably heals Aether and steadies the ship.
    const stabilityGain = Math.round(70 / get().totalNodes);
    set((s) => ({
      nodesAligned: next,
      systems: {
        ...s.systems,
        aetherStability: clamp(s.systems.aetherStability + stabilityGain),
      },
    }));
    get().logOnchain({
      kind: "NODE_ALIGNED",
      label: `Neural node ${next}/${get().totalNodes} realigned`,
      payload: { node: next, aetherStability: get().systems.aetherStability },
    });

    if (next >= get().totalNodes) {
      // Full repair: Aether comes back online, power & nav recover with her.
      set((s) => ({
        aetherMood: "hopeful",
        systems: {
          ...s.systems,
          aetherStability: clamp(Math.max(s.systems.aetherStability, 88)),
          power: clamp(s.systems.power + 22),
          navigation: clamp(s.systems.navigation + 31),
        },
        phase: "stabilized",
        dialogueIndex: 0,
      }));
      get().logOnchain({
        kind: "AETHER_STABILIZED",
        label: "Aether neural matrix stabilized — companion restored",
        payload: { aetherStability: get().systems.aetherStability },
      });
      get().logOnchain({
        kind: "SYSTEM_RESTORED",
        label: "Navigation & power rerouted through Aether — course to Mars locked",
        payload: {
          navigation: get().systems.navigation,
          power: get().systems.power,
        },
      });
    }
  },

  setSystem: (key, value) =>
    set((s) => ({ systems: { ...s.systems, [key]: clamp(value) } })),

  // ── Chapter 2 — The Debris Field ─────────────────────────────────────────
  beginApproach: () => set({ phase: "approach", dialogueIndex: 0, aetherMood: "focused" }),

  enterRewiring: () => {
    const board = boardForStage(1);
    set({
      phase: "rewiring",
      dialogueIndex: 0,
      aetherMood: "focused",
      navStage: 1,
      navConnections: [],
      navFuel: board.fuelBudget,
    });
  },

  addNavConnection: (conn) => {
    const stage = get().navStage;
    const board = boardForStage(stage);
    const reason = shortReason(board, conn, get().navConnections);
    if (reason) {
      // A short is rejected AND vents drift/fuel — soft cost, never a hard fail.
      set((s) => ({ navFuel: Math.max(0, s.navFuel - board.shortCost) }));
      return { ok: false, reason };
    }
    const next = [...get().navConnections, conn];
    set({ navConnections: next });

    if (isBoardSolved(board, next)) {
      get().logOnchain({
        kind: "NAV_STAGE_CLEARED",
        label: `${board.title} restored`,
        payload: { stage, fuel: get().navFuel },
      });
      if (stage === 1) {
        const b2 = boardForStage(2);
        set({ navStage: 2, navConnections: [], navFuel: b2.fuelBudget });
      } else {
        get().logOnchain({
          kind: "NAV_ONLINE",
          label: "Nav core back online — trajectory through the field solved",
          payload: { fuel: get().navFuel },
        });
        set({ phase: "transit", navOnline: true, dialogueIndex: 0, aetherMood: "hopeful" });
      }
    }
    return { ok: true };
  },

  clearNavBoard: () => set({ navConnections: [] }),

  completeTransit: () => {
    get().logOnchain({
      kind: "TRANSIT_COMPLETE",
      label: "Cleared the debris field — Mars approach nominal",
      payload: { fuel: get().navFuel },
    });
    set((s) => ({
      aetherMood: "stable",
      journeyResumed: true,
      journeyProgress: Math.min(1, s.journeyProgress + 0.12),
    }));
  },

  // ── Decision system ──────────────────────────────────────────────────────
  seedTrustFromStability: () => set((s) => ({ trust: seedTrust(s.systems.aetherStability) })),

  makeChoice: (decisionId, option) => {
    const s = get();
    const before = s.trust;
    const next = applyOption(
      { trust: s.trust, flags: new Set(s.flags), systems: s.systems },
      option,
    );
    set({ trust: next.trust, flags: Array.from(next.flags), systems: next.systems });
    get().logOnchain({
      kind: "DECISION_MADE",
      label: option.label,
      payload: { decision: decisionId, option: option.id },
    });
    if (next.trust !== before) {
      get().logOnchain({
        kind: "TRUST_SHIFT",
        label: `Trust ${next.trust >= before ? "+" : ""}${next.trust - before} → ${next.trust}`,
        payload: { trust: next.trust, delta: next.trust - before },
      });
    }
  },

  // ── Chapter 3 — The Quiet Mutiny ─────────────────────────────────────────
  beginMutiny: () => {
    // Ch.3 is where carried-over trust starts to matter — seed it from how whole
    // Aether came out of Ch.1 if it hasn't diverged yet.
    set((s) => ({
      phase: "mutiny",
      dialogueIndex: 0,
      aetherMood: "wounded",
      trust: s.flags.length === 0 ? seedTrust(s.systems.aetherStability) : s.trust,
    }));
  },

  enterTriage: () =>
    set({ phase: "triage", dialogueIndex: 0, aetherMood: "focused", triageCommitted: false }),

  setAllocation: (allocation) => set({ triageAllocation: allocation }),

  toggleContainVesta: () => set((s) => ({ containVesta: !s.containVesta })),

  commitTriage: () => {
    const s = get();
    const outcome = resolveTriage(VESTA_TRIAGE, s.triageAllocation, s.containVesta);
    if (!outcome.valid) {
      return { ok: false, reason: "Over the power budget — pull units back first." };
    }

    get().logOnchain({
      kind: "POWER_ALLOCATED",
      label: `Power triaged — bus ${outcome.used}/${outcome.available} drawn`,
      payload: { ...outcome.allocation, remaining: outcome.remaining },
    });
    if (s.containVesta) {
      get().logOnchain({
        kind: "VESTA_CONTAINED",
        label: "VESTA locked off the bus",
        payload: { cost: VESTA_TRIAGE.containCost },
      });
    }

    // Route the trust shift + consequence flags through the tested decision path.
    get().makeChoice("ch3_triage", {
      id: s.containVesta ? "contain" : "loose",
      label: "Power triage committed",
      trust: outcome.trustDelta,
      flags: outcome.flags,
    });

    set({
      triageCommitted: true,
      phase: "aftermath",
      dialogueIndex: 0,
      // Aether's register reflects whether you kept her whole.
      aetherMood: outcome.tiers.aetherCore === "critical" ? "fragmented" : "hopeful",
    });
    return { ok: true };
  },

  logOnchain: (event) =>
    set((s) => ({
      ledger: [
        ...s.ledger,
        { ...event, seq: s.ledger.length + 1, ts: Date.now() },
      ],
    })),
}));
