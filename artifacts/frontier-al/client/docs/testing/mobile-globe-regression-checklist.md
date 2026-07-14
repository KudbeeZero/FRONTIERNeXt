# Mobile Globe Touch Regression Checklist

Use this checklist when verifying mobile globe interactions before a release or after touching any of the following files:

- `client/src/components/game/globe/GlobeParcels.tsx`
- `client/src/components/game/PlanetGlobe.tsx`
- `client/src/components/game/hud/hud.css`
- `client/src/components/game/globe/GlobeHUD.tsx`
- `client/index.html`

## Environment

- Device: real mobile device or Chrome DevTools mobile emulation with touch events enabled
- URL: deployed preview or production (`https://frontierprotocol.app`)

## Checklist

- [ ] **Single tap selects parcel**
  - Tap a plot on the globe with one finger.
  - Expected: plot is selected, peek card and/or bottom sheet opens.

- [ ] **Pinch zoom works**
  - Place two fingers on the globe and pinch in/out.
  - Expected: camera zooms in/out smoothly.

- [ ] **Pinch causes no rotation**
  - Pinch the globe with two fingers.
  - Expected: camera zooms only; globe does not spin.

- [ ] **Releasing first finger opens nothing**
  - Start a pinch, then lift the first finger while the second is still down.
  - Expected: no plot is selected, no sheet opens.

- [ ] **Dock buttons work**
  - Tap each button in the bottom dock: MAP, BATTLES, ARMORY, INVENTORY, COMMANDER, MORE.
  - Expected: each button responds (navigates, toggles, or opens the drawer).

- [ ] **Empty dock gaps pass through**
  - Touch and drag in the empty space between dock buttons, or pinch over the dock area without touching a button.
  - Expected: the gesture passes through to the globe; the dock does not block zoom/rotate.

- [ ] **PlayerLegend does not block touches**
  - Tap the "YOU" badge in the top-left.
  - Expected: the tap is handled by the globe, not the badge; the badge is not interactive.

- [ ] **Browser page does not zoom**
  - Perform a browser-level pinch zoom on the page chrome.
  - Expected: page stays at 100%; only the globe camera zooms.

## Sign-off

- [ ] All checks passed
- [ ] No regressions observed on desktop
- [ ] Screenshot or screen recording attached (optional but recommended)
