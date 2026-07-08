# PR #231 Audit Follow-ups (M1-5: Persistent Retry Queue)

**Date:** 2026-07-08
**Branch:** `feat/mint-retry-delivery`
**Head commit:** `5d20658`

## Findings Addressed

### §4.1: Manual retry re-entry into post-refund states (FIXED)
- **File:** `server/routes.ts:1139-1142`
- **Change:** Extended the manual retry endpoint to reject `refund_needed` and `refund_failed` states in addition to `delivered` and `refunded`.
- **Before:** `if (retryRow.status === "delivered" || retryRow.status === "refunded")`
- **After:** `if (retryRow.status === "delivered" || retryRow.status === "refunded" || retryRow.status === "refund_needed" || retryRow.status === "refund_failed")`
- **Rationale:** Prevents double-value delivery if `refundAlgoPayment` threw after the payment was actually broadcast/confirmed.

### §4.3: No uniqueness constraint on plot_id (FIXED)
- **Files:** `server/db-schema.ts:727`, `migrations/0013_plot_mint_retry_queue.sql:31-32`
- **Change:** Added `unique` constraint on `plot_id` column in Drizzle schema, converted migration index to `CREATE UNIQUE INDEX`.
- **Also updated:** `server/services/chain/mintRetryQueue.ts:48-92` to check for existing row before inserting, updating instead if found.
- **Rationale:** Prevents duplicate rows when enqueue is called multiple times for the same plot.

### §4.5: Minted-but-undelivered from initial purchase not enqueued (FIXED)
- **File:** `server/routes.ts:2183-2193`
- **Change:** Added `enqueuePlotMintRetry` call in the `transfer_failed` branch of the purchase flow.
- **Rationale:** When NFT mints successfully but delivery fails during initial purchase, the buyer has no automated recovery path. Now enqueues for retry.

### §4.6: Unused import in mintRetryQueue.ts (FIXED)
- **File:** `server/services/chain/mintRetryQueue.ts:31`
- **Change:** Removed unused `getAdminAddress` import.

## Test Results

```
Test Files  58 passed | 7 skipped (65)
Tests  477 passed | 24 skipped (501)
```

Typecheck clean. All changes verified.