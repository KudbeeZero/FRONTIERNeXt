# BOMB SQUAD WORKLOG — 2026-06-10

> Shift context: no prior `NIGHT-AUDIT-*.md` exists in this repo and the referenced
> settled commits (6e088dc, 63afc0f, bcbf55e) are not in this history — target list
> built from the standing known-scary list + fresh recon. Admin-gating recon found
> an ungated money-path surface, which jumped the queue per protocol.

## TONIGHT'S TARGETS

1. **NFT delivery hijack** — `POST /api/nft/deliver/:plotId` and
   `POST /api/nft/deliver-commander/:commanderId` are public and transfer
   custody-held (already paid-for) NFTs to ANY caller-supplied address.
2. **Payment replay** — `verifyAlgoPayment` is stateless; no txid is ever
   recorded as redeemed. One ALGO payment buys unlimited plots/commanders.
3. **resolveBattles races** — no row locking / in-transaction precondition
   re-checks; battle resolution can erase a concurrent purchase.

---

## TARGET 1 — NFT DELIVERY HIJACK

### Device Diagram (Phase 1)

**Mechanism** (`server/routes.ts:736` plot, `server/routes.ts:1020` commander):
both endpoints accept `{ address }` from an unauthenticated caller and run:

1. Load NFT row (`plot_nfts` / `commander_nfts`); 404 if no assetId.
2. Custody check: `row.mintedToAddress === getAdminAddress()` else
   `{success:false, reason:"not_in_custody"}`.
3. Opt-in check: `isAddressOptedIn(address, assetId)` else
   `{success:false, reason:"not_opted_in"}`.
4. **Transfer the 1-of-1 ASA from admin to `address`** and persist
   `mintedToAddress = address`.

**Trigger path (attacker with a wallet):**
- `GET /api/nft/plot/:plotId` is public and reveals assetId + custody state
  (`mintedToAddress` = admin ⇒ undelivered).
- Anyone can opt in to any ASA (zero-amount self-transfer).
- Attacker opts in, POSTs `deliver` with their own address → the buyer's
  paid-for NFT is transferred to the attacker. 1-of-1 asset ⇒ unrecoverable
  without clawback (clawback is intentionally disabled on mainnet config).

**Why the shift before us was afraid:** every purchased plot sits in the
custody window (mint → buyer opt-in), often hours for casual wallet users.
This is "user paid and owns nothing" — the exact stranded-money failure the
custodian design was built to avoid.

**Failure modes:**
- F1: attacker steals custody-held plot NFT (paying buyer loses asset).
- F2: attacker steals custody-held commander NFT.
- F3 (secondary): griefer delivers someone's NFT to a third address.

**Rightful owner derivation (for the cut):**
- Plot: `parcels.plotId → ownerId → players.address`.
- Commander: the player whose `commanders` JSONB array contains
  `{ id: commanderId }` (same rule the retry-commander endpoint uses at
  `routes.ts:959`, there gated by playerId knowledge — also weak, noted).

### Blast radius (must be provably unchanged)

- Transfer transaction construction for identical inputs (sender, receiver,
  amount=1, assetIndex, note, fee) — snapshot via mocked algod.
- Asset-create (mint) transaction construction for identical inputs.
- `attemptDelivery` semantics: not_opted_in / transfer_failed / delivered.
- Legitimate-owner delivery flow: owner calling with their registered wallet
  still receives the NFT; not-minted / not-in-custody / not-opted-in
  responses keep their shapes and `reason` strings.

### The Cut (Phase 3)

Smallest change: an exported pure decision function
`evaluateNftDeliveryClaim()` in `server/security.ts` (the established
cross-cutting security module), encoding the full decision table including a
new `not_owner` denial; both routes resolve the rightful owner's address and
call it before any chain interaction. 403 on mismatch. No schema change, no
new runtime files.

Long-term recommendation: deliveries should require the authenticated wallet
session (`getAuth`) rather than address matching, once WALLET_AUTH_REQUIRED
is enforced everywhere; and route handlers should be extracted to a testable
module so HTTP-level tripwires are possible.
