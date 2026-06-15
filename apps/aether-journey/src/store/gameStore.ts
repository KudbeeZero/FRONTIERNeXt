import { create } from "zustand";
import type { AetherMood, OnchainEvent, Phase, ShipSystems } from "./types";

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
  resumeJourney: () => void;

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

  resumeJourney: () =>
    set((s) => ({
      aetherMood: "stable",
      journeyResumed: true,
      // First leg of the healed journey toward Mars.
      journeyProgress: Math.min(1, s.journeyProgress + 0.08),
    })),

  logOnchain: (event) =>
    set((s) => ({
      ledger: [
        ...s.ledger,
        { ...event, seq: s.ledger.length + 1, ts: Date.now() },
      ],
    })),
}));
