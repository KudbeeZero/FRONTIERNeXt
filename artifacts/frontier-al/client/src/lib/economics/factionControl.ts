/**
 * client/src/lib/economics/factionControl.ts
 *
 * Pure shaping for Unit D2's "Faction Control" chart — territory counts per
 * AI faction plus an "Unclaimed" remainder, in the SAME fixed order as
 * `PLAYER_FACTIONS` (the faction-select gate) so the chart's categorical
 * colors match the identity a player already associates with each faction
 * everywhere else in the game.
 *
 * CONTRACT: pure — no fetch, no React. The caller supplies the already-fetched
 * `/api/factions` + `/api/economics` data.
 */
import { PLAYER_FACTIONS } from "@/lib/factions";
import { TOTAL_PLOTS } from "@shared/schema";

export interface FactionTerritory {
  name: string;
  territoryCount: number;
}

export interface FactionControlRow {
  name: string;
  territoryCount: number;
  color: string;
}

const UNCLAIMED_COLOR = "#6b7280"; // neutral gray — never reused for a real faction

/**
 * @param factions             live per-faction territory counts (`GET /api/factions`).
 * @param playerOwnedParcels    parcels owned by human players (`/api/economics` ownedParcelCount) — not attributed to any AI faction.
 * @param totalParcels          total plots on the map (defaults to the real TOTAL_PLOTS).
 */
export function buildFactionControlRows(
  factions: FactionTerritory[],
  playerOwnedParcels: number,
  totalParcels = TOTAL_PLOTS,
): FactionControlRow[] {
  const byName = new Map(factions.map((f) => [f.name, f.territoryCount]));

  const rows: FactionControlRow[] = PLAYER_FACTIONS.map((f) => ({
    name: f.name,
    territoryCount: Math.max(0, byName.get(f.name) ?? 0),
    color: f.color,
  }));

  const factionTotal = rows.reduce((sum, r) => sum + r.territoryCount, 0);
  const unclaimed = Math.max(0, totalParcels - factionTotal - Math.max(0, playerOwnedParcels));

  rows.push({ name: "Unclaimed", territoryCount: unclaimed, color: UNCLAIMED_COLOR });
  return rows;
}
