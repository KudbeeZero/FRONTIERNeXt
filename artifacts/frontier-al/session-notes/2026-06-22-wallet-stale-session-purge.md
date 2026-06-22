# 2026-06-22 — Purge half-open wallet sessions on failed connect (duplicate-popup storm)

## Symptom
After #97 deployed, owner (desktop) still reports **multiple Pera popups** —
"only like four of them popping up extra ones" (down from seven, but not gone).

## Likely cause
A failed or cancelled `wallet.connect()` can leave a **half-open WalletConnect
session** behind. Nothing purged it, so leftovers accumulate in browser storage
and Pera resurfaces every stale pairing on the next attempt → a stack of popups.

## Fix
- `client/src/contexts/WalletContext.tsx`
  - `purgeStaleSession(wallet)` — best-effort `wallet.disconnect()` that never
    throws (cleanup, not the main path).
  - `connect()` now calls it whenever an attempt fails OR is cancelled, before
    returning/throwing — so a leftover pairing can't pile up.

## Test
- `client/tests/purgeStaleSession.spec.ts` — disconnects a live session, never
  throws when disconnect rejects, no-ops safely with no wallet/disconnect.

## Verification
- `pnpm run check` (tsc) — clean.
- `pnpm run test` — 20 files / 95 tests pass.
- `pnpm run build` — green.
- ⚠️ **Targeted at the most likely cause; NOT yet confirmed live.** Owner should
  re-test on the deployed bundle in a clean/incognito window. If popups persist,
  next step is clearing the WalletConnect localStorage keys explicitly on
  connect failure (a deeper purge than `disconnect()`).

## Scope
Client-only, wallet connect cleanup. No server/chain/economy/globe changes.
