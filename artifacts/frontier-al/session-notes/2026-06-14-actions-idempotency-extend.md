# 2026-06-14 — Extend idempotency-nonce guard to build & upgrade

**Branch:** `claude/actions-idempotency-extend-2qpwrn`
**Head commit:** (set at closeout — final baton commit on this branch)
**PR:** #27 → `main` — _AWAITING_AUDIT_ (CI: green expected; "Typecheck & server tests")
**Prev PR:** #26 independently audited **PASS** (`docs/audits/feat-actions-idempotency-nonce.md`) + merged (`9da5f5f`) at the start of this session.

## What shipped (test-backed)
Extended PR #26's `createActionIdempotencyGuard` to the next-highest-risk mutating
actions — **build** and **upgrade** — reusing the existing helper (no redesign):
- **`idempotencyGuard.ts`** — added an optional `scope.target` folded into the key:
  `${action}:${playerId}:${target}:${nonce}` (target-less key unchanged → claim-frontier
  is byte-for-byte identical; no migration, no regression).
- **`routes.ts`** — build & upgrade claim the nonce **before** the spend/mutation
  (`buildImprovement`/`upgradeBase`/`fireBurn`); `target = parcelId:type`;
  missing/malformed → 400, replay → 409, broken store → 503 (fail closed). Shared
  `idempotencyRejection()` helper for the safe status/error mapping.
- **`shared/schema.ts`** — optional `idempotencyKey` on build/upgrade schemas.
- **client `useBuild`/`useUpgrade`** — send a fresh `crypto.randomUUID()` per call
  (the live POST path; `queueBuild/UpgradeAction` no-op for server-authoritative
  actions). No UI change.
- **`idempotencyGuard.spec.ts`** — +11 tests (server 225 → 236).

## Tests run (exact)
- `pnpm install --frozen-lockfile` → OK (lockfile unchanged, no new deps)
- `pnpm --filter @workspace/frontier-al run check` → **tsc 0 errors**
- `pnpm --filter @workspace/frontier-al run test:server` → **236/236 (30 files)** (+11)
- `pnpm --filter @workspace/frontier-al run test` → **45/45 (7 files)**

Root `pnpm run typecheck` still fails only in the pre-existing, unrelated
`artifacts/mockup-sandbox` package (not in CI; untouched).

## Security
`/security-pass` → **PASS**, report at
`artifacts/frontier-al/docs/audit/2026-06-14-actions-idempotency-extend.md`.
No new vuln (the change is a duplicate-prevention control). playerId in the key is
auth-verified by the global mutation middleware. No funds-logic change → no
`algo-auditor` needed (same posture as PR #26).

## Known risks / not covered
- **No `release()`** on the action guard (LOW, carried from #26) — a nonce stays
  consumed if the spend throws after the claim; fail-closed (no double-spend),
  fresh-UUID-per-call client means no lockout.
- **Genuine double-clicks** (two distinct nonces) are not blocked — that's
  rate-limiting/debounce, not idempotency. The control blocks replay/retry of an
  identical request (same nonce), per the unit's requirement.
- **No live-DB / HTTP-mount test** — same `routes.ts` import entanglement as
  #25/#26; the guard is unit-tested with the exact route scopes, the wiring
  verified by reading.
- **No rate limit on `/api/actions/*`** — pre-existing (baton risk).
- **Migration `0006_action_nonces.sql`** must be applied before deploy (no new
  migration this unit — target rides in the existing `key` column).

## Next unit (proposed)
`feat/rate-limit-actions` — per-IP/per-player limiter on `/api/actions/*`
(mint-on-prepare / double-click DoS), the natural complement to the nonce guard.
Alternatives: `chore/registerRoutes-testable` (enable a real HTTP route-mount test
of the 400/409/503 enforcement), a TTL/prune for `action_nonces`, or
`chore/align-vite-types`.

## Off-limits (unchanged)
Do not merge `wip/atomic-purchase`; nothing in `ops/kestra/` may point at mainnet;
no funds/ASA/transfer code to mainnet without `/mainnet-gate` **and** `algo-auditor`.
