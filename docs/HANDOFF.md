# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `feat/actions-idempotency-nonce`
- **PR:** [#26](https://github.com/KudbeeZero/FRONTIERNeXt/pull/26) (idempotency-nonce
  guard for the ASCEND claim action)
- **Audit status:** `AWAITING_AUDIT`
- Note: **PR #25 audited PASS (independent) + merged** (`089825b`); audit at
  `docs/audits/feat-route-loop-server.md`.
- **CI gates green** (frontier-al scope = `ci.yml`): `check` 0,
  `test:server` **225/225** (was 217, +8), `test` **45/45**.

## What this chat did (for the auditor)
Added a centralized **action idempotency/replay guard** and enforced it on the
highest-risk free action, `POST /api/actions/claim-frontier` (it credits ASCEND
**and** enqueues an on-chain transfer → double-submit could double-credit/pay):
- `server/idempotencyGuard.ts` — `createActionIdempotencyGuard` (mirrors
  `createPaymentReplayGuard`): claim-once keyed `${action}:${playerId}:${nonce}`,
  DB-backed (`action_nonces`, key PK) + in-proc fallback, **fail-closed**, nonce
  validated `/^[A-Za-z0-9_-]{8,128}$/`. Scoped by player → no cross-player collide.
- `routes.ts` — `claim-frontier` requires the nonce, claims BEFORE crediting:
  missing/malformed→400, replay→409, broken store→503.
- `db-schema` `action_nonces` + `migrations/0006_action_nonces.sql` (staged).
- `shared/schema` optional `idempotencyKey`; client `useClaimAscend` sends
  `crypto.randomUUID()` (metadata only — no UI change).
- `server/idempotencyGuard.spec.ts` (+8): first-ok / duplicate-blocked /
  different-player-no-collide / missing / malformed / safe-reasons+fail-closed /
  storeless claim-once / deterministic key.
- Ran **/security-pass** → PASS, no new finding; report at
  `artifacts/frontier-al/docs/audit/2026-06-14-action-idempotency-nonce.md`.
- **No new funds-movement code (transfer logic unchanged) → no algo-auditor
  trigger. No new deps.**
- **Not covered (honest):** only `claim-frontier` enforced — `build`/`upgrade`
  remain double-submittable; no HTTP route-mount test (guard unit-tested, wiring
  by inspection); migration `0006` staged (until applied, single-instance
  in-proc fallback); no TTL/prune on `action_nonces`.

## NEXT chat
- **Proposed branch:** `feat/actions-idempotency-extend` (or pick below).
- **Scope options (one unit each):**
  1. **Extend the guard** to the other double-submittable mutating actions
     (`build`/`upgrade`), with per-action tests; add a TTL/prune for
     `action_nonces`. (Touches a few routes — keep tight; client callers need the
     nonce plumbed like `useClaimAscend`.)
  2. **`chore/registerRoutes-testable`** — inject storage/chain into
     `registerRoutes` so the enforcement (require-nonce → 400/409/503) gets a real
     HTTP route-mount integration test (closes the "no route-mount test" gap).
  3. **Port PR #10's algod-first finality check** into `verifyAlgoPayment`
     (indexer-only today). **Funds-economic → `algo-auditor` + `/security-pass`.**
  4. `feat/rate-limit-actions` — rate-limit `/api/actions/*` (mint-on-prepare DoS).
  5. `chore/align-vite-types` — fix the pre-existing `mockup-sandbox` root-typecheck.
- **Open risks:**
  - ⚠️ Only `claim-frontier` is idempotency-guarded — `build`/`upgrade` aren't — #1.
  - ⚠️ No HTTP route-mount test of the enforcement — #2.
  - ⚠️ Migrations `0005` + `0006` must be applied before deploy (replay + nonce guards).
  - ⚠️ `verifyAlgoPayment` finality is indexer-only — #3.
  - ⚠️ No rate limit on `/api/actions/*` — #4.
  - ⚠️ No TTL/prune on `action_nonces` (unbounded growth) — #1.
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/`
  may point at mainnet; no funds/ASA/transfer code to mainnet without
  `/mainnet-gate` **and** `algo-auditor`; no funds-moving phase ships without that.
