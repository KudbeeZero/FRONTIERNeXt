---
name: algosdk-v3-indexer-shape
description: algosdk v3 indexer .do() returns typed class instances (camelCase, bigint, string addresses) — kebab-case keys are always undefined
metadata:
  type: project
---

algosdk is pinned at ^3.5.2 (installed 3.5.2). Confirmed via node_modules/algosdk/package.json.

**Indexer `.do()` deserializes JSON into typed model class instances**, not raw REST JSON.
`lookupTransactionByID(txId).do()` → `TransactionResponse` (proof: node_modules/algosdk/dist/cjs/client/v2/indexer/lookupTransactionByID.js `prepare()` calls `decodeJSON(text, TransactionResponse)`).

**Why:** This means kebab-case REST keys (`tx-type`, `confirmed-round`, `payment-transaction`, `asset-id`) DO NOT EXIST on the returned objects — they are always `undefined`. Only the camelCase typed fields are populated. Code using `obj["kebab-key"] ?? obj.camelKey` works ONLY because the camelCase fallback fires every time; the kebab read is dead code.

**Confirmed field names/types** (node_modules/algosdk/dist/types/client/v2/indexer/models/types.d.ts):
- `Transaction.txType?: string` (value `"pay"`, `"axfer"`, etc.) — line ~2500
- `Transaction.sender: string` — a STRING, NOT an Address object — line ~2334
- `Transaction.confirmedRound?: bigint` — line ~2378
- `Transaction.paymentTransaction?: TransactionPayment` — line ~2457
- `Transaction.rekeyTo?: Address`, `closeRewards?`, `closingAmount?` present
- `TransactionPayment.amount: bigint` — microAlgos — line ~3039
- `TransactionPayment.receiver: string` — STRING — line ~3043
- `TransactionPayment.closeRemainderTo?: string` — line ~3053
- `TransactionResponse.transaction: Transaction` — line ~3090 (camelCase; no kebab `transaction` variant)

**Runtime codec confirmation** (node_modules/algosdk/dist/cjs/client/v2/indexer/models/types.js): `Transaction.sender` and `TransactionPayment.receiver` decode via `StringSchema()` → plain strings at runtime (not just per .d.ts). By contrast `authAddr`/`rekeyTo` decode via `Address.fromString` → Address OBJECTS. So address string-compares are correct ONLY for sender/receiver; NEVER string-compare authAddr/rekeyTo without `.toString()`.

**How to apply:** For any v3 indexer/algod read in this codebase, string comparisons of `sender`/`receiver` are SAFE (they are strings here). But `amount`/`confirmedRound` are `bigint` — wrapping in `Number()` is fine for amounts ≤ 2^53 but loses the bigint guarantee; mixed bigint/number comparisons throw `TypeError`. Note algod (not indexer) and some account-info reads may differ — verify per call site. See [[verify-algo-payment]].
