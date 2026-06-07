# Money-Path & EPI Follow-up Audit — 2026-06-07

**Scope:** A verification/hardening sweep over the work that landed across the long
branch lineage (`claude/verify-repo-state-3MUZ6` → `claude/repo-security-audit-ammZZ`):
globe rendering, VERITAS, provably-fair prediction markets, wallet integration, and the
five documented security passes in
[`2026-06-07-api-access-control-audit.md`](./2026-06-07-api-access-control-audit.md).

**Goal:** confirm the prior passes hold up and hunt for what they missed —
deep-debug the financial path, re-check access control, and harden. This pass
**fixes verified Critical/High + cheap wins**; deeper items are backlogged (see §4).

**Method:** four parallel read-only audit streams (auth/secrets · blockchain money
path · data layer · LUT memory integrity), then each candidate finding was
**verified against the actual code** before fixing — several agent claims were
disproven (§3) and dropped rather than "fixed".

---

## 1. Findings fixed in this pass

### C1 — `claimWinnings` double-claim → duplicated payout  *(CRITICAL)*
`server/storage/db.ts` — `claimWinnings()`

The old path was: `SELECT` unclaimed winning positions → compute payout → per-row
`UPDATE … claimed=true` → credit player. **None of it was transactional.** Two
concurrent claims for the same positions both read `claimed=false`, both compute the
full payout, and both credit the player — duplicating funds out of the pool.

**Fix:** the whole body now runs in `this.db.transaction`, and the claim is a
**guarded compare-and-set**:
`UPDATE marketPositions SET claimed=true WHERE …playerId…outcome=winning AND claimed=false RETURNING *`.
The payout is computed from the rows the UPDATE *actually flipped*. A second
concurrent claim flips zero rows → credits nothing → `"No unclaimed winning positions"`.
(A transaction alone is insufficient under Postgres READ COMMITTED; the conditional
UPDATE is what makes it safe.)

### C2 — `placeBet` concurrent overdraft  *(HIGH)*
`server/storage/db.ts` — `placeBet()`

Read balance → check `frontier < amount` → write `frontier - amount` with **no
transaction**. Two concurrent bets both pass a stale check and overdraw the player
(stake more than they hold). This was already flagged as open in
`ASCENDANCY SECURITY HARDENING LUT.md` §3.2.

**Fix:** wrapped in `this.db.transaction` with an **atomic debit**
`UPDATE players SET frontier = frontier - amount WHERE id=? AND frontier >= amount RETURNING frontier`
(no row → `"Insufficient FRONTIER balance"`), and the pool increment is now an atomic
`SET tokenPool = tokenPool + amount` (avoids a lost update when bets race on the pool).

### H1 — `/api/parcels/attackable` leaks EPI to anonymous callers  *(HIGH)*
`server/routes.ts` — `GET /api/parcels/attackable`

The handler read `const { session } = req as any; const playerId = session?.playerId ?? ""`
— but **nothing populates `req.session`** (the canonical accessor is `getAuth(req)`,
used everywhere else). So `playerId` was always `""`, which means:
1. the `ownerId != playerId` filter never excluded the caller's own parcels, and
2. the endpoint returned **every** player's stored resource counts
   (`ironStored`/`fuelStored`/`crystalStored`) to **anonymous** callers — the exact
   off-chain EPI that Pass 3 redacts from `/api/game/state` and the WS feed. This was
   a hole straight through the Pass-3 redaction for this one endpoint.

**Fix:** use `getAuth(req)`; return `401` when `isWalletAuthRequired()` and no session
(consistent with `assertPlayerOwnership`); use `auth.playerId` so the caller's own
parcels are correctly excluded. The endpoint stays under `enumerationLimiter`.

### M1 — `sql.raw()` ID arrays → injection-fragile  *(MEDIUM)*
`server/routes.ts` (battle history + admin battles-live)

Four queries built `… = ANY(ARRAY[…]::text[])` by string-concatenating quoted IDs via
`sql.raw(ids.map(id => \`'\${id}'\`).join(","))`. The IDs are server-generated UUIDs
today, so not currently exploitable, but it's a fragile pattern one schema change away
from injection. **Fix:** replaced all four with drizzle's parameterized `inArray()`.

