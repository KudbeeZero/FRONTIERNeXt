# 2026-06-22 — Globe v2 rebuild (from recovered REBUILD_NOTES)

## Context
Owner shared photos of a `REBUILD_NOTES.md` from a `globe/v2/` folder authored in a
separate WSL checkout. None of the v2 code had ever been committed to this repo — only
the old (unlit) globe stack existed. The notes diagnose why the old globe looked wrong
(inert lights, fake "SUN" HUD readout, additive purple corona → magenta wash, stacked
depthTest:false shells → double-darkening, camera-relative parallax) and propose a v2
with a single world-space sun driving every layer.

## Unit of work
Ported the v2 globe into this repo as **new, self-contained files** — nothing existing
was modified (the notes' rollback guarantee holds: delete `globe/v2/` +
`public/globe-rebuild-preview.html` to revert). **Not wired into the live app.**

New files under `client/src/components/game/globe/v2/`:
- `sunModelV2.ts` — single source of truth for the sun (world-space dir + `dayFactor` +
  matching GLSL). Pure, deterministic, test-backed.
- `planetDataV2.ts` — data layer; reuses `generateFibonacciSphere` + `BIOME_COLORS` +
  `getPlotColor` for server/client parity; deterministic mock biomes when no parcels.
- `PlanetSurfaceV2.tsx` — one shader, day albedo → night-lights across one terminator.
- `PlotTilesV2.tsx` — 21k instanced tiles, terminator on the GPU via `onBeforeCompile`,
  normal depth testing (no stacking).
- `AtmosphereV2.tsx` — one blue/cyan fresnel rim, sun-modulated (no purple → no magenta).
- `SunV2.tsx` — single writer of the shared sun dir + visible disc + directional light.
- `PlanetGlobeV2.tsx` — orchestrator + layer-by-layer debug panel; drop-in prop shape.
- `REBUILD_NOTES.md` — the recovered diagnosis (transcribed + Status section updated).

Plus:
- `client/public/globe-rebuild-preview.html` — standalone harness (three via CDN
  importmap, procedural textures, layer toggles, orbit, sun scrub). Open at
  `/globe-rebuild-preview.html`.
- `client/tests/globe-v2-sunmodel.spec.ts` — 9 tests pinning the lighting core.

## Verification (this environment)
- `pnpm --filter @workspace/frontier-al run check` — **clean**.
- `pnpm --filter @workspace/frontier-al run test` — **107/107** (incl. 9 new).
- `pnpm --filter @workspace/frontier-al run build` — **succeeds** (pre-existing chunk-size
  warning only).
- **Not** visually verified on a GPU here, and **not** wired into the app — needs an
  owner-side dev-server smoke test of `/globe-rebuild-preview.html` (and/or mounting
  `<PlanetGlobeV2 />`) before it could replace the old globe.

## /code-review fixes (same PR, post-review)
`/code-review` on the diff surfaced color-pipeline defects that would make the v2
surface look dark/inconsistent — fixed in-PR (GLSL, typecheck/build-verified, NOT
GPU-verified):
- **#1 (high):** `PlanetSurfaceV2` raw ShaderMaterial wrote `gl_FragColor` with no
  tone-map/encode (three only runs `<tonemapping_fragment>`/`<colorspace_fragment>` for
  built-in materials), so the surface read dark + disagreed with the tiles. Now inlines
  three's exact ACES fit + linear→sRGB (`uToneExposure` matches the Canvas 1.15).
- **#2 (med):** `PlotTilesV2` night dim was applied at `<dithering_fragment>` (after
  tone-map/encode). Moved to `diffuseColor` at `<color_fragment>` → dims in linear space,
  matching the surface.
- **#3 (med):** `SUN_GLSL` was exported as the shader-side single source of truth but
  unused. Now wired into both shaders (`dayFactorV2()`); the inline terminator copies are
  gone, so CPU/surface/tile drift is impossible by construction.
- Same fixes mirrored into `globe-rebuild-preview.html`.
- Deferred: #4 (texture `colorSpace` set in a post-render effect w/o `needsUpdate`) and the
  mock-data opt-in guardrail — documented, not yet changed.

## Next
- Owner smoke-test the preview harness + mock `<PlanetGlobeV2 />`.
- If it looks right, a follow-up unit wires `PlanetGlobeV2` into `GameLayout` behind a
  flag and ports the remaining old-globe overlays (HUD, battle arcs, live events,
  observer/replay) onto the v2 stack.
