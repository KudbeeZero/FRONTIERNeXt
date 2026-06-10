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

### Status: 💣 DEFUSED — tripwires `cf33592`, cut `2d7ab83`, suite green (171).

---

## TARGET 2 — PAYMENT REPLAY (verifyAlgoPayment trust boundary)

### Device Diagram (Phase 1)

**Mechanism** (`server/services/chain/commander.ts:204`, consumed by
`/api/actions/purchase` at `routes.ts:1589` and `/api/actions/mint-avatar`
at `routes.ts:1826`):

`verifyAlgoPayment({txId, expectedSender, minMicroAlgo})` is a **stateless**
indexer lookup. It checks confirmed-round > 0, tx-type == "pay", sender ==
buyer, receiver == admin wallet, amount >= price — and then forgets the txid
forever. No table records redemption; `plot_nfts` has no payment column at
all; `commander_nfts.algo_payment_tx_id` is written post-mint with no unique
constraint and is never read back.

**Trigger paths:**
- T1: one payment ≥ plot price → POST purchase for plot A, then plot B, C…
  Same txid passes verification every time. Free plots, bounded only by the
  21,000-plot supply.
- T2: one payment ≥ commander price → mint N commanders (idempotency key is
  `(playerId, commanderId)` which changes per avatar — never blocks).
- T3: cross-purpose — same payment for a plot AND a commander.
- T4: concurrent duplicates of the same request (both verify before either
  mutates).

**Secondary defect found in the same boundary:** the type check reads
`txn["tx-type"]` with no camelCase fallback. algosdk v3 (3.5.2 pinned)
indexer clients return camelCase models (`txType`), so against a real v3
response every verification THROWS — fail-closed (not exploitable) but a
launch-blocking outage of all paid flows. The surrounding fields already
have dual-shape fallbacks (`confirmed-round` ?? `confirmedRound`, etc.);
this one was missed.

**Why feared:** this is the front door of the revenue path. One missing
check = free plots / double-spends on day one, and the bug class is silent —
nothing errors when a replay succeeds.

### Blast radius (must be provably unchanged)

- The acceptance decision table for the recorded matrix: confirmed exact
  payment / overpayment accepted; not-found / unconfirmed / non-pay /
  wrong-sender / wrong-receiver / underpayment rejected with the same error
  classes. Encoded in `commander.spec.ts` (passes on current code).
- A first-use (legitimate) payment must still purchase exactly as before.
- No change to mint/transfer construction (Target 1 tripwires still guard).

### The Cut (Phase 3)

1. `redeemed_payments` table (txId PRIMARY KEY = atomic global uniqueness),
   authored as staged migration `0005_redeemed_payments.sql` + db-schema —
   **not executed tonight** (morning runbook below).
2. `createPaymentReplayGuard(store)` in `security.ts` — dependency-injected,
   fully unit-testable: claim-once semantics, release-on-failed-purchase,
   fail-CLOSED when the store errors (block sales rather than allow replay),
   in-memory fallback only when no store exists (dev/mem mode).
3. Wire into both routes: claim AFTER chain verification succeeds, BEFORE
   any state mutation; 409 on already-redeemed; release the claim if the
   downstream mutation throws (a failed purchase must not burn the buyer's
   payment).
4. `tx-type` camelCase fallback in verifyAlgoPayment (in-boundary fix).

Long-term recommendation: dedicated payments ledger with amount/round
recorded, owner-facing receipts, and route-level integration tests.

### Status: 💣 DEFUSED — tripwires `a98c32f`, cut `90c4616`, suite green (188).

**Deploy-order constraint:** migration `0005_redeemed_payments.sql` MUST be
applied before this code reaches production. The guard fails closed: with
the table missing, all paid purchases return 503 (no replay risk, but no
sales either).

---

## TARGET 3 — resolveBattles CONCURRENCY

### Device Diagram (Phase 1)

**Mechanism** (`server/storage/db.ts:1600` resolveBattles, `:1115`
purchaseLand, `:1167` deployAttack; callers `routes.ts` admin endpoint
`/api/game/resolve-battles` + 15-second background interval):

- `resolveBattles()` fetches pending battles OUTSIDE any transaction, then
  resolves each in its own transaction with plain reads (no FOR UPDATE) and
  **unconditional** updates.
- `purchaseLand()` checks `ownerId == null` then blind-writes ownership; it
  never checks `activeBattleId`.
