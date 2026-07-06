# 2026-07-06 — Unit B3: Battle Scars

**Branch:** `claude/session-failure-review-rwsbol` (restarted from main after #198
merged) · **Unit:** third and final battle-map feature from
[`BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md`](../docs/BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md).

## What shipped

Today a battle's cinematic (`GlobeBattleSequence`) fades ~12 seconds after
resolution and the map forgets it happened. This renders a slowly fading mark
for every recent battle — a **scorch ring** where the attacker captured the
plot (victor's faction color), or a **shield glint** where the defense held —
sized by the real power differential and decaying over 4 hours, so the globe
reads as a live war map of the recent front lines. This completes the
before → during → after arc: **B1 Muster** (build-up) → **B2 Shield Wall**
(the clash) → **B3 Battle Scars** (the aftermath).

- `client/src/lib/battle/battleScars.ts` — new pure derivation module:
  `scarOpacityForAge` (linear fade, 0 past 4h), `scarSizeForPowerDiff`
  (soft-saturating scale of `|attackerPower − defenderPower|`, the margin of
  victory), and `deriveBattleScars` (dedupe by `battleId` — a live update
  refreshes a seeded record — drop anything past its max age, sort newest
  first, cap at 40 concurrent scars).
- `client/src/components/game/globe/GlobeBattleScars.tsx` — new thin R3F
  renderer, mounted next to the other battle layers. Takes a `seedRecords`
  prop (history fetched **outside** `<Canvas>` — see below) and appends live
  records itself off the existing `onBattleResolved` WS bus, the same event
  `GlobeBattleSequence` already consumes. Recomputes the age-based fade on a
  slow 60s interval rather than every frame (the decay spans hours, so
  per-frame updates would be wasted work).
- `client/src/components/game/PlanetGlobe.tsx` — added `useBattleScarSeed()`,
  a small react-query hook fetching the existing public
  `GET /api/battles/history?limit=50` endpoint, called in the **outer**
  `PlanetGlobe` component (above `<Canvas>`) and passed down as a prop through
  `Scene` into `GlobeBattleScars`. **Architectural note for future units:**
  react-query's `QueryClientContext` is not guaranteed to bridge into
  components mounted by `@react-three/fiber`'s own reconciler — every
  data-fetching hook in this codebase already runs above `<Canvas>` and flows
  in as props (confirmed by grepping the whole `globe/` directory: zero
  existing `useQuery` calls inside it). Followed that convention rather than
  risk a Canvas-context assumption.

**Zero new server endpoints.** `GET /api/battles/history` and the
`battle:resolved` WS broadcast both already existed and already carried
everything needed (`plotId`, `outcome`, `attackerPower`/`defenderPower`,
`resolvedAt`/`timestamp`).

## Tests

New `client/tests/battle-scars.spec.ts` — 12 tests: brand-new scar is fully
opaque / fades linearly to 0 at max age / negative age (clock skew) treated
as brand-new / tolerates non-finite input / power-differential size increases
and saturates toward 1 / even matchup has 0 size / records past max age are
dropped / a fresh record derives captured+color correctly / **dedupe by
battleId** (a later record replaces the earlier one — the live-update path) /
sorted newest first / capped at `maxScars` keeping the newest.

**Verification:** tsc clean · server 439/14 skipped · client **265** (253 + 12
new) · production build green (`pnpm run build`).

**Honest gap:** same as B1/B2 — the R3F renderer is typecheck/build-verified
only, matching every other globe battle layer in this codebase (none have
live-browser tests; the sandbox's documented external-host proxy trap makes a
live screenshot impractical here). Owner should eyeball the globe some hours
after a few battles resolve — scars should be visible and fading, and a live
resolution should add a new one without a page refresh.

## For the next session

All three battle-map features (B1, B2, B3) are shipped. Next per the plan:
the dataviz units — **D2** quick-win charts (faction control + battle pulse
from existing endpoints) then **D3** real supply-history (needs a snapshot
table).
