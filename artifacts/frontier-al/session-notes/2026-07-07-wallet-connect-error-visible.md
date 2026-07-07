# 2026-07-07 — Make wallet-connect error text actually visible

Owner was live-testing the game preview and hit a wallet connection failure with no
readable detail — just a red "Try Again" button.

## Root cause

`WalletConnect.tsx`'s error state rendered the actual failure string (from
`useWallet().error`, e.g. a rejected signature, unsupported wallet, or a network
hiccup) ONLY as the `title` attribute of the "Try Again" button — a hover tooltip.
Invisible on touch devices, easy to miss on desktop, and exactly why the owner could
only describe it as "a connection ERROR" with no way to relay what actually failed.

## The fix

`client/src/components/game/WalletConnect.tsx` — the error branch now renders `error`
as visible text beneath the button/dismiss row, and also surfaces the existing
"Trouble connecting? Reset wallet connection" escape hatch (already used for the
restoring/disconnected states) — a connect failure can itself be a stuck stale
session, so the same recovery path applies.

## Tests

- `client/tests/walletConnectErrorVisible.spec.tsx` (new, 2 cases) — the error message
  renders as visible text (not just a title), and the reset-connection link is
  reachable from the error state.

## Verified green

- `pnpm run check` (tsc) — clean
- `pnpm run test` (client) — 325 passed (was 323; +2 new)
- `pnpm run test:server` — 449 passed, 24 skipped (unchanged, no server files touched)
- `pnpm run build` — clean production build

## Honest gap

Doesn't diagnose *why* the owner's actual wallet connect attempt failed — that reason
will now be visible on their screen the next time they hit it, which is the point:
this unblocks them reporting the real error text instead of guessing blind.