- `deployAttack()` checks `activeBattleId == null` then blind-writes it.

**Trigger paths:**
- R1 double-resolution: the 15s interval, the admin endpoint, and any second
  server instance can all pick up the same pending battle. Both transactions
  run the full effect set: defender `attacksLost`/`consecutiveLosses` SQL
  increments apply TWICE, defense halves twice, pillage/cascade effects
  duplicate, events duplicate.
- R2 purchase-vs-resolve: a buyer can pay real ALGO for a parcel that is
  mid-battle (purchase has no under-attack check); when the battle resolves
  attacker-wins, the resolution snapshot blind-writes ownership and the paid
  purchase is erased. Reverse interleaving silently reverts a capture.
- R3 double-deploy: two concurrent deployAttack calls both pass the
  activeBattleId pre-check → two pending battles on one parcel → R1-style
  double effects at resolution.

**Why feared:** corrupted ownership/resource state across 21,000 plots is
unrecoverable trust damage, and R2 is a money path (ALGO paid, plot gone).

### Blast radius (must be provably unchanged)

- Deterministic resolution outcomes for fixed fixtures (`resolve.spec.ts`,
  already in suite) — resolution math untouched.
- Storage contract encoded in `battle-concurrency.spec.ts` (passes on
  current code): under-attack deploy rejection, exactly-once sequential
  resolution, activeBattleId lifecycle, ownership transfer on attacker win,
  purchase accept/reject semantics.

### The Cut (Phase 3)

Claim-based conditional writes — every failure mode degrades to "skip and
retry/refuse", never to a double effect:

1. resolveBattles: battle status update becomes the atomic claim
   (`WHERE id = ? AND status = 'pending'` + RETURNING); zero rows ⇒ another
   resolver owns this battle ⇒ skip all effects.
2. deployAttack: `SET active_battle_id WHERE active_battle_id IS NULL` +
   RETURNING; zero rows ⇒ "already under attack" (transaction rolls back).
3. purchaseLand: reject parcels with `activeBattleId` set (a battle's
   outcome is already locked — selling mid-battle strands someone); owner
   write becomes `WHERE owner_id IS NULL` + RETURNING; zero rows ⇒ "already
   owned". The purchase route releases the payment-replay claim on throw, so
   the buyer's ALGO stays redeemable.
4. mem.ts purchaseLand gets the same under-attack rejection (storage parity).

**Honest testability note:** the conditional-WHERE semantics are PostgreSQL
behavior; CI has no postgres and new deps (pg-mem/testcontainers) are
forbidden tonight. The mem-storage contract tests + tsc + the
skip-not-corrupt failure analysis are the containment; a real-PG integration
test is the explicit daytime work order.

Long-term recommendation: SELECT … FOR UPDATE on parcel rows in all three
writers, single-flight resolveBattles (advisory lock), and idempotent event
emission.

### Status: 💣 DEFUSED — tripwires `827717d`, cut `64e18bc`, suite green (194).

---

## BOMB SQUAD REPORT — 2026-06-10

> ⚠️ FOR THE MAINNET-GATE AGENT: items 1–3 below were all live money-path
> defects on the launch surface. Item 2's staged migration has a hard
> deploy-order constraint. The STILL ARMED list contains one ungated admin
> surface (orbital) that should be a one-line daytime fix.

### 💣 DEFUSED

1. **NFT delivery hijack** (`/api/nft/deliver/:plotId`,
   `/api/nft/deliver-commander/:commanderId`) — public endpoints transferred
   custody-held, paid-for 1-of-1 NFTs to any caller-supplied address; the
   only guards (admin custody + ASA opt-in) are both attacker-satisfiable.
   Cut: `evaluateNftDeliveryClaim()` ownership gate in `security.ts` — exact
   match against the in-game owner's registered wallet, before any chain
   call. Tripwires: txn-construction snapshots for mint/transfer +
   `attemptDelivery` semantics (`land.spec.ts`), delivery decision table
   (`security.spec.ts`). Attacker trace: opt-in + POST now dies at 403
   `not_owner` with zero chain interaction. Commits `cf33592` → `2d7ab83`.

