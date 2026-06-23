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
  | "transit"; // resolve: the ship flies the restored course through the field

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
    | "TRANSIT_COMPLETE";
  label: string;
  /** Free-form, JSON-serializable detail (future: ASA id, reward amounts, etc.). */
  payload?: Record<string, number | string | boolean>;
}
