# 2026-07-06 — Fix concurrent double-payout in claimWinnings

**Branch:** `claude/session-failure-review-rwsbol` (restarted from main after #204
merged) · **Unit:** second item from the DB-health audit's HIGH-PRIORITY queue —
the worst of the double-spends (no transaction at all).

## The bug

`DbStorage.claimWinnings` (`server/storage/db.ts:3294`) ran **bare statements
with no transaction**: the unclaimed-positions read had no lock, the mark-claimed
`UPDATE` keyed only on `id` (no `AND claimed=false`, no rowCount check), and the
player credit was a read-then-write (`ascend: playerRow.ascend + payout`). Two
concurrent claims both saw the positions unclaimed and both paid out — a double
payout of prediction-market winnings.

## The fix (mirrors openLootBox / fillTradeOrder)

Wrapped the whole method in one `this.db.transaction`, then:
1. **`FOR UPDATE`** on the unclaimed-positions SELECT — serializes concurrent
   claims; the second blocks, re-reads 0 unclaimed rows after the first commits,
   and bails.
2. **Conditional claim before crediting** — `UPDATE market_positions SET
   claimed=true WHERE id IN (…) AND claimed=false RETURNING`, with a
   `marked.length !== positions.length` bail. A double-claim matches too few
   rows and returns without paying.
3. **Relative credit** — `ascend = ascend + payout` (not read-then-write), so
   concurrent credits can't lose an update.
4. Narrowed the market + positions `SELECT *`s to the columns actually read
   (consistent with the fillTradeOrder change; also what let the focused test
   schema stay minimal).

## Test — real Postgres, deterministic fail-before/pass-after PROVEN

New `server/storage/claimwinnings.db.spec.ts` (gated on `DATABASE_URL`, added to
`test:server:db`). Two cases:
- **Serial:** a second claim after the first is rejected, payout credited once.
- **Deterministic concurrency:** a separate connection holds a `FOR UPDATE` lock
  on the unclaimed position (an in-flight claim); the real `storage.claimWinnings`
  is kicked off and must **block** on that lock; the in-flight claim then commits
  (position claimed + player credited 190) and the storage claim unblocks,
  re-reads 0 unclaimed rows, and must bail without a second payout.

**Why deterministic (a lesson from the trade-fill unit):** a naive
`Promise.all([claim, claim])` race is timing-dependent — the read-then-write
lost-update can mask the double-pay (yielding the "correct" 190 by accident) and
the shared-pool operations can accidentally serialize. My first draft of this
test PASSED on the buggy code for exactly that reason. The lock-orchestration
version forces the overlap and distinguishes fixed from buggy every run.

**Proven against a throwaway local Postgres:**
- **Fail-before:** a schema-compatible buggy variant (no txn, unconditional mark,
  read-then-write credit) FAILS the lock test — `claimWinnings` returned a payout
  instead of an error because it didn't block on the lock and double-paid
  (player ended at 380).
- **Pass-after:** the fixed code passes both tests.
- Full `test:server:db` (all 4 DB specs) passes together, 15 tests. Cluster torn
  down.

**Verification:** tsc clean · server **446 passed / 18 skipped** (default CI; +2
gated concurrency tests skipped without `DATABASE_URL`) · client 285 (untouched) ·
production build green.

**Honest gap:** the concurrency test is `DATABASE_URL`-gated → not in the default
CI gate (no DB there), same posture as the other `.db.spec.ts` files; it runs via
`pnpm run test:server:db` against real Postgres (which CI DOES run as a separate
step — confirmed this session when the trade-fill test's table-clobber surfaced
there). Ran it here to prove the fix.

## Next in the HIGH-PRIORITY queue

3. `grantWelcomeBonus`+login (`routes.ts:444`) — concurrent logins double-enqueue
   the on-chain 500-ASCEND transfer (real funds). **NEXT** — this one crosses into
   the route layer (the enqueue is in the login handler, not just storage), so the
   fix is an atomic `UPDATE … WHERE welcomeBonusReceived=false RETURNING` gating
   the enqueue on rowCount.
4. `placeBet` (`db.ts:3216`) — non-atomic double-credit.
Then quick DB/gate wins (indexes migration 0013, tighter action rate-limits),
then features (Commander Garrison, Armory fixes, plot-satellite view, globe color
layers). Alliances + "mother nature" still need an owner design conversation.
