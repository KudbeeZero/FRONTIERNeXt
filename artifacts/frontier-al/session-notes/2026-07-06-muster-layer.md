# 2026-07-06 — Unit B1: War Council Muster

**Branch:** `claude/session-failure-review-rwsbol` (restarted from main after #196
merged) · **Unit:** first battle-map feature from
[`BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md`](../docs/BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md).

## What shipped

The defender of a pending battle already gets a converging warning reticle
(`GlobeIncomingTelegraph`) in the final 8 seconds before resolution. The
attacker's launch plot showed nothing for the entire 10-minute pending window.
This adds the other half: a pulsing staging glow + energy core on the
**source** plot, active for the whole pending window (not just a lead-in),
scaled by the real `troopsCommitted` on the battle, plus a faint spark that
creeps along the existing battle arc toward the target as resolution nears.

- `client/src/lib/battle/musterState.ts` — new pure timing module. Troop
  scaling reuses the exact same soft-saturating curve (`x/(x+60)`) as the
  `muster` beat inside the resolution cinematic itself
  (`shared/battle-sequence.ts` / `TROOP_INTENSITY_K`), so the build-up and the
  cinematic payoff read as the same fight at two moments, not two different
  tuning curves.
- `client/src/components/game/globe/GlobeMusterLayer.tsx` — new thin R3F
  renderer, mirroring `GlobeIncomingTelegraph`'s structure exactly (pure logic
  module + `useFrame` renderer, `shouldPlayBattleCinematics` gate, same
  `serverNow()` clock). Attacker color resolved via the existing
  `factionColor()` helper (falls back to neutral for human players, same as
  the resolution cinematic). The creeping spark reuses `buildArcCurve` — the
  same curve-construction helper `GlobeBattleSequence`'s strike sphere and
  `BattleArcs`' persistent arc already use, so it visually rides the same path.
- `PlanetGlobe.tsx` — one import + one mount line, next to
  `GlobeIncomingTelegraph` (the layer it complements). No other file touched.

**Zero server changes.** Every input (`sourceParcelId`, `troopsCommitted`,
`startTs`, `resolveTs`) was already on the `Battle` type reaching the client;
`parcels`/`players` were already props on the sibling layers.

## Tests

New `client/tests/muster-state.spec.ts` — 9 tests pinning: inactive before
start / active immediately at start / active for the *whole* window (not a
lead-in) / inactive at-and-after resolution / troop scale increases and
saturates toward 1 / glow ramps in over `glowRampMs` then holds / floors so
the effect never fully vanishes / creep progress rises monotonically /
tolerates non-finite and degenerate input (resolve-before-start, zero-length
window).

**Verification:** tsc clean · server 439/14 skipped · client **245** (236 + 9
new) · production build green (`pnpm run build`, both client and server
bundles).

**Honest gap:** the R3F renderer (`GlobeMusterLayer.tsx`) is
typecheck/build-verified only, matching every other globe battle layer in
this codebase (`GlobeIncomingTelegraph`, `GlobeBattleSequence`, etc.) — none
of them have a live-browser screenshot test. A headless visual check was
attempted against the Cloudflare Pages preview for the *previous* unit (D1)
and hit the sandbox's documented proxy trap (browser TLS reset on external
hosts even though `curl` succeeds) — the same would apply here, and this unit
also needs a live pending battle + the full game server/DB stack per
`docs/HEADLESS_VISUAL_TESTING.md`, which wasn't run this session. Owner should
eyeball a real pending attack on the globe post-deploy.

## For the next session

B1 done. Next per the plan: **B2 Shield Wall** (brace-beat fortification
dome), then **B3 Battle Scars** (persistent aftermath decals), then the
dataviz units (D2 quick-win charts, D3 supply history).
