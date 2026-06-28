# 2026-06-28 — Desktop dashboard widget system (foundation, flag-gated)

**Branch:** `claude/wallet-dashboard-redesign-b78nwa`
**Trigger:** owner screenshots — the in-game menus (WAR / ARMORY / ACADEMY / COMMANDER /
RANKINGS / WAR ROOM / BATTLES / EVENTS / AI FACTIONS) overlap and bunch together. Owner wants a
draggable snap-grid dashboard "to the next level."

## What shipped (client-only; default OFF; no server/funds/ASA/globe change)
A self-contained **draggable snap-grid dashboard**, mounted only behind a flag so the live HUD is
untouched until the owner opts in.

- **Pure layout engine** `client/src/lib/dashboard/layout.ts` — 12-col grid math (snap
  `pixelToCell` / `cellToPixels`, `clampToGrid`, `moveWidget`, `bringToFront`), default-merge, and
  **versioned localStorage persistence** (corrupt/old blobs fall back to defaults, never throw).
- **Feature flag** `client/src/lib/dashboard/flag.ts` — `?dashboard=1` (sticky) or
  `localStorage frontier_dashboard_enabled=1`; `?dashboard=0` disables. Default **off**.
- **React layer** `client/src/components/game/dashboard/`:
  - `useWidgetLayout` — state + persistence glue over the pure engine.
  - `Widget` — dnd-kit draggable frame (drag handle, minimize, hide).
  - `DashboardCanvas` — `DndContext` + snap-on-drop, a "Reset layout" control, and a tray to
    restore hidden widgets.
  - `defaults.ts` — canonical 12-col placement for the 9 panels (trade/factions/markets start hidden).
- **GameLayout wiring** — when `dashboardOn`, the two fixed desktop `<aside>` rails are replaced by
  the canvas hosting the **same** panels (CommandCenter, War Room, Rankings, Armory, Academy,
  Commander, Trade, Factions, Markets) as movable widgets. When off, the rails render exactly as
  before (the conditionals are strictly additive). Added dep: `@dnd-kit/core|modifiers|utilities`.

## Tests (fail-before / pass-after)
- `client/tests/dashboardLayout.spec.ts` (15) — grid/snap/clamp/merge/persistence + corrupt-blob fallback.
- `client/tests/dashboardFlag.spec.ts` (4) — default-off; `?dashboard=1/0` precedence; persisted flag.
- Green: `check` (tsc) · `test` (client) **219 passed** (200 + 19 new) · `test:server` **411/14-skip** · `build` OK.

## Honest limitation (read this)
The widget canvas is **not browser-verified** — the sandbox can't render/drag it. The pure engine +
flag are unit-tested; the React layer typechecks + builds but its on-screen behavior (drag feel,
snap, panel fit inside widgets) is unverified. It is **default OFF**, so the live game is unchanged.
**Owner: evaluate on the branch preview with `?dashboard=1`** (e.g.
`https://claude-wallet-dashboard-rede.frontieralgo.pages.dev/game?dashboard=1`). Once it looks right,
the next unit promotes it to default + adds resize handles + per-widget sizing.

## Next units
- Dashboard v2: make it the default desktop layout, add resize handles, tune default placement, fold
  in the remaining panels (Economics/Intel/Inventory/Battles) and the floating plot panel.
- Branded-domain redirect `frontierprotocol.app` → `frontiernext.fly.dev` (from 2026-06-27 diagnosis).
