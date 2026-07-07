# 2026-07-07 — fix concurrent double-enqueue in grantWelcomeBonus (M1-1)

**Unit M1-1** from the master roadmap's 3-month queue (Phase 25) — the next real
funds bug after #204 (fillTradeOrder) and #205 (claimWinnings).

## Bug

`DbStorage.grantWelcomeBonus` (`server/storage/db.ts:1099`, called from
`maybeGrantWelcomeBonus` at `routes.ts:444` and inline in
`POST /api/actions/connect-wallet` at `routes.ts:~1373`) ran inside a
transaction but the player `SELECT` had no row lock and the mark-received
`UPDATE` was unconditional (no `AND welcomeBonusReceived=false`, no rowCount
check). Two concurrent calls (e.g. a double-fired login, or a login racing
`connect-wallet`) both saw `welcomeBonusReceived: false`, both credited the
in-game ASCEND balance, and — the real damage — **both enqueued the on-chain
500-ASCEND transfer**, a genuine double-spend of real funds.

**Found a second call site with the identical bug** while re-verifying the
baton's file:line before coding: `POST /api/actions/connect-wallet`
(`routes.ts:~1360-1395`) duplicates the same check-then-grant-then-enqueue
logic inline instead of calling `maybeGrantWelcomeBonus`. Both call sites are
fixed by making the storage method itself the atomic gate.

## Fix — mirrors #204/#205 (FOR UPDATE + conditional UPDATE)

- `grantWelcomeBonus` now returns `Promise<boolean>` (`true` iff *this* call
  actually granted the bonus) instead of `Promise<void>`.
- `FOR UPDATE` on the player SELECT (narrowed to the 4 columns actually read:
  `name`, `ascendBalanceMicro`, `totalAscendEarned`, `welcomeBonusReceived`) —
  serializes concurrent grants; the second call blocks until the first
  commits, then re-reads `welcomeBonusReceived=true`.
- Conditional `UPDATE … WHERE id=? AND welcomeBonusReceived=false RETURNING`
  (narrowed to `id`) — belt to the lock: a race that somehow got past it still
  matches 0 rows and bails before crediting.
- `interface.ts` + `mem.ts` updated to match the new `Promise<boolean>`
  signature. MemStorage has no `await` between its check and mutation, so it
  was already single-process-atomic — this is a type-signature-only change
  there.
- Both route call sites (`maybeGrantWelcomeBonus`, `connect-wallet`) now gate
  `enqueueAscendTransfer` on the boolean return, not the pre-check read.

## Test — real Postgres, deterministic fail-before/pass-after proven

New `server/storage/welcomebonus.db.spec.ts` (gated on `DATABASE_URL`, added
to `test:server:db`): a serial-second-grant case, a **deterministic**
concurrency case (a separate connection holds a `FOR UPDATE` lock to force the
real grant call to block, then commits an in-flight grant and asserts the
blocked call bails without crediting again), and a `Promise.all` concurrent
case for parity with the sibling specs.

Proven against a throwaway local Postgres (`pg_ctlcluster 16 main start`):
- **Fail-before:** reverted to a schema-compatible buggy variant (no
  `FOR UPDATE`, unconditional UPDATE) — the deterministic lock test FAILED
  (`expected true to be false`; the buggy call returned `true` a second time
  instead of blocking and bailing). The serial and naive `Promise.all` tests
  still passed even on the buggy code — same lesson as #205: those two alone
  are not sufficient proof, only the lock-forcing test reliably discriminates
  fixed from buggy.
- **Pass-after:** fixed code passes all 3 new tests; full `test:server:db`
  (5 files, 18 tests) passes together with `--no-file-parallelism`.

## Verification

tsc clean · server **446 passed / 21 skipped** (default CI; +3 gated vs. before
= the new DB spec, correctly skipped without `DATABASE_URL`) ·
`coverage:server` **93.09%/82.17%/91.86%/94.54%** (stmts/branch/func/lines,
above the 80%-lines gate) · client **285** (unchanged) · production build
green · `test:server:db` **18/18** passed together against real Postgres.

## Audit checklist

- [x] **Scope:** storage method + both route call sites that enqueue off it +
  interface/mem signature + a gated test + the test:server:db script list; no
  schema/migration change
- [x] **Tests:** new real-Postgres deterministic concurrency test,
  fail-before/pass-after proven locally
- [x] **HARD RULES checked:** this *is* funds-adjacent (gates an on-chain
  500-ASCEND enqueue) — fix only prevents a double-enqueue, doesn't add new
  transfer logic; no mainnet config touched; no globe/combat/canvas change;
  no mock data
- [x] **Honest gaps:** the concurrency test is `DATABASE_URL`-gated → runs in
  CI's dedicated Postgres-backed `test:server:db` step, not the default no-DB
  unit step; proven here against real Postgres before opening the PR
- [x] **Docs updated in the same commit:** this session note, baton rewritten
