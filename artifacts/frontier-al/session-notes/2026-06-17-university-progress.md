# Session note — 2026-06-17 — University: persisted course progress

**Branch:** `feat/university-progress` (off `origin/main` @ `615fb85`)
**Unit:** persist which University courses a player has PASSED and show a ✓ badge in the
catalog. Implements the design produced by the "JAMES" subagent (the 3rd of the BOB/RICK/
JAMES trio; BOB+RICK content shipped as PR #58).

## What shipped
- **Schema (`server/db-schema.ts`)** — new nullable `jsonb university_passed` (`string[]`)
  column on the players table. Mirrors the existing nullable `weapon_profile` column →
  applied via `pnpm db:push`, **no hand-written migration** (additive + nullable).
- **Storage (`IStorage` + Mem + Db)** — `getPassedCourses(playerId)` and
  `markCoursePassed(playerId, moduleId)` (idempotent set-union). DbStorage uses a
  transaction, mirroring `updateWeaponProfile`.
- **Routes (`server/routes.ts`)** — `GET /api/university/passed` and
  `POST /api/university/complete {moduleId}`, both behind `assertPlayerOwnership` (same
  auth idiom as `/api/weapons/*`). POST validates `moduleId` via `getModule`.
- **Client (`UniversityPanel.tsx`)** — optional `playerId` prop; when present, a react-query
  reads passed ids and a mutation records a pass (fired from the result phase when
  `gradeQuiz` returns `passed`). Catalog renders a **✓ Passed** badge. `GameLayout` passes
  `playerId={player?.id}`. Bare render (standalone page, tests) stays valid — query disabled.

## Tests
- `server/storage/university.spec.ts` (3, fail-before/pass-after — methods didn't exist):
  records + persists a pass, idempotent on repeat, throws for unknown player.
- Updated `client/tests/university-panel.spec.tsx` to wrap the panel in a
  `QueryClientProvider` (useQuery now needs a client in context even when disabled).

## Verification (WSL)
- `check` (tsc) → clean · `test:server` → **266/266** (incl. storage university 3) ·
  `test` (client) → **57/57**.
- **Deploy note:** production DB needs `pnpm --filter @workspace/frontier-al run db:push`
  to add the `university_passed` column (or an additive `ALTER TABLE players ADD COLUMN
  university_passed jsonb;`). Nullable → safe, no backfill.

## Safety
Touches no chain/funds/ASA/transfer code — cosmetic tutorial badge, zero economic value
(the POST trusts the client pass result; answers aren't re-sent, acceptable for a
non-economic surface). **No `/mainnet-gate` trigger.** Only MemStorage + DbStorage
implement `IStorage`, both updated → tsc enforces completeness.
