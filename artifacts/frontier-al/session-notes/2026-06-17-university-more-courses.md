# Session note — 2026-06-17 — University: 5 more courses

**Branch:** `feat/university-more-courses` (off `origin/main` @ `83e6055`)
**Unit:** expand the FRONTIER University catalog from 6 → 11 courses.

## What shipped
Added 5 new tutorial modules (`shared/university/curriculum.ts`), each grounded in the
real game (facts gathered by an Explore pass over the relevant code):

- **Commanders** (`commanders`) — 3 tiers (Sentinel +10/+10, Phantom +18/+6, Reaper
  +30/+5), 12h lock after attacking, ASCEND-cost special attacks (Orbital Strike, EMP,
  Siege Barrage, Sabotage), NFT mint.
- **Trade Station** (`trade`) — peer-to-peer resource orders (Iron/Fuel/Crystal/ASCEND),
  sub-parcel marketplace (ASCEND ask price), trader leaderboard.
- **Prediction Markets** (`markets`) — stake ASCEND on binary outcomes, Open→Closed→
  Resolved lifecycle, 5% fee, **provable fairness** ("Verify proof" re-runs the resolver
  → admin can't pick winners).
- **Terraforming** (`terraform`) — biome convert, hazard/stability (0–100) gauges,
  degraded = hazard>60 or stability<30, resource multiplier, offensive `corrupt_land`.
- **Seasons** (`seasons`) — persistent world (no hard reset), ~90-day chapters, top-10
  FRONTIER-token rewards (top-heavy ~30% to #1), 24h/6h/1h countdown broadcasts.

Supporting edits:
- `shared/university/types.ts` — extended the `GameSystem` union with the 5 systems.
- `client/.../UniversityPanel.tsx` — added `SYSTEM_LABEL` + `SYSTEM_COLOR` entries (the
  `Record<GameSystem,…>` maps are exhaustive, so `tsc` enforced this).
- `shared/university/university.spec.ts` — assert all 11 systems present + catalog ≥ 11.

## Verification (WSL)
- `check` (tsc) → **clean** (exhaustive-map check passed)
- `test:server` → **263/263** (university spec now 8)
- `test` (client) → **57/57** (SSR catalog smoke loops all 11 modules)
- Not run in-browser: Academy render (no headless harness) — data-driven JSX backed by
  typecheck + SSR smoke + the shared integrity/grading unit tests.

## Notes
- **Veritas deliberately not a course** — it's a backend fairness harness, never
  player-facing. Its value surfaces inside the Markets course ("Verify proof").
- Pure additive content: no globe/combat render core, no chain/funds code → no
  `/mainnet-gate` trigger.
