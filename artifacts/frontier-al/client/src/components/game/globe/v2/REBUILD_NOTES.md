# Globe v2 — rebuild notes

> Recovered from out-of-repo rebuild notes (authored in a separate WSL checkout that
> the sandbox shell could not reach, so the v2 code was never committed there) and
> re-ported into this repo. This file is the root-cause diagnosis of why the old
> globe looked wrong and the design of the v2 fix.

## Why the old globe looked wrong

The old planet had **two competing day/night systems**, plus a magenta wash:

1. **Lights were inert.** `PlanetGlobe.tsx` adds an `ambientLight` + `directionalLight`s,
   but `GlobeTerrain` uses a custom **unlit** shader (full-bright albedo) and every plot
   tile uses an **unlit** `meshBasicMaterial`. The lights touched nothing, so there was
   no real terminator.
2. **The "SUN" readout is fake.** `GlobeHUD` prints a hard-coded `ALT … SUN: 20°` string;
   it is decorative, not a real sun angle.
3. **The magenta wash.** Additive back-side corona shells — the outer one a purple-indigo
   `Color(0.16, 0.08, 0.6)`. Additive purple over the dark planet and through the gaps
   between tiles, amplified by ACES tone mapping (`toneMappingExposure ≈ 1.15`), reads as
   a magenta/pink tint. The cloud/night textures all existed, so it was **not** the classic
   missing-texture magenta — it was the corona.
4. **Apparent shadow shifts when rotating** = parallax of camera-relative layers. With no
   world-space sun, the only thing that changed on rotation was the camera-relative additive
   corona, so the bright/limb area appeared to ride along as the camera moved.
5. **Double layer.** Real stacked translucent shells at nested radii (terrain 1.0, border
   1.012, fill 1.018, sub-parcels 1.028, atmosphere 1.04/1.12/1.28) with `depthTest:false`,
   so everything composited regardless of depth and compounded.

## v2 layer stack (inner → outer) — each independently toggleable

| # | Layer         | File                | Notes |
|---|---------------|---------------------|-------|
| 0 | Starfield     | `StarField` (reused) | static points backdrop |
| 1 | Planet surface| `PlanetSurfaceV2.tsx`| **one** shader: albedo (day) → night-lights, blended across **one** terminator |
| 2 | Plot tiles    | `PlotTilesV2.tsx`   | 21k instanced, terminator applied **on the GPU** via `onBeforeCompile` — no purple, no stacking |
| 3 | Atmosphere    | `AtmosphereV2.tsx`  | **one** blue/cyan fresnel rim, sun-modulated — no purple |
| 4 | Sun + light   | `SunV2.tsx`         | visible disc + directional light, both from the shared sun dir |

Supporting modules:

- `sunModelV2.ts` — **single source of truth** for the sun direction (world-space, normalized,
  orbiting). Also the one `dayFactor()` used everywhere (JS + a matching GLSL snippet).
- `planetDataV2.ts` — the **data layer**, fully separate from rendering. Builds instancing
  arrays from parcels, or deterministic **mock** data when `parcels` is empty.
- `PlanetGlobeV2.tsx` — orchestrator: Canvas, OrbitControls, the layers, and the
  layer-by-layer debug panel.

## The lighting fix, precisely

- A **single** `sunDir` `Vector3` (world space) is owned by `PlanetGlobeV2` and written each
  frame by `SunV2` from `computeSunDirection()`. Surface, tiles, and atmosphere all read that
  same ref.
- Day/night = `smoothstep(-0.10, 0.10, dot(worldNormal, sunDir))`. **One** terminator, **one**
  darkening per fragment. There is no second darkening, so double-darkening cannot occur.
- Because `sunDir` is world-space and the planet group never rotates, dragging the globe no
  longer slides the terminator — the fix for "sun-shade shifts when the globe rotates."
- The magenta source (purple additive corona) is gone; the rim is blue only.

## Preview / verify

Self-contained harness (no build step), already in the repo:

- `client/public/globe-rebuild-preview.html` — open via the dev server at
  `/globe-rebuild-preview.html`. Toggle each layer, drag to orbit (terminator stays put), and
  scrub the sun. It uses procedural textures so the **lighting model** can be validated with
  zero assets.

In-app:

```tsx
import PlanetGlobeV2 from "@/components/game/globe/v2/PlanetGlobeV2";

// mock preview:
<PlanetGlobeV2 />

// live data (same prop shape as the old PlanetGlobe):
<PlanetGlobeV2 parcels={parcels} currentPlayerId={currentPlayerId} onParcelSelect={onParcelSelect} />
```

## Swap-in / rollback

- **Nothing is wired into the app yet** — importing `PlanetGlobeV2` is the only step to try it.
  The old `PlanetGlobe` remains the default.
- To roll back: delete `globe/v2/` and `public/globe-rebuild-preview.html`. No existing file
  was modified.

## Status / honesty

- The lighting core (`sunModelV2`) is **test-backed** — `client/tests/globe-v2-sunmodel.spec.ts`
  pins the unit-vector / determinism / terminator invariants.
- The React/TS port typechecks (`pnpm --filter @workspace/frontier-al run check`) and the client
  test suite is green (`pnpm --filter @workspace/frontier-al run test`).
- **Not yet visually verified on a GPU** in this environment, and **not yet wired into the live
  app** — it still needs an owner-side dev-server smoke test before it replaces the old globe.