2. **Payment replay** (`/api/actions/purchase`, `/api/actions/mint-avatar`)
   — `verifyAlgoPayment` is a stateless indexer read; one confirmed payment
   could buy unlimited plots/commanders, concurrently and across purposes.
   Cut: `redeemed_payments` table (tx_id PK, staged migration 0005) +
   `createPaymentReplayGuard` (claim-once via INSERT-ON-CONFLICT, release on
   failed mutation, fail-CLOSED on store errors). Also fixed in-boundary:
   the tx-type check now accepts algosdk v3 camelCase models — against a
   real v3 indexer response the old check threw on ALL payments (fail-closed
   outage of every paid flow; we are pinned to algosdk ^3.5.2). Tripwires:
   9-case acceptance decision table (`commander.spec.ts`), replay-guard
   semantics incl. concurrent single-winner (`security.spec.ts`). Attacker
   trace: second redemption → 409 before any state mutation. Commits
   `a98c32f` → `90c4616`.

3. **resolveBattles concurrency** (`storage/db.ts`) — pending battles
   fetched outside any transaction + unconditional writes ⇒ the 15 s
   interval / admin endpoint / second instance double-apply all resolution
   effects; purchase had no under-attack check and could be erased by a
   resolving battle after the buyer paid ALGO. Cut: claim-based conditional
   writes in resolveBattles / deployAttack / purchaseLand (every lost race
   degrades to skip/refuse, never double effects) + mem parity. Tripwires:
   storage battle/purchase contract (`battle-concurrency.spec.ts`) +
   existing deterministic-outcome fixtures. Commits `827717d` → `64e18bc`.

Verification: `tsc` clean, full server suite green (194 tests, 28 new
tonight), production build green. All chain interaction in tests is mocked;
no migration was executed.

### 🧨 ATTEMPTED — REVERTED

None. Three targets, three cuts, zero tripwire failures.

### 🚧 STILL ARMED (untouched, priority order)

1. **`POST /api/orbital/trigger` + `/api/orbital/resolve/:id` are ungated**
   (`routes.ts:2457–2480` pre-shift numbering) — any client can force or
   cancel orbital impact events (economy/gameplay disruption, not direct
   theft). One-line fix: `requireAdminKey` on both. Found by tonight's admin
   recon; deliberately left to stay within the 3-target cap.
2. **`/api/weapons/mint-nft` delivers to `action.receiverAddress`**
   (`routes.ts:2237` area) — session-gated, but the receiver address is
   caller-supplied rather than the session wallet. Same device class as
   Target 1, lower severity. Apply the `evaluateNftDeliveryClaim` pattern.
3. **`WALLET_AUTH_REQUIRED=false` accepted in production** — body-supplied
   playerId is trusted when the flag is off; add startup enforcement
   (fail boot if prod && !walletAuthRequired).
4. **`/api/nft/retry-commander/:commanderId`** requires only knowledge of
   playerId+commanderId (no session binding) — can grief by resetting
   idempotency keys. Low severity, session-bind it.
5. Standing list items not reached: auth session edges around the flow,
   ECONOMY_MODE flip harness (below).

### 📐 LONG-TERM FIXES RECOMMENDED

- Delivery endpoints should require the authenticated wallet session
  (`getAuth`) instead of address-matching, once WALLET_AUTH_REQUIRED is
  enforced; extract route handlers into testable modules for HTTP-level
  tripwires.
- Dedicated payments ledger (amount, round, receipt) instead of the minimal
  `redeemed_payments` row; UNIQUE index on `commander_nfts.algo_payment_tx_id`
  as belt-and-braces.
- Real-postgres integration tests (testcontainers) for the conditional-WHERE
  claims in db.ts — tonight's verification is mem-contract + analysis only.
- `SELECT … FOR UPDATE` row locking + advisory-lock single-flight for
  resolveBattles; idempotent event emission.
- NFT-follows-capture semantics: after a battle capture, the previous owner's
  delivered NFT no longer matches in-game ownership — decide and document the
  canonical rule (clawback on testnet? in-game-state-is-truth disclaimer?).

### 🌅 MAINNET-DAY RUNBOOKS AUTHORED

- **Migration 0005 (`redeemed_payments`)** — staged, NOT executed. Apply
  BEFORE deploying any build containing these commits:
  `psql "$DATABASE_URL" -f migrations/0005_redeemed_payments.sql` (or
  `pnpm run db:push`). If the table is missing the replay guard fails
  CLOSED: all paid purchases return 503 (no replay risk, but no sales).
  Verify post-deploy: a repeated `algoPaymentTxId` purchase returns 409.
  If a buyer's purchase fails after claiming (crash window), their txid may
  be stranded in `redeemed_payments` — recover with a manual row delete
  after verifying they received nothing.
