# Weapons → combat wiring audit (2026-06-25)

## Finding

The weapon system is **acquirable but inert in combat**.

- **Wired (live):** Armory build / unlock / upgrade / loadout — `ArmoryPanel.tsx` →
  `/api/weapons/{catalog,build,unlock,upgrade,loadout}`. Players can buy + equip weapons.
- **Orphaned (no client caller):** the two combat verbs —
  - `POST /api/weapons/fire` (`routes.ts:2539`) → `weaponService.fireWeapon` →
    `engagementStore.launch` (ballistics + intercept). Engine + specs exist; **zero UI**.
  - `POST /api/weapons/deploy-defense` (`routes.ts:2564`) → `weaponService.deployDefense`. Same.
- **"Initiate Invasion"** (`GlobeHUD.tsx`) is fully wired but to the **separate legacy
  troops/resources battle engine** (`deployAttack`), which ignores weapons entirely.
- "Invasion" is a UI label for the existing battle→conquest mechanic; there is **no** separate
  unimplemented invasion engine.

## HARD-RULE note

`fire` / `deploy-defense` debit via `storage.spendAscend` — the **same in-game ASCEND ledger**
the live Armory unlock/upgrade actions already use. Wiring their UI introduces **no new
funds/ASA/chain surface** (only `mint-nft` touches custody). Not a `/mainnet-gate` trigger.

## Roadmap (serial units)

- **Unit 1 — Offensive Weapon Strike — ✅ this PR.** `weaponStrike.ts` (pure
  eligibility/range helper, `eligibleStrikes`, +6 tests) · `useWeapons.ts`
  (`useWeaponCatalog` + `useFireWeapon`) · `StrikePanel.tsx` (self-contained: catalog +
  owned territory → fireable list → `/api/weapons/fire`, toast on hit/intercept) · a
  **Weapon Strike** button beside "Initiate Invasion" in `GlobeHUD.tsx`. Server unchanged.
- **Unit 2 — Defensive deploy UI** for `/api/weapons/deploy-defense` on owned parcels
  (defensive specs only; fog-of-war: server intentionally does not broadcast a deployment).
- **Unit 3 — Engagement feedback:** consume the `weapon_engagement` ws broadcast →
  globe strike cinematic + HUD callout (reuse the battle-cinematic layer).
