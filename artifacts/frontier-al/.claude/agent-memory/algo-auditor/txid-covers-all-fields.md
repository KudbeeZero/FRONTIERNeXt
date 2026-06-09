---
name: txid-covers-all-fields
description: algosdk v3 txID() is a hash over ALL consensus fields (rekey, close, aclose, grp, sender, amt, asset) — txID-match is a sound never-trust-client guarantee.
metadata:
  type: project
---

In algosdk 3.5.2, `Transaction.txID()` = base32(genericHash(TX_TAG || toByte())), and `toByte()` = msgpack of `toEncodingData()`. Verified at `node_modules/algosdk/dist/cjs/transaction.js`:
- `toEncodingData()` (line 388) ALWAYS includes top-level `rekey` (rekeyTo) and `grp` (group id), plus per-type `close` (payment closeRemainderTo) and `aclose`/`asnd` (assetTransfer closeRemainderTo/assetSender), receiver, amount, assetIndex, sender, fee, fv/lv.
- `rawTxID()` (line 740) hashes exactly those bytes.

**Why:** The atomic plot-purchase /submit (server/services/chain/plot-purchase-group.ts `submitPlotPurchaseGroup`) trusts the client-signed txn0/txn1 ONLY via `d.txn.txID() === expected`. This is sound precisely because txID covers every field a malicious client could alter (receiver, amount, assetId, sender, AND added rekey/close/group). A match is a sufficient guarantee — no per-field re-check needed.

**How to apply:** When reviewing any "compare decoded txID to prepared txID" trust boundary in this repo, treat the txID-match as covering rekey/close/group too — do NOT flag missing per-field checks as a finding. The ONE thing txID-match does NOT prove is signature validity/signer identity (decodeSignedTransaction does not verify the sig) — but sender is pinned by txID and algod validates the sig on submit, so a wrong/garbage sig just fails the atomic group (no fund/NFT effect). assertNoRekeyOrClose field paths (`t.rekeyTo`, `t.payment?.closeRemainderTo`, `t.assetTransfer?.closeRemainderTo`) match the v3 shape. See [[verify-algo-payment]].
