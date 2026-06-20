/**
 * server/util/intervals.ts
 *
 * Tiny pure helper for env-tunable background-task cadences.
 *
 * Several `setInterval` loops in `routes.ts` (the battle auto-resolver, the
 * `battle_tick` broadcast, …) read their period from an env var with a default
 * and a hard floor. This centralizes that one expression so the parsing rules
 * are consistent and testable instead of being re-typed inline at each call site.
 */

/**
 * Largest interval we will honor (24h). Anything above this is treated as a
 * misconfiguration and clamped down. This is well under Node's timer
 * `TIMEOUT_MAX` (2_147_483_647): a delay above that — or a non-finite one like
 * `Infinity` (`Number("1e999")`) — is silently coerced by Node to **1ms**, i.e.
 * a hot loop that hammers the DB, the exact opposite of the floor's intent.
 */
const MAX_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Resolve a background-task interval (ms) from an env value.
 *
 * - `raw` unset / empty / non-numeric / `"0"` / non-finite (`Infinity`) → `def`
 * - a finite value below `floor` → clamped up to `floor`
 * - a finite value above `MAX_INTERVAL_MS` → clamped down to the ceiling
 * - otherwise → the parsed value
 *
 * The floor protects shared infra (e.g. Neon) from being hammered by a
 * misconfigured, too-aggressive cadence; the ceiling stops a too-large value
 * from overflowing Node's timer and wrapping back to a 1ms hot loop.
 */
export function clampIntervalMs(
  raw: string | undefined,
  def: number,
  floor: number,
): number {
  const parsed = Number(raw) || def;
  if (!Number.isFinite(parsed)) return def;
  return Math.min(MAX_INTERVAL_MS, Math.max(floor, parsed));
}
