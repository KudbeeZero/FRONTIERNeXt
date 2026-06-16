# Audit — PR #27 `feat/actions-idempotency-extend` (build & upgrade idempotency)

**Verdict: PASS WITH NOTES** → merged.

## PR / branch / commit
- **PR:** [#27](https://github.com/KudbeeZero/FRONTIERNeXt/pull/27) — `feat(security): extend idempotency-nonce guard to build & upgrade actions`
- **Branch:** `claude/actions-idempotency-extend-2qpwrn`
- **Head audited:** `3c48a0b` · **Base:** `origin/main` `9da5f5f` · **Merged as:** `a1dc9ab`
- **GitHub state at audit:** `state: open`, `mergeable_state: clean`, the only open PR.
- **CI on head `3c48a0b`:** "Typecheck & server tests" ✅ success · "Cloudflare Pages" ✅ success.
- Audited by an independent auditor subagent (re-derived from diff + tests on the PR head; no files modified by the audit).

## Tests (actual, on `3c48a0b`)
| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK, lockfile unchanged |
| `pnpm --filter @workspace/frontier-al run check` | **tsc 0 errors** |
| `pnpm --filter @workspace/frontier-al run test:server` | **236/236 (30 files)** (was 225, +11) |
| `pnpm --filter @workspace/frontier-al run test` | **45/45 (7 files)** |

Spec delta independently confirmed: `idempotencyGuard.spec.ts` 8 → 19 `it()` blocks (+11).

## Claims vs. evidence
| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | `target` folded into key; target-less key byte-identical | ✅ | `idempotencyGuard.ts:45-49` ternary; spec asserts `build:alice:${NONCE}` (3-arg) and `build:alice:plot-42:turret:${NONCE}` (4-arg) |
| 2 | build/upgrade `claim()` BEFORE the spend; target=`parcelId:type` | ✅ | upgrade `routes.ts:1583-1590` before `upgradeBase` (1592); build `routes.ts:1655-1662` before `buildImprovement` (1664) + `fireBurn` (1672) |
| 3 | reason → 400/409/503 via `idempotencyRejection()`, generic text | ✅ | `routes.ts:115-130`; spec test 9 asserts reason never matches `alice/550e8400/upgrade/plot-42/defense` |
| 4 | optional `idempotencyKey` on build & upgrade schemas | ✅ | `shared/schema.ts` build & upgrade each `+ idempotencyKey: z.string().optional()` |
| 5 | client sends `crypto.randomUUID()`, no other UI change | ✅ | only `useGameState.ts` changed client-side; exactly 2 `randomUUID()` additions |
| 6 | +11 tests (9 cases + cross-target + deterministic key) | ✅ | 8→19 it(); cases 1-9 + 6b cross-target + deterministic-key present |
| 7 | no new deps, no new migration | ✅ | no `package.json`/lock/`.sql` in diff |
| 8 | playerId auth-verified by global middleware for both routes | ✅ | `MUTATION_PATH_RE` `routes.ts:423` matches `/api/actions/`; `evaluateOwnership` 425-439; build also `assertPlayerOwnership` 1647-1648 (before the guard) |

## Scope creep / over-claim
- **No scope creep** — app changes confined to guard + build/upgrade enforcement + spec; rest is doc/baton/session-note only.
- **No over-claim** — only build/upgrade enforcement added; claim-frontier call site passes no `target` → unchanged key → PR #26 behavior + tests preserved (server suite green).

## Security
- **Claim-before-spend ordering correct** — a missing/malformed nonce returns 400 before any spend/mutation/burn. Fail-closed on store error (503). No PII/secret leak (test 9 enforces).
- **LOW (cosmetic, not a regression):** `store.tryInsert(key, { playerId, action })` persists row metadata *without* `target` (`idempotencyGuard.ts:71`). The dedup `key` itself carries the target, so correctness is unaffected — forensic/metadata only.
- **LOW (accepted, carried from #26):** no `release()` — a thrown spend leaves the nonce consumed; fail-closed, fresh-UUID-per-call avoids lockout.

## What could NOT be verified (gaps)
- **No live HTTP-mount / DB-integration test** — the 400/409/503 wiring and claim-before-spend ordering are verified by reading source + direct guard unit tests, not by a request through the real route (same `routes.ts` import entanglement as #25/#26). Runtime enforcement untested.
- On-chain `fireBurn` dedup effect inferred from ordering, not exercised at runtime.

## Notes carried forward as tracked follow-ups (see baton)
From this audit + the prior `/code-review`:
- **ID-001** safeUuid fallback (`crypto.randomUUID` undefined in non-secure/legacy contexts) — Low.
- **ID-002** structured/unambiguous `target` construction (delimiter ambiguity if `parcelId` contains `:`) — Low.
- **ID-003** stable idempotency nonce (per logical action, reused across retries; duplicate → original 200, not 409) — **High, NEXT** (`feat/idempotency-stable-nonce`).
- **ID-004** `action_nonces` TTL + prune (unbounded growth, amplified by per-call nonce on high-frequency build/upgrade) — Medium (`chore/action-nonces-ttl`).

## Gate action
PASS WITH NOTES → **merged** (`a1dc9ab`). One-open-PR invariant restored (0 open PRs). Baton updated with ID-001..ID-004; NEXT unit = `feat/idempotency-stable-nonce`. No follow-up code started this chat.
