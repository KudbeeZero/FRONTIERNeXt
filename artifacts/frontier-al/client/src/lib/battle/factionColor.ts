/**
 * client/src/lib/battle/factionColor.ts
 *
 * Canonical hex colours for the four AI factions, for use in the 3D/Canvas
 * battle cinematic (Three.js materials need hex, not Tailwind classes). The hues
 * mirror the faction-panel palette (`FactionPanel`/`AiFactionLog`) so a faction's
 * identity reads the same in the HUD and on the globe: when KRONOS takes a plot,
 * the capture burst is KRONOS purple — identity wired into the sequence.
 *
 * CONTRACT: pure. Unknown names (e.g. a human player's handle, or "Unclaimed")
 * fall back to a neutral cyan so the cinematic always has a colour.
 */

/** Neutral fallback when the combatant isn't one of the known factions. */
export const NEUTRAL_COLOR = "#67e8f9";

/** Faction → signature hex (Tailwind-400 equivalents of the faction-panel palette). */
const FACTION_HEX: Record<string, string> = {
  "NEXUS-7": "#22d3ee", // cyan-400
  KRONOS: "#c084fc", //   purple-400
  VANGUARD: "#fbbf24", // amber-400
  SPECTRE: "#fb7185", //  rose-400
};

/** The signature colour for a faction name/id, or the neutral fallback. */
export function factionColor(nameOrId: string | null | undefined): string {
  if (!nameOrId) return NEUTRAL_COLOR;
  return FACTION_HEX[nameOrId] ?? NEUTRAL_COLOR;
}

/** True when the name is one of the known factions (not a player handle). */
export function isKnownFaction(nameOrId: string | null | undefined): boolean {
  return !!nameOrId && nameOrId in FACTION_HEX;
}
