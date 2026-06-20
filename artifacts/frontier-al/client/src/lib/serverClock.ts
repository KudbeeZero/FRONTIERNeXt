/**
 * serverClock.ts — server-authoritative time for drift-free countdowns.
 *
 * Battle countdowns / cooldown timers compare a SERVER timestamp (`battle.resolveTs`,
 * `lockedUntil`, …) against "now". Using the client's `Date.now()` makes those timers
 * wrong whenever the device clock is skewed. The server pushes its clock via a WS
 * `time_sync` message (and `GET /api/time`); we keep the offset and expose
 * `serverNow()` so the UI ticks against server time instead.
 *
 * Pure + framework-free (no React/DOM) so the offset math is unit-tested directly.
 * Single module-level offset is fine: there is one server, one socket.
 */

let _offsetMs = 0;

/** PURE: server↔client clock offset. Falls back to 0 for a non-finite serverTime. */
export function computeOffsetMs(serverTime: number, clientNow: number): number {
  return Number.isFinite(serverTime) ? serverTime - clientNow : 0;
}

/** Record a fresh server time sample (from `time_sync` / `GET /api/time`). */
export function setServerTime(serverTime: number, clientNow: number = Date.now()): void {
  _offsetMs = computeOffsetMs(serverTime, clientNow);
}

/** Best estimate of the server's current epoch-ms — use this for countdowns. */
export function serverNow(clientNow: number = Date.now()): number {
  return clientNow + _offsetMs;
}

/** Current applied offset (ms). Server ahead of client → positive. */
export function getOffsetMs(): number {
  return _offsetMs;
}
