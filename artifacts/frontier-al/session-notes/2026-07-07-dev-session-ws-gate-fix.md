# 2026-07-07 — Fix: dev/test sessions never opened the live game WebSocket

Found while doing a live headless health-check of the battle system (owner asked for a
"polish" pass + an image of the battle system + whether things are actually working).

## The bug

`useGameSocket(authTrigger, ...)` in `client/src/hooks/useGameSocket.ts` only opens the
live game WebSocket once `authTrigger` is truthy **and** a session token exists
(`if (!authTrigger || !token) return;`). `GameLayout.tsx` passes `wallet.authVersion` as
that trigger. `authVersion` starts at `useState(0)` and is only ever bumped in one place:
`WalletContext.tsx`'s real wallet-signature `authenticate()`, on a successful
`/api/auth/verify`.

The dev/test login path (`POST /api/dev/quick-auth`, gated by `DEV_LOGIN_ENABLED`) never
calls `authenticate()` — it gets its session token directly from the quick-auth response
and stores it via `setAuthToken()`. So for **every** dev/test session, `authVersion` stays
at its initial `0` — permanently falsy — for the entire life of the session. `0` is falsy
in JS, so the WS gate blocks forever, even though a perfectly valid token exists.

**Confirmed live**, not just by reading code: a background agent ran the documented
headless-visual recipe, authenticated as a dev/test player, and fired a real weapon 3x via
the live API. The server accepted every shot and computed damage/time-of-flight correctly
(mechanically fine), but the missile arc / impact visuals never rendered — because
`LiveWeaponLayer.tsx` and `GlobeBattleSequence.tsx` render *only* off WS-pushed
`weapon_engagement` / `battle:resolved` events, with no REST fallback for those specifically
(the base game state / plots DO have a 30s REST-poll fallback, so the globe itself still
looks fine — only the live moment-to-moment battle/weapon events were silently dropped).

Real wallet-authenticated players are unaffected — their `authenticate()` call bumps
`authVersion` normally.

## The fix

`client/src/contexts/WalletContext.tsx`: added a small pure helper,
`devIdentityAuthVersion(contextAuthVersion)`, which returns the real context's
`authVersion` unless it's still `0`, in which case it returns `1` (a truthy sentinel).
Applied it to the dev-identity override object `useWallet()` already returns when a dev
session is shadowing the wallet — the same object that already fakes `isConnected`,
`isAuthenticated`, etc. for the dev identity. No change to the real wallet path at all.

## Tests

`client/tests/devIdentityPrecedence.spec.ts` — 2 new cases: `devIdentityAuthVersion(0) → 1`,
`devIdentityAuthVersion(3) → 3` (a real, already-bumped value is preserved, not reset).

## Verified green

- `pnpm run check` (tsc) — clean
- `pnpm run test` (client) — 305 passed (was 303; +2 new)
- `pnpm run test:server` — 449 passed, 24 skipped (unchanged — server-side untouched)
- `pnpm run build` — clean production build

## Honest gaps

- Not re-verified live in a second headless run (the original repro run's Postgres/server
  were already torn down). The fix is a 2-line, fully unit-tested logic change mirroring
  the exact mechanism that already works for real wallets, so I'm confident in it, but
  flagging that the *original failing scenario* wasn't re-run end-to-end after the fix.
- This only fixes dev/test sessions. It does not touch, and is unrelated to, the separately
  documented weapons-system gaps (no fire cooldown, damage-settlement never happens,
  weapon fire not integrated with the cinematic bus) — those remain queued in
  `docs/WEAPONS_SYSTEM_UX_PLAN.md`.
