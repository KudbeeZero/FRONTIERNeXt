# Session: 2026-06-10 — Payment/Chain Gate Diagnosis + Phase 1 Fix

**Branch:** `fix/payment-replay-algod-finality` (off `wip/atomic-purchase`)
**Commit:** `3a0359e` · **PR:** → `wip/atomic-purchase` (see GitHub)
**Status:** Phase 1 DONE, reviewed (algo-auditor PASS), runtime-verified (PASS). Phases 2–4 open.

## Why this work
Diagnose + fix the payment/chain "gates" protecting the economy. Anchored to
`docs/audit/chain-services-audit.md` + `.claude/agent-memory/algo-auditor/*`, then
**reconciled against current code**.

## Key diagnosis (read before touching payments)
- The purchase flow is **half-migrated**: the live client uses the **legacy**
  `POST /api/actions/purchase` (`server/routes.ts:1685`); the hardened atomic
  `/prepare`+`/submit` path + `delivery-worker.ts` are built server-side but the
  client never calls them, and the worker's DELIVERED/STAMPED funds phases are stubbed.
- `chain-services-audit.md` is **STALE** (pre the ~13:05 atomic refactor). Its
  "gratis purchase" / "verifyAlgoPayment is dead code" / null-price claims are
  already FIXED on the live path. Trust the `algo-auditor` agent-memory notes (10:52).

## What was built (Phase 1 — fixes D1 + D2)
- **D2 — finality via algod (HARD RULE #2):** `verifyAlgoPayment`
  (`server/services/chain/commander.ts`) now reads the confirmed payment from
  **algod** `pendingTransactionInformation`, with an indexer fallback only for
  archived txns. Rejects `closeRemainderTo`/`rekeyTo` riders; hoisted the dynamic
  `getAdminAddress` import.
- **D1 — replay guard (HARD RULE #3):** new `consumed_payment_txids` table
  (`server/db-schema.ts`, txid PK) + `consumePaymentTxid`
  (`server/services/payment-dedup.ts`). Legacy purchase and commander mint now
  **verify → consume → grant**, fail-closed (a consumed txid is never released).
- Tests: `commander.spec.ts` + `payment-dedup.spec.ts` (13). `tsc` clean; 128/128 server tests.

## Verification (runtime, against live testnet nodes)
Booted the server, drove `POST /api/actions/purchase`:
- Bogus txid → 402, log `Payment txn not found (algod + indexer)` — algod+indexer fallback both ran.
- Real testnet pay txid → 402, log `Payment sender mismatch: got GD64YIY3… expected C7RU…` —
  proves real-transaction field parsing works (the risk unit-test mocks couldn't cover).
- Missing txid → 400. Verdict **PASS**. (Reached the verifier with `WALLET_AUTH_REQUIRED=false`
  shell var only — never written to `.env`.)

## OPEN / backlog (next shift)
1. **Deploy gate:** run `drizzle-kit push` to create `consumed_payment_txids` BEFORE deploy.
   Until then a real successful purchase 500s at the consume step (fail-closed, no double-spend).
2. **Runtime-unverified:** the D1 replay path (buy → replay same txid → 409) couldn't be driven
   without a funded testnet wallet; covered by unit tests + the DB PK only.
3. **LOW (pre-existing):** `getAdminAddress()` can return `""` if admin fails to load
   (`client.ts:170`) → confusing 402 instead of a clear startup error. Fail fast at boot.
4. **Phase 2** — finish atomic migration: complete `delivery-worker` funds phases (behind the
   algo-auditor gate), add rate-limit + per-player cap to `/prepare` (mint-on-prepare DoS),
   enforce `WALLET_AUTH_REQUIRED` for atomic endpoints, split the false-402 in
   `plot-purchase-group.ts submit`, wire the client to `/prepare`→sign→`/submit`.
5. **Phase 3** — retire legacy `/api/actions/purchase` once client is on atomic.
6. **Phase 4** — re-mint FRONTIER ASA with clawback (live ASA has none → `fireBurn` silently fails);
   migrate balances. (User decision: re-mint, not buyer-signed burn.)
7. **Integration:** `wip/atomic-purchase` epic → `main` is a separate gated merge (the epic history
   contains a "do NOT merge" snapshot commit — clean it up before merging to main).

Full plan: `~/.claude/plans/pure-whistling-leaf.md`. Run the **algo-auditor** gate
(`.claude/agents/algo-auditor.md`; not a harness subagent_type — run inline) before any
commit touching chain/ASA/economy code.
