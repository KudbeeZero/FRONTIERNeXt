// ── Per-viewer game-state scoping (fog of war / EPI protection) ───────────────
//
// The full GameState contains off-chain economic intelligence that must not be
// handed wholesale to every client: per-parcel stored resources (the "which
// plots hold the most tokens" signal) and every player's spendable balances.
//
// scopeGameStateFor() returns a view tailored to one viewer:
//   • the viewer's OWN parcels/player keep full detail (they need it to play)
//   • all other parcels have their stored resources zeroed
//   • other human players have their spendable balances zeroed
//   • AI players are left intact — their economy is public game challenge, not
//     user EPI, and several panels (War Room / Factions) surface it
//
// Sanctioned target intel (e.g. top attackable parcels) still flows through the
// dedicated, rate-limited REST endpoint — this only removes the uncontrolled
// firehose over the WebSocket and /api/game/state.

import type { GameState, LandParcel, Player } from "@shared/schema";

function redactParcelResources(p: LandParcel): LandParcel {
  return {
    ...p,
    ironStored: 0,
    fuelStored: 0,
    crystalStored: 0,
    frontierAccumulated: 0,
    frontierPerDay: 0,
  };
}

function redactPlayerEconomics(p: Player): Player {
  const r: Player = {
    ...p,
    iron: 0,
    fuel: 0,
    crystal: 0,
    frontier: 0,
    testnetProgress: [],
  };
  // Only touch optional fields that are actually present so the shape is stable.
  if (p.treasury !== undefined) r.treasury = 0;
  if (p.xenoriteVault !== undefined) r.xenoriteVault = 0;
  if (p.voidShardVault !== undefined) r.voidShardVault = 0;
  if (p.plasmaCoreVault !== undefined) r.plasmaCoreVault = 0;
  if (p.darkMatterVault !== undefined) r.darkMatterVault = 0;
  if (p.lootBoxes !== undefined) r.lootBoxes = [];
  return r;
}

/**
 * Produce a viewer-scoped copy of the game state. Pass `null` for an
 * unauthenticated viewer (everything economic is redacted).
 */
export function scopeGameStateFor(full: GameState, viewerPlayerId: string | null): GameState {
  return {
    ...full,
    parcels: full.parcels.map((p) =>
      viewerPlayerId && p.ownerId === viewerPlayerId ? p : redactParcelResources(p),
    ),
    players: full.players.map((p) =>
      p.id === viewerPlayerId || p.isAI ? p : redactPlayerEconomics(p),
    ),
  };
}
