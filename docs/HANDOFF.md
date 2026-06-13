# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `claude/transactions-plane-game-status-vu6xqr`
- **PR:** [#18](https://github.com/KudbeeZero/FRONTIERNeXt/pull/18) (security
  hardening of the transactions surface)
- **Audit status:** `AWAITING_AUDIT`
- Note: previous PR **#17 was merged directly by the owner** (`bfea649` on
  `main`, merged 2026-06-13) — treat its audit as waived-by-owner, same as #15.
- **CI is GREEN again.** The baton's long-standing "255 client typecheck errors"
  claim is **stale**: `pnpm --filter @workspace/frontier-al run check` now exits 0
  on `main`+this branch. The audit gate works again — no longer relying on the
  vitest-only interim bar.

## What this chat did (for the auditor)
Owner asked to check status, fix errors, and push the transactions game toward
secure+working. Finding: the transaction loop (wallet payment → `verifyAlgoPayment`
→ replay guard → grant land/commander → async NFT delivery) **already exists and
works** (server 202/202). Shipped one security-hardening unit closing baton risks:
- **`verifyAlgoPayment` rejects close-remainder / rekey riders** (fail-closed;
  +5 tripwire tests, kebab + camelCase shapes).
- **Gated `/api/orbital/trigger` + `/api/orbital/resolve/:id`** behind
  `requireAdminKey` (were ungated mutation endpoints; no legitimate caller exists).
- **Session-bound `/api/nft/retry-commander/:commanderId`** via
  `assertPlayerOwnership`; fixed its client caller to use `apiRequest` so the
  session token is actually sent (raw `fetch` would have 401'd — caught in review).
- **Fixed `useMintAvatar` optimistic update** (`frontier`→`ascend`, real per-tier
  `mintCostAscend` instead of hardcoded -50).
- **Verified:** tsc 0 errors, server 202/202, client 31/31, build green.

## NEXT chat
- **Proposed branch:** `feat/verify-finality-and-rate-limit` (or split).
- **Scope options (one unit each):**
  1. **Port PR #10's algod-first finality check** into `verifyAlgoPayment`
     (currently indexer `confirmed-round` only). **Funds-economic → run
     `algo-auditor`.** The rider-rejection from this chat is the companion fix.
  2. `feat/rate-limit-actions` — rate-limit `/api/actions/*` to close the
     mint-on-prepare DoS (no limiter today).
  3. `feat/veritas-land-flow` — robot land purchase (testnet payment →
     `POST /api/actions/purchase` → assert ownership + replay guard).
  4. `feat/veritas-commander-flow` — commander mint (payment + ASCEND clawback).
  5. Kestra queue (from #17): remediation → auto-triage → chaos drills.
- **Owner setup (not code):**
  - **Before any deploy:** apply `migrations/0005_redeemed_payments.sql` — replay
    guard fails closed; without the table every paid purchase 503s.
  - Import `ops/kestra/*.yml` into the Kestra VM (router first), create the 3
    Discord webhooks + responder role, set secrets per `ops/kestra/README.md`.
- **Open risks:**
  - ⚠️ `verifyAlgoPayment` finality is indexer-only (no algod cross-check) — #1 above.
  - ⚠️ No rate limit on `/api/actions/*` (mint-on-prepare DoS) — #2 above.
  - ⚠️ Migration 0005 must be applied before deploying the replay guard.
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/`
  may point at mainnet; no funds/ASA/transfer code to mainnet without
  `mainnet-gate`; no funds-moving phase ships without an `algo-auditor` pass.
