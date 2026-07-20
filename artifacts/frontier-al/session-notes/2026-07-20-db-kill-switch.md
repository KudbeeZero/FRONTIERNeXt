# Session note — 2026-07-20 — Database kill switch (HALT_DB)

## What shipped
- **Branch:** `feat/frontier-halt-db-kill-switch`
- **PR:** #279
- **Head commit:** `0cc5c3b` (squash-merged into `main`)
- **Unit:** Add a reversible kill switch that halts all database communication when `HALT_DB=true` is set.

## Implementation
Three defense-in-depth layers:
1. **Pool-level guard** (`server/db.ts`): `withDbRetry()` throws `"Database operations halted"` before any query runs.
2. **Express middleware** (`server/routes.ts`): all `/api` routes return 503 with `{ error: "Database temporarily unavailable — service halted" }`.
3. **Background interval guards** (`routes.ts`, `wsServer.ts`, `transferQueue.ts`, `mintRetryQueue.ts`, `season/manager.ts`): every periodic task checks `isDbHalted()` and skips work.

New helper modules:
- `server/dbHalt.ts` — pure `isDbHalted()` function
- `server/dbHaltMiddleware.ts` — 503 middleware + `guardInterval()` helper
- Tests: `server/dbHalt.spec.ts`, `server/dbHalt.db.spec.ts`, `server/dbHaltMiddleware.spec.ts`

## Tests run
- `pnpm run check` — clean (tsc exit 0)
- `pnpm run test:server` — 719 passed, 26 skipped
- `pnpm run test` — 10 passed

## CI status
- Typecheck & server tests: ✅
- Cloudflare Pages: ✅
- CodeQL: ❌ (pre-existing/unrelated failure)

## Known risks / untested
- **Integration gap:** End-to-end behavior of `HALT_DB=true` on a live server (all intervals stopping, all API routes returning 503 under load) is structurally guaranteed but not exercised by a live integration test. Local unit tests cover the code paths.
- **Bypass risk:** Any future module that imports `db` directly and calls `pool.query()` without going through `withDbRetry` would bypass Layer 1. Current codebase audit shows all DB access goes through `withDbRetry` or `storage.*()`.

## Next unit
Resume feature roadmap — Battle Planner planner UI, or faction economy / treasury / equity / contribution-ledger foundation.

## Off-limits
- No funds/ASA/transfer code changed.
- No globe/combat/canvas behavior changed.
- No schema/migration added.
