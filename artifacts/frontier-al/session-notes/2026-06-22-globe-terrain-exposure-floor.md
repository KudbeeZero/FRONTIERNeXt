# 2026-06-22 — Globe terrain brightness: exposure + ambient floor

Branch: `claude/website-file-verification-3w5lg4`

## What this unit did
Matched the planet-surface shader in
`client/src/components/game/globe/GlobeTerrain.tsx` to the owner's
home-computer "fixed" version (supplied as photos of the local file).

**Before (repo):** flat unlit multiply, no clamp —
```glsl
vec3 boosted = boostSat(dayCol.rgb, 1.5) * 2.6;
gl_FragColor = vec4(boosted, 1.0);
```

**After (owner's validated fix):** exposure + additive ambient floor, clamped —
```glsl
float EXPOSURE = 2.0;
float FLOOR = 0.50;
vec3 boosted = boostSat(dayCol.rgb, 1.5) * EXPOSURE + FLOOR;
gl_FragColor = vec4(min(boosted, vec3(1.0)), 1.0);
```

Why this is the right change: the `FLOOR` lifts dark texels so nothing reads as
pure black, and the `min()` clamp prevents the highlight blowout that the raw
`* 2.6` could produce. Both tunables are named constants so brightness is trivial
to nudge later.

## How we got here
- Originally planned to add real directional sun-lighting (the planet shader is
  unlit, which is why the "Globe Visual Polish v2" lighting rig in older session
  notes was visually inert — nothing consumed scene lights).
- Owner then supplied photos of their local "fixed" `GlobeTerrain.tsx`. It was NOT
  directional lighting — it was this exposure+floor tuning. Pivoted to replicate
  the owner's already-validated look rather than invent a divergent one.
- Cross-checked the other globe files from the photos: `GlobeParcels.tsx` and
  `GlobeColorSettings.tsx` already match the repo. `GlobeTerrain.tsx` was the only
  meaningful difference. Single-file change.

## Scope
- Only `GlobeTerrain.tsx` touched. No tiles, HUD, atmosphere, combat, canvas,
  data sources, or scene-light objects changed.

## Verification
- `pnpm --filter @workspace/frontier-al run check` — tsc clean.
- `pnpm --filter @workspace/frontier-al run test` — 98/98 client tests pass.
- `pnpm --filter @workspace/frontier-al run build` — Vite + esbuild build clean
  (pre-existing chunk-size warning only).
- **Visual: UNVERIFIED by this session.** No GPU/display in the cloud container to
  render the WebGL globe; the change is a 1:1 copy of the owner's home-computer
  shader, so the look is validated by provenance, not by an in-session screenshot.
  Confirm visually on a real run.

## Rollback
Revert `GlobeTerrain.tsx` to the `* 2.6` flat multiply to restore the prior look.
