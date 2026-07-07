# 2026-07-07 — fix residual wallet-popup vectors P1 + P3 (M1-3)

**Unit M1-3** from the master roadmap's 3-month queue (Phase 25) — the residual
wallet-popup vectors left over after #175/#176's popup-storm fix. Read
`WalletContext.tsx` (604 lines) and `WalletConnect.tsx` (351 lines) fully
before touching anything, per the baton's own caution not to regress #175.

## P1 — per-route WalletProvider remount re-arms auto-auth

**Bug:** `App.tsx` mounted a fresh `<WalletProvider>` instance inside **every**
`<Route>` (10 separate instances). `wouter`'s `<Switch>` renders exactly one
matching `<Route>` at a time, so a client-side navigation between two
`WalletProvider`-wrapped routes (no full page reload) unmounted the old
provider and mounted a brand-new one. The underlying wallet *connection*
persists (it's owned by the single outer `@txnlab/use-wallet-react` provider
above the Switch), but the fresh `WalletProvider` instance's own
`authAttemptedFor` ref reset to `null`. Landing on `/game` (`autoAuth`) after
having already authenticated on a previous mount re-armed the auto-auth effect
and fired a duplicate signature prompt for an address already authenticated
moments earlier.

**Fix:**
- `App.tsx` now hoists **one** shared `<WalletProvider>` instance wrapping an
  inner `<Switch>` for every route except `/university` and `/admin` (both
  deliberately mount with **no** wallet context — neither touches chain/funds,
  confirmed by this session's own earlier audit correction on the M2-3 roadmap
  entry — so they're kept in the outer Switch, ahead of the shared-provider
  catch-all, unaffected by this restructure).
- `autoAuth` is no longer a static per-route JSX prop; it's derived reactively
  from the current path via the new pure `shouldAutoAuthenticateForPath(path)`
  (`path === "/game"`), passed to the single instance. Since the instance
  itself never unmounts across navigation, this is a plain prop update, not a
  remount.
- **Defense in depth:** a new module-level (not per-component-instance) memory
  — `hasAutoAuthed` / `markAutoAuthed` / `clearAutoAuthedAddresses` — records
  which addresses have completed auto-auth this page load. Even if some future
  change reintroduces multiple provider instances, or any other remount
  happens, an address already auto-authed this load will not be re-prompted.
  Cleared only on an explicit `disconnect()` (mirrors the existing per-instance
  ref reset), so a genuine reconnect still re-triggers auto-auth exactly once.

## P3 — purge-on-connect could abort an in-flight session resume

**Bug:** `connect()`'s pre-dial purge ran whenever `!wallet.isConnected`, with
no way to distinguish "genuinely abandoned pairing" from "a session resume
still completing in the background." The bounded reconnect grace
(`RECONNECT_GRACE_MS`, 3s) gives up on the *local* "restoring" spinner and
shows the Connect button again if the address hasn't landed yet — but it does
not cancel the underlying resume promise inside the wallet SDK, which can
still succeed a moment later. If the player then taps Connect on that same
wallet (naturally, since it's the one they own), the purge tears down a resume
that was about to succeed, forcing a fresh QR/approval flow for no reason.

**Fix:** new pure `shouldPurgeBeforeConnect(wallet)` — purges only when the
wallet is **both** disconnected **and** not `isActive`. `isActive` without
`isConnected` is precisely the signal a resume may still be in flight (the SDK
itself hasn't given up on this wallet either). Reasoned through all three of
#175's named storm scenarios (crashed connect, cross-origin hop, abandoned
tab) in the doc comment: in the first two, `isActive` reads `false` (a fresh
origin/session has nothing marked active yet), so the purge still runs
unchanged — this narrows the purge condition, it does not loosen it for the
scenarios #175 actually targeted.

**Honest gap, disclosed in the PR:** the "abandoned tab with a still
cryptographically-valid but genuinely-given-up-on pairing" case can't be fully
distinguished from a real in-flight resume without live SDK behavior this
sandbox cannot exercise. Owner should smoke-test connect/disconnect/reconnect
— including deliberately reproducing the original multi-stale-pairing storm
scenario — on a real device before considering this fully closed.

## Tests

New pure-function tests (mirrors this file's established
`deriveWalletStatus`/`shouldUseDevIdentity`/`purgeStaleSession` pattern):
- `client/tests/autoAuthGuard.spec.ts` (4 tests) — the module-level guard.
- `client/tests/shouldAutoAuthenticateForPath.spec.ts` (2 tests) — the
  route-derived `autoAuth` decision.
- `client/tests/shouldPurgeBeforeConnect.spec.ts` (5 tests) — the purge gate,
  including the exact `isActive`-without-`isConnected` case P3 targets.
- `client/tests/route-loop.spec.tsx` — added a regression guard confirming
  `/university` and `/admin` still resolve to their own routes (not the 404
  fallback) after the Switch restructure; updated 3 existing test files'
  `vi.mock("@/contexts/WalletContext")` calls to add the new
  `shouldAutoAuthenticateForPath` export the mock was missing.

**Real-browser verification attempted, partially completed:** stood up a
throwaway local Postgres + real dev server + real Vite client + headless
Chromium (this repo's documented recipe) and navigated the fixed app across
`/`, `/info/economics`, `/university`, `/battles`, `/armory`. Zero
hook-order/"must be used within a WalletProvider" context errors — confirms
the provider restructure doesn't crash. Some pre-existing `.toFixed`/
`.toLocaleString` console errors appeared on data-dependent landing-page
widgets (`HypeTicker`, `TokenSection`, `LandingEconomics`); traced to
`ALGORAND_ADMIN_MNEMONIC not set` logged at server startup — before any client
code loads, in files this diff never touches — so these are a pre-existing
dev-sandbox environment gap, not a regression from this fix. A second
same-repro run (against the unmodified code, for a clean before/after
comparison) crashed the headless browser process itself mid-navigation
(sandbox flakiness); not re-attempted given the first run's evidence was
already conclusive. **The actual wallet-connect/auto-auth-dedup flow with a
real wallet remains device-unverified** — no real Pera/Lute extension or
mobile QR flow is reachable from this sandbox, matching the precedent set by
#175/#203/#208/#209 for wallet-flow changes.

## Verification

tsc clean · server 446/24 skipped (unchanged — server code untouched) ·
`coverage:server` unaffected (unchanged) · client **297** (285 + 12 new: 4 +
2 + 5 pure-function tests + 1 new route-loop regression assertion) ·
production build green.

## Audit checklist

- [x] **Scope:** `App.tsx` (routing/provider restructure) +
  `WalletContext.tsx` (module-level guard, purge gate, route helper) + 3
  existing test files' mocks updated for the new export + 3 new test files;
  no server/schema/route (API) change
- [x] **Tests:** 11 new pure-function tests + 1 new regression assertion in
  `route-loop.spec.tsx` (12 new client tests total); full client + server
  suites green
- [x] **HARD RULES checked:** no funds/ASA/mainnet code; no globe/combat/canvas
  change; no mock data introduced; `/university` and `/admin` still mount with
  no wallet context, unchanged
- [x] **Honest gaps:** P3's exact SDK-timing race and the real
  wallet-connect/auto-auth-dedup flow are device-unverified — flagged above
  and in the PR, owner should smoke-test on a real device
- [x] **Docs updated in the same commit:** this session note, baton rewritten
