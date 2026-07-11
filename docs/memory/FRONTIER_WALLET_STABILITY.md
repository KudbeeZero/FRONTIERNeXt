# FRONTIER Wallet Stability Handoff

## Problem

Multiple wallet connection or signing prompts could be triggered by repeated clicks, overlapping operations, or unsafe session restoration. This caused duplicate transaction attempts, confused users, and potential wallet security issues.

## Implemented Protections

### Architecture
- **Single wallet provider**: One WalletProvider in the component tree above the Router
- **Centralized coordination**: WalletContext manages all wallet state and operations
- **Global promise lock**: `withWalletOperation` prevents concurrent wallet interactions

### Locking Mechanisms
- Same-operation callers share the same in-flight Promise (prevents duplicate clicks)
- Different overlapping wallet operations are blocked with clear error messages
- User rejection does not trigger automatic signing retry

### Session Management
- **Passive restoration**: Extension wallets (Lute) silently restore on page reload
- **Safe restoration**: `walletResumeGuard` suppresses unsafe interactive mobile-wallet restoration
- **Stale lock detection**: `WalletContext` detects and clears locks from crashed sessions

### UX Improvements
- Stable toast/notification IDs prevent duplicate notifications
- TestNet and balance validation before all transactions

## Important Implementation Details

### Promise Handling
```typescript
// WRONG - creates new promise on each call
export async function withWalletOperation<T>(...)

// CORRECT - returns shared promise
export function withWalletOperation<T>(...): Promise<T> {
  return activeOperation.promise;
}
```

### Storage Resolution (Dependency Injection)
`walletResumeGuard` accepts an optional `storage?: Storage` parameter on all exported functions. This allows tests to override localStorage with a mock implementation.

**Pattern used:**
```typescript
export function suppressInteractiveWalletResume(storage?: Storage): SuppressResult {
  // Resolve storage ONCE at top of function
  const resolvedStorage = getStorage(storage);
  
  // Reuse resolved Storage throughout the function
  const state = readUseWalletPersistedState(resolvedStorage);
  writeUseWalletPersistedState(nextState, resolvedStorage);
  resolvedStorage.removeItem(WALLET_SESSION_HINT_KEY);
}
```

This DI pattern enables testing in Node environments without `window.localStorage`. Production code passes no argument (uses `window.localStorage`); tests pass a `MemoryStorage` implementation.

### Dependency Coupling
`walletResumeGuard` accesses `localStorage.getItem("@txnlab/use-wallet")`. This is an internal SDK detail. After upgrading `@txnlab/use-wallet`, verify:
- Storage key format hasn't changed
- Wallet ID constants are still valid
- Interactive vs passive wallet classification is correct

### Test Fixtures
The batch queue rejection test uses SDK-compatible Algorand fixtures (address format, transaction params). Don't simplify these without verifying they still reach the signer.

## Changed Files

### Core Implementation (8 files)
- `client/src/lib/walletOperationLock.ts` (new)
- `client/src/lib/walletResumeGuard.ts` (new)
- `client/src/contexts/WalletContext.tsx`
- `client/src/hooks/useBlockchainActions.ts`
- `client/src/contexts/ConnectionContext.tsx`
- `client/src/components/game/LandSheet.tsx`
- `client/src/components/game/GameLayout.tsx`
- `client/src/lib/algorand.ts`

### Tests (4 files)
- `client/tests/walletResumeGuard.spec.ts` (8 tests)
- `client/tests/walletOperationLock.spec.ts` (4 tests)
- `client/src/lib/algorand.spec.ts` (9 wallet tests)
- `client/tests/walletConnectLock.spec.tsx` (1 provider test)

## Verification Results

### Automated Tests (All Passing)
- Client tests: 371/371
- Server tests: 480/480
- TypeScript: passing
- Build: passing
- walletResumeGuard: 8/8 passing
- walletOperationLock: 4/4 passing
- algorand wallet tests: 9/9 passing

### Untouched (Verified)
- TestNet configuration
- Asset IDs (ASA IDs)
- Treasury addresses
- Transaction amounts
- Signature logic and funds paths

## Manual Owner Gate

**The incident is not fully confirmed until funded Lute TestNet testing completes:**

### Required Test Checklist
1. **Rapid connect clicks**: Click Connect 10 times in 2 seconds → exactly 1 wallet window
2. **Session sharing**: Connect on index page → verify same address appears on globe page
3. **Passive restore**: Reload page with Lute extension → auto-connects without popup
4. **Single operation**: Click "Buy Plot" → exactly 1 Lute signing prompt
5. **Rejection handling**: Decline signing → no automatic retry or new wallet window
6. **Repeated actions**: Click "Buy Plot" 5 times rapidly → exactly 1 signing request (others blocked)
7. **Notification dedup**: Complete "Buy Plot" → exactly 1 toast notification (not 3-5)
8. **Wallet switching**: Switch from Lute to Pera and back → no stale locks blocking new operations
9. **Mobile wallet safety**: With Pera paired, reload page → no popup appears (passive guard working)

