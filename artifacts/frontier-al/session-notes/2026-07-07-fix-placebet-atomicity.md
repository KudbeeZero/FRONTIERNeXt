# 2026-07-07 — fix concurrent lost-update in placeBet (M1-2)

**Unit M1-2** from the master roadmap's 3-month queue (Phase 25) — the next real
economy-integrity bug after #204 (fillTradeOrder), #205 (claimWinnings), and #208
(grantWelcomeBonus).

## Bug

`DbStorage.placeBet` (`server/storage/db.ts:3252`, roadmap said `db.ts:3216` — line
had drifted, re-verified before coding) ran bare statements with no transaction:
the player balance debit was a **read-then-write**
(`ascend: playerRow.ascend - amount`) and so was the market pool credit
(`tokenPoolA: marketRow.tokenPoolA + amount`). Two concurrent bets — the same
player racing themselves, or two different players betting the same
market/outcome at once — could both read the same starting value and one
update's result got clobbered by the other (a lost update):
- A player could place two bets while only ever being charged for one (a free
  extra stake, effectively an under-collateralized position).
- A market's pool total could drift out of sync with the sum of its positions,
  corrupting the payout math `claimWinnings` relies on
  (`distributablePool`/`payout` are computed from `tokenPoolA`/`tokenPoolB`).

## Fix — mirrors #204/#205/#208 (FOR UPDATE before any mutation + conditional relative updates)

- Wrapped the whole method in `this.db.transaction(...)`.
- `FOR UPDATE` on **both** the market row and the player row, taken **before any
  mutation** (not just before the final write) — so the status/expiry/cutoff/
  balance checks below the locks are authoritative; a concurrent transaction on
  either row blocks until this one commits.
- Both selects narrowed to the columns actually read (`status`/`resolvesAt`/
  `resolutionCutoffTs` for the market; `id`/`ascend`/`isAi` for the player) —
  mirrors the narrowing already applied in fillTradeOrder/claimWinnings/
  grantWelcomeBonus.
- Conditional relative updates as a belt to the lock: `UPDATE players SET
  ascend = ascend - amount WHERE id=? AND ascend >= amount RETURNING id` (bails
  on 0 rows, matching "Insufficient ASCEND balance"); `UPDATE prediction_markets
  SET tokenPoolA/B = tokenPoolA/B + amount WHERE id=? AND status='open'
  RETURNING *` (bails if the market resolved out from under the bet).
- Order matters: the balance debit and pool credit are only ever run **after**
  both locks are held and all business-rule checks pass — no path exists where
  one mutation lands and a later check then bails (which would otherwise strand
  a real debit against a bet that never got created).

## Test — real Postgres, deterministic fail-before/pass-after proven

New `server/storage/placebet.db.spec.ts` (gated on `DATABASE_URL`, added to
`test:server:db`): a serial-bet case (including an unaffordable second bet
rejected without touching state), a **deterministic** concurrency case (a
separate connection holds a `FOR UPDATE` lock on the player row to force the
real bet call to block, then commits an in-flight debit down to an
unaffordable balance and asserts the blocked call bails on insufficient funds
without a lost update), and a `Promise.all` concurrent case (two different
players betting the same market/outcome — asserts the pool reflects both
debits, not a lost update from one clobbering the other).

Proven against a throwaway local Postgres (`pg_ctlcluster 16 main start`):
- **Fail-before:** reverted to a schema-compatible buggy variant (no
  transaction, no `FOR UPDATE`, read-then-write) — the deterministic lock test
  FAILED (the bet call did NOT block on the lock, read the stale pre-debit
  balance, and let a bet through that the player could no longer actually
  afford after the in-flight debit committed). The serial and naive
  `Promise.all` tests still passed even on the buggy code — same lesson as
  #205/#208: those two alone are not sufficient proof, only the lock-forcing
  test reliably discriminates fixed from buggy.
- **Pass-after:** fixed code passes all 3 new tests; full `test:server:db`
  (6 files, 21 tests) passes together with `--no-file-parallelism`.

## Verification

tsc clean · server **446 passed / 24 skipped** (default CI; +3 gated vs. before
= the new DB spec, correctly skipped without `DATABASE_URL`) ·
`coverage:server` **93.09%/82.17%/91.86%/94.54%** (stmts/branch/func/lines,
unchanged — placeBet's DB-side code isn't in the curated coverage `include`,
matching the DB-code convention) · client **285** (unchanged) · production
build green · `test:server:db` **21/21** passed together against real
Postgres.

## Audit checklist

- [x] **Scope:** one storage method + a gated test + the test:server:db script
  list; no schema/migration/route change
- [x] **Tests:** new real-Postgres deterministic concurrency test,
  fail-before/pass-after proven locally
- [x] **HARD RULES checked:** no mainnet/funds-transfer code (this moves
  in-game ASCEND between a player and a market pool, not an on-chain
  transfer); no globe/combat/canvas change; no mock data
- [x] **Honest gaps:** the concurrency test is `DATABASE_URL`-gated → runs in
  CI's dedicated Postgres-backed `test:server:db` step, not the default no-DB
  unit step; proven here against real Postgres before opening the PR
- [x] **Docs updated in the same commit:** this session note, baton rewritten
