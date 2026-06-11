# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `claude/night-shift-01b8vc`
- **PR:** [#15](https://github.com/KudbeeZero/FRONTIERNeXt/pull/15) (docs-only: review report + baton)
- **Audit status:** `AWAITING_AUDIT`

## What this chat did (for the auditor)
Flattened the PR pileup into `main` at the owner's explicit request, then ran a
7-angle code review of everything that landed:
- **Merged** #11 (admin boot failfast), #7 (tutorial removal + test-globe),
  #12 (Bomb Squad security fixes + ASCEND rename), #8 (this protocol) →
  `main` = `24c4184`, push verified.
- **Closed unmerged:** #10 (competing replay guard; its algod-finality check
  should be ported — see risks) and #6 (superseded hook). Conflict resolution:
  `.claude/hooks/session-start.sh` now does deps-install (remote) + baton print.
- **Verified on `24c4184`:** server suite 194/194 green, client 31/31 green,
  build green. **`pnpm run check` is RED — 255 pre-existing client tsc errors**
  (identical before/after the merges; `@types/react` 18/19 workspace split).
- **Review:** 9 findings, full report in
  [docs/audits/2026-06-11-merge-flatten-review.md](./audits/2026-06-11-merge-flatten-review.md).

## NEXT chat
- **Proposed branch:** `fix/client-typecheck-ci`
- **Scope (one line):** make `pnpm --filter @workspace/frontier-al run check`
  green (255 errors; `@types/react` 18 vs 19 split across the workspace) — the
  CI typecheck step is red on `main`, which breaks this protocol's audit gate
  until fixed.
- **Right after that (separate unit):** `fix/endpoint-gating` — gate
  `/api/orbital/trigger` + `/api/orbital/resolve/:id` (admin key) and
  session-bind `/api/nft/retry-commander/:commanderId` (review findings #1),
  plus the one-line `frontier:`→`ascend:` fix at
  `client/src/hooks/useGameState.ts:166` (finding #2).
- **Open risks (read these):**
  - ⚠️ **CI is red on `main`** (typecheck step) — pre-existing, not from the
    merges. Until fixed, `/handoff-audit` cannot confirm green from CI alone;
    use the vitest suites + build as the interim bar.
  - ⚠️ **Before any deploy:** apply `migrations/0005_redeemed_payments.sql`
    (e.g. `drizzle-kit push`). The replay guard fails closed — without the
    table, every paid purchase 503s. No boot-time check exists (finding #3).
  - ⚠️ Ungated endpoints above are a **live attack surface** (finding #1).
  - ⚠️ `wip/atomic-purchase` remains unmerged (history contains a "do NOT
    merge" snapshot). Closed PR #10's algod-first finality check +
    `closeRemainderTo`/`rekeyTo` rider rejection are worth porting to `main`'s
    `verifyAlgoPayment`.
  - ⚠️ Mint-on-prepare DoS (no rate limit on `/api/actions/*`) still open.
- **Off-limits:** do not merge `wip/atomic-purchase`; no funds/ASA/transfer code
  to mainnet without `mainnet-gate`; no funds-moving phase ships without an
  `algo-auditor` pass first.
