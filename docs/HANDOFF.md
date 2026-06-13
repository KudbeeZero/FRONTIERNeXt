# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `claude/handoff-audit-t5ci91`
- **PR:** [#19](https://github.com/KudbeeZero/FRONTIERNeXt/pull/19) (gameplay-loop
  playthrough regression test + independent audit of PR #18)
- **Audit status:** `AWAITING_AUDIT`
- **CI is GREEN:** `check` 0 errors, `test:server` **210/210** (was 202),
  `test` **31/31**.

## What this chat did (for the auditor)
1. **Audited PR #18 independently (verdict PASS).** PR #18 was already
   owner-merged (`c292138`); a fresh adversarial auditor re-derived PASS from the
   diff + tests (all 5 security claims verified with file:line evidence, suites
   green, zero scope creep, fail-closed hardening). Replaced the previous chat's
   in-PR self-audit with this independent one at
   `docs/audits/claude-transactions-plane-game-status-vu6xqr.md`. One pre-existing
   LOW note: `assertPlayerOwnership` trusts `req.body.playerId` when
   `WALLET_AUTH_REQUIRED=false` (repo-wide, out of scope).
2. **Shipped one unit: a full gameplay-loop playthrough test** —
   `server/storage/gameplay-loop.spec.ts` (+8 tests, server 202→210). Drives the
   real storage layer (MemStorage, no DB/chain/funds) through:
   bootstrap player → welcome bonus → **acquire land** → **mine resources** →
   collect → **accrue + claim ASCEND** → **mint commander**, asserting each state
   transition AND its guard (double-purchase, mining cooldown, insufficient-ASCEND
   mint). This makes "can a player get land, mine, earn ASCEND, mint" a
   reproducible CI check.
   - **Explicitly NOT covered (untested, by design):** the HTTP route layer
     (ALGO `verifyAlgoPayment`, redeemedPayments replay guard, session auth) and
     the on-chain NFT mint/delivery/retry — both need a live testnet + admin
     wallet, which this container does not have. MemStorage ≠ DbStorage parity.

## NEXT chat
- **Proposed branch:** `feat/route-loop-integration-test` (or pick from below).
- **Scope options (one unit each):**
  1. **Route-layer loop test:** mount the real `/api/actions/*` handlers with a
     mocked storage singleton (`vi.mock`) + mocked `verifyAlgoPayment`, and assert
     the purchase path including the **replay guard** (redeemedPayments) and auth
     wiring — the gap the storage-level playthrough does not reach. CI-testable.
  2. **Port PR #10's algod-first finality check** into `verifyAlgoPayment`
     (currently indexer-only). **Funds-economic → run `algo-auditor`.**
  3. `feat/rate-limit-actions` — rate-limit `/api/actions/*` (mint-on-prepare DoS;
     no limiter today).
  4. `feat/veritas-land-flow` / `feat/veritas-commander-flow` — implement the
     stubbed veritas robot flows (`server/veritas/flows/index.ts`). **These run
     only against a live testnet** (need `VERITAS_TEST_MNEMONIC`, funded wallet,
     `VERITAS_FRONTIER_ASA_ID`) — cannot be validated in-container.
- **Open risks:**
  - ⚠️ Live payment verification + on-chain NFT flow remain **unvalidated** in
    CI (need testnet) — only the in-game mechanics are regression-covered.
  - ⚠️ `verifyAlgoPayment` finality is indexer-only (no algod cross-check) — #2.
  - ⚠️ No rate limit on `/api/actions/*` (mint-on-prepare DoS) — #3.
  - ⚠️ Migration `0005_redeemed_payments.sql` must be applied before deploying the
    replay guard (else every paid purchase 503s).
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/`
  may point at mainnet; no funds/ASA/transfer code to mainnet without
  `mainnet-gate`; no funds-moving phase ships without an `algo-auditor` pass.
