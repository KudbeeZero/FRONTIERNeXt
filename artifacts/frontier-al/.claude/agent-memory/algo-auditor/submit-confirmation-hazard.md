---
name: submit-confirmation-hazard
description: submitPlotPurchaseGroup conflates send-reject with waitForConfirmation-timeout; 402 "funds not taken" is false post-acceptance
metadata:
  type: project
---

In `server/services/chain/plot-purchase-group.ts` `submitPlotPurchaseGroup`, `algosdk.waitForConfirmation(algod, txid, 4)` at line 206 is bare (no try/catch). algosdk 3.5.2 `waitForConfirmation` (node_modules/algosdk/dist/cjs/wait.js) throws on: 4-round timeout (~12-16s), and on `client.status()` / `client.statusAfterBlock()` transient errors (only 404s from pendingTransactionInformation are swallowed).

The route catch at `server/routes.ts:2090-2099` wraps the WHOLE `submitPlotPurchaseGroup` call in one catch — it cannot distinguish a pre-acceptance `sendRawTransaction` rejection (funds truly not taken) from a post-acceptance `waitForConfirmation` throw (group already in pool, will commit). Both set `prep.status='failed'` and return 402 "Your funds were not taken — please retry." The message is FALSE whenever the accepted txn commits (the common case).

**Why this matters:** false fund-safety assertion on a money path + a too-aggressive 4-round window.

**Mitigating facts (so severity is HIGH not CRITICAL):** routes.ts:2068 short-circuits only on `status==='submitted'`, NOT `'failed'` — so an in-window client retry re-enters submit; `isAlreadyInLedger` (plot-purchase-group.ts:146) matches both "already in pool" and "already in ledger" → resubmit falls through to waitForConfirmation which now succeeds → DB persist runs. So in-window retry recovers.

**Unrecoverable tail:** past the txn validity window (`lastValid`, ~tens of minutes) a committed-but-not-persisted purchase can't be re-finalized in-band — resubmit hits a validity error (not matched by isAlreadyInLedger → rethrown → 402) and pendingTransactionInformation 404s → waitForConfirmation times out.

**Fix direction:** split phases — only call the path "not taken" for a pre-acceptance `sendRawTransaction` rejection; post-acceptance waitForConfirmation timeout → 202/409 "submitted, confirmation pending" with a non-terminal 'pending' status; before resubmit, query the payment txid (indexer/pendingTransactionInformation) and skip send if already committed. Relates to [[verify-algo-payment]].
