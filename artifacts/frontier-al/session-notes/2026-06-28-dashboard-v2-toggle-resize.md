# 2026-06-28 — Dashboard v2: in-HUD toggle + resizable widgets

**Branch:** `claude/wallet-dashboard-redesign-b78nwa`
**Builds on:** #168 (dashboard foundation). Owner wants to TEST it on desktop without URL flags.

## What shipped (client-only; still flag-seeded, now toggleable in-UI)
- **TopBar toggle** — a grid button (desktop only, `data-testid="button-dashboard-toggle"`) flips between
  the classic rails and the widget dashboard live. `dashboardOn` is now React state in GameLayout
  (seeded from the `?dashboard=1`/persisted flag); the toggle calls `setDashboardEnabled()` + flips state,
  so the choice persists and no reload is needed.
- **Resizable widgets** — `Widget` has a bottom-right resize handle (pointer-drag); it reports live pixel
  size and `DashboardCanvas` snaps it to whole grid cells via the new pure `pixelToSize()`. `useWidgetLayout`
  gained `resize(id, w, h)` (clamped to the grid).

## Tests
- `pixelToSize` added to `dashboardLayout.spec.ts` (inverse-of-cellToPixels; floors at 1×1).
- Green: `check` (tsc) · `test` (client) **221 passed** (219 + 2) · `build` OK. (`test:server` unaffected — client-only.)

## Honest limitation
Still **not browser-verified** (sandbox has no display) — the resize/drag feel and the toggle are
typecheck+build+unit-test green but unproven on screen. Owner is now testing locally / on preview:
load `/game`, click the grid icon in the top bar (or `?dashboard=1`), drag widgets by their header,
resize from the bottom-right corner, "Reset" restores defaults.

## Next
- Promote dashboard to default-on for desktop once the owner confirms the feel.
- Fold in remaining panels (Economics/Intel/Inventory/Battles) + the floating plot panel.
- Branded-domain redirect `frontierprotocol.app` → `frontiernext.fly.dev`.
