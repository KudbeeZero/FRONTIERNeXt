---
name: atomic-purchase-submit-recovery
description: /submit DB-tx-failure recovery is via idempotent /submit retry while status='prepared'; only the post-algod-retention window is a real (narrow) brick risk.
metadata:
  type: project
---

routes.ts `/api/actions/purchase/submit` (~L2048-2182). Chain-commit→DB-persist boundary.

**Recovery path that DOES exist (dominant case):** if `submitPlotPurchaseGroup` succeeds (2083) but the `db.transaction` (2104) throws, the outer catch (2178) returns 400 and `prep.status` stays `'prepared'` (the `set status='submitted'` at 2144 rolled back; the `set status='failed'` at 2093 is ONLY on the submit-throw branch, which did not fire). A **prompt re-invocation of `/submit` with the same prepareId** falls through the `status==='submitted'` gate (2068), re-runs `submitPlotPurchaseGroup` (already-in-ledger → `isAlreadyInLedger` → `waitForConfirmation` succeeds), then re-runs the DB tx idempotently (onConflictDoNothing + `.for('update')` NULL-owner-safe ownership claim). State fully recovers. So "one DB blip = permanent brick" is FALSE.

**Real narrow kernel (lower severity than a CRITICAL permanent-brick claim):** the idempotent retry only works while algod still retains pending-txn info for the confirmed group (~a few min / ~1000 rounds). After that window, on retry `sendRawTransaction` of the now-expired group throws "txn dead"/expired — NOT matched by `isAlreadyInLedger` (only matches "already in ledger"/"already in pool"/"transactionpool.remember") — so it re-throws, the catch at 2090 mislabels status `'failed'` and returns 402 "funds were not taken" (false: funds taken + NFT delivered). `waitForConfirmation` over the old txid then 404s. **No reconciler exists** over plot_purchase_prepare / plot_purchases (grep: only diagnose-delivery.ts script + FRONTIER-token transferQueue, neither covers plots). In this compound window (DB-tx fail AND no prompt retry) the plot is genuinely stranded/unbuyable.

**Hardening (if pursued):** (a) before marking `'failed'` at 2090-2098, look up the payment txid on-chain (indexer/algod) and treat confirmed→idempotent-persist, never `'failed'`; (b) add a sweep over non-terminal prepare rows that re-checks the txid on-chain and runs the idempotent persist without re-submitting (works past lastValid via indexer, not sendRawTransaction). See [[verify-algo-payment]].

algosdk v3 `waitForConfirmation` (node_modules/algosdk/dist/cjs/wait.js): polls `pendingTransactionInformation(txid)`; returns on `confirmedRound`; swallows 404 (post-retention) and throws "not confirmed after N rounds".