### M2 — Timing-unsafe admin-key compare  *(MEDIUM)*
`server/routes.ts` — `GET /api/blockchain/status`

The additive admin-balance branch compared `headerKey === process.env.ADMIN_KEY` with a
plain `===` (byte-by-byte timing side-channel on the admin key) while the rest of the
codebase uses `timingSafeEqual`. **Fix:** exported `safeEqual` from `server/security.ts`
and used it here.

### Refactor — extracted pure payout math
Pulled the parimutuel split into `server/engine/markets/payout.ts`
(`computeMarketPayout`) so the money arithmetic is unit-testable (DB-free) and
consistent. `claimWinnings` now calls it.

---

## 2. Verification

- `pnpm run check` (tsc) — clean
- `pnpm run test:server` — **121/121 pass** (+6 new in `engine/markets/payout.spec.ts`:
  pro-rata split, fee deduction, flooring, the pool-conservation invariant, empty-pool
  guard)
- `pnpm run build` (Vite + esbuild) — succeeds

The DB-level concurrency guarantees (C1/C2) are enforced by SQL semantics
(conditional `RETURNING` UPDATEs) and verified by code review — the server test harness
is intentionally DB-free, so they can't be exercised as live concurrency tests here.

---

## 3. Claims investigated and DROPPED (so they aren't re-raised)

- **"Predictable `Math.random` battle seed → front-runnable markets."** The
  `Math.random` at `db.ts` ~L286 seeds **cosmetic orbital events**, not battle
  outcomes. Battle resolution is deterministic from `hashSeed(battleId, startTs)` for
  *replay verification*, and `battle_outcome` markets only resolve once
  `battle.status === 'resolved'`; staking closes at `resolutionCutoffTs`. Not
  front-runnable. No change.
- **"ASA batch confirms only the first tx."** `_sendAtomicTransfers` assigns a group ID;
  Algorand atomic groups are **all-or-nothing in a single block**, so confirming one
  member confirms the whole group. No change.

---

## 4. Backlogged (deliberately not done this pass)

See `docs/backlog/MARKET_FACT_SNAPSHOT_AND_RECONCILIATION.md`.

- **Market facts read live at resolution, not snapshotted at cutoff.** Aggregate
  sources (`burn_threshold`, `territory_count`, `ownership_at_turn`) are read from
  *current* state in `computeOutcome`, and the recorded `turn`/`byTurn` are not used to
  constrain the query — a manipulation window between staking cutoff and resolution.
  Needs a fact snapshot captured at `resolutionCutoffTs` (schema + resolver change).
- **Clawback fire-and-forget reconciliation.** `clawbackFrontierAsa` is fire-and-forget
  and returns `null` on failure while the DB debit proceeds → DB/on-chain divergence.
  Needs a periodic reconciliation job comparing DB balances to on-chain.
- **Token math float dust** (payout/fee floor; ASA `Math.floor`/`Math.round` mix) — move
  to integer/BigInt micro-FRNTR end-to-end.
- **Operational fail-closed guards** already noted in the prior audit's "remaining
  recommendations": `SESSION_SECRET`/CORS fail-closed in prod, mnemonic → secrets
  manager, welcome-bonus account-age heuristic.

---

## 5. LUT memory-layer maintenance

The LUT layers are structurally intact; one real drift was corrected:
- `ASCENDANCY SECURITY HARDENING LUT.md` §3.2 + §7: marked the auth/admin/rate-limit
  and money-path items completed (with dates), leaving genuine operator/infra tasks open.
- `ASCENDANCY MASTER INTEGRATION LUT.md`: folder-tree LUT filenames corrected to the real
  space-separated names (were underscored).
- `PROJECT MEMORY.md` §8 index: resolved the dangling `RAILWAY_DEPLOY_GUIDE` and
  `HILDA_v2_Pipeline` references and pointed security at `docs/audit/`.
