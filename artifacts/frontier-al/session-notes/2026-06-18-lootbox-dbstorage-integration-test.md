# 2026-06-18 — Loot-box DbStorage Postgres integration test

## Unit
Retire the #60-audit open risk: **"DbStorage SQL path is NOT test-covered"** — the
loot-box storage guards (`FOR UPDATE` row lock, the conditional-`UPDATE`-on-
`rowCount` double-open guard, the `LEAST(...)` vault cap) were only verified by
construction (all 6 prior tests use MemStorage). Test-only; no production behavior
change.

## What shipped
- `server/storage/lootbox.db.spec.ts` — Postgres-backed integration test for
  `DbStorage.awardLootBox` / `openLootBox`. Uses the **real `node-postgres` driver**
  against a **real Postgres** (so `rowCount`, `FOR UPDATE`, `LEAST(...)` behave
  authentically), applies the actual `migrations/0010_loot_box_inventory.sql` over a
  minimal `players` stub (exercises the migration too), and covers:
  - award persists as unopened; unopened inventory cap drops overflow; opening frees a slot
  - open credits the deterministic reward into the right vault column + marks opened
  - serial double-open → `already_opened`, vault credited once
  - **concurrent** double-open (two pooled connections racing on the same box) →
    exactly one win, one `already_opened`, vault credited once (the real `FOR UPDATE`
    + `rowCount` guard)
  - vault clamp at `RARE_MINERAL_VAULT_CAP` via `LEAST(...)`
  - `not_found` for unknown id + another player's box (ownership)
- `test:server:db` npm script (runs just this spec).
- CI: a `postgres:16` service + a dedicated **"DbStorage integration tests"** step
  that sets `DATABASE_URL` and runs `test:server:db`. The existing `test:server`
  step stays DATABASE_URL-free so all MemStorage tests are unchanged.

## Design notes
- **Why not PGlite (in-memory):** the drizzle pglite driver does **not** populate
  `rowCount` (verified by spike), so the production double-open guard
  `(marked.rowCount ?? 0) === 0` would mis-fire and the first open would wrongly
  return `already_opened`. A real Postgres is required for a faithful test.
- **Gated on `DATABASE_URL`:** the `describe.skipIf(!DATABASE_URL)` block dynamically
  `import()`s `db.ts` so the skip path (default `test:server`, no DB) never triggers
  its DATABASE_URL-required module load. No new runtime dependency added.
- No seam in `DbStorage`: with `DATABASE_URL` set, the module-level `db` already
  points at the test DB; the test stubs `initPromise` to skip `seedDatabase()`.

## Coverage (before → after)
- Gate `coverage:server`: **93.12% lines, PASS → 93.12% lines, PASS (unchanged)**.
  Expected — the gate's `include` set is the deterministic game-math core only;
  `server/storage/**` (incl. `db.ts`) is deliberately out of it, so a DbStorage test
  does not move the gated number. The value here is the new behavioral coverage, not
  the gate figure.

## Verification
- `check` (tsc) ✓
- `test:server` **279 passed | 7 skipped** (no DB — integration block skips)
- `test:server:db` (with local Postgres 16) **7 passed**
- `coverage:server` **93.12% lines PASS**
- client `test` **57 passed** · `build` ✓

## Remaining loot-box risk
- The DbStorage SQL path is now **test-backed in CI** (Postgres service). Resolved.
- Migration `0010_loot_box_inventory.sql` must still be applied before any DbStorage
  deploy (staged, not run at boot) — unchanged deploy-time note.
