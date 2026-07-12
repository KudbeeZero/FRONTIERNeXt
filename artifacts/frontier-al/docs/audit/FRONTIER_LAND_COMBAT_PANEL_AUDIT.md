# FRONTIER-AL Land, Combat & Panel Audit

**Date:** 2026-07-12
**Scope:** Player-facing land-management & combat system — end-to-end trace
**Commit:** `fa5b125` (main, PR #242 merged)
**Type:** Read-only — no code changes, no branches, no PRs

---

## ASKED

Full audit of: land parcel management, sub-parcel creation/ownership/upgrades,
archetype selection, energy generation/storage/consumption/regeneration,
attack-method selection, attack launch, defense calculation, battle resolution,
rewards/damage/cooldowns/persistence, panel responsiveness, and database/engine
consistency.

---

## SYSTEM MAP

### 1. Land Parcel Management

| Layer | Path | Lines |
|---|---|---|
| UI | `client/src/components/game/LandSheet.tsx` | 1–800+ |
| UI | `client/src/components/game/CommandCenterPanel.tsx` | 1–500+ |
| UI | `client/src/components/game/SelectedPlotPanel.tsx` | — |
| State | `useGameState()`, `useUpgrade()`, `useBuild()`, `usePurchase()` | `hooks/useGameState.ts` |
| Query | `GET /api/game/state` → `GameState.parcels` | `routes.ts:1740` |
| Mutation | `POST /api/actions/upgrade` | `routes.ts:2070` |
| Mutation | `POST /api/actions/build` | `routes.ts:2095` |
| Mutation | `POST /api/actions/mine` | `routes.ts:1995` |
| Mutation | `POST /api/actions/purchase` | `routes.ts:2120` |
| Validation | `upgradeActionSchema`, `buildActionSchema`, `mineActionSchema`, `purchaseActionSchema` | `shared/schema.ts:507–558` |
| Service | `storage/` — `deployUpgrade`, `deployBuild`, `deployMine`, `deployPurchase` | `server/storage/db.ts` |
| DB | `parcels` table: `improvements`, `defenseLevel`, `ownerId`, `ironStored`, `fuelStored`, `crystalStored`, `lastMineTs`, `ascendAccumulated` | `server/db-schema.ts:253–314` |
| Engine | Upgrade affects `ascendPerDay`, `defenseLevel`, `storageCapacity`, `yieldMultiplier` | `shared/schema.ts:1186–1206` |
| Status | **LIVE** — fully wired | |

### 2. Sub-Parcel Creation & Ownership

| Layer | Path | Lines |
|---|---|---|
| UI | `client/src/components/game/land/SubParcelGrid.tsx` | 1–239 |
| State | `useQuery` for `/api/plots/:plotId/sub-parcels` | L28–32 |
| Mutation | `POST /api/plots/:plotId/subdivide` | L43–50 |
| Mutation | `POST /api/sub-parcels/:subParcelId/purchase` | L34–41 |
| Route | `POST /api/plots/:plotId/subdivide` | `routes.ts:2365` |
| Route | `POST /api/sub-parcels/:subParcelId/purchase` | `routes.ts:2470` |
| Validation | Implicit (playerId, plotId, subParcelId) | — |
| Service | `storage/db.ts` — `subdivideParcel`, `purchaseSubParcel` | — |
| Rules | `canSubdivideParcel()`: ownership, hold time, no active battle | `game-rules.ts:346–365` |
| DB | `subParcels` table: `parentPlotId`, `subIndex` (0–8), `ownerId`, `purchasePriceAscend`, `archetype`, `archetypeLevel`, `energyAlignment`, `improvements` | `db-schema.ts:460–485` |
| Status | **LIVE** — fully wired | |

### 3. Sub-Parcel Upgrades

| Layer | Path | Lines |
|---|---|---|
| UI | `client/src/components/game/land/SubParcelUpgradePanel.tsx` | 1–309 |
| State | `buildMutation`, `archetypeMutation`, `createListingMutation`, `cancelListingMutation` | L24–63 |
| Query | `GET /api/sub-parcels/listings` | L33–37 |
| Mutation | `POST /api/sub-parcels/:id/build` | L24–31 |
| Route | `POST /api/sub-parcels/:subParcelId/build` | `routes.ts:2503` |
| Validation | `SUB_PARCEL_FACILITY_COSTS`, `SUB_PARCEL_DEFENSE_COSTS`, `isImprovementAllowedForArchetype()` | `shared/schema.ts:868–884` |
| Service | `storage/db.ts` — `buildSubParcelImprovement` | — |
| DB | `subParcels.improvements` (jsonb), `players.ascend`/`iron`/`fuel` | — |
| Status | **LIVE** — fully wired | |

### 4. Archetype Selection

| Layer | Path | Lines |
|---|---|---|
| UI | `SubParcelUpgradePanel.tsx` archetype buttons | L102–175 |
| State | `pendingArchetype`, `pendingLevel`, `pendingAlignment` | L20–22 |
| Mutation | `POST /api/sub-parcels/:id/archetype` | L56–63 |
| Route | `POST /api/sub-parcels/:subParcelId/archetype` | `routes.ts:2543` |
| Validation | `arch archetype ∈ {"resource","trade","fortress","energy"}`, `MAX_SAME_ARCHETYPE_PER_GRID=3`, fortress level 1–3, energy alignment required | `game-rules.ts:340–364` |
| Service | `storage/db.ts` — `assignSubParcelArchetype` | — |
| DB | `subParcels.archetype`, `archetypeLevel`, `energyAlignment` | — |
| Status | **LIVE** — fully persisted | |

### 5. Energy (ASCEND) Generation, Storage, Consumption, Regeneration

| Layer | Path | Lines |
|---|---|---|
| Calc | `calculateAscendPerDay()`: base rate + facility bonuses | `shared/schema.ts:1186–1206` |
| UI | `InventoryPanel.tsx` L50–53, `LandSheet.tsx` L149, `TopBar.tsx` L117–129 | — |
| Claim route | `POST /api/actions/claim-frontier` | `routes.ts:2293–2349` |
| Validation | Wallet opt-in check, idempotency guard, `INFLUENCE_YIELD_THRESHOLD` | `db.ts:1142–1192` |
| Consumption | Commander mint, facility build, special attacks, drone/satellite deploy, sub-parcel purchase | `db.ts:552,691,941,988` |
| Regeneration | **Lazy (on-demand)**, not cron-based — computed at claim time | `db.ts:1154–1167` |
| Negative check | Server validates `player.ascend >= cost` before every spend | multiple locations |
| DB | `players.ascend` (balance), `parcels.ascendAccumulated`/`ascendPerDay`/`lastAscendClaimTs` | — |
| Status | **LIVE** — fully wired | |

### 6. Attack-Method Selection

| Layer | Exists? | Details |
|---|---|---|
| UI | **NO** | CommanderPanel Battlefront has Troops/Iron/Fuel/Crystal sliders, but no "attack method" selector |
| Schema | **NO** | `attackActionSchema` (schema.ts:517–530) has no `attackMethod` or `archetype` field |
| Route | **NO** | `POST /api/actions/attack` handler has no attack-method discriminator |
| Battle record | **NO** | `battles` table has no `attackMethod` column |
| Engine | **NO** | `resolveBattle()` never reads any attack method |
| Status | **PLACEHOLDER** — the concept does not exist in the current codebase | |

### 7. Attack Launch

| Layer | Path | Lines |
|---|---|---|
| UI | `CommanderPanel.tsx` Battlefront section | L590–808 |
| State | `targetParcelId`, `targetPlotId`, `troops`, `extraIron`, `extraFuel`, `extraCrystal`, `attackMode`, `sourceParcelId` | L85–103 |
| Handler | `handleLaunchPlotAttack()` → `onAttack(troops, totalIron, totalFuel, extraCrystal, activeCommander?.id, sourceParcelId)` | L232–235 |
| Parent | `GameLayout.tsx` `handleAttackConfirm()` → `attackMutation.mutate()` | — |
| Mutation | `useAttack()` in `useGameState.ts` | — |
| Route | `POST /api/actions/attack` | `routes.ts:1950–2007` |
| Validation | `attackActionSchema`: `attackerId`, `targetParcelId`, `troopsCommitted`, `resourcesBurned{iron,fuel}`, `crystalBurned?`, `commanderId?`, `sourceParcelId?`, `idempotencyKey?` | `schema.ts:517–530` |
| Service | `storage.deployAttack()` — creates battle, deducts resources, claims target parcel | `db.ts:1414–1581` |
| DB | `battles` table: `status="pending"`, `resolveTs = now + BATTLE_DURATION_MS (10 min)` | — |
| Status | **LIVE** — fully wired | |

### 8. Defense Calculation

| Layer | Path | Lines |
|---|---|---|
| Engine | `resolveBattle()`: `defenderPower = (defenseLevel * 15 + improvementBonus) * biomeMod` | `resolve.ts:55–61` |
| Constants | `BASE_DEFENSE_POWER=15`, `IMPROVEMENT_DEFENSE_PER_LEVEL=5`, `BIOME_DEFENSE_MOD` (mountain=1.4, water=0.5) | `tuning.ts:20–41` |
| Orbital | `ORBITAL_HAZARD_DEFENSE_PENALTY=0.2` (20% reduction) | `tuning.ts:59` |
| Status | **LIVE** — fully functional, deterministic | |

### 9. Battle Resolution

| Layer | Path | Lines |
|---|---|---|
| Engine | `resolveBattle(input: BattleInput): BattleResult` | `resolve.ts:27–97` |
| Engine | `resolveBattleFromPowers(attacker, defender, seed): BattleResult` | `resolve.ts:114–156` |
| Power | `attackerPower = troops*10 + iron*0.5 + fuel*0.8 + crystal*1.2 + commanderBonus` | `resolve.ts:31–35` |
| Morale | `×0.85` if morale debuff active | `resolve.ts:43–44` |
| Random | `randFactor ∈ [-10, +10]` via `mulberry32(seed)` | `resolve.ts:114–156` |
| Scheduler | `resolveBattles()` runs every 5s, resolves pending battles where `resolveTs < now` | `db.ts:1871–2100` |
| Persistence | `battles` row updated: `status→"resolved"`, `outcome`, `randFactor` | — |
| Ownership | Winner claims parcel: `defenseLevel→floor(half)`, influence damage applied | `db.ts:2018–2050` |
| Status | **LIVE** — fully functional, deterministic, provably fair | |

### 10. Rewards, Damage, Cooldowns, Persistence

| Feature | Implementation | Status |
|---|---|---|
| Pillage | `floor(storedResources * 0.3)` on attacker win | **LIVE** |
| Influence damage | `max(3, 15 * (1 - defenseLevels * 0.04))` | **LIVE** |
| Morale debuff | `MORALE_DEBUFF_BASE_MS (5 min) * (1 + losses * 0.5)` | **LIVE** |
| Attack cooldown | `ATTACK_COOLDOWN_PER_LOSS_MS (2 min)` per consecutive loss | **LIVE** |
| Commander lock | `COMMANDER_LOCK_MS (12 h)` after deployment | **LIVE** |
| Cascade defense | Adjacent parcels lose 1 defense level on capture | **LIVE** |
| Cascade defense penalty | `CASCADE_DEFENSE_PENALTY=1` | **LIVE** |
| Battle replay | `battle_replays` table stores full resolution log | **LIVE** |
| Game events | `game_events` table records every action | **LIVE** |

---

## WORKING END TO END

These flows are fully wired, authenticated, persisted, and have server-side validation:

1. **Land purchase** — `LandSheet → POST /api/actions/purchase → parcels.ownerId → NFT mint`
2. **Land mine** — `LandSheet → POST /api/actions/mine → ironStored/fuelStored/crystalStored`
3. **Land upgrade** — `LandSheet → POST /api/actions/upgrade → parcels.defenseLevel`
4. **Land build** — `LandSheet → POST /api/actions/build → parcels.improvements`
5. **Sub-parcel subdivide** — `SubParcelGrid → POST /api/plots/:id/subdivide → 9 subParcels rows`
6. **Sub-parcel purchase** — `SubParcelGrid → POST /api/sub-parcels/:id/purchase → subParcels.ownerId`
7. **Sub-parcel build** — `SubParcelUpgradePanel → POST /api/sub-parcels/:id/build → subParcels.improvements`
8. **Sub-parcel archetype assign** — `SubParcelUpgradePanel → POST /api/sub-parcels/:id/archetype → subParcels.archetype`
9. **Plot attack** — `CommanderPanel Battlefront → POST /api/actions/attack → battles + resource deduction`
10. **Battle resolution** — `resolveBattles() every 5s → resolveBattleFromPowers() → ownership transfer + pillage`
11. **ASCEND claim** — `TopBar → POST /api/actions/claim-frontier → players.ascend`
12. **Special attack** — `LandSheet → POST /api/actions/special-attack → instant parcel damage`
13. **Commander mint** — `CommanderPanel → POST /api/actions/mint-avatar → players.commanders`
14. **Drone/Satellite deploy** — `CommanderPanel → POST /api/actions/deploy-drone/satellite`
15. **Sub-parcel attack** — `CommanderPanel → POST /api/sub-parcels/:id/attack → immediate resolution`

---

## PARTIALLY WIRED

### 1. Sub-Parcel Archetype Effects on Gameplay

- **Archetype assignment** is LIVE — persisted to `subParcels.archetype`
- **Faction bonuses** are displayed in UI (`ARCHETYPE_FACTION_BONUSES`) but **not consumed by the battle engine**
- `computeArchetypeFactionBonus()` exists in `game-rules.ts:309–315` but is **never called** from the attack handler or battle resolver
- `computeGridPowerDependency()` exists in `game-rules.ts:324–335` but **never called** from the battle resolver
- Archetype building restrictions (`isImprovementAllowedForArchetype()`) ARE enforced server-side for sub-parcel builds

### 2. Energy Alignment (helios/aegis/nexus)

- **Stored** in `subParcels.energyAlignment` — wired
- **Displayed** in `SubParcelUpgradePanel.tsx` — wired
- **No gameplay effect** — the alignment labels are purely cosmetic. The documented effects ("grid efficiency", "shield uptime", "distribution range") are comments only, with zero code consuming them

### 3. Weapon Archetypes (Siege Baron, etc.)

- **Displayed** in `ArmoryPanel.tsx` — the player can build attributes and derive an archetype
- **Weapon system** is fully wired for firing/intercepting
- **Not connected to plot attacks** — the `POST /api/actions/attack` route never reads the player's weapon profile, loadout, or archetype
- The weapon system and the battle engine are **two separate, disconnected systems**

---

## BROKEN

### 1. "Attack Method" Concept Does Not Exist

Tester report: "selecting an attack method does not appear to connect to the attack action."

**Root cause:** There is no attack-method selection anywhere in the codebase. The CommanderPanel Battlefront has:
- Attack mode toggle: "Plot Attack" vs "Sub-Parcel" (these work)
- Troops slider (works)
- Extra Iron/Fuel/Crystal sliders (works)
- "Launch Plot Attack" button (works)

There is **no** UI element for selecting an attack method (siege, raid, bombard, etc.), no such field in the request schema, no such column in the database, and no such parameter in the battle engine. The concept simply does not exist in the current codebase.

**Classification: PLACEHOLDER (not broken — never built)**

### 2. WarRoomPanel "Targets" Tab Attack Button

The `WarRoomPanel.tsx` Targets tab (L360–444) has an "Attack" button per target parcel. This button calls `onAttackTarget(parcel.id)`, which in `GameLayout.tsx` is wired to `handleRequestAttack()`. This function:
- Opens the Commander Battlefront (`attackIntent` signal)
- Sets `selectedParcelId` 

It does **NOT** directly launch an attack. It navigates the player to the Commander panel Battlefront, where they must then manually enter the parcel ID, set troops, and press "Launch Plot Attack". The target parcel ID from the WarRoom is NOT pre-populated into the Battlefront's target input field.

**Classification: PARTIAL — UX is confusing; player must re-enter the target parcel ID manually**

---

## PLACEHOLDERS / DEAD UI

### 1. Energy Alignment Effects (helios/aegis/nexus)

- **UI:** `SubParcelUpgradePanel.tsx` L143–157 — selectable, shows labels
- **Server:** `POST /api/sub-parcels/:id/archetype` — accepts and persists `energyAlignment`
- **Engine:** **Zero consumption** — no code reads `energyAlignment` for any game calculation
- **Classification: PLACEHOLDER** — cosmetic label only

### 2. Sub-Parcel Archetype Faction Bonuses

- **UI:** `SubParcelUpgradePanel.tsx` L120–122 — shows "+X% faction"
- **Server:** `computeArchetypeFactionBonus()` exists in `game-rules.ts:309`
- **Engine:** **Never called** from the battle resolver
- **Classification: PLACEHOLDER** — displayed but not used

### 3. Grid Power Dependency

- **Server:** `computeGridPowerDependency()` exists in `game-rules.ts:324`
- **Engine:** **Never called** — fortress offline penalties and resource power requirements are not enforced
- **Classification: PLACEHOLDER** — logic exists but is unused

### 4. Weapon Archetype in Battle

- **UI:** `ArmoryPanel.tsx` — full weapon archetype system (Siege Baron, Artillery Marshal, etc.)
- **Server:** `POST /api/weapons/fire` — viable for missile engagements
- **Battle engine:** **Never reads** the player's weapon profile or archetype during plot attacks
- **Classification: DISCONNECTED SYSTEM** — two separate combat systems that don't interact

---

## WAR ATTACK-FLOW FINDINGS

### Current Attack Flow (as implemented)

1. Player opens Commander panel → Battlefront section
2. Selects "Plot Attack" or "Sub-Parcel" mode
3. Enters target parcel ID manually (or uses "Use Selected" button)
4. Adjusts Troops slider (1–10)
5. Optionally expands Advanced for Extra Iron/Fuel/Crystal
6. Views computed power and win chance
7. Presses "Launch Plot Attack" or "Launch Sub-Parcel Strike"
8. Request is sent: `POST /api/actions/attack` or `POST /api/sub-parcels/:id/attack`
9. Server validates ownership, cooldowns, resources, commander
10. Battle is created (plot) or resolved immediately (sub-parcel)
11. UI invalidates queries and shows BattleResultCard

### What the Tester Likely Experienced

- **"War panel not properly usable on mobile":** The HUD drawer on mobile uses `max-height: 72vh` with a dock handle at the bottom. The `WarRoomPanel` has a `max-h-[400px]` ScrollArea. Combined with the drawer's constraint, less than ~400px is available for the targets/results list. On a 667×375 mobile viewport in landscape, the effective visible area is approximately 300px tall, making the panel cramped.
- **"Selecting an attack method does not appear to connect":** There is no attack method selector. The tester may have been looking for one (or confused by the "Attack" button in WarRoomPanel which only opens the Commander panel) and found no way to select a method.
- **"Attack button not enabling":** The "Launch Plot Attack" button is disabled when `!canAfford || !hasCommander || allCommandersLocked || !!isOnCooldown || isAttacking || !targetParcelId`. A new player with no commander will see the button permanently disabled with no explanation visible in the WarRoom panel (the explanation is in the Commander panel).

### Attack Button Disabled States

| Condition | Check | Error Visible |
|---|---|---|
| No commander | `!hasCommander` | Only in Commander panel warnings |
| No resources | `!canAfford` | Yellow warning box in Battlefront |
| All commanders locked | `allCommandersLocked` | Yellow warning box |
| Attack cooldown | `isOnCooldown` | Yellow warning box |
| Attack in progress | `isAttacking` | Button text changes to "Deploying…" |
| No target | `!targetParcelId` | No warning — button just grayed out |

### WarRoomPanel "Attack" Button → Commander Flow

```
WarRoomPanel Targets tab → "Attack" button
  → GameLayout.handleRequestAttack()
    → attackIntent++ (opens Commander Battlefront)
    → setSelectedParcelId(targetId)
  → CommanderPanel receives selectedParcel as prop
    → useEffect sets targetParcelId and targetPlotId
  → Player must still manually press "Launch Plot Attack"
```

The target **is** pre-populated into the Commander Battlefront's target input field (via `useEffect` L106–111). But the player must still navigate to the Commander tab, find the Battlefront, and press the launch button. This is a two-step flow that may confuse players expecting a one-click attack.

---

## SUB-PARCEL FINDINGS

### Control Classification

| Control | Status | Evidence |
|---|---|---|
| Subdivide plot | **LIVE** | `POST /api/plots/:id/subdivide` → 9 subParcel rows |
| Buy sub-parcel | **LIVE** | `POST /api/sub-parcels/:id/purchase` → `subParcels.ownerId` |
| Select sub-parcel | **LIVE** | `selectedSubIndex` state → opens `SubParcelUpgradePanel` |
| Build facility (sub-parcel) | **LIVE** | `POST /api/sub-parcels/:id/build` → `subParcels.improvements` |
| Build defense (sub-parcel) | **LIVE** | Same endpoint, different cost table |
| Assign archetype | **LIVE** | `POST /api/sub-parcels/:id/archetype` → persisted |
| Archetype persists after reload | **LIVE** | Read from `subParcels.archetype` on query |
| Fortress tier selection | **LIVE** | `archetypeLevel` 1–3 persisted |
| Energy alignment selection | **LIVE** | `energyAlignment` persisted |
| List for trade | **LIVE** | `POST /api/sub-parcels/listings` → `subParcelListings` |
| Cancel listing | **LIVE** | `DELETE /api/sub-parcels/listings/:id` |
| Upgrade costs charged | **LIVE** | `SUB_PARCEL_FACILITY_COSTS` / `SUB_PARCEL_DEFENSE_COSTS` |
| Upgrade max levels | **LIVE** | `FACILITY_INFO[type].maxLevel` / `DEFENSE_IMPROVEMENT_INFO[type].maxLevel` |
| Owner authorization | **LIVE** | `subParcel.ownerId === playerId` check on build/archetype |
| Upgrade effects displayed | **LIVE** | Shows `LvN → LvN+1`, cost, biome multiplier |
| Upgrade effects in battles | **PARTIAL** | Sub-parcel improvements are stored but NOT read by the plot attack engine. Only sub-parcel attacks use the stored values. |
| Archetype effects in battles | **PLACEHOLDER** | `archetype` is stored but never read by battle engine |
| Archetype faction bonuses | **PLACEHOLDER** | Displayed in UI, `computeArchetypeFactionBonus()` exists but never called from battle resolver |
| Energy alignment effects | **PLACEHOLDER** | Stored, displayed, zero game effect |

---

## ARCHETYPE FINDINGS

### Sub-Parcel Archetypes (4 types)

| Archetype | Description | Building Allowed | Faction Bonus | Battle Effect |
|---|---|---|---|---|
| `resource` | "Boosts extraction yield" | electricity, blockchain_node, data_centre | SPECTRE +15% | **NONE** |
| `trade` | "Increases market throughput" | comm_terminal, data_centre | SPECTRE +20% | **NONE** |
| `fortress` | "Tiered combat fortification" | turret, shield_gen, storage_depot, radar, fortress | KRONOS +25% | **NONE** (improvements do affect sub-parcel attack defense) |
| `energy` | "Generates power for adjacent parcels" | electricity, blockchain_node, data_centre | NEXUS-7 +20% | **NONE** |

### Weapon Archetypes (6 types)

| Archetype | Primary Stat | Secondary Stat | Connected to Plot Attack? |
|---|---|---|---|
| Siege Baron | Firepower | Logistics | **NO** |
| Artillery Marshal | Range | Firepower | **NO** |
| Hypersonic Striker | Range | Guidance | **NO** |
| Ghost Marksman | Interception | Range | **NO** |
| Aegis Interceptor | Interception | Logistics | **NO** |
| Swarm Commodore | Logistics | Firepower | **NO** |

### What Archetype Selection Does NOT Currently Change

- Attack methods available: **NO** — no attack method concept exists
- Attack power: **NO** (for plot attacks) — only commander `attackBonus` is used
- Defense: **NO** (for plot attacks) — only `defenseLevel * 15 + improvementBonus`
- Battle range: **NO** — not a concept in current battle engine
- Cooldown: **NO** — cooldowns are fixed constants
- Energy cost: **NO** — attack costs are iron/fuel/crystal, not ASCEND
- Resource cost: **NO** — attack costs are independent of archetype
- Battle outcome: **NO** — archetype never read by resolver
- AI targeting: **NO** — AI uses faction presets, not archetypes
- Rewards: **NO** — pillage formula is fixed

### Archetype Values Displayed But Never Read by Battle Engine

1. `subParcels.archetype` — stored, displayed, never read by `resolveBattle()`
2. `subParcels.archetypeLevel` — stored, displayed, never read by `resolveBattle()`
3. `subParcels.energyAlignment` — stored, displayed, never read by any game logic
4. `ARCHETYPE_FACTION_BONUSES` — defined, displayed in UI, `computeArchetypeFactionBonus()` never called
5. Weapon archetype (Siege Baron, etc.) — fully defined, never read by `resolveBattle()`
6. Player weapon profile / loadout — stored, never read by attack handler

---

## ENERGY FINDINGS

### ASCEND Lifecycle

```
Generation: calculateAscendPerDay(improvements) per parcel
  → base rate (1/day prod, 50/day test) + facility bonuses
  → accumulated lazily: (now - lastClaimTs) * rate / msPerDay
  → only if influence >= INFLUENCE_YIELD_THRESHOLD (20)

Storage:   parcels.ascendAccumulated (per-parcel pending)
           players.ascend (wallet balance, after claim)

Claim:     POST /api/actions/claim-frontier
           → requires wallet opt-in
           → transfers accumulated → player balance
           → idempotency guard prevents double-claim

Consumption:
  Commander mint:   10–50 ASCEND (test) / 50–400 (prod)
  Facility build:   5–30 ASCEND (test) / 30–180 (prod)
  Special attack:   2–8 ASCEND (test) / 10–40 (prod)
  Drone deploy:     2 ASCEND (test) / 20 (prod)
  Satellite deploy: 5 ASCEND (test) / 50 (prod)
  Sub-parcel buy:   10–100 ASCEND (per biome)
  Trade listing:    free
  Archetype assign: free

Regeneration: Lazy — computed at claim time, not via scheduler
```

### Energy Validation

- All ASCEND-spending actions check `player.ascend >= cost` before deducting
- Server validates — client display is informational only
- ASCEND cannot go negative (server rejects before deduction)
- Battle resolution does NOT deduct ASCEND (battles cost iron/fuel/crystal, not ASCEND)
- Upgrades do NOT alter energy use (ASCEND costs are fixed per schema constant)

### Energy Archetype Sub-Parcels

- **Do energy archetypes generate ASCEND?** No. The archetype itself generates nothing. It gates which facilities can be built (`electricity`, `blockchain_node`, `data_centre`), and those facilities DO generate ASCEND.
- **Does energy alignment matter?** No. `helios`/`aegis`/`nexus` are stored and displayed but have zero game effect.
- **Does `computeGridPowerDependency()` run?** No. It exists in `game-rules.ts:324` but is never called.

---

## BATTLE-ENGINE FINDINGS

### Deterministic Resolution Formula

```
attackerPower = troopsCommitted × 10 + iron × 0.5 + fuel × 0.8 + crystal × 1.2 + commanderBonus
  × (0.85 if morale debuff)

defenderPower = (defenseLevel × 15 + Σ(improvement.level × 5)) × biomeMod
  × (0.8 if orbital hazard)

adjustedAttacker = attackerPower + randFactor   (randFactor ∈ [-10, +10])
winner = adjustedAttacker > defenderPower ? "attacker" : "defender"
```

### Values NOT Consumed by the Engine

| Value | Stored In | Engine Reads? |
|---|---|---|
| `subParcels.archetype` | `subParcels` table | **NO** |
| `subParcels.archetypeLevel` | `subParcels` table | **NO** |
| `subParcels.energyAlignment` | `subParcels` table | **NO** |
| Weapon archetype | `players.weaponProfile` | **NO** |
| Weapon loadout | `players.weaponProfile` | **NO** |
| Player faction | `players.playerFactionId` | **NO** (for battle resolution) |
| `ARCHETYPE_FACTION_BONUSES` | `shared/schema.ts` | **NO** |
| `computeGridPowerDependency()` | `game-rules.ts` | **NO** (never called) |
| Sub-parcel improvements | `subParcels.improvements` | **Only for sub-parcel attacks** (not plot attacks) |

### Values Used by the Engine

| Value | Source | Use |
|---|---|---|
| `troopsCommitted` | Request body | Attacker power |
| `resourcesBurned.iron` | Request body | Attacker power |
| `resourcesBurned.fuel` | Request body | Attacker power |
| `crystalBurned` | Request body | Attacker power |
| `commander.attackBonus` | Player record | Attacker power |
| `defenseLevel` | Parcel record | Defender power |
| `parcel.improvements` (turret/shield_gen/fortress) | Parcel record | Defender power |
| `biome` | Parcel record | Biome defense modifier |
| `moraleDebuffUntil` | Player record | Attacker penalty |
| `orbitalHazardActive` | Orbital event | Defender penalty |

---

## DESKTOP PANEL FINDINGS

### Right-Rail Panel Container

```css
/* GameLayout.tsx L1443–1445 */
aside.hidden.md:flex.flex-col.w-60.lg:w-72.absolute.top-16.right-0.bottom-0.z-30
  backdrop-blur-md.bg-background/70.border-l.border-border.overflow-hidden
```

- Fixed width: 240px (md) / 288px (lg)
- `overflow-hidden` on the aside — **blocks scrolling** for panels that don't set their own overflow
- Height: `top-16 bottom-0` → from 64px to viewport bottom

### Panel Wrapping Issues

| Panel | Wrapper | Issue |
|---|---|---|
| TradeStation | `flex-1 ... overflow-hidden` | **Scroll trap** — `overflow-hidden` blocks child scrolling |
| FactionPanel | `flex-1 ... overflow-hidden` | **Scroll trap** — same issue |
| WarRoomPanel | `flex-1 overflow-auto` + internal `max-h-[400px]` | OK, but double-scroll risk |
| ArmoryPanel | `flex-1 overflow-y-auto` div wrapper | OK |
| UniversityPanel | `flex-1 overflow-y-auto` div wrapper | OK |
| CommanderPanel | `flex-1 overflow-auto` | OK |
| All others | Varies | Generally OK |

### Specific Clipping Risks

1. **TradeStationPanel** (L1503–1506): `className="flex-1 border-0 rounded-none overflow-hidden"` — the `overflow-hidden` prevents the internal tab content from scrolling. Content is clipped.
2. **FactionPanel** (L1509–1511): Same pattern — `overflow-hidden` on wrapper blocks ScrollArea.
3. **WarRoomPanel** (L309): `ScrollArea className="h-full max-h-[400px]"` — at 1280×720, the right rail has ~656px of height. The 400px max-height is reasonable but means the Targets tab ScrollArea is shorter than the available space.

### Unreachable Buttons

- **CommanderPanel "Mint" button** (L363): `minWidth: 76` inline — may clip at 240px panel width if content is wide
- **CommanderPanel "Launch Plot Attack" button** (L779): Always at the bottom of the Battlefront section, inside a ScrollArea. ScrollArea is `flex-1` so it should be reachable by scrolling.

---

## MOBILE PANEL FINDINGS

### Mobile Layout Architecture

- **Desktop:** Two side rails (left: CommandCenter, right: tabbed panels)
- **Mobile:** Fullscreen panel overlay (`md:hidden absolute inset-0 z-30 pt-16 pb-16`) + BottomNav HUD dock
- **HUD Drawer:** `max-height: 46vh` (desktop) / `72vh` (mobile, `@media max-width: 760px`)

### Viewport-Specific Issues

| Viewport | Issue |
|---|---|
| 667×375 (iPhone SE landscape) | Available height: 375px. TopBar: 64px. BottomNav: 64px. Remaining: 247px. Drawer max-height: 270px (72vh of 375 = 270px). **Panels are pinned between drawer and dock.** |
| 844×390 (iPhone 12/13 landscape) | Available height: 390px. Remaining after chrome: 262px. Drawer: 281px. Better but still tight. |
| 932×430 (iPhone 14 Pro Max landscape) | Available height: 430px. Remaining: 302px. Drawer: 310px. Marginally usable. |

### Specific Mobile Issues

1. **CommanderPanel Battlefront** on mobile: The fullscreen panel height is `inset-0 pt-16 pb-16`. At 667×375 landscape, that's 247px for the entire CommanderPanel which has a dense stats header (~160px), then ScrollArea for the rest. The Battlefront section with all its controls (target input, troops slider, advanced sliders, power display, warnings, launch button) needs approximately 400px to be fully visible without scrolling. **On mobile landscape, the launch button is always below the fold.**

2. **WarRoomPanel** on mobile: The fullscreen panel at 667×375 has 247px. The WarRoomPanel has a header (52px) + tabs (36px) + ScrollArea. The Targets tab has a filter Select (29px) + ScrollArea. The attack buttons per target are small (h-6) and should be reachable, but the scrollable area is at most 166px tall.

3. **No landscape-specific handling** — The codebase uses `md:` breakpoint (768px) for most responsive changes but has no explicit landscape orientation handling.

4. **Touch targets** — All buttons use `h-6` or `h-7` (24–28px) which is below the recommended 44px touch target. The `px-2` padding on attack buttons (L430) makes them very narrow.

---

## DATABASE / AUTHORIZATION RISKS

### Authorization

- **Plot attacks:** `assertPlayerOwnership()` server-side — attackerId must match session playerId
- **Sub-parcel attacks:** `subParcel.ownerId !== playerId` — cannot attack own sub-parcels
- **Sub-parcel build:** `subParcel.ownerId === playerId` — must own the sub-parcel
- **Sub-parcel archetype:** `canAssignArchetype()` — ownership + grid limits
- **Parcel build/upgrade:** Global mutation middleware checks `playerId` matches session
- **Verdict:** **STRONG** — all mutations are ownership-gated server-side

### Idempotency

- **Plot attacks:** Optional `idempotencyKey` — 409 on in-flight, 200 replay with stored result
- **Sub-parcel attacks:** **NO idempotency guard** — rapid clicks could create duplicate attacks
- **Sub-parcel builds:** **NO separate idempotency guard** (relies on `buildMutation.isPending` client-side)
- **Sub-parcel archetype:** **NO idempotency guard** — rapid clicks could create duplicate mutations
- **Parcel upgrades/builds:** `withIdempotency()` guard present
- **Verdict:** **MIXED** — plot attacks are protected; sub-parcel operations lack server-side idempotency

### Duplicate Protection

- **Rapid-click sub-parcel attack:** `subParcelAttackMutation.isPending` client-side only. Server-side, two concurrent `POST /api/sub-parcels/:id/attack` calls could both succeed if the sub-parcel state hasn't changed between them.
- **Rapid-click archetype assign:** `archetypeMutation.isPending` client-side only. Two concurrent calls could both succeed, with the second overwriting the first.
- **Rapid-click sub-parcel build:** Same pattern — client-side guard only.

### Energy Can Go Negative?

- **No.** All ASCEND-spending server functions check `player.ascend >= cost` before deducting.
- If concurrent requests somehow both pass the check (race condition), the second deduction could make balance negative. But the `db.ts` storage methods use database-level atomicity (single-row updates with WHERE conditions), mitigating this.

### Upgrades Without Gameplay Effect

- **Can a player buy sub-parcel upgrades that don't affect gameplay?** Yes. Building a `turret` on a sub-parcel is persisted but only affects sub-parcel attack defense, not plot attack defense. The player may not realize this.
- **Can a player assign an archetype that has no effect?** Yes. All archetypes are persisted but have no battle-engine effect. Only building restrictions are enforced.

---

## MISSING TEST COVERAGE

### Panels With No Tests (12 of 16)

| Panel | Test File |
|---|---|
| WarRoomPanel | **NONE** |
| CommanderPanel | **NONE** |
| InventoryPanel | **NONE** |
| LandSheet | **NONE** |
| BattlesPanel | **NONE** |
| SubParcelGrid | **NONE** |
| SubParcelUpgradePanel | **NONE** |
| SubParcelGridPicker | **NONE** |
| WorldIntelPanel | **NONE** |
| LeaderboardPanel | **NONE** |
| ArmoryPanel | **NONE** |
| EconomicsPanel | **NONE** |

### Panels With Tests (4 of 16)

| Panel | Test File | Strength |
|---|---|---|
| CommandCenterPanel | `command-center-panel.spec.tsx` | SSR smoke only |
| UniversityPanel | `university-panel.spec.tsx` | SSR smoke only |
| AdminDashboard | `admin.spec.tsx` | SSR smoke only |
| HudShell | `hud-shell.spec.tsx` | SSR smoke only |

### Missing Test Categories

- **No attack mutation tests** — no test exercises the `POST /api/actions/attack` flow end-to-end
- **No sub-parcel mutation tests** — no test exercises build/archetype/purchase/subdivide
- **No battle-engine integration tests** — unit tests exist for `resolveBattle()` but no integration test with the full deploy→resolve→persist flow
- **No responsive/mobile tests** — no viewport-specific tests
- **No panel interaction tests** — all panel tests are SSR smoke (render to static markup, no jsdom)
- **No energy/ASCEND lifecycle tests** — only `economy-config.spec.ts` tests the daily rate projection

### Strong Existing Tests

- `server/engine/battle/resolve.spec.ts` — **STRONG**: Determinism, power calc, pillage, biome mods, morale
- `server/engine/battle/tuning.spec.ts` — Balance invariants
- `server/services/chain/land.spec.ts` — NFT mint/transfer
- `server/storage/game-rules.spec.ts` — Subdivision rules, archetype assignment
- `client/tests/terraform-storage-smoke.spec.ts` — Terraform with state changes
- `client/tests/gamertag-recovery.spec.ts` — Decision logic

---

## RECOMMENDED IMPLEMENTATION LANES

### Lane 1: War Attack-Method Wiring and Error Visibility

**Smallest safe order:**

1. Add an "attack method" concept to the shared schema (enum + Zod schema extension)
2. Add attack method selector to CommanderPanel Battlefront (simple dropdown: "Standard", "Siege", "Raid")
3. Wire the selected method to the `attackActionSchema` and `POST /api/actions/attack`
4. Store `attackMethod` on the `battles` table (new column, nullable, backward-compatible)
5. Add explicit "why disabled" tooltip text on the Launch button when disabled
6. Wire the WarRoomPanel "Attack" button to pre-populate the Commander Battlefront target field (already partial — verify it works end-to-end)
7. Add `useAttack` mutation test

### Lane 2: Shared Panel Responsiveness Foundation

**Root cause fix:**

1. Remove `overflow-hidden` from the right-rail aside and replace with `overflow-y-auto`
2. Fix TradeStationPanel and FactionPanel wrappers: change `overflow-hidden` to `overflow-auto`
3. Add `min-h-0` to flex children in panel containers to prevent flex overflow
4. Add `overscroll-contain` to panel ScrollAreas to prevent scroll chaining
5. Add `safe-area-inset-bottom` padding for mobile panels
6. Increase touch targets to minimum 44px (currently 24–28px)
7. Add landscape-specific max-height for mobile fullscreen panels

### Lane 3: Sub-Parcel Upgrade Persistence (Minor Fixes)

1. Add server-side idempotency guard to `POST /api/sub-parcels/:id/attack`
2. Add server-side idempotency guard to `POST /api/sub-parcels/:id/archetype`
3. Add server-side idempotency guard to `POST /api/sub-parcels/:id/build`
4. Add tests for sub-parcel mutation idempotency

### Lane 4: Archetype/Energy Server Enforcement

**Wire the existing but unused game rules:**

1. Call `computeArchetypeFactionBonus()` from the battle resolver and add faction bonus to defender power
2. Call `computeGridPowerDependency()` from the battle resolver and apply offline penalties
3. Add energy-alignment effects: `helios` → +10% ASCEND generation, `aegis` → +5% defense for adjacent fortress parcels, `nexus` → +1 range for power distribution
4. Add archetype-specific attack modifiers (e.g., fortress → +10% defense in sub-parcel battles)

### Lane 5: Battle-Engine Integration

1. Add weapon profile consumption to plot attack resolution (optional: read `player.weaponProfile` and apply damage bonus)
2. Wire sub-parcel improvements into plot defense calculation (currently only main-parcel improvements are read)
3. Add sub-parcel archetype effects to sub-parcel attack resolution

### Lane 6: Regression Tests and Owner QA

1. Add panel rendering tests for WarRoomPanel, CommanderPanel, InventoryPanel, LandSheet
2. Add attack mutation test (mock server, verify request payload)
3. Add sub-parcel mutation tests (build, archetype, purchase)
4. Add responsive snapshot tests at 3 mobile viewports
5. Add energy lifecycle test (accumulate → claim → spend → verify balance)
6. Run `/test-matrix` to refresh the coverage matrix
7. Owner QA: verify attack flow on mobile, verify archetype persistence, verify energy claim

---

## NEEDS YOU

1. **Attack method design:** What attack methods should exist? (Siege, Raid, Bombard, etc.) What should each method change? (Power multiplier, pillage rate, cooldown, resource cost, range?)
2. **Energy alignment design:** Should `helios`/`aegis`/`nexus` have gameplay effects? If so, what?
3. **Weapon archetype integration:** Should the weapon archetype system (Siege Baron, etc.) connect to plot attacks? Or should it remain a separate missile-interception system?
4. **Mobile panel UX:** Should the Commander Battlefront be simplified for mobile? (e.g., remove Advanced sliders, auto-set troops to max affordable)
5. **Sub-parcel attack idempotency:** Is the lack of server-side idempotency on sub-parcel attacks acceptable for TestNet, or should it be fixed before mainnet?
6. **Touch target sizes:** Minimum 44px touch targets vs. current 24–28px — is a UI redesign acceptable?