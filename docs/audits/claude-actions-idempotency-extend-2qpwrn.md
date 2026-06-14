# Audit — PR #27 `claude/actions-idempotency-extend-2qpwrn` (independent re-audit)

**Verdict: PASS** (one CONCERNS-level note: route wiring verified by inspection,
not an integration test — consistent with #26, not a regression).

> Second, **independent** audit performed at the start of the AUTO-001 chat. PR
> #27 already had its own audit (`docs/audits/pr-27-audit.md`, PASS WITH NOTES)
> and was merged (`a1dc9ab`) while this audit ran. This re-audit re-derives the
> truth from the diff + a fresh test run and **confirms the same verdict**.

## PR / branch / commit
- **PR:** [#27](https://github.com/KudbeeZero/FRONTIERNeXt/pull/27) — extend the
  idempotency-nonce guard to `build` & `upgrade`.
- **Branch:** `claude/actions-idempotency-extend-2qpwrn`
- **Head audited:** `3c48a0b` · **Base:** `9da5f5f` · **Merged as part of** `main` `daebfbc`.
- **Method:** independent auditor subagent in an isolated worktree; diff read in
  full; tests re-run; no files modified by the audit.
- **Real diff (correct base `9da5f5f..3c48a0b`):** 10 files, +450/−54 (5 code/test).

## Claims vs. evidence
| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Guard reused; optional `target` added; key `${action}:${playerId}:${target}:${nonce}`; target-less branch byte-for-byte unchanged (no new migration) | ✅ | `idempotencyGuard.ts:45-49` (`actionNonceKey` ternary — target-less returns the identical old string); `:18,30` (`target?` added). `claim-frontier` not in diff; `0006` unchanged (added by #26). |
| 2 | build & upgrade claim nonce BEFORE spend/mutation and before `fireBurn` | ✅ | upgrade `routes.ts:1579-1591` claim precedes `upgradeBase` (`:1593`); build `:1652-1664` claim precedes `buildImprovement` (`:1669`) and `fireBurn` (`:1676`). |
| 3 | Scope = player+action+target; no collision across different player/action/target; tests assert | ✅ | `idempotencyGuard.spec.ts` tests 5, 6, 6b + deterministic-key test. |
| 4 | Fail-closed; safe enum reasons (no echo); 400/409/503 mapping | ✅ guard / ⚠️ mapping by inspection | guard: spec test 9 (broken store → `store_unavailable`, never echoes player/nonce/action/target). `idempotencyRejection` (`routes.ts:1581-1593`) maps 409/503/400 — verified by reading, no test drives it. |
| 5 | +11 tests; server 225→236; client 45/45 | ✅ | +11 `it()`, 0 deletions; I ran it (below). |
| 6 | No new deps; no new migration | ✅ | `pnpm-lock.yaml`/`package.json` not in diff; frozen install clean; no migration changed. |
| 7 | client `useBuild`/`useUpgrade` send fresh `crypto.randomUUID()` per call | ✅ | `useGameState.ts:82-86` (useUpgrade), `:111-115` (useBuild). |

## Tests (re-run by the auditor — actual output)
- `pnpm install --frozen-lockfile` → "Lockfile is up to date… Already up to date".
- `pnpm --filter @workspace/frontier-al run check` → tsc clean, 0 errors.
- `pnpm --filter @workspace/frontier-al run test:server` → **30 files, 236 passed**.
- `pnpm --filter @workspace/frontier-al run test` → **7 files, 45 passed**.

All match the claimed counts exactly.

## Scope creep
None. Changes are confined to `server/idempotencyGuard.ts`, `server/routes.ts`,
`server/idempotencyGuard.spec.ts`, the client hooks (`useGameState.ts`), plus
docs/baton/security report. No unrelated files.

## Security (funds/ASA/auth)
- **Double-burn prevention holds** by inspection: the claim is atomic
  (PK `ON CONFLICT DO NOTHING` / in-proc Set) and runs before both the spend and
  `fireBurn`; a replay returns 409 before any spend/clawback.
- **Lockout-on-thrown-spend** is the accepted fail-safe tradeoff (no `release()`);
  fresh-UUID-per-call client means a genuine retry uses a new key — only exact
  replays are blocked. Correct for an ASCEND-burning path.
- **Auth** unchanged: the global mutation middleware (`routes.ts:425-443`) gates
  POST `/api/actions/*` on `playerId` ownership. No new auth gap.

## What I could NOT verify
1. **Route-level wiring is untested** — no HTTP/integration test hits
   `/api/actions/build` or `/upgrade`; the 11 new tests are guard **unit** tests.
   Claim-before-spend ordering, `${parcelId}:${type}` target construction, and the
   400/409/503 mapping are verified by code reading only. (Same posture as
   #25/#26 — a consistent gap, not a regression. Tracked as
   `chore/registerRoutes-testable`.)
2. **On-chain behavior** (real clawback/finality) not exercised — no live testnet
   in this environment.

## Operational note
`0005`/`0006` migrations are STAGED, not run at boot. `0006_action_nonces` must
be applied before deploying a build that enforces the guard — and that
prerequisite now also covers the `build`/`upgrade` paths. Not a code defect.
