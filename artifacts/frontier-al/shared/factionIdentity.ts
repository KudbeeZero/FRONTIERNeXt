/**
 * shared/factionIdentity.ts
 *
 * Canonical, server-authoritative source of truth for "what faction does this
 * player / parcel belong to?" and the ally/enemy/neutral relationship used by
 * the (future) Battle Planner.
 *
 * DESIGN RULE (enforced here, not in the client):
 *   - A parcel's effective faction is derived from its canonical *owner*, never
 *     from any client-supplied value.
 *   - no owner                       → neutral
 *   - AI owner that is a canonical faction account (name === faction id)
 *                                   → that faction
 *   - human owner with playerFactionId (durable, server-provided)
 *                                   → that selected faction
 *   - human owner with no faction   → neutral
 *   - We NEVER infer a human's faction from their display name.
 *
 * Pure + dependency-free (only the faction id list from ./waitlist) so the exact
 * same logic runs on the server (territory totals, parcel enrichment) and can be
 * reused by the client (globe coloring) without divergence.
 */

import { PLAYER_FACTION_IDS, type PlayerFactionId } from "./waitlist";

/** A player/faction id, or null when the entity is unaligned (neutral). */
export type EffectiveFaction = PlayerFactionId | null;

/** Sentinel for "no faction" — explicit so callers never conflate "" with neutral. */
export const NEUTRAL_FACTION: EffectiveFaction = null;

/** Minimal view of an owner record the resolver needs. */
export interface FactionOwnerLike {
  isAi?: boolean | null;
  isAI?: boolean | null;
  name?: string | null;
  playerFactionId?: string | null;
}

/** Minimal view of a parcel the resolver needs. */
export interface ParcelOwnerLike {
  ownerId: string | null;
}

const KNOWN_FACTIONS: readonly string[] = PLAYER_FACTION_IDS;

/** Coerce an arbitrary string to a known faction id, or null. */
export function sanitizeFaction(value: string | null | undefined): EffectiveFaction {
  return value && KNOWN_FACTIONS.includes(value) ? (value as PlayerFactionId) : NEUTRAL_FACTION;
}

/** True when the value is one of the known player factions. */
export function isKnownFaction(value: string | null | undefined): boolean {
  return !!value && KNOWN_FACTIONS.includes(value);
}

/**
 * Canonical AI faction accounts have a player `name` equal to the faction id
 * (e.g. "NEXUS-7"). Only those carry a faction; a generic AI with a non-faction
 * name resolves to neutral.
 */
export function canonicalAiFactionName(name: string | null | undefined): EffectiveFaction {
  return sanitizeFaction(name);
}

/**
 * Resolve a player's effective faction from their canonical owner record.
 * AI → only canonical faction accounts; humans → only the durable playerFactionId.
 */
export function resolvePlayerFaction(
  player: FactionOwnerLike | null | undefined,
): EffectiveFaction {
  if (!player) return NEUTRAL_FACTION;
  const isAi = player.isAi ?? player.isAI ?? false;
  if (isAi) {
    return canonicalAiFactionName(player.name);
  }
  return sanitizeFaction(player.playerFactionId ?? null);
}

/**
 * Resolve a parcel's effective faction from its canonical owner player.
 * Unowned parcels are always neutral.
 */
export function resolveParcelFaction(
  parcel: ParcelOwnerLike | null | undefined,
  ownerPlayer: FactionOwnerLike | null | undefined,
): EffectiveFaction {
  if (!parcel || !parcel.ownerId) return NEUTRAL_FACTION;
  return resolvePlayerFaction(ownerPlayer);
}

export type Relationship = "ally" | "enemy" | "neutral";

/**
 * Canonical ally/enemy/neutral classification for future Battle Planner
 * targeting. Two entities with no faction (or where either is neutral) are
 * neutral to each other; same faction = ally; different factions = enemy.
 */
export function classifyRelationship(
  viewer: EffectiveFaction,
  other: EffectiveFaction,
): Relationship {
  if (!viewer || !other) return "neutral";
  return viewer === other ? "ally" : "enemy";
}

/**
 * Aggregate parcel ownership into per-faction territory counts, derived
 * server-side from each parcel's owner. Neutral (unowned / unaligned) parcels
 * are excluded from every faction's total.
 *
 * Pure and DB-free so it can be unit-tested directly and reused by both the
 * `/api/factions` route and the snapshot builder.
 */
export function computeFactionTerritory(
  parcels: ParcelOwnerLike[],
  playersById: Map<string, FactionOwnerLike>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const parcel of parcels) {
    const owner = parcel.ownerId ? playersById.get(parcel.ownerId) ?? null : null;
    const faction = resolveParcelFaction(parcel, owner);
    if (faction) counts[faction] = (counts[faction] ?? 0) + 1;
  }
  return counts;
}
