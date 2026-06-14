# 2026-06-14 — Action idempotency-nonce guard (PR #26)

## Branch & commit
- **Branch:** `feat/actions-idempotency-nonce`
- **Head commit:** `5893ec3` (security-pass report; baton commit follows on push)

## PR & CI
- **PR:** [#26](https://github.com/KudbeeZero/FRONTIERNeXt/pull/26) — idempotency-nonce
  guard for the ASCEND claim action. **Open, AWAITING_AUDIT.**
- **CI status:** running on push; locally verified green (see Tests).
- Relay context: **PR #25** audited PASS + merged (`089825b`).

## What shipped
- `server/idempotencyGuard.ts` (new) — `createActionIdempotencyGuard`: claim-once
  keyed `${action}:${playerId}:${nonce}`, DB-backed (`action_nonces`) + in-proc
  fallback, fail-closed, nonce-validated. Scoped by player.
- `server/routes.ts` — `claim-frontier` requires + claims the nonce before
  crediting (missing/malformed→400, replay→409, store down→503).
- `server/db-schema.ts` `action_nonces` + `migrations/0006_action_nonces.sql` (staged).
- `shared/schema.ts` optional `idempotencyKey`; client `useClaimAscend` sends
  `crypto.randomUUID()`.
- `server/idempotencyGuard.spec.ts` (+8 tests).
- `/security-pass`: `artifacts/frontier-al/docs/audit/2026-06-14-action-idempotency-nonce.md` (PASS).
- Recorded the independent PASS audit of PR #25.

## Tests run (exact results)
- `pnpm install --frozen-lockfile` → OK (lockfile unchanged)
- `pnpm --filter @workspace/frontier-al run check` → **tsc 0 errors**
- `pnpm --filter @workspace/frontier-al run test:server` → **225/225 (30 files)** (was 217, +8)
- `pnpm --filter @workspace/frontier-al run test` → **45/45 (7 files)**
- `pnpm run typecheck` (root) → still **FAILS only in `artifacts/mockup-sandbox`** (pre-existing; not in CI).

## Verified vs untested
- **Test-backed:** the guard's 6 required cases (first-ok / duplicate-blocked /
  different-player-no-collide / missing / malformed / safe-reason+fail-closed) +
  storeless claim-once + deterministic key — against REAL guard code.
- **Untested / not covered (honest):** the `claim-frontier` route wiring (require
  → 400/409/503) is verified by inspection + tsc, not an HTTP test (routes.ts
  import entanglement). Only `claim-frontier` enforced; `build`/`upgrade` not yet.

## Known risks
- Only `claim-frontier` guarded; `build`/`upgrade` still double-submittable.
- No HTTP route-mount test of enforcement. Migrations `0005`+`0006` must be applied
  before deploy. No TTL/prune on `action_nonces`. `verifyAlgoPayment` indexer-only;
  no rate limit on `/api/actions/*`.

## Next unit (proposed)
- **`feat/actions-idempotency-extend`** — extend the guard to `build`/`upgrade`
  (+ per-action tests) and add a TTL/prune for `action_nonces`. Or
  **`chore/registerRoutes-testable`** for a real HTTP route-mount test.

## Off-limits (unchanged)
- Do not merge `wip/atomic-purchase`; nothing in `ops/kestra/` points at mainnet;
  no funds/ASA/transfer code to mainnet without `/mainnet-gate` **and**
  `algo-auditor`; no funds-moving phase ships without that.

## Durable lesson
- Pattern for action idempotency: mirror `createPaymentReplayGuard` — a
  store-pluggable claim-once guard (DB table + in-proc fallback, fail-closed),
  keyed by `${action}:${playerId}:${nonce}` so it's player-scoped. Enforce at the
  route (require nonce → 400/409/503) and plumb `crypto.randomUUID()` from the
  client caller so gameplay isn't broken. Unit-test the guard (route mount is
  blocked by routes.ts import side-effects).
