/**
 * Gamertag "unnamed" detection — used to re-prompt players whose tag was never
 * saved (e.g. a failed first attempt, or a skip on the welcome screen).
 *
 * No database schema change is involved: a player who has never set a gamertag
 * keeps the server-generated default `name`, which is `<first6>...<last4>` of
 * the wallet address (see `getOrCreatePlayerByAddress` in
 * `server/storage/db.ts`). A human player whose `name` still matches that
 * default — or is null/empty — is "unnamed" and should be prompted again.
 *
 * AI factions and service accounts are never prompted (callers must also guard
 * on `player.isAi`, but `needsGamertag` enforces it too).
 */

export interface GamertagPlayerLike {
  name?: string | null;
  address?: string | null;
  isAi?: boolean;
}

/**
 * True when `name` is unset or matches the server's default display-name
 * pattern for `address`. Comparison is case-insensitive because stored
 * addresses may differ in casing from the connected wallet address.
 */
export function isDefaultUnnamedName(
  name: string | null | undefined,
  address: string | null | undefined,
): boolean {
  if (!name || name.trim().length === 0) return true;
  const a = (address ?? "").trim();
  // Algorand addresses are 58 chars; a shorter value (e.g. a dev/test sentinel)
  // can't form the default pattern, so treat it as already-named to avoid
  // spuriously prompting non-production identities.
  if (a.length < 10) return false;
  const expected = `${a.slice(0, 6)}...${a.slice(-4)}`;
  return name.trim().toLowerCase() === expected.toLowerCase();
}

/** Whether the given player should be prompted to choose a gamertag. */
export function needsGamertag(player: GamertagPlayerLike | null | undefined): boolean {
  if (!player) return false;
  if (player.isAi) return false;
  return isDefaultUnnamedName(player.name, player.address);
}

/**
 * The exact decision `GameLayout` uses to open the tag modal from its recovery
 * effect. Centralized so it can be unit-tested directly:
 *  - never re-open after the player dismissed/saved this session (`dismissed`);
 *  - never fight an already-open modal (`showGamerTag`);
 *  - otherwise prompt any human player who is still unnamed.
 * On a fresh page load `dismissed` resets, so an unnamed player is prompted
 * again on their next authenticated visit (until a valid tag is saved).
 */
export function shouldRecoverGamerTag(opts: {
  player: GamertagPlayerLike | null | undefined;
  dismissed: boolean;
  showGamerTag: boolean;
}): boolean {
  if (opts.dismissed) return false;
  if (opts.showGamerTag) return false;
  return needsGamertag(opts.player);
}
