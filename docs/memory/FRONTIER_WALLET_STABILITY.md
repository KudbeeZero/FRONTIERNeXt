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

## Free-Model Handoff

### Do NOT
- Redesign or refactor the wallet architecture
- Change wallet library versions without updating `walletResumeGuard`
- Merge until owner completes manual Lute TestNet verification
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
1. Owner performs manual Lute TestNet verification
2. If all tests pass → merge PR
3. If issues found → open focused fix PR (not on this branch)
