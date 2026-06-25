# Session note — 2026-06-25 — Weapon Strike UI (weapons-combat Unit 1)

**Branch:** `claude/weapons-strike-ui` → one PR into `main`.

## Context
Invasion-wiring audit (see `docs/audit/2026-06-25-weapons-combat-wiring.md`) found weapons are
acquirable in the Armory but **inert in combat** — `/api/weapons/fire` and `/deploy-defense`
were orphaned (no client callers). Owner chose "wire fire + defense UI." This is Unit 1
(offensive fire); defense + cinematic feedback are Units 2–3.

## What shipped (this unit)
- `client/src/lib/weaponStrike.ts` — pure `eligibleStrikes(entries, ownedParcels, target)`:
  owned **offensive** weapons only, nearest owned parcel as source, in-range/affordable reason.
  Reuses shared `greatCircleKm` / `isDefenseSpec` so client range == server range.
- `client/tests/weaponStrike.spec.ts` — 6 tests (in-range, out-of-range, no-territory,
  defensive-excluded, unowned-excluded, nearest-source). Fail before / pass after.
- `client/src/hooks/useWeapons.ts` — `useWeaponCatalog` (shares ArmoryPanel cache key) +
  `useFireWeapon` → `POST /api/weapons/fire`, invalidates catalog + game state.
- `client/src/components/game/globe/StrikePanel.tsx` — self-contained modal: pulls catalog +
  owned territory itself, lists fireable weapons (cost/range), fires, toasts hit vs intercept.
- `GlobeHUD.tsx` — **Weapon Strike** button beside "Initiate Invasion" on hostile parcels.
- Server: **unchanged** (route + engine already existed and broadcast `weapon_engagement`).

## Verify (all green locally)
- `check` (tsc) clean · `test` (client) **174 passed** · `test:server` **380 passed / 14 skip**.
- ⚠️ **Not browser-verified** — the panel/button visuals + the live fire round-trip are untested
  on-device. Manual path: select an enemy parcel → Weapon Strike → fire an in-range owned
  offensive weapon → toast + ASCEND debit.

## Next
- **Unit 2:** defensive deploy UI (`/api/weapons/deploy-defense`).
- **Unit 3:** consume `weapon_engagement` → globe strike cinematic + HUD callout.
