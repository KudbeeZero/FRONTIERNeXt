---
name: verify-algo-payment
description: verifyAlgoPayment in commander.ts is the single ALGO payment verifier for BOTH plot purchases and commander mints; server-authoritative price; has a payment-replay gap
metadata:
  type: project
---

`verifyAlgoPayment` — server/services/chain/commander.ts ~L204-255.

**Single verifier reused for two flows** (server/routes.ts):
- Plot purchase: L1688, `minMicroAlgo = Math.round((parcel.purchasePriceAlgo ?? 0) * 1_000_000)` from DB.
- Commander mint: L1925, `minMicroAlgo = Math.round(COMMANDER_ALGO_PRICE_ACTIVE[tier] * 1_000_000)` from server constant.
Both prices are SERVER-AUTHORITATIVE (never client-supplied). Good.

**Checks performed:** confirmedRound > 0; txType === "pay"; sender === expectedSender; receiver === adminAddr; amount >= minMicroAlgo. Returns amountMicroAlgo.

**Why the kebab/camel `??` fallbacks exist:** algosdk was upgraded to v3 (see [[algosdk-v3-indexer-shape]]); indexer responses became typed camelCase class instances. The kebab reads (`txn["tx-type"]`, `["confirmed-round"]`, `["payment-transaction"]`) are now always undefined; the camelCase fallback is the only live branch. The txType camelCase fallback fix is CORRECT.

**KNOWN GAPS (flag on every review until fixed):**
1. **Payment replay / no txId consumption.** The payment txId is NEVER recorded as spent. Idempotency keys are `mint:{playerId}:{plotId}` and `cmdr:mint:{playerId}:{commanderId}` (keyed on game entity, not payment). One real ALGO payment of price P can satisfy verification for multiple distinct purchases (different plots/commanders) and survives server restarts. Fix: persist consumed txIds with a UNIQUE constraint and reject reuse inside verifyAlgoPayment (or atomically at the call site).
2. **No max-amount / closeRemainderTo / rekey check.** Verifier only checks `amount >= min`. It does not inspect `paymentTransaction.closeRemainderTo` or rekeyTo of the inbound payment (low risk for an inbound pay to admin, but worth noting).
3. **`amount` is bigint → wrapped in Number().** Safe for realistic microAlgo magnitudes; do not introduce bigint/number mixed comparisons.
4. **Null parcel price → minMicroAlgo = 0.** `purchasePriceAlgo` is a nullable `real` column (server/db-schema.ts:199; shared/schema.ts:213 `number | null`, no default, no notNull). routes.ts:1685 does `(parcel.purchasePriceAlgo ?? 0) * 1e6`, so a null/0-price parcel sets minMicroAlgo=0 and ANY payment (even 1 microAlgo self-pay) passes `amount >= 0`. Buy-below-price vector. Fix: reject minMicroAlgo<=0 in the verifier and/or make the column notNull with a floor price.

**How to apply:** Treat the v3 type-shape fix as safe to ship, but do NOT describe this verifier as trustworthy against double-spend until the replay/txId-consumption gap is closed. See [[human-audit-areas]].
