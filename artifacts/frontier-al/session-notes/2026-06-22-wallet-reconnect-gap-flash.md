# 2026-06-22 — Wallet reconnect-gap flash fix

## Symptom (owner, live `/game`)
"Spinner → connect jump": the **Reconnecting Wallet…** spinner shows, then it
jumps to the **Connect your wallet** gate even though a wallet was connected last
load — then a beat later the game appears. A visible flash.

## Root cause
`deriveWalletStatus(libReady, isConnected)` trusted `isConnected` the instant
use-wallet v4 flipped `isReady === true`. But Pera / WalletConnect repopulates
`activeAddress` a tick **after** `isReady`. In that post-ready gap the derivation
returned `"disconnected"` → `GameLayout` rendered the connect-gate
(`data-testid="wallet-gate"`) → then `activeAddress` landed → game. The earlier
`isReady` fix (#97) only closed the *blind-800ms-timer* window, not this gap.

## Fix (client-only, evidence-gated — NOT a blind timer)
`WalletContext.tsx`:
- `deriveWalletStatus(libReady, isConnected, reconnectPending)` — when ready and
  not yet connected but a reconnect is pending, stay `"restoring"` instead of
  `"disconnected"`. Short-circuits to the game the instant the address lands.
- `reconnectPending = !restoreGraceElapsed && (hasActiveWallet || hadSessionHint)`:
  - `hasActiveWallet` — use-wallet still marks a wallet active (resuming).
  - `hadSessionHint` — persisted `frontier_wallet_session` flag set when an
    address was active on a previous load; cleared only on explicit disconnect.
  - `RECONNECT_GRACE_MS = 3000` — bounded backstop so a session that will never
    resume falls through to the gate (no endless spinner), distinct from the old
    cosmetic timer because it only runs when a reconnect is actually expected and
    is cancelled the moment the address arrives.
- New visitors (no hint, no active wallet) → gate immediately, no regression.
- Explicit `disconnect()` clears the hint + skips the grace → gate shows at once.

## Tests
`client/tests/walletStatus.spec.ts` — added the post-ready reconnect-gap cases
(`deriveWalletStatus(true, false, true) === "restoring"`, etc.). These FAIL
against the old 2-arg derivation and PASS after.

- `pnpm --filter @workspace/frontier-al run check` — clean.
- `pnpm --filter @workspace/frontier-al run test` — **20 files / 98 tests pass**.
- `pnpm --filter @workspace/frontier-al run build` — green.

## Status
⚠️ Code + local tests green; **not yet confirmed on the live bundle**. Owner to
re-test the spinner→connect transition on deployed `/game` in a clean window.
Folded into PR #98 (same branch — one open PR at a time).
