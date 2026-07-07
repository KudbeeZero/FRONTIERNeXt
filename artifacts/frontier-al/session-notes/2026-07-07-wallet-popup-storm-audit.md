# 2026-07-07 — Independent audit of PR #214 (wallet-popup-storm recovery)

## Summary

Completed independent second opinion on PR #214's wallet-popup-storm fix. The fix is **correct and complete**. Added one missing test for `resetWalletConnection()`.

## Fix Review

### What was fixed
PR #214 introduced an escape hatch for the wallet-popup-storm bug (8+ Pera/WalletConnect popups on page load). The root cause was traced to `@txnlab/use-wallet-react`'s `WalletProvider` calling `manager.resumeSessions()` which, when a stale `@txnlab/use-wallet:v4` session key exists, triggers Pera's `reconnectSession()` to resurface ALL stale WalletConnect pairings as popups.

The fix:
1. Created `client/src/lib/walletReset.ts` with:
   - `WALLET_RESET_STORAGE_KEYS` - the critical storage keys to clear
   - `clearWalletStorage()` - clears all wallet-related storage + auth token
   - `resetWalletConnection()` - clears storage + hard reloads
2. Added "Trouble connecting? Reset wallet connection" link in `WalletConnect.tsx`
3. Exported `WALLET_TYPE_KEY` and `WALLET_ADDRESS_KEY` from `WalletContext.tsx`

### Test coverage assessment
Existing tests cover:
- `WALLET_RESET_STORAGE_KEYS` - verifies correct keys included
- `clearWalletStorage` - verifies removeItem for all keys, best-effort error handling, SSR-safe
- `clearWalletStorage clears auth token` - verifies `clearAuthToken` integration
- `walletConnectResetLink` - verifies UI wiring (link renders in "restoring" and "disconnected" states, NOT in connected state)
- Plus all related wallet tests: `walletStatus`, `shouldPurgeBeforeConnect`, `purgeStaleSession`, `autoAuthGuard`, `devIdentityPrecedence`, `wsAuthClose`

**Missing**: No test for `resetWalletConnection()` itself. Added test that verifies `window.location.reload` is called.

### Verification
- ✅ All client tests pass: 321 tests (was 320, +1 new)
- ✅ All server tests pass: 449 passed, 24 skipped (unchanged)
- ✅ TypeScript compile clean
- ✅ Build clean

## Remaining Fragility Assessment

### 1. Missing test for `resetWalletConnection` (FIXED)
Added test in `walletReset.spec.ts` that mocks `window.location.reload` and verifies it's called.

### 2. `@txnlab/use-wallet:v4` key coupling (DOCUMENTED)
The SDK's internal storage key `@txnlab/use-wallet:v4` is version-coupled. Documented in `walletReset.ts` doc comment to verify on SDK upgrade. Low risk - the key is stable across minor versions.

### 3. Reset link can be clicked multiple times (MINOR UX)
No guard against multiple rapid clicks on the reset link. Each click clears storage and reloads. This is harmless (storage is already cleared) but could cause confusing UX with multiple reloads. **Not a bug** - the reset is idempotent.

### 4. `clearAuthToken()` uses global `localStorage` (NOT AN ISSUE)
`clearWalletStorage()` accepts an optional storage param, but `clearAuthToken()` always uses global `localStorage`. This is intentional - the auth token is app-level state, not wallet-state. Tests stub both appropriately.

## Conclusion

The PR #214 fix is correct and complete. It correctly addresses the popup storm by clearing the SDK's persisted session key, preventing `resumeSession()` from ever reaching Pera's problematic `reconnectSession()`. The escape hatch is appropriately hidden in pre-connected states where users get stuck, and the tests are comprehensive.

**No further fixes required.** The added test for `resetWalletConnection()` closes the only test gap found.