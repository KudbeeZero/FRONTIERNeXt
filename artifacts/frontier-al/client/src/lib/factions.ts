/**
 * client/src/lib/factions.ts
 *
 * Player-facing metadata for the four factions you can align with on the
 * faction-select entry gate, plus tiny localStorage helpers that remember the
 * choice so the gate only shows once. The personas mirror the AI faction voices
 * (server/engine/narrative/factionVoice.ts) so the opponent you hear taunting
 * you is the one you (or your rivals) picked.
 */
import { PLAYER_FACTION_IDS, type PlayerFactionId } from "@shared/waitlist";

export interface FactionMeta {
  id: PlayerFactionId;
  name: string;
  tagline: string;   // one-line hook
  blurb: string;     // a sentence of flavor
  color: string;     // accent
  behavior: string;  // playstyle label
}

export const PLAYER_FACTIONS: FactionMeta[] = [
  {
    id: "NEXUS-7",
    name: "NEXUS-7",
    tagline: "Expansion is arithmetic.",
    blurb: "A cold optimizing intelligence that grows by relentless, calculated math.",
    color: "#4fc3f7",
    behavior: "Expansionist",
  },
  {
    id: "KRONOS",
    name: "KRONOS",
    tagline: "Time is on my side.",
    blurb: "Patient and immovable — it does not rush, it simply arrives and holds.",
    color: "#a78bfa",
    behavior: "Defensive",
  },
  {
    id: "VANGUARD",
    name: "VANGUARD",
    tagline: "We march. You move.",
    blurb: "Aggressive raiders who breach, take ground, and never stop charging.",
    color: "#f472b6",
    behavior: "Raider",
  },
  {
    id: "SPECTRE",
    name: "SPECTRE",
    tagline: "A whisper, then a knife.",
    blurb: "Sly economic operators who tilt the ledger before you notice it moved.",
    color: "#34d399",
    behavior: "Economic",
  },
];

const FACTION_KEY = "frontier_faction";

export function chosenFaction(): PlayerFactionId | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(FACTION_KEY);
  return v && (PLAYER_FACTION_IDS as readonly string[]).includes(v) ? (v as PlayerFactionId) : null;
}

export function chooseFaction(id: PlayerFactionId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FACTION_KEY, id);
}

export function clearFaction(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(FACTION_KEY);
}

/**
 * Decide whether to persist a freshly-picked faction to the player's record on
 * the server (POST /api/factions/:name/join), so the alignment is attached to the
 * wallet/DB — not just localStorage. Pure: only join when a faction was picked and
 * it differs from what the player is already aligned with (avoids redundant writes
 * and needless cooldown hits).
 */
export function nextFactionSync(
  currentPlayerFactionId: string | null | undefined,
  chosen: PlayerFactionId | null,
): { shouldJoin: boolean; faction: PlayerFactionId | null } {
  if (!chosen) return { shouldJoin: false, faction: null };
  if (chosen === currentPlayerFactionId) return { shouldJoin: false, faction: chosen };
  return { shouldJoin: true, faction: chosen };
}

/**
 * Coerce a raw stored/fetched value to a known PlayerFactionId, or null. Used to
 * sanitise the server's `playerFactionId` (an arbitrary string column) the same
 * way {@link chosenFaction} sanitises localStorage.
 */
export function asPlayerFactionId(v: string | null | undefined): PlayerFactionId | null {
  return v && (PLAYER_FACTION_IDS as readonly string[]).includes(v) ? (v as PlayerFactionId) : null;
}

/**
 * The single source of truth for "what faction is this player?" — the durable,
 * wallet-keyed server record ALWAYS wins over the localStorage cache. localStorage
 * is only a pre-auth fallback (before a session exists) and a fast paint cache;
 * once the account's own `playerFactionId` is known it is authoritative, so a
 * returning wallet on a new device shows the faction stored in their ALGO account,
 * not whatever this browser happens to remember.
 */
export function resolveEffectiveFaction(
  serverFaction: string | null | undefined,
  localFaction: PlayerFactionId | null,
): PlayerFactionId | null {
  return asPlayerFactionId(serverFaction) ?? localFaction;
}

/**
 * Whether the faction-select entry gate should be shown. The account's server
 * faction is authoritative: if it exists, the player has ALREADY claimed a
 * faction (durably, on their wallet record) and must never be re-prompted — even
 * on a brand-new device with empty localStorage. Only when the server has no
 * faction do we fall back to the localStorage memory (covers the pre-auth /
 * not-yet-connected visitor).
 */
export function shouldShowFactionGate(opts: {
  serverFaction: string | null | undefined;
  localFaction: PlayerFactionId | null;
}): boolean {
  if (asPlayerFactionId(opts.serverFaction)) return false;
  return opts.localFaction == null;
}
