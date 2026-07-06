# 2026-07-06 — Fix concurrent double-spend in fillTradeOrder

**Branch:** `claude/session-failure-review-rwsbol` (restarted from main after #203
merged) · **Unit:** first item from the DB-health audit's HIGH-PRIORITY queue —
a real concurrent double-spend, the concrete form of the owner's "nothing gets
lost or repeats itself" concern.

## The bug (audit finding, verified by reproduction)

`DbStorage.fillTradeOrder` (`server/storage/db.ts:2281`) ran inside a transaction
but the order `SELECT` had **no row lock** and the mark-filled `UPDATE` keyed
**only on `id`** (no `AND status='open'`, no rowCount check), with the resource
transfers happening BEFORE the mark. Under Postgres READ COMMITTED, two concurrent
fills of the SAME open order both passed the `status==='open'` check and both
applied the resource transfer → the offerer debited twice, resources duplicated.

## The fix (mirrors the in-repo `openLootBox` pattern)

1. **`FOR UPDATE`** on the order `SELECT` — serializes concurrent fills of one
   order; the second filler blocks until the first commits, re-reads
   `status='filled'`, and bails at the status check before any transfer.
2. **Conditional claim BEFORE the transfers** — the mark-filled `UPDATE` is now
   `WHERE id=? AND status='open'` with a `RETURNING` rowCount bail, moved to run
   *before* the resource moves. Belt to the lock's suspenders: even if the lock
   were bypassed, a double-fill matches 0 rows and returns "no longer open"
   without moving resources.
3. Narrowed the two player `SELECT *`s to the 6 columns actually read (id, name,
   iron, fuel, crystal, ascend) — required so the row lock's blast radius is
   minimal and a small efficiency win (also what let the focused test schema work
   without stubbing all ~40 player columns).

## Test — real Postgres, fail-before/pass-after PROVEN

New `server/storage/tradefill.db.spec.ts` (gated on `DATABASE_URL`, added to the
`test:server:db` script, mirrors `lootbox.db.spec.ts`): a serial-double-fill case
and a **concurrent double-fill** case (two fillers race the same order via
`Promise.all` on separate pooled connections; asserts exactly one wins, the
offerer is debited exactly once, exactly one filler is credited).

**Proven against a throwaway local Postgres:**
- **Fail-before:** a schema-compatible buggy variant (guards removed, original
  ordering) FAILS the concurrency test — the loser's error was "Offerer no longer
  has enough resources" instead of "no longer open", i.e. both fills got past the
  status guard and the loser only tripped later on a balance the winner had
  already drained (the double-debit race, exactly as the audit described).
- **Pass-after:** the fixed code passes both tests.
- Cluster torn down after.

**Verification:** tsc clean · server **446 passed / 16 skipped** (default CI; the
+2 skipped vs. before are the new gated concurrency tests, correctly skipped
without `DATABASE_URL`) · client 285 (untouched) · production build green.

**Honest gap:** the new concurrency test is gated on `DATABASE_URL` and so does
NOT run in the default CI gate (which has no DB) — same posture as the existing
`lootbox.db.spec.ts` and `chainEventStore.db.spec.ts` (see COVERAGE_GATE.md). It
DOES run via `pnpm run test:server:db` against a real Postgres, and I ran it
here to prove the fix. The CI gate stays green on tsc + the non-DB server suite.

## Next in the HIGH-PRIORITY queue (from the DB-health audit)

2. `claimWinnings` (`db.ts:3278`) — **not in a transaction at all**; concurrent
   double-claim pays out twice. Next unit — same pattern (wrap in a txn +
   conditional `UPDATE … WHERE claimed=false` before crediting).
3. `grantWelcomeBonus`+login (`routes.ts:444`) — concurrent logins double-enqueue
   the on-chain 500-ASCEND transfer (real funds).
4. `placeBet` (`db.ts:3216`) — non-atomic double-credit.
Then the quick DB/gate wins (indexes migration 0013, tighter action rate-limits)
and the queued features (Commander Garrison, Armory fixes/rework, plot-satellite
view + globe color layers). Alliances + "mother nature" events still need an owner
design conversation before any code.
