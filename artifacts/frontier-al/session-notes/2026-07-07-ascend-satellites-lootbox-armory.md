# 2026-07-07 — ASCEND claim, satellite visuals, loot box desktop tab, Armory/attack UX

Second wave of live-play gaps reported by the owner after the NFT-delivery fix
landed and they got much further into real gameplay (18 parcels, 6
commanders, first battle won). Two parallel background agents traced all
five reported items to concrete root causes before any code changed.

## Fixes

### 1. ASCEND "Claim" button never appeared (real bug — server)
Root cause: `DbStorage` (Postgres-backed, i.e. production) never persists a
running `ascendAccumulated` value — the column is only ever written as `0`,
as part of `claimAscend()`'s reset. `game-rules.ts`'s `rowToParcel` just
echoed that permanently-stale `0` to the client, so
`totalClaimableAscend` (`GameLayout.tsx`) was always `0` and the TopBar
button (correctly wired, `TopBar.tsx:117`) never had anything to show.
Contrast: `MemStorage` (`server/storage/mem.ts:245`) does tick the field on
every read, so this only broke in the real DB-backed path.

Fix: extracted the exact `claimAscend` formula (including the
influence-yield gate) into a new pure, directly-unit-testable function,
`computeLiveAscendAccrued(parcel, now)` in `server/storage/game-rules.ts`,
and overlay it onto every parcel in `DbStorage.getGameState()` before
returning to the client — read-only, no extra writes, so `claimAscend`'s own
accounting is untouched. 5 new unit tests in `game-rules.spec.ts` cover the
regression case (real elapsed time → real accrual) plus the influence gate,
future-timestamp guard, and base-accumulation behavior.

### 2. Satellites rendered as bare placeholder spheres (real bug — cosmetic)
`GlobeEvents.tsx`'s `SatelliteOrbitLayer` was correctly deploying, tracking,
and orbiting satellites (`deploySatellite` in `db.ts` was never broken) —
but the mesh was a literal 12-segment `sphereGeometry`, matching the
complaint verbatim ("just like round objects"). Replaced with a cheap
procedural silhouette (box body + two solar-panel wings + antenna cone via a
`<group>`) — no new asset pipeline needed.

### 3. Loot boxes had zero UI on desktop (real bug — dead data)
`InventoryPanel` (fully correct: filters unopened boxes, wires a real "Open"
button to a real, ownership-scoped, idempotent server endpoint) was only
ever mounted inside the `md:hidden` mobile fullscreen panel. The desktop
right-rail tab list (`RailTab`) explicitly excluded `"inventory"` — so a
desktop player's loot boxes were fetched into state but had no surface to
view or open them anywhere. Added an "Inventory" tab to the desktop rail
(`panelNav.ts`'s `RailTab` now only excludes `"map"`; `GameLayout.tsx` gained
the icon entry + render branch, reusing the exact same props as the mobile
instance). Updated `panelNav.spec.ts` to match the new intended behavior.

### 4. Armory has no "fire" button — UX gap, not a bug
The Armory (unlock/upgrade/equip) and weapon-firing (globe → click an
enemy-owned plot → "Weapon Strike") are two separate surfaces with no
cross-link. `server/weapons/service.ts`'s fire/unlock/range logic is sound
and tested; a player who reasonably looks for "deploy" inside the Armory
just finds nothing. Added a one-line callout at the top of the catalog
section pointing them to the globe.

### 5. Special Attacks section vanishes silently without a Commander — UX gap
`LandSheet.tsx:711`'s Special Attacks section was hard-gated on
`player?.commander` with no fallback — if absent, the section simply doesn't
render, no explanation. Added an explanatory line for that case. (This
specific player already has 6 commanders, so this wasn't their blocker, but
it's a real first-time-player trap.)

## Explicitly NOT fixed — needs a design decision, not a code fix

**Vault currencies are a dead economy loop.** `xenoriteVault`,
`voidShardVault`, `plasmaCoreVault`, `darkMatterVault` are produced by
opening loot boxes (`server/engine/lootbox/open.ts`) and displayed with a
"/50" cap in `InventoryPanel.tsx` implying they build toward something —
but grepped across the entire client + server: **they are never spent
anywhere.** Weapon unlock/upgrade/fire/deploy costs are ASCEND-only
(`shared/weapon-economy.ts`). This is a genuine "have resources that do
nothing" experience, but wiring in a made-up spend cost is a game-balance/
economy-design call, not something to invent unilaterally in a bug-fix pass.
**Owner decision needed**: either give these a real sink (e.g. fold into
weapon unlock/upgrade cost) or clearly label them "not yet spendable" in the
UI so it stops reading as broken.

## Scope check

Client + one shared server module (`game-rules.ts`) + `db.ts`'s read path.
No funds/ASA/transfer logic touched. No mainnet-adjacent code.

## Verified green

- `pnpm run check` (tsc) — clean
- `pnpm run test` (client) — 326 passed, unchanged count (panelNav.spec.ts
  updated in place to match new intended behavior, not added to)
- `pnpm run test:server` — **454 passed** (was 449, +5 new —
  `computeLiveAscendAccrued` regression coverage), 24 skipped, unchanged
- `pnpm run build` — clean production build

The ASCEND/satellite/inventory fixes are server-math + pure-function
test-backed. The Armory/LandSheet copy additions and satellite visual are
UI-only, same testing-gap caveat as the previous NFT-delivery fix (no
jsdom/interaction harness in this repo for these deep game panels).
