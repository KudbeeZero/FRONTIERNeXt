# PR #231 Audit Report: feat/mint-retry-delivery

**Date:** 2026-07-08  
**Branch:** `feat/mint-retry-delivery`  
**Head commit:** `4db0f2ef60cf4697da40b777d8b0a95e2745b320`  
**Verdict:** ❌ **FAIL** — Critical logic bug in GET /api/nft/plot/:plotId endpoint

---

## Claim Verification

| # | Claim | Status | Evidence |
|---|-------|--------|----------|
| 1 | Migration 0013 added `plot_mint_retry_queue` table with UNIQUE constraint on `plot_id` | ✅ | `migrations/0013_plot_mint_retry_queue.sql:29-30` — `CREATE UNIQUE INDEX IF NOT EXISTS "plot_mint_retry_queue_plot_id_unique" ON "plot_mint_retry_queue" ("plot_id")` |
| 2 | `mintRetryQueue.ts` worker with enqueue/drain/start functions; `enqueuePlotMintRetry` checks for existing row and updates instead of inserting duplicates | ✅ | `mintRetryQueue.ts:49-93` — checks for existing row before insert, updates if found |
| 3 | `refund.ts` — ALGO refund primitive for admin-signed refunds to buyers | ✅ | `refund.ts:30-56` — `refundAlgoPayment` function using admin account |
| 4a | Routes enqueue failed mints in purchase flow `.catch` block | ✅ | `routes.ts:2203-2217` — calls `enqueuePlotMintRetry` in catch block |
| 4b | Routes enqueue on `transfer_failed` | ✅ | `routes.ts:2186-2197` — calls `enqueuePlotMintRetry` in transfer_failed branch |
| 4c | `POST /api/nft/retry-plot/:plotId` endpoint with 409 Conflict for `refund_needed`/`refund_failed` states | ✅ | `routes.ts:1142-1144` — returns 409 for these states |
| 4d | Enhanced `GET /api/nft/plot/:plotId` to check retry queue | ⚠️ | `routes.ts:984-1005` — checks retry queue but has UNREACHABLE DEAD CODE (lines 999-1004 are never executed) |
| 5 | `server/index.ts` — Wired `startPlotMintRetryWorker()` at boot | ✅ | `index.ts:278-281` — imports and calls `startPlotMintRetryWorker()` |
| 6 | `NftClaimNotification.tsx` — HUD shows failed/minting states with retry button | ✅ | `NftClaimNotification.tsx:245-266` — displays failed status with retry button |
| 7 | `GameLayout.tsx` — Added `handleRetryPlotMint` and wired `NftClaimNotification` component | ✅ | `GameLayout.tsx:692-712` — `handleRetryPlotMint` defined; `GameLayout.tsx:1684-1700` — component wired with prop |
| 8 | `mintRetryQueue.spec.ts` — 7 unit tests covering the queue | ❌ | Only 5 test cases found (`grep -c "it("` returns 9, but actual tests: 2 nested under `enqueuePlotMintRetry`, 4 under `drainPlotMintRetries`) |

---

## Audit Follow-ups Verification

| § | Claim | Status | Evidence |
|---|-------|--------|----------|
| 4.1 | POST /api/nft/retry-plot/:plotId returns 409 Conflict for refund_needed/refund_failed states | ✅ | `routes.ts:1142-1144` |
| 4.3 | UNIQUE constraint on plot_id in migration 0013; enqueuePlotMintRetry checks for existing row | ✅ | `migrations/0013` and `mintRetryQueue.ts:52-57` |
| 4.5 | Purchase flow enqueues on transfer_failed, not just on mint failure | ✅ | `routes.ts:2186-2197` |
| 4.6 | Removed unused getAdminAddress import from mintRetryQueue.ts | ✅ | `mintRetryQueue.ts:24-30` — only imports `randomUUID`, `db`, `plotMintRetryQueue`, `plotNfts`, `mintIdempotency`, `eq`, `and`, `mintLandNft`, `attemptDelivery`, `refundAlgoPayment` |

---

## **Critical Issues Found**

### ⚠️ Dead Code / Logic Bug in GET /api/nft/plot/:plotId (routes.ts:996-1004)

```javascript
// Line 996: This condition catches "delivered" and "refunded"
if (retryRow.status === "delivered" || retryRow.status === "refunded" || retryRow.status === "refund_needed" || retryRow.status === "refund_failed") {
  return res.json({ plotId, assetId: null, status: "failed", ... });  // EARLY RETURN
}
// Lines 999-1004: These are UNREACHABLE — they will NEVER execute
if (retryRow.status === "refunded") {  // ← Never reached
  return res.json({ plotId, assetId: null, status: "refunded", ... });
}
if (retryRow.status === "delivered") {  // ← Never reached
  return res.json({ plotId, assetId: null, status: "delivered", ... });
}
```

**Impact:** 
- `delivered` returns as `status: "failed"` instead of `status: "delivered"` 
- `refunded` returns as `status: "failed"` instead of `status: "refunded"`
- `refundTxId` is never returned to client
- Client sees wrong status, preventing proper UI display

### ⚠️ Test Count Mismatch

Claim states "7 unit tests" but actual count is 5 (`describe` blocks contain 2 + 4 tests).

---

## Runtime / On-Chain Gaps (Cannot Verify)

1. **Actual on-chain refund behavior** — `refund.ts` throws on insufficient admin balance; test only mocks this
2. **Real database unique constraint enforcement** — Requires actual Postgres `db:push` migration
3. **End-to-end mint retry flow** — Worker runs on interval; no integration test for full cycle
4. **Concurrent retry attempts** — No test for race conditions when manual retry hits during worker cycle

---

## Test Results

```
Test Files  58 passed | 7 skipped (65)
Tests  477 passed | 24 skipped (501)
```

Typecheck passes (`tsc` clean).

---

## Verdict: FAIL

The PR has an **untested assertion** causing incorrect behavior:
- Lines 999-1004 in `routes.ts` are dead code that was intended to handle `refunded` and `delivered` states correctly
- The early return on line 997 catches these states but returns wrong `status` value

**Remediation required before merge:**
1. Remove dead code (lines 999-1004) or fix the conditional logic
2. Add test for the GET endpoint's retry queue state handling