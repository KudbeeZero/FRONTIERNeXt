# 2026-06-07 — Money-path & EPI follow-up hardening

Verification/hardening sweep over the long branch lineage
(`claude/verify-repo-state-3MUZ6` → `claude/repo-security-audit-ammZZ`). Confirmed the
five documented security passes hold up, then deep-debugged the financial path and
re-checked access control. Full write-up:
[`docs/audit/2026-06-07-money-path-and-epi-followup.md`](../docs/audit/2026-06-07-money-path-and-epi-followup.md).

## Fixed
- **CRIT — `claimWinnings` double-claim** (`server/storage/db.ts`): was non-transactional
  SELECT→compute→mark→credit; concurrent claims duplicated payouts. Now a transaction with
  a guarded `UPDATE … claimed=false … RETURNING` claim; payout computed from the rows
  actually flipped.
- **HIGH — `placeBet` concurrent overdraft** (`db.ts`): now transactional with an atomic
  `frontier >= amount` compare-and-set debit + atomic pool increment.
- **HIGH — `/api/parcels/attackable` EPI leak** (`server/routes.ts`): read a dead
  `req.session` (always `""`) → leaked every player's stored resources to anonymous
  callers and never excluded own parcels. Now uses `getAuth(req)`, 401s when auth required.
- **MED — `sql.raw()` ID arrays** (`routes.ts`, 4 sites): → parameterized `inArray()`.
- **MED — timing-unsafe admin compare** (`routes.ts` `/api/blockchain/status`): → exported
  `safeEqual` (`server/security.ts`).
- **Refactor:** extracted `server/engine/markets/payout.ts` (`computeMarketPayout`) so the
  parimutuel math is pure + unit-tested.

## Verified
- `pnpm run check` clean; `pnpm run test:server` **121/121** (+6 in `payout.spec.ts`);
  `pnpm run build` OK.

## Dropped (disproven, won't re-raise)
- "Predictable `Math.random` battle seed" — that RNG is cosmetic orbital events; battle
  markets gate on `status==='resolved'`.
- "ASA batch confirms only first tx" — Algorand atomic groups are all-or-nothing.

## Backlogged
`docs/backlog/MARKET_FACT_SNAPSHOT_AND_RECONCILIATION.md`: snapshot market facts at the
staking cutoff (currently read live at resolution; `turn`/`byTurn` unused), clawback↔chain
reconciliation, integer token math, and operational fail-closed guards.

## LUT maintenance
- `SECURITY HARDENING LUT` §3.2/§7: marked completed code-level items (dated); kept
  operator/infra tasks open.
- `MASTER INTEGRATION LUT`: fixed folder-tree LUT filenames (spaces, not underscores).
- `PROJECT MEMORY` §8: resolved dangling `RAILWAY_DEPLOY_GUIDE` / `HILDA_v2_Pipeline` refs.
