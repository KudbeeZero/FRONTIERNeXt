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
 * Resolve a background-task interval (ms) from an env value.
 *
 * - `raw` unset / empty / non-numeric / `"0"` → falls back to `def`
 * - a valid positive number below `floor` → clamped up to `floor`
 * - otherwise → the parsed value
 *
 * The floor protects shared infra (e.g. Neon) from being hammered by a
 * misconfigured, too-aggressive cadence.
 */
export function clampIntervalMs(
  raw: string | undefined,
  def: number,
  floor: number,
): number {
  return Math.max(floor, Number(raw) || def);
}
