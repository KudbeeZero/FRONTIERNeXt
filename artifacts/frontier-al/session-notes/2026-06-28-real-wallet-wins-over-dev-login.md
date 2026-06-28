# 2026-06-28 — Real wallet wins over dev/test auto-login

**Branch:** `claude/wallet-dashboard-redesign-b78nwa` (reset to `main` after #166 merged)
**Trigger:** owner screenshots — landing page shows the real **Lute** wallet connected
(`NRJQZM…JGTQ`, **14.866 ALGO**) with ENTER GAME, but in-game the TopBar reads
**DEV-TEST-COMMANDER · 0.000 ALGO**. The dev auto-login was overriding the connected wallet.

## Root cause
`useWallet()` (`client/src/contexts/WalletContext.tsx`) presented the dev/test identity whenever
`DEV_MODE && !context.isConnected && devSessionActive()`. `isConnected = !!activeAddress`, which is
briefly **false during the wallet RESUME** after the full-page nav into `/game`. With a lingering
dev session in localStorage (a `VITE_DEV_AUTOLOGIN` one, or a stale one), the dev identity shadowed
the real wallet during that gap — and stuck.

## Fix (client-only; no server/funds/ASA change)
1. **Precedence as a pure function** — new exported `shouldUseDevIdentity(devMode, walletStatus,
   devActive)` gates on `walletStatus === "disconnected"`, not bare `!isConnected`. So the dev
   identity is suppressed while the wallet is **"restoring"** (the resume gap) or **"connected"** —
   a real wallet always wins. No-wallet dev play is unchanged (status is "disconnected" when there's
   no wallet at all → dev fallback still fires).
2. **Purge the dev session when a real wallet lands** — in the `activeAddress` effect, once a real
   address is active we call `endDevSession()` (gated on `DEV_MODE && devSessionActive()`). This
   stops a `VITE_DEV_AUTOLOGIN` session from re-shadowing the wallet and lets the wallet-auth cookie
   replace the dev cookie server-side.

## Tests (fail-before / pass-after)
- New `client/tests/devIdentityPrecedence.spec.ts` (5 cases): dev identity only when DEV_MODE +
  session + **disconnected**; never over "connected"; never over "restoring" (the exact bug); off
  with no session; off when DEV_MODE is false.

## Green
- `check` (tsc) — clean
- `test` (client) — **200 passed** (195 prior + 5 new)
- `test:server` — **411 passed / 14 skipped**
- `build` — Vite + esbuild OK

## Honest limitation
Not browser-verified on-device (sandbox can't drive the real Lute extension). Logic + unit tests +
build only. Owner smoke-test: connect Lute on landing → ENTER GAME → TopBar should now show the Lute
address + real balance, NOT DEV-TEST-COMMANDER.

## Still open / next
- **Desktop dashboard widget system** — custom dnd-kit snap-grid for the bunched in-game menus
  (visible in the same screenshot).
- **Branded-domain redirect** `frontierprotocol.app` → `frontiernext.fly.dev` (from 2026-06-27 diagnosis).
