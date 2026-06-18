# 2026-06-18 — CI coverage gate (deterministic game-math core ≥ 80%)

## What shipped

A real, quantitative code-coverage gate wired into CI — scoped honestly to the
deterministic game-math core, **not** a global-80% claim.

- **Provider:** added `@vitest/coverage-v8@4.1.6` (pinned to match locked `vitest`
  4.1.6 — a `^4.1.0` range resolved to 4.1.9 and tripped the peer check). Past the
  `minimumReleaseAge` supply-chain guard. `pnpm-lock.yaml` updated + committed.
- **Config:** `vitest.server.config.ts` → `test.coverage` (v8). `include` = curated
  game-math modules (`shared/weapons/**`, `shared/university/**`,
  `shared/economy-config.ts`, `shared/weapon-economy.ts`,
  `server/engine/battle/resolve.ts`, `server/engine/markets/resolve.ts`).
  Thresholds: lines/statements/functions **80**, branches **70**.
- **Scripts:** `coverage:server` (the gate) + `coverage:server:full` (informational
  whole-package number, no thresholds).
- **CI:** new step `Coverage gate (deterministic game-math core ≥ 80%)` in
  `.github/workflows/ci.yml`, between `test:server` and client `test`.
- **Docs:** `docs/COVERAGE_GATE.md` (full rationale + honest exclusions); root
  `CLAUDE.md` + frontier-al `README.md` updated; `coverage/` added to `.gitignore`.

## Verification (test-backed)

- `coverage:server` → **PASS**, exit 0. Measured: **lines 93.12% / statements 91.4% /
  functions 90.27% / branches 77.9%** — all clear of the 80/80/80/70 floor.
- **Negative check:** `coverage:server --coverage.thresholds.lines=99` → **exit 1**
  (`ERROR: Coverage for lines (93.12%) does not meet global threshold (99%)`). The gate
  genuinely bites.
- `coverage:server:full` → **~21.6% lines** whole-package (informational only).
- `check` (tsc) → green. `test:server` → **266 passed**. `test` (client) → **57 passed**.

## Honest flags

- The ≥80% gate covers the **deterministic game-math core only**. Whole `server/shared`
  is **~22%** — reported informationally, **NOT** claimed as 80%.
- Excluded surfaces (DB/storage, services, routes, stateful season/AI managers,
  `sim`/`veritas` dev tools) are integration/I/O-heavy — the `/test-matrix` "blocked"
  rows. Excluded by category, not number-gamed.
- **Client coverage is not gated** (out of scope).
- Raising whole `server/shared` toward 80% is a **separate future PR** (large
  DB/storage/service test backfill) — explicitly not this unit.

## Next

- Audit this PR (diff vs. claims; rerun `coverage:server` + the negative check), then
  merge.
- Optional follow-ups: client coverage ratchet; add new deterministic math modules to
  the gate `include` as they land.
