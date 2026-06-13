# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `claude/handoff-audit-t5ci91`
- **PR:** [#20](https://github.com/KudbeeZero/FRONTIERNeXt/pull/20) (adds the
  `/end-session` skill)
- **Audit status:** `AWAITING_AUDIT`
- Note: previous PR **#19 was merged by the owner** (gameplay-loop playthrough
  test + independent #18 audit) — treat its audit as waived-by-owner, same as
  #17/#18. Its CI was green (typecheck + server 210/210 + client 31/31).

## What this chat did (for the auditor)
This chat ran across the relay: it **audited PR #18 (PASS)**, shipped the
**gameplay-loop playthrough test** (`server/storage/gameplay-loop.spec.ts`, server
202→210; merged as PR #19), then added one more unit:
- **`/end-session` skill** (`.claude/skills/end-session/SKILL.md`, this PR #20) —
  an umbrella "I'm done" command. It takes stock of session state and routes:
  unwrapped unit → run `/closeout`; PR already open → no duplicate; already
  merged → verify + keep baton truthful; nothing changed → say so. Always
  guarantees committed + pushed (ephemeral container), confirms green, writes a
  dated session note, prints a truthful report. **Docs/tooling only — no code
  changed.** Verified: frontmatter matches existing skills, it registers as
  `/end-session`, and the full CI triad is green (tsc 0 / server 210/210 /
  client 31/31).
  - **Untested (honest):** skills are prompt-driven, so there is no automated test
    that *executes* the skill end-to-end — verified by inspection + registration.

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
