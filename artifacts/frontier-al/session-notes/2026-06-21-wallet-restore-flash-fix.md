# 2026-06-21 — Wallet restore-flash fix (connect-gate flashing on /game)

## Symptom
Owner reported the wallet "flashing again" on the live `/game` page after the
previous wallet firefighting deploy (popup-storm + transient-error fixes were
already live). The remaining flash: the **"Connect your wallet" gate flashes up
for a moment, then the game appears** — on mobile especially.

## Root cause
`WalletContext` flipped out of the `"restoring"` status on a **blind 800ms
timer** (`setTimeout(() => setIsInitialized(true), 800)`), independent of whether
use-wallet had actually finished resuming the saved session. On a slow mobile
resume the timer fired first → `walletStatus` became `"disconnected"` while the
address was still resuming → `GameLayout` rendered the wallet-gate → the address
landed a moment later → snap to game. That snap is the "flash."

## Fix
Gate `"restoring"` on use-wallet's real `isReady` (v4 exposes it; true once the
manager finishes `resumeSessions()`), not a timer. While `isReady === false` the
status is `"restoring"`; only once ready do we trust connected/disconnected.

- `client/src/contexts/WalletContext.tsx`
  - Read `isReady` from `useWalletLib()`.
  - Removed the 800ms `isInitialized` timer + state.
  - Extracted pure `deriveWalletStatus(libReady, isConnected)` (exported) and use it.

## Test (no fix without a test)
- `client/tests/walletStatus.spec.ts` — asserts `deriveWalletStatus(false, *)`
  is `"restoring"` (never `"disconnected"` mid-restore, which is what flashed the
  gate), and connected/disconnected only once ready.

## Verification
- `pnpm run check` (tsc) — clean.
- `pnpm run test` (client) — 18 files / 89 tests pass (incl. the new spec).
- `pnpm run build` — client + server build green.
- **Live visual confirmation by the owner is still pending** — this removes the
  premature-disconnected flash path; the owner should hard-refresh `/game` and
  confirm the connect-gate no longer flashes before the game loads.

## Scope
Client-only, wallet status derivation. No server/chain/economy/globe changes.
