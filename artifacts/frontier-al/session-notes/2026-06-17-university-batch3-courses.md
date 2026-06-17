# Session note — 2026-06-17 — University: 5 more courses (batch 3)

**Branch:** `feat/university-more-courses` (off `origin/main` @ `83e6055`)
**Unit:** expand the academy 11 → 16 courses. Authored in parallel by three read-only
subagents (BOB/RICK/JAMES); BOB+RICK content integrated here, JAMES's progress-tracking
design deferred to a separate unit (see below).

## What shipped (5 new courses)
New `GameSystem` keys `orbital` / `nft` / `basics`; two advanced courses reuse existing
`combat` / `builds`:
- **Satellites & Recon Drones** (`orbital`) — drones (20 ASCEND, 15-min scout, max 5),
  satellites (50 ASCEND, 1h, +25% yield, max 2), vs the Orbital Strike commander special.
- **How Minting Works** (`nft`) — plots/commanders/weapons as 1-of-1 ASAs (PLOT/CMDR/WPN),
  ARC-3 `#arc3` metadata, opt-in-before-delivery, wait-for-confirmation finality.
- **Your First 10 Minutes** (`basics`) — connect wallet (Pera/Defly/Kibisis/LUTE) → claim
  500 ASCEND welcome bonus → buy a plot with ALGO → set a 60-pt build → fire first shot.
- **Layered Defense Tactics** (`combat`, advanced) — point→area→terminal/exo, real intercept
  envelopes, aegis-badge gating up to Arrow-3 (hall_of_fame).
- **Archetype Mastery** (`builds`, advanced) — 60-pt budget, soft cap 14, tradeoff math
  (20→6 over cap→3.0 tax each partner), full archetype roster, hitting a target cleanly.

All numbers spot-verified against `shared/schema.ts` (WELCOME_BONUS_ASCEND=500,
DRONE/SATELLITE/orbital_strike consts), `client/src/lib/walletManager.ts` (wallet list),
`shared/weapons/defense.ts` + `attributes.ts`.

## Edits
- `shared/university/types.ts` — +3 `GameSystem` keys.
- `shared/university/curriculum.ts` — +5 modules.
- `client/.../UniversityPanel.tsx` — +3 `SYSTEM_LABEL`/`SYSTEM_COLOR` entries (tsc-enforced exhaustive).
- `shared/university/university.spec.ts` — assert all 14 systems present + catalog ≥ 16.

## Verification (WSL)
- `check` (tsc) → clean · `test:server` → **263/263** · `test` (client) → **57/57**.
- Live-verified: `dev:client` (Vite :3000) serves `/university` (HTTP 200) — all 16 courses
  render and play. Full server not run (`DATABASE_URL` absent); University is server-independent.

## Deferred — progress tracking (JAMES's design, NOT yet built)
A separate unit: persist passed-course ids and show a ✓ badge. Low-risk plan = nullable
`jsonb university_passed` column (mirrors `weaponProfile`, applied via `db:push`, no
migration) + `getPassedCourses`/`markCoursePassed` on IStorage + GET/POST
`/api/university/*` + client query/mutation + ✓ in the catalog. Touches no chain/funds →
no `/mainnet-gate`. Full code + fail-before/pass-after test were drafted; implement as its
own PR.
