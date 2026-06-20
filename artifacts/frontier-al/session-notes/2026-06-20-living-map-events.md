# 2026-06-20 — Living Map PR1: live world-event telemetry boxes on the globe

## Unit
Owner wants the map to feel **alive** — boxes popping up, arrows, telemetry, tied together. Discovery
showed the globe already renders live **arcs** (battle_started, weapon engagements), **mining pulses**,
**orbital zones**, **satellites**, and an `<Html>` EventCard pattern — but the EventCards are **replay-only**,
and live events that carry coords (`battle_resolved`, `land_claimed`) produce **no on-map visual** (text in
the ActivityFeed only). This unit fills the "box popping up" half for those live events.

## What shipped (additive globe overlay; no server change)
- `client/src/lib/globe/liveEventDisplay.ts` (NEW) — pure `liveEventDisplay(event) → {label,color,kind}|null`:
  `battle_resolved` → VICTORY / DEFENSE HELD (from `metadata.outcome`), `land_claimed` → CLAIMED; returns
  `null` for already-visualized / coordless types (battle_started/mine/orbital/commander_deployed/scan_ping).
  +7 tests (`client/tests/liveEventDisplay.spec.ts`).
- `client/src/components/game/globe/GlobeLiveEvents.tsx` (NEW) — R3F layer mounted in the Scene that
  self-subscribes to the live `onWorldEvent` bus and pops a transient `<Html>` "◉ LIVE" box at the event's
  lat/lng (TTL 6s, capped at 8, dedup by id; `unsub` + `clearTimeout` cleanup). Mirrors the existing
  `GlobeEventOverlays` `<Html>` pattern + the propless self-subscribing `LiveWeaponLayer` precedent.
- `PlanetGlobe.tsx` — mount `<GlobeLiveEvents />` beside `LiveWeaponLayer` (one import + one line).

## Scope / safety
Additive overlay — no change to existing layers, server emission, schema, funds. Driven by **real**
broadcast `world_event`s (already public in the ActivityFeed) — **no mock data**. Globe/canvas HARD RULE:
scoped + audited; `VITE_TEST_GLOBE` untouched.

## Verification
`check` ✓ · client `test` **83** (+7 `liveEventDisplay.spec`) · `test:server` **318** (unchanged) ·
`build` ✓. **Visual NOT browser-verified here** (no display/browser; R3F components aren't SSR-testable —
the codebase convention is to unit-test the pure globe *lib* functions, which this does). **Owner verifies
the actual boxes/pop from their computer.**

## Gates (owner-requested)
`/code-review` (clean — additive, pure-helper-backed) · `/security-pass` (PASS — client read-only display
of already-public events, no secret/address leak; `docs/audit/2026-06-20-living-map-events-security-pass.md`)
· `/pr-gate`.

## Process note
Multiple PRs open in parallel by owner direction: **#78** (design doc), **#79** (comm-terminal), + this.
Recommend merging the earlier ones to keep the stack manageable.

## Follow-ups
Burst-ring marker (orientation-correct, tangent to surface); fix `commander_deployed`/`scan_ping` `(0,0)`
coords (source-parcel wiring) so they're map-placeable; region/faction telemetry (SD-C).
