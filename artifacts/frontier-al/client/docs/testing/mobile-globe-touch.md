# Mobile Globe Touch Interaction — Testing Notes

## Scope

Documents the mobile globe touch fixes shipped in PR #263 and why automated regression coverage for the pointer guard is not currently practical.

## Fixes in PR #263

1. **Pinch-click guard** (`client/src/components/game/globe/GlobeParcels.tsx`)
2. **Pure pinch zoom** (`client/src/components/game/PlanetGlobe.tsx` — `TWO: THREE.TOUCH.DOLLY_PAN`)
3. **Dock pointer passthrough** (`client/src/components/game/hud/hud.css`)
4. **PlayerLegend pointer passthrough** (`client/src/components/game/globe/GlobeHUD.tsx`)
5. **Viewport zoom lock** (`client/index.html`)

## Why the pointer guard is hard to unit-test

The guard lives inside `PlotOverlay` inside `GlobeParcels.tsx`. It depends on:

- React Three Fiber (R3F) pointer events (`onPointerDown`, `onPointerUp`, `onClick`) on a `<mesh>`.
- A full WebGL Canvas and the R3F event system to emit `onClick` with the correct `delta`.
- `useRef` counters that are shared across the synthetic pointer lifecycle of a single gesture.

The existing client test harness runs in Node and uses `renderToStaticMarkup` / `react-test-renderer` (SSR/headless, no jsdom, no WebGL). Simulating R3F pointer events would require:

- A jsdom or happy-dom environment with a mocked WebGL context.
- Mocking R3F's `useFrame`, `Canvas`, `mesh`, `sphereGeometry`, `meshBasicMaterial`, `applyProps`, etc.
- Synthesizing pointer events with correct `pointerId`, `isPrimary`, and screen coordinates so R3F emits `onClick` with the expected delta.

That level of mocking is brittle and would mostly test the mock, not the real behavior. The team therefore treats the guard as manually verified.

## Current test harness

- **Vitest** (client + server) — `pnpm run test`, `pnpm run test:server`.
- **No jsdom / happy-dom** — all client tests are SSR/headless.
- **No Playwright, Cypress, or `@vitest/browser`** — none are installed in the workspace.
- **No E2E directory**.

## Manual reproduction steps

### Pinch-click suppression (most important)

1. Open `https://frontierprotocol.app` on a mobile device (or Chrome DevTools mobile emulation with touch enabled).
2. Navigate to the globe.
3. Place two fingers on the globe and pinch in/out to zoom.
4. While pinching, lift one finger first, then the other.
5. **Expected:** no plot panel opens.
6. Now tap the globe with a single finger.
7. **Expected:** the tapped plot is selected and the panel/sheet opens.

### Pure pinch zoom

1. Pinch the globe with two fingers.
2. **Expected:** camera zooms in/out only; no globe rotation.

### Dock passthrough

1. Tap each dock button (MAP, BATTLES, ARMORY, INVENTORY, COMMANDER, MORE).
2. **Expected:** each button responds and navigates/toggles.
3. Place a finger in the empty space between dock buttons and drag to rotate the globe.
4. **Expected:** globe rotates/zooms; dock does not intercept the gesture.

### PlayerLegend passthrough

1. Tap the "YOU" badge in the top-left corner.
2. **Expected:** the tap passes through to the globe; the badge is not interactive.

### Browser zoom lock

1. Attempt a browser-level pinch zoom (two fingers on the page chrome).
2. **Expected:** page does not zoom; canvas zooms instead.

## Future automated test ideas

- **Headless browser E2E** with Playwright or Vitest Browser Mode: simulate multi-touch using `PointerEvent` with `pointerId` and `isPrimary`.
- **Extract guard hook** (`usePointerTap`) if the guard is reused elsewhere. Then test the hook with synthetic React events, not R3F events.
- **Visual regression** via `docs/HEADLESS_VISUAL_TESTING.md` recipe: capture before/after screenshots of the dock and panels.

## Related files

- `client/src/components/game/globe/GlobeParcels.tsx` — pointer guard
- `client/src/components/game/PlanetGlobe.tsx` — OrbitControls touch config
- `client/src/components/game/hud/hud.css` — dock pointer-events
- `client/src/components/game/globe/GlobeHUD.tsx` — PlayerLegend
- `client/index.html` — viewport meta
- `client/docs/testing/mobile-globe-regression-checklist.md` — QA checklist
