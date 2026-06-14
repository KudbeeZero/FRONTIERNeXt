# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `claude/actions-idempotency-extend-2qpwrn`
- **PR:** [#27](https://github.com/KudbeeZero/FRONTIERNeXt/pull/27) (extend the
  idempotency-nonce guard to build & upgrade actions)
- **Audit status:** `AWAITING_AUDIT`
- Note: **PR #26 audited PASS (independent) + merged** (`9da5f5f`); audit at
  `docs/audits/feat-actions-idempotency-nonce.md`.
- **CI gates green** (frontier-al scope = `ci.yml`): `check` 0,
  `test:server` **236/236** (was 225, +11), `test` **45/45**.

## What this chat did (for the auditor)
Extended PR #26's `createActionIdempotencyGuard` to **build** and **upgrade** —
reuse, not redesign:
- `server/idempotencyGuard.ts`: added an optional `scope.target` folded into the
  key → `${action}:${playerId}:${target}:${nonce}`. Target-less key is **unchanged**
  (claim-frontier byte-for-byte identical → no migration, no regression).
- `server/routes.ts`: `/api/actions/build` and `/api/actions/upgrade` claim the
  nonce **before** the spend/mutation (`buildImprovement`/`upgradeBase`/`fireBurn`);
  `target = parcelId:type`; missing/malformed → 400, replay → 409, broken store →
  503 (fail closed). Shared `idempotencyRejection()` helper for the safe mapping.
- `shared/schema.ts`: optional `idempotencyKey` on build/upgrade schemas.
- client `useBuild`/`useUpgrade`: send a fresh `crypto.randomUUID()` per call (the
  live POST path; `queueBuild/UpgradeAction` no-op for server-authoritative
  actions). No UI change.
- `server/idempotencyGuard.spec.ts` (+11, 225 → 236): build/upgrade valid first;
  duplicate blocked; cross-player / cross-action / cross-target no-collision;
  missing & malformed rejected; safe-enum reasons + fail-closed; deterministic
  target-scoped key.
- Ran **/security-pass** → PASS; report at
  `artifacts/frontier-al/docs/audit/2026-06-14-actions-idempotency-extend.md`.
- **playerId in the key is auth-verified** by the global mutation middleware
  (`routes.ts:409`). No funds-logic change → no `algo-auditor` needed (same posture
  as #26). No new deps. No new migration.
- **Not covered (honest):** no HTTP route-mount test (same `routes.ts` import
  entanglement as #25/#26) — the guard is unit-tested with the exact route scopes,
  the wiring (claim-before-spend, 400/409/503) verified by reading. No `release()`
  on the guard (LOW, carried from #26) — fail-closed, fresh-UUID client = no
  lockout. Genuine double-clicks (distinct nonces) are not blocked — that's
  rate-limiting, not idempotency. mine/collect/attack still unguarded.

## Audit checklist (for the next /handoff-audit)
| Claim | How to verify |
|---|---|
| Guard reused, target added, claim-frontier unchanged | `idempotencyGuard.ts` `actionNonceKey` — target-less branch identical; `actionNonceKey("build","alice",N)` === `build:alice:N` |
| build/upgrade claim BEFORE the spend | `routes.ts` build (~1646) & upgrade (~1575): guard `.claim(...)` precedes `buildImprovement`/`upgradeBase`/`fireBurn` |
| Scope = player+action+target | guard call passes `action:"build"/"upgrade"`, `target: \`${parcelId}:${type}\`` |
| Fail-closed + safe errors | `idempotencyRejection()` → 400/409/503, generic text, no nonce/key/playerId echo |
| Tests real, +11 | `pnpm --filter @workspace/frontier-al run test:server` → 236/236 (was 225) |
| Typecheck / client green | `check` 0; `test` 45/45 |
| No new deps / migration | `--frozen-lockfile` clean; target rides existing `action_nonces.key` |
| No over-claim | only build/upgrade enforced (+ claim-frontier from #26); mine/collect/attack still unguarded, not claimed |

## NEXT chat
- **Proposed branch:** `feat/rate-limit-actions` — per-IP/per-player limiter on
  `/api/actions/*` (mint-on-prepare / rapid double-click DoS), the natural
  complement to the nonce guard.
- **Scope options (one unit each):**
  1. **`feat/rate-limit-actions`** — rate-limit `/api/actions/*` (centralize in
     `server/rateLimitStore.ts`), with deterministic tests.
  2. **`chore/registerRoutes-testable`** — inject storage/chain into
     `registerRoutes` so a true HTTP route-mount test of the 400/409/503
     idempotency enforcement is possible (closes the "no route-mount test" gap).
  3. **`chore/action-nonces-ttl`** — TTL/prune for `action_nonces` (unbounded
     growth; operational housekeeping).
  4. **Port PR #10's algod-first finality check** into `verifyAlgoPayment`
     (indexer-only today). **Funds-economic → `algo-auditor` + `/security-pass`.**
  5. `chore/align-vite-types` — fix the pre-existing `mockup-sandbox` root-typecheck
     failure (vite/`@types/node` mismatch; not in CI).
- **Open risks:**
  - ⚠️ No rate limit on `/api/actions/*` — #1.
  - ⚠️ No full HTTP route-mount test (guard unit-tested instead) — #2.
  - ⚠️ `action_nonces` has no TTL/prune (grows unbounded) — #3.
  - ⚠️ No `release()` on the action guard (LOW; fail-closed, no lockout).
  - ⚠️ mine/collect/attack still have no idempotency nonce (cooldown/accrual only).
  - ⚠️ `verifyAlgoPayment` finality is indexer-only — #4.
  - ⚠️ Migrations `0005_redeemed_payments.sql` + `0006_action_nonces.sql` must be
    applied before deploying the guards.
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/`
  may point at mainnet; no funds/ASA/transfer code to mainnet without
  `/mainnet-gate` **and** `algo-auditor`; no funds-moving phase ships without that.
