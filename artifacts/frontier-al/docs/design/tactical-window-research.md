# 2D Tactical Window — Research & Layout Proposal

> READ-ONLY design note. No external art/assets used. Patterns below are generic
> space/strategy-HUD conventions, not copied from any product.

## Repo findings

- **No 2D tactical window exists today.** Closest pieces: `ObserverLayer.tsx`
  (camera-distance → look-back time), `GlobeEventOverlays.tsx` (arcs/rings on the globe),
  `WorldIntelPanel.tsx` (text event/timeline feed).
- The globe `SCOPE_BRIEF.md` defines the safe seam: a future overlay should be a
  **screen-space layer** that uses the planned `worldToScreen` / `surfaceHit`
  projection (`client/src/lib/globe/globeProjection.ts`) and must **never** reach into
  globe render internals.

## Where it should mount

A new `client/src/components/game/globe/TacticalOverlay.tsx`, mounted next to
`LiveWeaponLayer` / `GlobeEventOverlays` inside `PlanetGlobe`, drawn as an HTML/CSS
overlay (not inside the three.js canvas) so it stays cheap and testable.

## Recommended first-version sections (read-mostly, one action)

1. **Selected parcel / sector** — id, biome, owner.
2. **Selected target** — owner, defense level, est. defender power.
3. **Selected weapon** — name, tier, damage, range, fire cost (ASCEND).
4. **Weapon status** — ready / cooldown remaining / out-of-range / locked (with reason).
5. **Your defense** — defenseLevel + improvements summary (the battle-wired ones).
6. **Recent battle log** — last N events from the existing event feed / replay.
7. **Active modifiers** — commander bonus, radar debuff, biome mod, orbital hazard.
8. **One action: Fire / Engage** — the only clickable; everything else is read-only.

## Data it needs (all already available)

- Selected parcel + target from globe pick state.
- Equipped weapon spec from the weapons profile (`/api/weapons/catalog`).
- Range check via `inRange` (great-circle) — already in `shared/weapons`.
- Cooldown from engagement/loadout state.
- Battle log from `world_event` WS stream / `/api/battle/replay`.

## Interaction rules

- **Clickable:** Fire/Engage only (disabled with a reason when invalid).
- **Read-only:** all stats/log.
- **Animate:** cooldown ring, incoming-threat pulse (reuse existing FX).
- **Keep simple for v1:** no drag-targeting; target = current globe selection.

## Connection to the engine

The window is a thin view over existing endpoints. Firing calls `/api/weapons/fire`;
the resulting `weapon_engagement` event already drives globe FX. The only new backend
requirement for a *meaningful* loop is that an `impacted` shot produces a visible,
tested effect on the target (see `first-playable-combat-loop.md`).
