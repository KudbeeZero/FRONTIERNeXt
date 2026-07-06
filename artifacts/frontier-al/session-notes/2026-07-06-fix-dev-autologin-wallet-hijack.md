# Fix: production `VITE_DEV_AUTOLOGIN` wallet hijack (real bug, owner-reported)

**Date:** 2026-07-06  
**Session:** claude/session-ncb8qx  
**Unit:** Fix owner-reported bug — real wallet login works on landing, but the game always
forces a developer wallet, sign-out doesn't work, and land purchases fail.
**Outcome:** ✅ Root cause found and fixed. Fully verified via read: `tsc`, `test:server` (439
passed / 14 skipped), client `test` (230 passed) all green.

---

## Owner's report

> "when I login or when I go to the homepage, I'm able to login to the Wallet that's on the
> landing page. However, when I get into the game, it always forces me into a developer wallet.
> I'm unable to sign out and I'm unable to purchase any land really I can't do anything."

## Root cause (two compounding bugs)

1. **`fly.toml` shipped `VITE_DEV_AUTOLOGIN = 'true'` on the production Fly deploy.** This is a
   *zero-click* flag: `landing.tsx`'s `useEffect` fires `quickAuthAndEnter()` on page load for
   **every visitor**, real wallet or not — signing them in as the shared, non-spendable
   `DEV-TEST-COMMANDER` sentinel and auto-navigating straight into `/game`, no button click, no
   opt-in. This flag was already flagged with a ⚠ in
   [`docs/FRONTIER_ARCHITECTURE_TRUTH.md`](../../../docs/FRONTIER_ARCHITECTURE_TRUTH.md) as
   "must be removed before mainnet" — but it was live on the TestNet deploy the owner was
   actually using, actively breaking real play, not just a pre-mainnet cleanup item.

2. **`WalletContext.disconnect()` never cleared the dev session.** Even once a dev session
   exists (from the auto-login above, or the manual "⚙ Dev / Test Mode" button), clicking
   "Disconnect" only called `activeWallet?.disconnect()` — it never called `endDevSession()`.
   Since `useWallet()`'s `shouldUseDevIdentity(...)` re-fires on *every* render whenever
   `devSessionActive()` is still true and `walletStatus === "disconnected"`, the dev identity
   **immediately re-shadowed** the now-genuinely-disconnected wallet on the very next render —
   so "Disconnect" silently did nothing from the player's point of view. This is what made the
   trap unrecoverable: even a player who correctly diagnosed "I'm signed in as the wrong wallet"
   had no way out of it in the UI.

Together these explain all three symptoms:
- **"Forced into a developer wallet"** — the zero-click autologin wins the race before (or
  instead of) the real wallet connecting.
- **"Unable to sign out"** — `disconnect()` didn't clear the dev session, so the dev identity
  re-appeared as "connected" immediately after clicking Disconnect.
- **"Unable to purchase land"** — the dev/test player is deliberately bound to a non-wallet
  sentinel address (`devSession.ts`) that can never sign a real transaction or claim an NFT out
  of escrow — by design, for the *opt-in* test-player flow. A real player stuck on that identity
  can't spend real ALGO because there's no wallet behind it.

This is the same class of bug already partially fixed once before (see
`client/tests/devIdentityPrecedence.spec.ts`, which pins that a *connected or restoring* wallet
always beats the dev identity) — but that fix only covered the render-time precedence check, not
the "does disconnecting actually clear the trap" case, and didn't touch the zero-click deploy
flag that was creating the trap for real users in the first place.

## Fix

1. **`fly.toml`** — removed `VITE_DEV_AUTOLOGIN = 'true'` from `[build.args]`. The manual
   "⚙ Dev / Test Mode" button (gated by `VITE_DEV_MODE`, still `true`) is untouched — playtesting
   without a wallet is still available, just no longer forced on every visitor automatically.
2. **`client/src/contexts/WalletContext.tsx`** — added
   `shouldEndDevSessionOnDisconnect(devMode, devActive)` (pure, same style as the existing
   `shouldUseDevIdentity`/`shouldDevAutoLogin` guards) and wired it into `disconnect()`:
   ```ts
   if (shouldEndDevSessionOnDisconnect(DEV_MODE, devSessionActive())) endDevSession();
   ```
   This is defense in depth: even if a dev session exists for any reason (manual button, a
   pre-fix leftover localStorage flag in an already-affected browser), Disconnect now actually
   ends it, so the player reaches a genuine connect-gate afterward.
3. **Tests** — `client/tests/disconnectClearsDevSession.spec.ts` pins the new guard function
   (fires only when both dev-mode and an active dev session are true; off otherwise).
4. **Docs** — `docs/FRONTIER_ARCHITECTURE_TRUTH.md` and `artifacts/frontier-al/ENV_VARS.md`
   updated to reflect the fix and warn against ever setting `VITE_DEV_AUTOLOGIN` in a deployed
   environment again.

## Verification

- `pnpm --filter @workspace/frontier-al run check` — clean.
- `pnpm --filter @workspace/frontier-al run test:server` — 439 passed / 14 skipped (unchanged).
- `pnpm --filter @workspace/frontier-al run test` — 230 passed (227 prior + 3 new).
- **Not yet verified live on Fly** — this fix requires a redeploy (new build picks up the
  changed `fly.toml` build arg) to take effect in production. The owner (or next session) should
  confirm after deploy: (1) landing page no longer auto-enters the game without a click, (2) a
  real wallet connected on landing stays connected in `/game`, (3) Disconnect actually shows the
  connect-gate afterward, (4) a land purchase using the real connected wallet succeeds.

## Note for browsers already affected

Existing visitors who were auto-hijacked before this fix have `frontier_dev_session=1` already
sitting in their browser's localStorage. Two independent paths now clear it going forward:
- Connecting a real wallet (`activeAddress` becoming truthy) already called `endDevSession()`
  before this fix (`WalletContext.tsx` line ~311) — unaffected by this change.
- Clicking Disconnect now also clears it (the fix above) — previously it did not.
No server-side or database change is needed; this is entirely a client-side localStorage flag.

---

**Files changed:**
- `fly.toml`
- `artifacts/frontier-al/client/src/contexts/WalletContext.tsx`
- `artifacts/frontier-al/client/tests/disconnectClearsDevSession.spec.ts` (new)
- `docs/FRONTIER_ARCHITECTURE_TRUTH.md`
- `artifacts/frontier-al/ENV_VARS.md`
