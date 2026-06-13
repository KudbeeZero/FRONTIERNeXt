# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `feat/route-loop-server`
- **PR:** [#25](https://github.com/KudbeeZero/FRONTIERNeXt/pull/25) (centralize +
  test the route-loop auth/ownership decision)
- **Audit status:** `AWAITING_AUDIT`
- Note: **PR #24 audited PASS (independent) + merged** (`501b770`); audit at
  `docs/audits/test-gamelayout-connected-shell.md`.
- **CI gates green** (frontier-al scope = `ci.yml`): `check` 0,
  `test:server` **217/217** (was 210, +7), `test` **45/45**.

## What this chat did (for the auditor)
Server route-loop **auth/replay hardening + tests** (PR #25), behavior-preserving:
- Extracted the route-loop auth/ownership decision into a pure, exported helper
  `server/routeOwnership.ts` (`evaluateOwnership`) and wired BOTH the global
  mutation middleware (`routes.ts:389`) and `assertPlayerOwnership` (`routes.ts:232`)
  to it — single source of truth, no API/route/schema/client change. All 210 prior
  server tests still pass → behavior preserved.
- `server/routeOwnership.spec.ts` (+7) proves the 6 required cases with REAL code:
  happy path, missing auth→401, owner-mismatch→403, replay (createPaymentReplayGuard
  →already_redeemed), malformed input (zod), and generic/no-leak error bodies; plus
  the `WALLET_AUTH_REQUIRED=false` escape-hatch posture.
- Ran **/security-pass** → PASS, no new finding; report at
  `artifacts/frontier-al/docs/audit/2026-06-13-route-loop-auth-ownership.md`.
- **No game behavior changed. No new deps. No funds-moving code → no algo-auditor
  needed.**
- **Not covered (honest):** no full HTTP route-mount test — importing `routes.ts`
  is entangled (storage throws without `DATABASE_URL`, chain clients init at import,
  unref'd module-level `setInterval`), so the real decision logic is unit-tested
  instead (same code the live middleware runs). Free/resource actions
  (`mine`/`collect`/`claim-frontier`) have no idempotency nonce (rely on
  cooldown/time-accrual).

## NEXT chat
- **Proposed branch:** `feat/actions-idempotency-nonce` (or pick below).
- **Scope options (one unit each):**
  1. **Idempotency nonce for free/resource actions:** add an optional
     `X-Idempotency-Key` guard (mirroring `createPaymentReplayGuard`) to
     `/api/actions/{mine,collect,build,claim-frontier}` to block double-submit/
     replay, with deterministic tests. (Touches ~several routes — keep tight.)
  2. **`chore/registerRoutes-testable`:** inject storage/chain into `registerRoutes`
     so a true HTTP route-mount integration test is possible (closes the "no
     route-mount test" gap from #25).
  3. **Port PR #10's algod-first finality check** into `verifyAlgoPayment`
     (indexer-only today). **Funds-economic → `algo-auditor` + `/security-pass`.**
  4. `feat/rate-limit-actions` — rate-limit `/api/actions/*` (mint-on-prepare DoS).
  5. `chore/align-vite-types` — fix the pre-existing `mockup-sandbox` root-typecheck
     failure (vite/`@types/node` mismatch; not in CI).
- **Open risks:**
  - ⚠️ No idempotency nonce for free/resource actions — #1.
  - ⚠️ No full HTTP route-mount test (decision logic unit-tested instead) — #2.
  - ⚠️ `verifyAlgoPayment` finality is indexer-only — #3.
  - ⚠️ No rate limit on `/api/actions/*` — #4.
  - ⚠️ Schemas not `.strict()` (extra fields stripped) — LOW.
  - ⚠️ Migration `0005_redeemed_payments.sql` must be applied before deploying the
    replay guard.
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/`
  may point at mainnet; no funds/ASA/transfer code to mainnet without
  `/mainnet-gate` **and** `algo-auditor`; no funds-moving phase ships without that.
