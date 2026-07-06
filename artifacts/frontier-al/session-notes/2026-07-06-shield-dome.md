# 2026-07-06 — Unit B2: Shield Wall

**Branch:** `claude/session-failure-review-rwsbol` (restarted from main after #197
merged) · **Unit:** second battle-map feature from
[`BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md`](../docs/BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md).

## What shipped

During the resolution cinematic's `brace` beat, a translucent hex-faceted
shield dome now rises over the **defender's** plot — size/brightness driven by
the beat's real intensity (which the shared battle engine already computes as
`max(defenderPower saturation, fortification-level saturation)`). At impact the
dome either **cracks apart and fades** (attacker wins / capture) or **flares
once and holds solid** (defense held).

- `client/src/lib/globe/battleSequencePlayback.ts` — added a new, **independent**
  exported channel `braceDomeAt(seq, elapsedMs) → BraceDomeState` (opacity,
  strength, shatterProgress, flareIntensity). This is a separate export from
  `GlobePlaybackState`/`playbackAt` — `GlobeBattleSequence.tsx` and everything
  that reads `GlobePlaybackState` is completely unaffected.
- `client/src/components/game/globe/GlobeShieldDome.tsx` — new thin R3F
  renderer. Subscribes to the **same `cinematicBus`** that
  `GlobeCinematicCamera`/`BattleCalloutHUD` already use (`onCinematic`) —
  reads `seq.target` directly off the published sequence, same pattern as
  `GlobeCinematicCamera`. Does **not** touch `GlobeBattleSequence.tsx` at all.
  Dome geometry is a low-poly hemisphere (`sphereGeometry` widthSegments=6 →
  hexagonal silhouette) oriented outward via a quaternion aligning local +Y to
  the plot's surface normal. Defender color comes straight off
  `seq.defender.color` (already populated by the existing sequence-assembly
  pipeline via `factionColor`).
- `PlanetGlobe.tsx` — one import + one mount line, next to
  `GlobeBattleSequence`/`GlobeCinematicCamera` (the other cinematicBus
  consumers). No other file touched.

**Zero server changes.** Every input (`brace` beat intensity, `captured`,
`target`, `defender.color`) was already on `BattleSequence` reaching the
client via the existing cinematic pipeline.

## Tests

New `client/tests/brace-dome-playback.spec.ts` — 8 tests built on two real
sequences from `buildBattleSequence` (one `attacker_wins`, one
`defender_wins` with a much higher `defenderPower`): invisible before brace /
rises across the brace beat / holds fully solid through impact / strength
tracks the brace beat's own real intensity (and is higher for the
higher-power defender) / cracks apart and fades after impact on a capture /
never shatters and flares once then stays solid on a held defense / bounded
0…1 across the whole sequence for both outcomes / tolerates non-finite
elapsed time.

**Verification:** tsc clean · server 439/14 skipped · client **253** (245 + 8
new) · production build green (`pnpm run build`).

**Honest gap:** same as B1 — the R3F renderer is typecheck/build-verified
only, matching every other globe battle layer in this codebase. Not
live-browser verified (documented sandbox proxy trap applies to any external
preview URL). Owner should eyeball a real battle resolution on the globe
post-deploy — the dome should be visible rising during brace, then either
cracking or flaring at impact.

## For the next session

B2 done. Next per the plan: **B3 Battle Scars** (persistent aftermath
decals), then the dataviz units (D2 quick-win charts, D3 supply history).