### How to Test
1. Build and run: `pnpm run build && pnpm start`
2. Open http://localhost:3000
3. Open DevTools Console (F12)
4. Follow checklist above
5. Export console logs if any issues found

### Success Criteria
- All 9 checklist items pass
- No console warnings about wallet locks
- No stuck "Signing..." states
- No duplicate Lute/Pera windows

## Case B — Production 401 Defect (Mobile Safari, Resolved)

### Symptom (Production)
On https://frontierprotocol.app, mobile Safari, owner with a connected Algorand wallet pressed `PURCHASE FOR 0.1 ALGO` and received:
`401: {"error":"Authentication required — connect your wallet"}`

### Final Root Cause (Case B)
- The wallet was connected in frontend state (`isWalletConnected === true`).
- The backend authentication session (signed challenge) was absent (`isAuthenticated === false`).
- `handlePurchase` checked `isWalletConnected` but **not** backend `isAuthenticated`, so the purchase request was sent without a Bearer token.
- The server correctly required the signed challenge flow: `POST /api/auth/nonce` then `POST /api/auth/verify`.

### Fix — Commit `e934508`
`fix(frontier-al): gate purchase on backend auth, auto-recover from 401`
- Added `ensureBackendAuthenticated()` — gates on backend `isAuthenticated`, performs the signed auth challenge **once** when needed.
- `handlePurchase` now requires backend authentication before purchase and aborts cleanly on rejection/cancellation (no purchase API call, no raw 401 toast).
- On a real `401` in `onError`, performs exactly one controlled re-authentication attempt and one retry.
- Does **not** auto-retry non-401 failures. Does **not** bypass server authentication. No longer exposes the raw JSON 401 to the player.

### Owner Production Verification (Mobile Safari, Production)
Public Algorand TestNet wallet: `OC6LXJ5WDGKMINKPWJF7ZZRU6ARWIOVFJMCMXBVOYUGQN3O67PFEL5B74A`
Owner-confirmed results on the production app:
- Wallet authentication completed (signed backend challenge succeeded).
- Purchase transactions completed in the wallet.
- The old raw `401` did not recur.
- Plot ownership updated to `OWNED BY YOU`.
- Plot #11627 displayed `Land NFT Delivered`.
- ASA `766120466` opt-in completed.
- Land NFT claim/delivery completed successfully.

### Preserved / Untouched
- **Backend authentication preserved**: server still requires `POST /api/auth/nonce` + `/api/auth/verify`; only client-side recovery was added. The 401 check on the server was NOT removed or bypassed.
- **Funds paths, prices, transaction amounts, ASA IDs, treasury/admin addresses, and TestNet configuration were NOT changed.**

## PR #237 Status
- PR: #237 `fix(frontier-al): prevent duplicate wallet prompts and unsafe resume`
- Branch: `fix/frontier-wallet-stability`, head `e934508`
- CI: Typecheck & server tests SUCCESS; Cloudflare Pages preview deploy SUCCESS; MERGEABLE.
- No unresolved review comments. Contains only expected wallet-stability files plus this memory doc.
- Closeout objective: confirm the three commits, record owner-verified production flow, add a PR comment, and push — **do not merge in this lane** (CI is green; merge deferred per closeout procedure).

## Next Separate Defect Lane: `fix/frontier-commander-nft-delivery`
After PR #237 merges, the next focused issue is **Commander NFT delivery** (separate from this wallet/auth fix):
- Observed: Sentinel #1 / #3 / #4 show `Mint Failed — Tap Retry`; ASA opt-in succeeds; land purchase + land NFT delivery succeed; Commander NFT mint/delivery does not consistently complete.
- Investigate: Commander NFT creation, delivery API behavior, ASA opt-in timing, transaction confirmation polling, retry idempotency, duplicate-mint prevention, duplicate wallet-prompt prevention, recovery when minting succeeds on-chain but UI/backend status remains failed.

## Free-Model Handoff

### Do NOT
- Redesign or refactor the wallet architecture
- Change wallet library versions without updating `walletResumeGuard`
- Add new wallet operations without wrapping in `withWalletOperation`

### May Do
- Inspect CI results or review comments
- Make minimal code changes only for reproducible failures
- Update documentation based on manual test results

## Related Documentation
- Main handoff: `docs/HANDOFF.md`
- Wallet context: `artifacts/frontier-al/client/src/contexts/WalletContext.tsx`
- Operation lock: `artifacts/frontier-al/client/src/lib/walletOperationLock.ts`
- Resume guard: `artifacts/frontier-al/client/src/lib/walletResumeGuard.ts`

## Next Steps
1. Owner production verification **completed** on mobile Safari (production flow passed; see Case B above).
2. PR #237 closeout: record owner-verified flow above, add PR comment, push branch, **do not merge in this lane**.
3. Next separate lane: `fix/frontier-commander-nft-delivery` (Commander NFT mint/delivery failures), started only after PR #237 merges.
