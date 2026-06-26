/**
 * shared/battleObjective.ts
 *
 * The "AI Battle Test" framing: when you pick a faction you get a designated
 * RIVAL and a clear objective — dismantle their outposts. Pure + deterministic so
 * the mission briefing (shown on the faction-select gate) and any future live
 * progress HUD compute identically. No I/O, no funds — just the rivalry map +
 * objective state math.
 */
import { isValidFactionId, type PlayerFactionId } from "./waitlist";

/**
 * Designated rivalries (symmetric). NEXUS-7 ↔ KRONOS mirrors the engine's
 * KRONOS-suppresses-NEXUS-7 logic; VANGUARD (raider) ↔ SPECTRE (economic) are
 * temperamental opposites.
 */
const RIVALS: Record<PlayerFactionId, PlayerFactionId> = {
  "NEXUS-7": "KRONOS",
  "KRONOS": "NEXUS-7",
  "VANGUARD": "SPECTRE",
  "SPECTRE": "VANGUARD",
};

/** The faction you're pitted against. Null for an unknown faction. */
export function rivalOf(faction: string): PlayerFactionId | null {
  return isValidFactionId(faction) ? RIVALS[faction] : null;
}

export interface MissionBriefing {
  faction: PlayerFactionId;
  rival: PlayerFactionId;
  headline: string;
  objective: string;
}

/** Mission briefing shown when a player aligns with a faction. Null if unknown. */
export function missionBriefing(faction: string): MissionBriefing | null {
  if (!isValidFactionId(faction)) return null;
  const rival = RIVALS[faction];
  return {
    faction,
    rival,
    headline: `${faction} vs ${rival}`,
    objective: `Dismantle every ${rival} outpost. Take the frontier.`,
  };
}

export type ObjectiveStatus = "active" | "won" | "lost";

export interface ObjectiveState {
  status: ObjectiveStatus;
  /** 0→1 toward victory (rival outposts cleared). */
  progress: number;
  headline: string;
}

/**
 * Evaluate objective progress against a rival's outpost count. Win = rival driven
 * to zero. Lost = the rival has overrun you (grown to ≥2× their start AND you hold
 * nothing). Otherwise active, with progress = fraction of the rival's starting
 * outposts you've cleared. Defensive against bad inputs (negative / zero start).
 */
export function evaluateObjective(input: {
  rivalStart: number;
  rivalNow: number;
  playerNow: number;
}): ObjectiveState {
  const start = Math.max(0, Math.floor(input.rivalStart));
  const now = Math.max(0, Math.floor(input.rivalNow));
  const player = Math.max(0, Math.floor(input.playerNow));

  if (now <= 0) return { status: "won", progress: 1, headline: "Rival eliminated — frontier secured." };
  if (player <= 0 && start > 0 && now >= start * 2) {
    return { status: "lost", progress: 0, headline: "Overrun — the rival holds the frontier." };
  }

  const cleared = start > 0 ? Math.min(1, Math.max(0, (start - now) / start)) : 0;
  return {
    status: "active",
    progress: cleared,
    headline: `${now} rival outpost${now === 1 ? "" : "s"} remaining`,
  };
}
