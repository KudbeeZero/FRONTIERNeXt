# 2026-07-07 — Graceful recovery for the "session does not own this player" 403

Owner report: acquiring territory (and other mutating actions) sometimes hard-fails with
`403: Forbidden — session does not own this player`, with no recovery — the player is stuck.

## Root cause

Two independent player-identity resolution paths can drift:

- **Server**: the mutating-route ownership check (`server/routeOwnership.ts`'s
  `evaluateOwnership`, called by the global mutation-ownership middleware in
  `routes.ts` and by `assertPlayerOwnership`) trusts the **auth-token-derived**
  `playerId` from the signed session.
- **Client**: `useCurrentPlayer()` (`client/src/hooks/useGameState.ts`) resolves "the
  current player" by matching `wallet.address` against the **cached** `/api/game/state`
  React Query data — entirely independent of the session's `playerId`.

After a wallet reconnect/switch (or a stale `/api/game/state` cache), these two can
disagree: the client sends a `playerId` that no longer matches the session, the server
correctly rejects it with 403, and — until now — the client did nothing but show a raw
"Purchase Failed" toast. No cookie/token was cleared, no re-auth was triggered; the
player stays stuck until they manually clear storage (or hit the escape hatch from the
2026-07-07 popup-storm fix).

## The fix

Server: tag that specific 403 branch with a machine-readable code instead of relying on
the human-readable string.

- **`server/routeOwnership.ts`** — `SESSION_MISMATCH_CODE = "SESSION_MISMATCH"`,
  attached to `evaluateOwnership`'s 403 return branch.
- **`server/routes.ts`** — both call sites (`assertPlayerOwnership` and the global
  mutation-ownership middleware) now spread `code` into the JSON error body when present.

Client: centralize detection + recovery at the single request chokepoint instead of
patching every `.mutate(..., { onError })` call site individually.

- **`client/src/lib/queryClient.ts`** — `throwIfResNotOk` now inspects a 403 body for
  `code === "SESSION_MISMATCH"`. On match: clears the stale session token
  (`clearAuthToken()`), shows a toast telling the player their session was reset, then
  hard-reloads (`window.location.reload()`, deferred 1.5s so the toast renders) so the
  next load runs a clean re-authentication handshake. A module-level flag prevents a
  burst of concurrent failing requests from stacking multiple toasts/reloads. The error
  is still thrown afterward — existing call-site `onError` toasts still fire too — but the
  reload means the player recovers instead of staying stuck.

This reuses the same "recovery escape hatch, not an SDK/DB patch" shape as the wallet
popup-storm fix from earlier today, since the actual drift condition (client cache vs.
server session momentarily disagreeing) isn't something to "prevent" outright without a
larger identity-resolution rearchitecture — it's a race, and the graceful response is to
self-heal, not to eliminate the possibility of ever raising it.

## Honest gap

Not reproduced against a live drift scenario (would require an actual wallet
reconnect/switch mid-session against a real backend) — verified via the real
`evaluateOwnership` decision function (server, unit test) and a mocked-fetch client test
asserting the exact recovery sequence (clear token → toast → reload), not an end-to-end
browser repro.

## Tests

- `server/routeOwnership.spec.ts` — extended test 3 to assert the 403 branch carries
  `code: SESSION_MISMATCH_CODE`.
- `client/tests/sessionMismatchRecovery.spec.ts` (new, 2 cases) — a SESSION_MISMATCH 403
  clears the token, toasts once, and reloads after the deferred delay; a plain/uncoded
  403 does neither.

## Verified green

- `pnpm run check` (tsc) — clean
- `pnpm run test:server` — 449 passed, 24 skipped (unchanged count — extended an existing test, no new server test file)
- `pnpm run test` (client) — 323 passed (was 320; +3 new)
- `pnpm run build` — clean production build
