# Combat / Weapon UI Audit

> READ-ONLY audit of the client (`client/src`). Evidence from sub-agent exploration;
> line numbers are best-effort and should be re-confirmed before editing.

## What exists and is wired

- **ArmoryPanel** (`client/src/components/game/armory/ArmoryPanel.tsx`) — full weapon
  progression UI on the `/armory` route: attribute point-budget allocator, archetype +
  badge wall, weapon catalog grid (per-weapon: name, tier, damage, range, real-world
  ref, unlock badge), and **Unlock / Upgrade / Equip** actions wired to
  `/api/weapons/{catalog,build,unlock,loadout,upgrade}` via React Query.
- **GlobeHUD / ParcelHUD** (`globe/GlobeHUD.tsx`) — parcel info + an **"Initiate
  Invasion"** button (`onAttack`) for enemy parcels. This drives the *invasion* engine,
  not per-weapon firing.
- **BattleWatchModal** (`BattleWatchModal.tsx`) — watch live/resolved battles; powers,
  commander, simulated progress + seeded log, and a real replay via
  `/api/battle/replay/:id` (pillage totals + phase log).
- **LiveWeaponLayer + WeaponScene/Projectile/ImpactBurst** (`globe/`, `weapons/`) —
  render fired weapons on the globe from `weapon_engagement` WS events (arc, trail,
  intercept/impact flash). Client clock rebases `launchTs` for skew.

## What is missing / stub

| Gap | Detail |
|---|---|
| **In-game fire button** | `/api/weapons/fire` exists but **nothing in the main HUD calls it**. Firing is only reachable conceptually via the armory loadout; there's no "select weapon → select target → fire" control in the game view. |
| **Defense-deploy UI** | `/api/weapons/deploy-defense` exists; no UI to place a battery on your parcel. |
| **2D tactical window** | No minimap / radar / top-down panel. Events are visible only on the 3D globe + `WorldIntelPanel` text feed. |
| **Target reticle** | Targeting reuses parcel selection (coverage-sphere + nearest-neighbor snap); no distinct aiming affordance. |
| **Upgrade cost preview** | "Upgrade" button doesn't show the ASCEND cost before clicking. |
| **Interception feedback** | Intercepts render a flash but add no battle-log entry. |
| **Currency label** | Armory shows costs as "FR" while the economy unit is ASCEND. |

## Why the current weapon UI "doesn't make sense" to a player

1. You can browse/unlock/upgrade/equip weapons in `/armory`, but you can't **fire** one
   from the game — the loop dead-ends.
2. Weapons have **no description** field, so cards show a name + stats but no "what is
   this / why use it."
3. There are two combat verbs ("Initiate Invasion" on the globe vs. the weapon system)
   with no visible link between them, so it's unclear which one "attacks."

## Recommendations (smallest patch)

- Add a **Fire** affordance to the parcel HUD: when an enemy parcel is selected and the
  player has an equipped offensive weapon in range, show "Fire [weapon]" → call
  `/api/weapons/fire`. Disable with a reason when locked/out-of-range/on-cooldown.
- Add a minimal **tactical panel** (see `tactical-window-research.md`) showing selected
  target, selected weapon, cooldown, and a battle-log feed.
- Add the `description` field and render it on weapon cards.
