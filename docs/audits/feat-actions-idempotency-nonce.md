# Audit — PR #26 `feat/actions-idempotency-nonce`

**Verdict: PASS**

## PR / branch / commit
- **PR:** [#26](https://github.com/KudbeeZero/FRONTIERNeXt/pull/26) — `feat(security): idempotency-nonce guard for the ASCEND claim action`
- **Branch:** `feat/actions-idempotency-nonce`
- **Head SHA audited:** `4fdf71f45ae4cce6bedc72ca8914ef8654a73c16`
- **Base:** `origin/main` = `089825b`
- Audited by an independent auditor subagent (re-derived from diff + tests, not the PR's claims). Working tree restored after; no files modified.

## Claims vs. evidence
| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | `idempotencyGuard.ts` → `createActionIdempotencyGuard`, mirrors payment guard, key `${action}:${playerId}:${nonce}`, claim-once | ✅ | `idempotencyGuard.ts:33-72`; mirrors `security.ts:210` `createPaymentReplayGuard` |
| 2 | Scoped by player+action; different player/action → distinct key, no collision | ✅ | `actionNonceKey` L34; spec collision + deterministic-key tests; action is a fixed literal, nonce regex forbids `:` → no delimiter-injection collision |
| 3 | DB-backed `action_nonces`, `key` PK, `INSERT…ON CONFLICT DO NOTHING`; in-process Set fallback | ✅ | schema `db-schema.ts:99-104`; wiring `routes.ts:97-113`; fallback `idempotencyGuard.ts:67-69` |
| 4 | Nonce regex `/^[A-Za-z0-9_-]{8,128}$/`, missing/malformed rejected | ✅ | `idempotencyGuard.ts:30,54-56`; spec tests 4 & 5 |
| 5 | Fail-closed: store error rejects | ✅ | `idempotencyGuard.ts:62-64` (catch → `store_unavailable`); spec broken-store test |
| 6 | Enforced on `claim-frontier` only; claim BEFORE credit; 400/409/503 mapping | ✅ | `routes.ts:1860-1879` guard runs before `claimAscend` L1900 / `enqueueAscendTransfer` L1905; status map L1871 |
| 7 | Client sends fresh `crypto.randomUUID()` per claim, no UI change | ✅ | `useGameState.ts:143-148` |
| 8 | +8 tests (217→225) covering valid/duplicate/cross-player/cross-action/missing/malformed/safe-enum+fail-closed/storeless/deterministic | ✅ | `idempotencyGuard.spec.ts` (8 `it`); confirmed by running both branches |
| 9 | Migration `0006_action_nonces.sql` staged, not auto-run | ✅ | file header "STAGED MIGRATION — NOT executed at server boot" |
| 10 | No new deps; lockfile unchanged | ✅ | `--frozen-lockfile` clean; no `package.json` dep diff |
| 11 | Only `claim-frontier` enforced; build/mine/etc not guarded and not claimed | ✅ | guard referenced once in `routes.ts` (claim-frontier route only) |

## Tests (actual output)
| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Lockfile up to date / Already up to date |
| `pnpm --filter @workspace/frontier-al run check` | tsc clean, no errors |
| `pnpm --filter @workspace/frontier-al run test:server` (PR) | **30 files, 225/225 passed** |
| `pnpm --filter @workspace/frontier-al run test:server` (main baseline) | 29 files, 217/217 → delta **+8, exactly as claimed** |
| `pnpm --filter @workspace/frontier-al run test` | client **7 files, 45/45 passed** |

GitHub CI on head `4fdf71f`: "Typecheck & server tests" ✅ success, "Cloudflare Pages" ✅ success.

## Scope creep
None. Non-code changes are doc/baton only: `docs/HANDOFF.md` (baton), `docs/audits/feat-route-loop-server.md` (record of the prior PR #25 audit, per protocol), `session-notes/*`, `artifacts/.../docs/audit/2026-06-14-*.md`. Code touched is limited to the guard, schema, migration, the claim-frontier route, the spec, and the client hook — all in scope.

## Untested assertions
- HTTP status mapping (400/409/503) end-to-end is verified by **code reading**, not an HTTP-mount integration test (same `routes.ts` import entanglement as PR #25). The guard itself is unit-tested directly.

## Security
- **playerId in the key is auth-verified upstream** — the global mutation middleware (`routes.ts:407-427`, `evaluateOwnership`) binds body `playerId` to the session player for `/api/actions/*` when `WALLET_AUTH_REQUIRED`. In dev/mem (auth off) it is client-trusted — same documented posture as the payment guard. No new vuln. *(info)*
- **Delimiter injection not exploitable** — nonce charset excludes `:`, action is a fixed literal → no cross-player/cross-action collision. *(info)*
- **No secret/PII leak** — error bodies are generic, reasons are safe enums; a spec test asserts the reason never echoes playerId/nonce/key. *(info)*
- **No `release()` on the action guard (LOW, accepted-risk)** — unlike the payment guard, a nonce claimed before `claimAscend` is not un-claimed if the downstream credit throws. Effect is fail-closed (no double credit); the client uses a fresh UUID per retry, so no permanent lockout. Acceptable; flagged for the follow-up unit.

## What I could NOT verify
- Live-Postgres `onConflictDoNothing` path (tests use a fake store mirroring PK semantics; no live DB).
- End-to-end HTTP status codes (no route-mount harness).
- On-chain double-enqueue prevention under real worker-drain behavior.

## Gate action
PASS → merge PR #26, sync `main`, start `feat/actions-idempotency-extend`. Carry forward the LOW `release()` note and the build/upgrade actions (still unguarded) as the next unit's scope.
