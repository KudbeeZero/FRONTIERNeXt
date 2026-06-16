# FRONTIER Combat Engine + Upgrade Matrix Audit

> READ-ONLY audit. Branch `claude/combat-upgrade-matrix-2a3gl2`. **No game code
> changed** — only docs under `artifacts/frontier-al/docs/design/`. Date 2026-06-16.
> Method: 3 parallel exploration agents + direct re-verification of the core battle
> math, weapon catalog, and economy files. "NOT VERIFIED" = not confirmable from code
> this pass.

## 1. Current repo state

- Branch: `claude/combat-upgrade-matrix-2a3gl2` (this unit).
- Scope: combat/weapons/land-upgrades **audit + truth tables**, no chain/admin/globe-render.
- Tests last green per baton: frontier-al `test:server` 244/244; root typecheck green.
- ⚠️ A separate PR (`claude/multi-agent-dev-plan-rdpbfi`) is **AWAITING_AUDIT** — this
  audit unit is doc-only and opens **no** PR, to respect "one open PR at a time."

## 2. Canonical vocabulary

Plot = Parcel (`LandParcel`, table `parcels`); 1/9 subdivisions = **sub-parcels**; built
structures = **improvements** (defense improvements [iron/fuel] + facilities [ASCEND]);
sub-parcel role = **archetype**. Weapons are a separate catalog (`shared/weapons`).

## 3. Existing combat code

- Invasion engine: `server/engine/battle/{resolve,tuning,random,sim}.ts` (+ specs).
- Weapon core: `shared/weapons/{missiles,artillery,antiAir,defense,catalog,ballistics,
  intercept,types,profile}.ts`; runtime `server/weapons/{service,engagementStore}.ts`;
  economy `shared/weapon-economy.ts`.
- Land/economy: `shared/schema.ts`, `shared/economy-config.ts`, `server/storage/db.ts`.
- UI: `ArmoryPanel.tsx`, `globe/GlobeHUD.tsx`, `BattleWatchModal.tsx`,
  `globe/LiveWeaponLayer.tsx`, `weapons/WeaponScene.tsx`.
- Existing docs: `docs/WEAPON_SYSTEM.md`, `docs/globe/SCOPE_BRIEF.md`.

## 4. Weapon system status

- **38 weapons**, all fields present **except `description` (no field exists)**.
- Prices are **not missing** — fire cost per spec; unlock ×6, upgrade ×3×tier, deploy ×4.
- Progression is by **tier (separate specs) gated by badge**, not per-weapon levels.
- Firing logic exists (ballistics + interception, tested); **no in-game fire button**.
- See `battle-weapons-matrix.csv` + `battle-weapons-audit.md`.

## 5. Land / parcel upgrade status

- Battle-wired: turret, shield_gen, fortress (+5 power/level), radar (×0.9 attacker),
  defenseLevel (×15 base). Level 2+ works for these.
- NOT wired: **data_centre** (yield mult computed, never applied), **ai_lab** (cooldown
  claim unread). storage_depot/electricity/blockchain_node are economy-only.
- Parcel unlocks are real (ALGO purchase + subdivide), economy/ownership-gated.
- See `land-upgrades-combat-matrix.csv` + `land-upgrades-combat-audit.md`.

## 6. Battle engine status

- Real, deterministic, tested invasion engine. **No explicit state machine** — single
  snapshot resolution with a textual phase log + on-demand replay.
- Player can engage via invasion. Damage resolves; pillage applies on win.
- **Weapon damage is NOT an input to the invasion engine**; weapon→parcel impact path
  NOT VERIFIED. See `battle-engine-audit.md`.

## 7. Master spreadsheet outputs (created)

- `docs/design/battle-weapons-matrix.csv` (38 weapons)
- `docs/design/land-upgrades-combat-matrix.csv`
- `docs/design/frontier-combat-upgrade-master-matrix.csv`
- `docs/design/frontier-combat-upgrade-master-matrix.md`
- Plus audits: `battle-engine-audit.md`, `battle-weapons-audit.md`,
  `land-upgrades-combat-audit.md`, `combat-ui-audit.md`, `tactical-window-research.md`,
  `first-playable-combat-loop.md`.

## 8. 2D tactical window

Absent. Should mount as a screen-space `TacticalOverlay.tsx` via the globe projection
seam. Proposed sections + data + interaction rules in `tactical-window-research.md`.

## 9. What is broken or missing

- **Critical:** weapon→battle connection NOT VERIFIED (firing may not change anything);
  no in-game fire button (loop dead-ends).
- **High:** no `description` field on weapons; data_centre/ai_lab not wired; no
  deploy-defense UI.
- **Medium:** no 2D tactical window; "FR" vs "ASCEND" label; fortress schema vs engine
  mismatch; special-attack effects NOT VERIFIED.
- **Low:** intercepts add no log entry; no upgrade-cost preview.

## 10. Smallest safe build step

**One PR: `feat/first-playable-combat-loop`** — wire one offensive weapon (towed
artillery) end-to-end so an `impacted` shot applies a tested parcel-state delta; add a
Fire control + minimal tactical panel; add `description`. Full scope in
`first-playable-combat-loop.md`.

## 11. Exact files to change (for that PR, confirm first)

`server/weapons/service.ts`, `server/weapons/engagementStore.ts`,
`shared/weapons/types.ts` (+catalog populate), `client/.../globe/TacticalOverlay.tsx`
(new) + Fire button in `globe/GlobeHUD.tsx`. Tests: extend
`server/weapons/service.spec.ts`.

## 12. Tests needed

Weapon-has-description; fire→impact→clamped parcel delta; fire-rejected states
(locked/no-target/range/cooldown/ASCEND); deterministic impact; keep `check` +
`test:server` + `test` green.

## 13. Final verdict

- **Do weapons make sense to a player?** Not yet — browsable/upgradable but unfireable
  in-game and undescribed.
- **Can weapons be fired?** Logic yes; UI no.
- **Are weapon upgrades priced?** Yes (formula-derived).
- **Are land upgrades connected to battle?** Yes for turret/shield_gen/fortress/radar;
  no for data_centre/ai_lab.
- **Are parcel unlocks real?** Yes.
- **Real battle engine or placeholder?** Real, deterministic, tested — but it's the
  *invasion* engine; the *weapon* engine is a separate, not-yet-connected layer.
- **Next smallest safe step:** `feat/first-playable-combat-loop` (above).

## 14. Implementation baton (for the next agent)

Build `feat/first-playable-combat-loop` per `first-playable-combat-loop.md`. **Must not
touch**: wallet/chain monitor, admin dashboard, unrelated 3D visuals, unrelated economy
systems, repo-wide refactors, mainnet. One unit, one PR, audited, then merged.
