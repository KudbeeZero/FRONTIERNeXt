# 2026-06-13 — Server route-loop auth/ownership hardening + tests (PR #25)

## Branch & commit
- **Branch:** `feat/route-loop-server`
- **Head commit:** `738e6d6` (security-pass report; baton commit follows on push)

## PR & CI
- **PR:** [#25](https://github.com/KudbeeZero/FRONTIERNeXt/pull/25) — centralize +
  test the route-loop auth/ownership decision. **Open, AWAITING_AUDIT.**
- **CI status:** running on push; locally verified green (see Tests).
- Relay context: **PR #24** audited PASS + merged (`501b770`).

## What shipped
- `server/routeOwnership.ts` (new) — pure `evaluateOwnership` helper; the single
  source of truth for the route-loop auth/ownership decision (401/403).
- `server/routes.ts` — global mutation middleware (`:389`) and
  `assertPlayerOwnership` (`:232`) rewired to call it. Behavior-preserving.
- `server/routeOwnership.spec.ts` (+7) — proves happy / missing-auth(401) /
  invalid-auth(403) / replay(already_redeemed) / malformed(zod) / safe-error-body,
  plus the `WALLET_AUTH_REQUIRED=false` posture, against REAL code.
- `/security-pass` report: `artifacts/frontier-al/docs/audit/2026-06-13-route-loop-auth-ownership.md` (PASS, no new finding).
- Recorded the independent PASS audit of PR #24.

## Tests run (exact results)
- `pnpm install --frozen-lockfile` → OK (lockfile unchanged)
- `pnpm --filter @workspace/frontier-al run check` → **tsc 0 errors**
- `pnpm --filter @workspace/frontier-al run test:server` → **217/217 (29 files)** (was 210, +7)
- `pnpm --filter @workspace/frontier-al run test` → **45/45 (7 files)**
- `pnpm run typecheck` (root) → still **FAILS only in `artifacts/mockup-sandbox`**
  (vite/`@types/node` mismatch; pre-existing; not in `ci.yml`).

## Verified vs untested
- **Test-backed:** the route-loop auth/ownership decision (the real code the live
  middleware + assertPlayerOwnership run); replay rejection; malformed-input
  rejection; generic error bodies. All 210 prior server tests still pass →
  behavior preserved.
- **Untested / not covered (honest):** no full HTTP route-mount test (routes.ts
  import is entangled — storage throws w/o DATABASE_URL, chain init, unref'd
  module setInterval); free/resource actions have no idempotency nonce.

## Known risks
- No idempotency nonce for free actions; no HTTP route-mount harness;
  `verifyAlgoPayment` indexer-only; no rate limit on `/api/actions/*`; schemas not
  `.strict()`; migration `0005_redeemed_payments.sql` must precede replay-guard deploy.

## Next unit (proposed)
- **`feat/actions-idempotency-nonce`** — optional `X-Idempotency-Key` guard for
  free/resource actions (mirror `createPaymentReplayGuard`), with deterministic
  tests. Or **`chore/registerRoutes-testable`** (inject storage/chain → real
  HTTP route-mount integration test).

## Off-limits (unchanged)
- Do not merge `wip/atomic-purchase`; nothing in `ops/kestra/` points at mainnet;
  no funds/ASA/transfer code to mainnet without `/mainnet-gate` **and**
  `algo-auditor`; no funds-moving phase ships without that.

## Durable lesson
- The route-loop auth/ownership decision was duplicated inline in the global
  mutation middleware AND `assertPlayerOwnership`. Centralizing it in a pure
  `evaluateOwnership` made it unit-testable without mounting the entangled
  `routes.ts` (which throws at import without DATABASE_URL + inits chain clients +
  starts an unref'd setInterval). Prefer extracting the decision over mounting the
  app when the app module has heavy import-time side effects.
