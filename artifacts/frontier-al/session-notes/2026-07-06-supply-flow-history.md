# 2026-07-06 — Unit D3: real supply-flow history

**Branch:** `claude/session-failure-review-rwsbol` (restarted from main after #200
merged) · **Unit:** final unit from
[`BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md`](../docs/BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md) —
the real chart the fake "Circulating Supply Trend (Projected)" chart (removed
in D1, since it was literally synthetic sine-wave data) pretended to be.

## What shipped

The research at the start of this session found that **no economics
time-series existed anywhere** in the app — `/api/economics` is snapshot-only,
and burns are cumulative per-player floats. Any honest history chart requires
sampling. This unit:

1. **New `economics_snapshots` table** (`server/db-schema.ts` +
   `migrations/0012_economics_snapshots.sql`, hand-authored in the exact style
   of `0011_battle_replays.sql` — additive-only, `IF NOT EXISTS`, safe to
   deploy before applying). **Verified end-to-end**: stood up a throwaway
   local Postgres, ran `drizzle-kit push`, confirmed the table + index landed
   exactly as designed, did a real insert/select round-trip, then confirmed
   the hand-authored SQL file itself is idempotent by applying it directly
   against the already-pushed schema (both `CREATE TABLE`/`CREATE INDEX`
   correctly no-op with `NOTICE: already exists, skipping`). Cluster torn down
   after.
2. **Hourly sampler**, split into two files on purpose:
   - `server/services/economicsSnapshotShape.ts` — pure: `shouldSampleNow`
     (hourly gate, always-sample-on-first-boot) + `buildSnapshotRow`. **Zero
     imports of `../db` or any chain client**, so this module (and its 7
     tests) load without `DATABASE_URL` set — the default `test:server` run
     has none. My first draft had the pure functions in the same file as the
     DB/chain code, which transitively imports `server/db.ts` (throws without
     `DATABASE_URL` at module load) — the fix mirrors this codebase's own
     established remedy for the same problem
     (`server/storage/lootbox.db.spec.ts`'s `describe.skipIf(!HAS_DB)` +
     deferred import pattern).
   - `server/services/economicsSnapshotSampler.ts` — the DB/chain
     integration: `computeEconomicsSnapshotValues()` (deliberately duplicates
     rather than imports `GET /api/economics`'s own computation — see below)
     and `sampleEconomicsSnapshotOnce()` (fail-open, try/catch, never throws).
3. **Wired into the existing server tick** (`server/index.ts`), mirroring the
   established `pruneActionNonces`/`timeoutStalePurchaseIntents` pattern
   exactly: `setInterval(..., 5min).unref()` calling the fail-open sampler
   (which internally gates to hourly), plus a 30s-after-boot `setTimeout` so
   the first sample doesn't wait up to 5 minutes.
4. **New `GET /api/economics/history`** (routes.ts) — returns stored snapshots
   oldest-first, capped at 500. Empty list until the sampler accrues rows.
5. **Client:** the real stacked-area "Supply Flow" chart on
   `/info/economics`, in the exact spot D1 removed the fake one. States its
   real "data since" date from the earliest snapshot rather than fabricating
   a past, and only renders once at least one real snapshot exists (no
   synthetic points, ever).

## Deliberate design choice: duplication over refactor

`computeEconomicsSnapshotValues()` copies the same computation
`GET /api/economics` already does, rather than extracting/sharing it. This is
a disclosed risk trade: `/api/economics` is a funds-adjacent, unrefactored,
untested-by-spec route other pages already depend on live. For the **first
schema-migration unit** of the session, zero chance of an accidental behavior
change to that endpoint outweighed DRY. A future cleanup can consolidate the
two into one shared function.

## Deviation from the plan doc: categorical, not sequential, color

The original plan text said "sequential-hue ramp" for the stacked areas. On
implementation, the dataviz skill's own canonical form table says part-to-
whole → **categorical**, not sequential — these are 3 qualitatively different
pools (Circulating/Treasury/Burned), not an ordered magnitude scale. Used the
**same 3 colors already on this exact page's Distribution pie chart**
(`PIE_COLORS`) for the new area chart — same categories, same colors, so the
pie and the new time-series read as the same breakdown at two different
altitudes. No new palette to validate.

## Tests

New `server/services/economicsSnapshotShape.spec.ts` — 7 tests: always-sample-
on-first-boot, no-resample-before-interval, samples-once-elapsed, custom
interval respected, non-finite input tolerated, row shaping carries all
values + the given id.

**Verification:** tsc clean · server **446** (439+7 new) /14 skipped · client
278 (unchanged — D3's client change is a thin data-mapping, no new pure logic
module) · production build green · **migration verified live** against a real
throwaway Postgres (push + insert/select + idempotent re-apply, detailed
above).

**Honest gap:** `computeEconomicsSnapshotValues()` and
`sampleEconomicsSnapshotOnce()` are integration glue (chain/DB) — not unit
tested, consistent with the rest of this codebase's chain/DB code
(`docs/COVERAGE_GATE.md`'s "blocked" rows; same precedent as the untested
`pruneActionNonces`/`timeoutStalePurchaseIntents`). The chart JSX itself is
typecheck/build-verified only, same as every other chart on this page. Owner
should verify the sampler actually fires in the real deployed environment
(check server logs ~30s after boot and hourly thereafter) and confirm
`/info/economics` starts accruing real history.

## For the next session

**All units from `BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md` are now shipped**
(D1 #196, B1 #197, B2 #198, B3 #199, D2 #200, D3 this PR). Nothing queued from
the owner's /goal remains. Next session should check with the owner for a new
priority, or pick up an item from the plan's "runners-up" section (Spoils
Convoy, Replay Theater, Front-line Heat) or the broader backlog in the baton.
