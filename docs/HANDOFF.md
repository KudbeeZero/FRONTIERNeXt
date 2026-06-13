# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `claude/handoff-audit-t5ci91`
- **PR:** [#21](https://github.com/KudbeeZero/FRONTIERNeXt/pull/21) (mainnet-readiness
  workflow layer — process skills + docs)
- **Audit status:** `AWAITING_AUDIT`
- Note: **PR #20 was audited PASS (independent) and merged** this session
  (`2de5075`); its audit is at `docs/audits/claude-handoff-audit-t5ci91.md`.
- **CI gates green** (frontier-al scope = what `ci.yml` runs): `check` 0,
  `test:server` **210/210**, `test` **31/31**.

## What this chat did (for the auditor)
Across the relay this chat: audited #18 (PASS), shipped the gameplay-loop test
(#19, merged), added the `/end-session` skill (#20, audited PASS + merged), and
now ships the **mainnet-readiness workflow layer** (this PR #21) — **process
hardening only, no game behavior changed**:
- New skills `.claude/skills/`: **`/pr-gate`** (read-only pre-merge go/no-go;
  refuses duplicate/red/unknown/untested; prints Summary/Evidence/Blockers/Next),
  **`/security-pass`** (surgical security review, fix⇒test, findings →
  `artifacts/frontier-al/docs/audit/`), **`/mainnet-gate`** (read-only
  PASS/CONCERNS/FAIL; cannot PASS without command/test/doc evidence; the concrete
  impl of the gate CLAUDE.md references), **`/test-matrix`** (visible
  covered/partial/missing/blocked grid).
- **`/end-session`** improved: always writes a dated session note (branch/commit/
  PR/CI/tests/risks/next/off-limits), updates an existing PR instead of opening a
  duplicate, no-op note when nothing changed; fixed a broken `/loop` link.
- Docs: **`docs/MAINNET_READINESS_FLOW.md`** (how the gates compose) + a `CLAUDE.md`
  pointer.
- **Untested (honest):** skills are prompt-driven — no automated test executes
  them; verified by inspection + registration + green CI.

## ⚠️ Operator action needed
- **Stale PR #16** (`fix/client-typecheck-ci`, opened 2026-06-11) is still open —
  the real "one open PR at a time" violation (the audit of #20 flagged it). It is
  unrelated to this relay branch; please **close it** (the client typecheck is
  green now, so it's likely obsolete) to restore the invariant.
- **Pre-existing typecheck failure (out of scope):** root `pnpm run typecheck`
  fails only in `artifacts/mockup-sandbox` (vite/`@types/node` 20-vs-25 mismatch);
  fails on `origin/main` too, not in CI. Candidate follow-up: a dependency-align
  unit.

## NEXT chat
- **Proposed branch:** `feat/route-loop-integration-test`.
- **Scope options (one unit each):**
  1. **Route-layer loop test:** mount `/api/actions/*` with a mocked storage
     singleton (`vi.mock`) + mocked `verifyAlgoPayment`; assert the purchase path
     incl. the **replay guard** (redeemedPayments) + auth wiring. CI-testable, and
     lets `/mainnet-gate` cite real evidence for those rows.
  2. **Port PR #10's algod-first finality check** into `verifyAlgoPayment`
     (indexer-only today). **Funds-economic → run `algo-auditor` + `/security-pass`.**
  3. `feat/rate-limit-actions` — rate-limit `/api/actions/*` (mint-on-prepare DoS).
  4. `chore/align-vite-types` — fix the `mockup-sandbox` root-typecheck failure.
  5. `feat/veritas-land-flow` / `feat/veritas-commander-flow` — **live-testnet only**
     (need `VERITAS_TEST_MNEMONIC`, funded wallet, ASA id); not CI-validatable.
- **Open risks:**
  - ⚠️ Live payment verification + on-chain NFT flow remain **unvalidated** in CI.
  - ⚠️ `verifyAlgoPayment` finality is indexer-only (no algod cross-check) — #2.
  - ⚠️ No rate limit on `/api/actions/*` — #3.
  - ⚠️ Migration `0005_redeemed_payments.sql` must be applied before deploying the
    replay guard.
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/`
  may point at mainnet; no funds/ASA/transfer code to mainnet without
  `/mainnet-gate` **and** `algo-auditor`; no funds-moving phase ships without that.
