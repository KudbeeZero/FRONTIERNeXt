// ---------------------------------------------------------------------------
// Shared game types.
//
// These are intentionally framed so they can later be serialized and recorded
// on-chain (Algorand boxes / ASAs) without reshaping the runtime model. Every
// player-meaningful action emits an `OnchainEvent`; in Phase 1 these are logged
// client-side, but the shape mirrors what a TEALScript box record would hold.
// ---------------------------------------------------------------------------

/** High-level scene the player is currently in. Drives cinematic gating. */
export type Phase =
  | "idle" // pre-interaction: waiting for the player to "wake" (audio gesture gate)
  | "waking" // fade-from-black, first contact with a damaged Aether
  | "diagnostic" // objective: scan Aether to surface the neural fault
  | "repair" // hands-on: realign the neural matrix nodes
  | "stabilized" // Ch.1 payoff: Aether restored, course to Mars locked
  // ── Chapter 2 — The Debris Field ──────────────────────────────────────────
  | "approach" // proximity alarm + briefing: the nav computer can't autopilot the field
  | "rewiring" // hands-on: the two-stage nav-circuit reroute puzzle
  | "transit" // resolve: the ship flies the restored course through the field
  // ── Chapter 3 — The Quiet Mutiny ──────────────────────────────────────────
  | "mutiny" // briefing: VESTA wakes corrupted and clamps power from Aether
  | "triage" // hands-on: allocate the scarce power bus across the three consumers
  | "aftermath" // resolve: the cost of the choice lands; trust has shifted
  // ── Chapter 4 — Blackout ──────────────────────────────────────────────────
  | "blackout" // briefing: comms dead zone; the beacon signal is degraded
  | "decode" // hands-on: deduce the beacon code from partial feedback
  | "fix" // resolve: position fixed, set up the Ch.5 descent
  // ── Chapter 5 — Descent (finale) ──────────────────────────────────────────
  | "descent" // hands-on: the staged insertion burn, recombining prior verbs
  | "arrival"; // resolve: touchdown → the ending

/** The four load-bearing ship subsystems shown on the status HUD (0–100). */
export interface ShipSystems {
  power: number;
  navigation: number;
  lifeSupport: number;
  aetherStability: number;
}

/** Aether's emotional/operational register — modulates dialogue + glitch FX. */
export type AetherMood = "fragmented" | "wounded" | "focused" | "hopeful" | "stable";

/**
 * One choice at a decision point. Effects are data so the whole branching model is
 * authorable + serializable (on-chain-ready) and testable as a pure function.
 */
export interface DecisionOption {
  id: string;
  label: string;
  /** Trust delta applied when chosen (may be negative). */
  trust?: number;
  /** Story flags set when chosen (drive later dialogue / endings). */
  flags?: string[];
  /** Ship-system deltas applied when chosen. */
  systems?: Partial<ShipSystems>;
  /** Short consequence line surfaced after the choice. */
  outcome?: string;
}

/** A branch point: a prompt and its mutually-exclusive options. */
export interface DecisionPoint {
  id: string;
  prompt: string;
  options: DecisionOption[];
}

/**
 * A player action worth remembering. In Phase 1 these live in memory; the field
 * shape is deliberately on-chain-ready (kind + payload + monotonic seq + ts) so
 * a later phase can flush them to an Algorand box / emit ASA rewards verbatim.
 */
export interface OnchainEvent {
  seq: number;
  ts: number;
  kind:
    | "AWAKENING"
    | "DIAGNOSTIC_RUN"
    | "NODE_ALIGNED"
    | "AETHER_STABILIZED"
    | "SYSTEM_RESTORED"
    // ── Chapter 2 ──
    | "NAV_STAGE_CLEARED"
    | "NAV_ONLINE"
    | "TRANSIT_COMPLETE"
    // ── Decision system (Ch.3+) ──
    | "DECISION_MADE"
    | "TRUST_SHIFT"
    // ── Chapter 3 ──
    | "POWER_ALLOCATED"
    | "VESTA_CONTAINED"
    | "RESOURCE_SPENT"
    // ── Chapter 4 ──
    | "PROBE_SENT"
    | "SIGNAL_LOCKED"
    // ── Chapter 5 ──
    | "STAGE_PASSED"
    | "STAGE_FAILED"
    | "DESCENT_COMPLETE";
  label: string;
  /** Free-form, JSON-serializable detail (future: ASA id, reward amounts, etc.). */
  payload?: Record<string, number | string | boolean>;
}
