# FRONTIER Master Game Specification

**Status:** Canonical game-design truth for future agents  
**Last updated:** 2026-07-12  
**Governing commit:** `da35c7e` (PR #250 merged)

---

## 1. Document Authority and Status Rules

This document is the **single source of truth** for FRONTIER-AL game design. All other documentation (GAME_MANUAL.md, ECONOMICS.md, STRATEGY_GUIDE.md) must align with this spec.

### Status Labels

Every feature carries one explicit status:

- **LIVE** — Fully wired, authenticated, persisted, player-visible
- **PARTIAL** — Some functionality works, but incomplete or disconnected
- **CONTRACT_ONLY** — Pure deterministic contract exists; zero production integration
- **CATALOG_ONLY** — Data/constants defined; no gameplay consumption
- **DISCONNECTED** — System exists but not wired to combat/economy
- **UI_ONLY** — Displayed in UI but no backend effect
- **PLACEHOLDER** — Stored/displayed but unused
- **PLANNED** — Approved design; no implementation
- **DEPRECATED** — Superseded; scheduled for removal
- **UNKNOWN_REQUIRES_OWNER** — Needs owner decision

**Rule:** Do not mix future design into LIVE paragraphs without a status label.

---

## 2. Vision and Player Promise

**FRONTIER-AL** is a persistent, blockchain-backed strategy game on Algorand TestNet.

**Player promise:**
- One shared 21,000-plot world (Fibonacci sphere, 8 biomes)
- Real on-chain stakes (every plot = ARC-3 NFT, ASCEND = live ASA)
- Four autonomous AI factions that never stop playing
- Provably fair battles (public seed, deterministic resolution)
- Persistent territory, resources, and structures 24/7

---

## 3. Current Production Experience

### What Players Can Do Today (LIVE)

1. **Connect wallet** (Pera/LUTE) → receive 500 ASCEND welcome bonus
2. **Purchase plots** with ALGO (0.2–1.5 ALGO by biome) → mint plot NFT
3. **Mine resources** (Iron/Fuel/Crystal) every 5 minutes per plot
4. **Build improvements** (turrets, shields, storage, radar, fortress) with Iron/Fuel
5. **Build facilities** (Electricity, Blockchain Node, Data Centre, AI Lab) with ASCEND
6. **Subdivide plots** after 4-hour hold → 9 sub-parcels (3×3 grid)
7. **Assign sub-parcel archetypes** (resource/trade/fortress/energy) — legacy categories
8. **Mint Commander avatars** (Sentinel/Phantom/Reaper) with ASCEND
9. **Launch plot attacks** with troops + resources → 10-minute battle → provably fair resolution
10. **Launch sub-parcel attacks** → immediate resolution
11. **Claim ASCEND** passively (1+ ASCEND/day per plot)
12. **Deploy recon drones** (20 ASCEND) and **orbital satellites** (50 ASCEND)
13. **Execute special attacks** (Orbital Strike, EMP Blast, Siege Barrage, Sabotage)
14. **Trade resources** peer-to-peer
15. **Compete in seasons** (~90-day cycles with phases and rewards)

### What Exists But Is Not Connected

- **Weapon archetypes** (Siege Baron, etc.) — displayed in Armory, not consumed by `resolveBattle()`
- **Energy alignment** (helios/aegis/nexus) — stored on sub-parcels, zero gameplay effect
- **Sub-parcel archetype bonuses** — `computeArchetypeFactionBonus()` exists, never called from resolver
- **Grid power dependency** — `computeGridPowerDependency()` exists, never called

### What Is Contract-Only (No Production Integration)

- **Six facility archetypes** (assault_foundry, siege_battery, etc.) — `shared/subplotArchitecture.ts`
- **Energy grid simulation** (brownout/blackout) — `shared/energyGrid.ts`
- **CombatProfile + BattleSnapshot** — `shared/combatProfile.ts`

### What Does Not Exist

- **Attack doctrines** (assault/siege/raid/sabotage/precision_strike) — approved design, no code
- **Tactical 2D/2.5D view** — described in manual, no implementation
- **Facility integrity/damage/repair/capture** — planned, no code

---

## 4. Core Gameplay Loop

```
Purchase plot (ALGO) → Mine resources (Iron/Fuel/Crystal) → Build improvements/facilities
    ↓                                                              ↓
Subdivide after 4h → Assign archetypes → Build sub-parcel facilities
    ↓                                                              ↓
Mint Commander (ASCEND) → Launch attack (troops + resources) → Battle (10 min)
    ↓                                                              ↓
Win → Capture territory + pillage 30% resources                    Lose → Morale debuff + cooldown
    ↓
Claim ASCEND (passive) → Build landmarks → Compete in seasons
```

---

## 5. World Scale and the 21,000-Plot Globe

**Status:** LIVE

- **Plot count:** 21,000 (Fibonacci sphere, polar exclusion at |lat| > 75°)
- **Biomes:** 8 (forest, desert, mountain, plains, water, tundra, volcanic, swamp)
- **Biome assignment:** Latitude + plot-index noise (`game-rules.ts:biomeFromLatitude()`)
- **Plot richness:** 1–100 (fixed at world generation, affects mining yield)
- **Globe renderer:** Three.js + React Three Fiber (`PlanetGlobe.tsx`)

### Globe Render Path (LIVE)

```
PlanetGlobe.tsx → Scene()
  → GlobeTerrain (albedo texture, shader with EXPOSURE=2.0, FLOOR=0.50)
  → PlotOverlay (21k InstancedMesh, biome colors, ownership colors)
  → SubParcelOverlay (3×3 grids, LOD-gated at camera < GLOBE_RADIUS * 2.6)
  → Battle arcs, weapon layers, event overlays
```

### Globe Presentation Targets (PLANNED)

- **Far orbit:** Earth recognizable, terrain/biome visible, parcel borders hidden
- **Mid orbit:** Plot borders fade in, faction/ownership colors clearer
- **Tactical zoom:** Sub-parcel cells visible, ownership/threats/resources actionable
- **Selected plot:** Transition to dedicated tactical land experience (NOT IMPLEMENTED)

---

## 6. Main Plot / Territorial HQ

**Status:** LIVE

The main plot is the territorial headquarters and ownership unit.

**Responsibilities:**
- Territorial HQ level (defense level)
- Sub-plot slot unlocks (subdivision after 4-hour hold)
- Grid generation and storage (3×3 sub-parcel layout)
- Global resource storage (Iron/Fuel/Crystal aggregates)
- Baseline territory defense (`defenseLevel`)
- Reinforcement speed (troop replenishment)
- Radar/sensor coverage (from Recon facilities)
- Repair and recovery (passive influence regeneration)

**Persistence:** `parcels` table (`server/db-schema.ts`)

---

## 7. Sub-Parcels and Facility Slots

**Status:** LIVE

Each main plot can be subdivided into a **3×3 grid of 9 sub-parcels**.

**Rules:**
- 4-hour hold requirement before subdivision
- Human-exclusive (AI factions cannot subdivide)
- Center cell (index 4) given to subdivider for free
- Other 8 cells purchasable with ASCEND (10–100 by biome)

**Sub-parcel responsibilities:**
- Persistent facility archetype (legacy: resource/trade/fortress/energy)
- Level (per-facility upgrade level)
- Improvements (turret, shield_gen, storage_depot, radar, fortress, electricity, blockchain_node, data_centre, ai_lab, comm_terminal)
- Energy alignment (helios/aegis/nexus) — stored but unused

**Persistence:** `subParcels` table (`server/db-schema.ts`)

---

## 8. Legacy Sub-Parcel Categories

**Status:** LIVE (persisted, building restrictions enforced, but not consumed by battle resolver)

**Legacy values:** `resource`, `trade`, `fortress`, `energy`

These are the **build-category axis** — they gate which facilities can be built on a sub-parcel:

| Legacy Category | Allowed Facilities | Faction Bonus | Battle Effect |
|----------------|-------------------|---------------|---------------|
| resource | electricity, blockchain_node, data_centre | SPECTRE +15% | NONE |
| trade | comm_terminal, data_centre | SPECTRE +20% | NONE |
| fortress | turret, shield_gen, storage_depot, radar, fortress | KRONOS +25% | NONE (improvements affect sub-parcel attack defense) |
| energy | electricity, blockchain_node, data_centre | NEXUS-7 +20% | NONE |

**Important:** These are NOT the same as the six canonical facility archetypes (Section 9).

**Code:** `shared/schema.ts:SubParcelArchetype`, `server/storage/game-rules.ts:canAssignArchetype()`

---

## 9. Six Canonical Facility Archetypes

**Status:** CATALOG_ONLY (defined in `shared/subplotArchitecture.ts`, zero gameplay effect)

The six canonical facility archetypes define what a sub-parcel is **built to do**:

1. **assault_foundry** — Rapid generation and commitment of offensive ground strength
   - Strategic role: offense
   - Compatible weapons: hypersonic_striker, swarm_commodore
   - Preferred alignment: helios

2. **siege_battery** — Long-range, high-yield destruction of fortifications
   - Strategic role: offense
   - Compatible weapons: siege_baron, artillery_marshal
   - Preferred alignment: helios

3. **defense_bastion** — Anchor territorial defense and shield generation
   - Strategic role: defense
   - Compatible weapons: aegis_interceptor
   - Preferred alignment: aegis

4. **recon_array** — Intelligence, targeting, and sensor coverage
   - Strategic role: intel
   - Compatible weapons: ghost_marksman, hypersonic_striker
   - Preferred alignment: nexus

5. **extraction_complex** — Sustained resource production feeding the grid
   - Strategic role: production
   - Compatible weapons: (none)
   - Compatible alignment: nexus

6. **logistics_nexus** — Movement, storage, and reinforcement across the grid
   - Strategic role: logistics
   - Compatible weapons: swarm_commodore, aegis_interceptor
   - Preferred alignment: nexus

**Upgrade trees:** Each archetype has exactly 3 branches, each with 3 tiers (9 nodes total).

**Code:** `shared/subplotArchitecture.ts:FACILITY_ARCHETYPES`

**Important:** These are NOT yet persisted or consumed by the battle resolver. They are a contract-only foundation for future phases.

---

## 10. Facility Upgrade-Tree Model

**Status:** CATALOG_ONLY

Each facility archetype has **3 upgrade branches**, each with **3 tiers**:

**Example: assault_foundry**
- Branch 1: Mobilization (troop_production, reinforcement_capacity)
- Branch 2: Armor Fabrication (armor_quality, emp_resistance)
- Branch 3: Reinforcement Logistics (reinforcement_capacity, transfer_capacity)

**Effect keys (intent-only, not consumed):**
- troop_production, reinforcement_capacity, armor_quality, attack_range, fortification_penetration
- shield_capacity, emp_resistance, sensor_range, stealth_detection
- iron_output, fuel_output, crystal_output, energy_efficiency, repair_speed, transfer_capacity

**Code:** `shared/subplotArchitecture.ts:FacilityUpgradeBranch`

---

## 11. Weapon Archetypes

**Status:** DISCONNECTED (displayed in Armory, not consumed by plot attacks)

Six weapon archetypes derived from player attribute spread:

1. **siege_baron** — Firepower + Range → ballistic, rocket_artillery, artillery
2. **artillery_marshal** — Range + Logistics → rocket_artillery, artillery
3. **hypersonic_striker** — Firepower + Guidance → hypersonic, ballistic
4. **ghost_marksman** — Guidance + Range → cruise, ballistic
5. **aegis_interceptor** — Interception + Guidance → missile_defense, anti_air
6. **swarm_commodore** — Logistics + Firepower → loitering, rocket_artillery

**Current behavior:**
- Player builds attributes → archetype derived automatically
- Weapon system fully wired for firing/intercepting
- **NOT connected to plot attacks** — `resolveBattle()` never reads weapon profile

**Code:** `shared/weapons/archetypes.ts:ARCHETYPES`

---

## 12. Energy Alignments

**Status:** PLACEHOLDER (stored/displayed, zero gameplay effect)

Three energy alignments define how a facility **operates**:

1. **helios** — Offensive burst, high output, high energy use
2. **aegis** — Shields, repair, defense, EMP resistance
3. **nexus** — Efficiency, support range, transfers, recon, regeneration

**Current behavior:**
- Stored on `subParcels.energyAlignment`
- Displayed in `SubParcelUpgradePanel.tsx`
- **Zero code reads it for game logic**

**Code:** `shared/schema.ts:EnergyAlignment`

---

## 13. Attack Doctrines

**Status:** PLANNED (approved design, no implementation)

Five attack doctrines define the method selected for a **specific battle**:

1. **assault** — Balanced, fast, general-purpose pressure
2. **siege** — Slow, high-damage vs fortifications; high resource cost
3. **raid** — Fast hit-and-run, resource theft, low commitment
4. **sabotage** — Debuff/disable (EMP/sabotage timers), not destruction
5. **precision_strike** — Single high-value target, high accuracy/cost

**Current behavior:**
- No `attackMethod` field in `attackActionSchema`
- No UI selector
- No column in `battles` table
- No parameter in `resolveBattle()`

**Code:** Does not exist yet

---

## 14. Player Resources and Economy

**Status:** LIVE

### Standard Resources

| Resource | Base Yield per Mine | Use |
|----------|-------------------|-----|
| Iron | 20 | Upgrades, attacks, defense improvements |
| Fuel | 12 | Operations, improvements, attacks |
| Crystal | 4 | High-level upgrades, advanced crafting |

**Storage:** Base 800 units (Iron + Fuel + Crystal combined), expandable via Storage Depot (+200/level, max 3)

### FRONTIER Token (ASCEND)

**Status:** LIVE

- **Total supply:** 1,000,000,000 ASCEND (fixed, on-chain ASA `755818217`)
- **Generation:** Passive (1+ ASCEND/day per plot, enhanced by facilities)
- **Claim:** Lazy (on-demand), requires wallet opt-in, idempotent
- **Consumption:** Commander mint, facility build, special attacks, drones, satellites, landmarks, sub-parcel purchase

**Code:** `shared/schema.ts:calculateAscendPerDay()`, `server/routes.ts:/api/actions/claim-frontier`

### Plot Pricing (ALGO)

| Biome | Price (ALGO) |
|-------|-------------|
| Desert | 0.2 |
| Plains | 0.3 |
| Swamp | 0.3 |
| Tundra | 0.4 |
| Forest | 0.5 |
| Mountain | 0.8 |
| Volcanic | 1.0 |
| Water | 1.5 |

**Code:** `shared/schema.ts:LAND_PURCHASE_ALGO`

### Sub-Parcel Pricing (ASCEND)

Formula: `max(10, min(100, round(algoBase × 50)))`

| Biome | Sub-Parcel Price (ASCEND) |
|-------|--------------------------|
| Desert | 10 |
| Plains | 15 |
| Swamp | 15 |
| Tundra | 20 |
| Forest | 25 |
| Mountain | 40 |
| Volcanic | 50 |
| Water | 75 |

**Code:** `server/storage/game-rules.ts:computeSubParcelPrice()`

---

## 15. Wallet and Blockchain Boundary

**Status:** LIVE

**Supported wallets:**
- Pera Wallet (mobile + web) — WalletConnect protocol
- LUTE Wallet (browser extension) — Direct injection

**Network:** Algorand TestNet (chainId: 416002)

**On-chain operations:**
- Plot purchase → mint ARC-3 NFT
- ASCEND claim → ASA transfer (batched)
- Commander NFT delivery → idempotent ASA transfer

**Two-layer model:**
- **Database:** Instant, source-of-truth for player balances
- **On-chain:** Batched, may lag behind DB state

**Code:** `server/services/chain/`, `shared/schema.ts`

---

## 16. Commander System

**Status:** LIVE

Three commander tiers:

| Tier | Cost (ASCEND) | ATK Bonus | DEF Bonus | Special Ability | Max Concurrent Attacks |
|------|--------------|-----------|-----------|-----------------|----------------------|
| Sentinel | 50 | +10% | +10% | Fortify | 1 |
| Phantom | 150 | +18% | +6% | Cloak | 2 |
| Reaper | 400 | +30% | +5% | Annihilate | 3 |

**Deployment rules:**
- 12-hour lock after deploying in an attack
- One active commander at a time
- Required for all special attacks

**Code:** `shared/schema.ts:COMMANDER_INFO`, `server/routes.ts:/api/actions/mint-avatar`

---

## 17. Human Combat Lifecycle

**Status:** LIVE

### Attack Flow

1. Player opens Commander panel → Battlefront section
2. Selects "Plot Attack" or "Sub-Parcel" mode
3. Enters target parcel ID (or uses "Use Selected")
4. Adjusts Troops slider (1–10)
5. Optionally expands Advanced for Extra Iron/Fuel/Crystal
6. Views computed power and win chance
7. Presses "Launch Plot Attack"
8. Request sent: `POST /api/actions/attack`
9. Server validates ownership, cooldowns, resources, commander
10. Battle created (plot) or resolved immediately (sub-parcel)
11. UI invalidates queries and shows BattleResultCard

### Battle Resolution Formula

**Attacker power:**
```
attackerPower = (troops × 10) + (iron × 0.5) + (fuel × 0.8) + commanderBonus
  × (0.85 if morale debuff)
```

**Defender power:**
```
defenderPower = (defenseLevel × 15 + improvementBonus) × biomeMod
  × (0.8 if orbital hazard)
```

**Resolution:**
```
adjustedAttacker = attackerPower × (1 + randFactor/100)
winner = adjustedAttacker > defenderPower ? "attacker" : "defender"
```

**randFactor:** Deterministic, ∈ [-10, +10], derived from `mulberry32(randomSeed)`

**Pillage:** On attacker win, steal 30% of stored resources (Iron/Fuel/Crystal)

**Code:** `server/engine/battle/resolve.ts:resolveBattle()`

### Attack Idempotency (PR #250)

**Status:** LIVE (as of `da35c7e`)

- **Key scope:** `attack:${verifiedPlayerId}:${nonce}` (auth-verified actor only)
- **Payload fingerprint:** Deterministic serialization of (actor, source, target, troops, iron, fuel, crystal, commander)
- **Behavior:**
  - Same key + same payload → replay original 200
  - Same key + different payload → 409 conflict
  - In-flight duplicate → 409 retry
  - Missing key → fail-open (legacy compat)

**Code:** `server/attackIdempotency.ts`, `server/idempotencyGuard.ts`, `migrations/0015_action_nonce_fingerprint.sql`

---

## 18. AI Faction Lifecycle

**Status:** LIVE

Four AI factions:

| Faction | Strategy | Aggression | Readiness Threshold | Min Defense Before Reconquest |
|---------|----------|-----------|--------------------|-----------------------------|
| NEXUS-7 | Expansionist | 1.3x | 0.6 | 2 |
| KRONOS | Defensive | 0.6x | 1.2 | 5 |
| VANGUARD | Raider | 1.4x | 0.5 | 1 |
| SPECTRE | Economic | 1.0x | 0.8 | 3 |

**AI behavior:**
- AI turns run every 2 minutes (configurable via `AI_TURN_INTERVAL_MS`)
- Each faction independently evaluates expansion, defense, and attack opportunities
- Adaptive Dominance Regulation (ADR): if any faction exceeds ~2,000 plots (~10%), others increase aggression

**Code:** `server/storage/ai-engine.ts`, `server/engine/ai/`

---

## 19. Energy Generation, Storage, Priority, and Brownouts

**Status:** CONTRACT_ONLY (simulator exists, zero production integration)

**Energy grid simulation:** `shared/energyGrid.ts`

**Inputs:**
- Producers (generation)
- Consumers (facilities with operating modes: standby/operational/active/burst)
- Storage (capacity, initial stored, reserve floor, charge/discharge rates)

**Allocation order:**
1. Priority (critical → high → normal → low)
2. Explicit allocation order (ascending)
3. Instance ID (ascending) as tiebreak

**Minimum sustainable rule:**
- If remaining pool < facility's `minimumSustainableDemand`, allocate zero
- Otherwise allocate `min(pool, requested)`

**Power states:**
- `fully_powered` — allocated >= requested
- `reduced` — allocated >= minimum but < requested
- `offline` — allocated < minimum

**Brownout:** At least one requesting facility is reduced or offline  
**Blackout:** At least one facility requested power AND no facility received minimum

**Current behavior:**
- `computeGridPowerDependency()` exists in `game-rules.ts:324` but is **never called**
- No brownout/blackout states in production
- No facility energy demand/production in production

**Code:** `shared/energyGrid.ts:simulateEnergyGrid()`

---

## 20. CombatProfile and Immutable Snapshots

**Status:** CONTRACT_ONLY (zero production integration)

**CombatProfile:** Immutable, validated, content-addressed combat profile  
**BattleSnapshot:** Profile frozen at launch, locks randomSeed, carries deterministic hash

**Fields:**
- Origin/target (actor, plot, subPlot)
- Commitment (troops, iron, fuel, crystal)
- Facility context (archetype, level, alignment)
- Energy context (alignment, grid summary)
- Upgrade context (archetype, effect key, tier)
- Target defense (defenseLevel, biome, improvements, orbital hazard)
- Modifiers (source, kind, scope, value)
- Random seed

**Current behavior:**
- No attack route consumes this
- No DB columns store this
- No `resolveBattle()` reads this
- No UI displays this

**Code:** `shared/combatProfile.ts:buildCombatProfile()`, `createBattleSnapshot()`

---

## 21. Facility Integrity, Damage, Repair, Capture, Salvage, Conversion

**Status:** PLANNED (no implementation)

**Planned features:**
- Integrity damage (facilities lose integrity from attacks)
- Temporary disablement (at 0 integrity, facility disabled until repaired)
- Upgrade impairment (damaged facilities lose higher-tier benefits)
- EMP (temporary disable + reduced output)
- Sabotage (resource drain / production pause)
- Energy drain (targeted facilities lose grid energy)
- Stored-resource loss (pillage on capture)
- Repair time (integrity regenerates over duration)
- Repair resource cost (iron/crystal to accelerate)
- Capture of damaged facilities (inherited in damaged state)
- Salvage (raider strips facility for resources)
- Conversion (new owner re-rolls archetype/alignment)
- Demolition (owner razes facility to free slot)

**Code:** Does not exist yet

---

## 22. Globe Presentation

**Status:** LIVE

### Current Renderer

**Entry:** `client/src/components/game/PlanetGlobe.tsx`

**Render chain:**
```
Canvas (PerspectiveCamera, fov=45, ACESFilmicToneMapping, exposure=1.15)
  → Scene()
    → CameraController (fly-to, stream mode)
    → StarField (background)
    → ambientLight (intensity=1.8, color=#d8eaff)
    → directionalLight × 3 (key/fill/rim)
    → GlobeTerrain (sphere, radius=2, albedo texture, shader)
    → PlotOverlay (21k InstancedMesh, biome colors, ownership colors)
    → SubParcelOverlay (3×3 grids, LOD-gated)
    → ObserverLayer / GlobeEventOverlays
    → BattleArcs, GlobeIncomingTelegraph, GlobeMusterLayer
    → GlobeBattleScars, MiningPulseLayer, OrbitalZoneLayer, SatelliteOrbitLayer
    → LiveWeaponLayer, GlobeBattleSequence, GlobeShieldDome
    → GlobeCinematicCamera, GlobeLiveEvents
    → OrbitControls (minDistance=3.6, maxDistance=12)
```

### GlobeTerrain Shader

**File:** `client/src/components/game/globe/GlobeTerrain.tsx`

```glsl
float EXPOSURE = 2.0;
float FLOOR = 0.50;
vec3 boosted = boostSat(dayCol.rgb, 1.5) * EXPOSURE + FLOOR;
gl_FragColor = vec4(min(boosted, vec3(1.0)), 1.0);
```

**Brightness tuning:** Saturation boost ×1.5, exposure ×2.0, ambient floor 0.50

### PlotOverlay

**File:** `client/src/components/game/globe/GlobeParcels.tsx`

- **Fill mesh:** InstancedMesh, renderOrder=2, opacity=0.88, vertexColors
- **Border mesh:** InstancedMesh, renderOrder=1, opacity=0.75, vertexColors
- **Biome colors:** `BIOME_COLORS` (globeConstants.ts)
- **Ownership colors:** Player (customizable via `useVisualPrefs`), enemy (customizable)
- **Selection/hover:** Animated pulse, gold highlight
- **Battle:** Hot pink-red pulse
- **Fog of war:** Opt-in, dim hidden plots (FOG_DIM_HIDDEN)

### SubParcelOverlay

**File:** `client/src/components/game/globe/GlobeParcels.tsx`

- **LOD gating:** Only visible when camera < `GLOBE_RADIUS * 2.6` (5.2 units)
- **Archetype colors:** `ARCHETYPE_COLORS` (resource=orange, trade=gold, energy=cyan, fortress=red)
- **Render order:** 3/4 (above main plot layer 1/2)

### Palette Controls

**File:** `client/src/components/game/globe/GlobeColorSettings.tsx`

- Territory color (player)
- Enemy color
- Fog of war toggle
- Observer mode toggle
- Battle cinematics toggle
- Cinematic camera toggle
- Battle sound toggle

**Storage:** localStorage-backed via `useVisualPrefs` hook

### Layer Controls

**Status:** Partially connected

- SubParcelOverlay hidden in stream mode only
- No explicit layer toggle UI for biome/ownership/battle/resource overlays

---

## 23. Plot Selection and Land-Management Experience

**Status:** LIVE

### LandSheet

**File:** `client/src/components/game/LandSheet.tsx`

**Features:**
- Plot ID, biome, ownership status
- Biome yield profile (Iron/Fuel/Crystal modifiers)
- Defense level, influence, richness
- Stored resources (owner-only, fog-of-war for enemy)
- 24h resource yield forecast
- Storage capacity and cooldown timer
- NFT claim banner
- Sub-parcel grid (3×3 table)
- Command console (mine/upgrade/claim)
- Mine/Upgrade/Terraform buttons (owner)
- Attack button (enemy-owned)
- Purchase button (unclaimed)
- Terraform panel (biome conversion advisor)
- Defense improvements (Iron/Fuel)
- Facilities (ASCEND)
- Plot upgrades (Iron/Fuel)
- Special attacks (Commander-required)

### SubParcelGrid

**File:** `client/src/components/game/land/SubParcelGrid.tsx`

**Features:**
- 3×3 table view (not tactical grid)
- Sub-parcel ownership status
- Improvements per sub-parcel
- Buy button (unowned)
- Manage button (owned) → opens SubParcelUpgradePanel
- Subdivide button (if eligible)

---

## 24. Tactical Parcel-View Specification

**Status:** PLANNED (no implementation)

**Target experience:**
- Transition from globe to dedicated tactical view when plot selected
- Show main HQ and sub-parcel/facility layout
- Provide Manage Plot, upgrades, energy, defenses, production, attack-origin controls
- 2D or 2.5D orthographic view
- Facility slots visible
- Layer toggles (ownership, threats, resources, facilities, selection, range, actionable)

**Current state:**
- No tactical component exists
- No orthographic camera
- No 2D/2.5D renderer
- LandSheet is a bottom-sheet panel, not a tactical map

**Code:** Does not exist yet

---

## 25. UI Panels and Mobile-Landscape Requirements

**Status:** PARTIAL

### Desktop Panels (Right Rail)

**Width:** 240px (md) / 288px (lg)  
**Height:** `top-16 bottom-0` (64px to viewport bottom)

**Scroll traps (KNOWN ISSUES):**
- TradeStation: `overflow-hidden` blocks child scrolling
- FactionPanel: `overflow-hidden` blocks child scrolling
- WarRoomPanel: Double-scroll risk (external ScrollArea + internal max-h-[400px])

### Mobile Layout

**Fullscreen panel overlay:** `md:hidden absolute inset-0 z-30 pt-16 pb-16`  
**BottomNav HUD dock:** 64px height

**Viewport-specific issues:**
- 667×375 (iPhone SE landscape): 247px available height after chrome. CommanderPanel Battlefront launch button always below fold.
- 844×390 (iPhone 12/13 landscape): 262px available. Marginal.
- 932×430 (iPhone 14 Pro Max landscape): 302px available. Marginally usable.

**Touch targets:** All buttons use h-6 or h-7 (24–28px), below recommended 44px

### Panel Test Coverage

**Panels with no tests (12 of 16):**
- WarRoomPanel, CommanderPanel, InventoryPanel, LandSheet, BattlesPanel
- SubParcelGrid, SubParcelUpgradePanel, SubParcelGridPicker
- WorldIntelPanel, LeaderboardPanel, ArmoryPanel, EconomicsPanel

**Panels with tests (4 of 16):**
- CommandCenterPanel, UniversityPanel, AdminDashboard, HudShell (SSR smoke only)

---

## 26. Live-vs-Planned Status Ledger

| Feature | Status | Notes |
|---------|--------|-------|
| 21,000-plot globe | LIVE | Fully wired |
| Plot generation | LIVE | Fibonacci sphere, 8 biomes |
| Biome assignment | LIVE | Latitude + noise |
| Plot ownership | LIVE | Persisted, authenticated |
| Plot purchase | LIVE | ALGO payment, NFT mint |
| Plot NFT mint/delivery | LIVE | Idempotent |
| Sub-parcels | LIVE | 3×3 grid, persisted |
| Sub-parcel archetypes (legacy) | LIVE | resource/trade/fortress/energy, building restrictions enforced |
| Six facility archetypes | CATALOG_ONLY | Defined, not persisted or consumed |
| Facility upgrade trees | CATALOG_ONLY | Defined, not consumed |
| Weapon archetypes | DISCONNECTED | Displayed, not consumed by resolver |
| Energy alignments | PLACEHOLDER | Stored/displayed, zero effect |
| Attack doctrines | PLANNED | Approved design, no code |
| Energy grid simulation | CONTRACT_ONLY | Simulator exists, not integrated |
| CombatProfile/Snapshot | CONTRACT_ONLY | Contract exists, not integrated |
| Brownouts/blackouts | CONTRACT_ONLY | Simulator exists, not integrated |
| Facility integrity/damage | PLANNED | No code |
| Facility repair | PLANNED | No code |
| Facility capture | PLANNED | No code |
| Facility salvage | PLANNED | No code |
| Facility conversion | PLANNED | No code |
| Tactical 2D/2.5D view | PLANNED | No code |
| Attack idempotency | LIVE | PR #250 merged |
| Battle resolution | LIVE | Deterministic, provably fair |
| AI factions | LIVE | Four factions, 2-min interval |
| Commander system | LIVE | Three tiers, 12-hour lock |
| ASCEND generation/claim | LIVE | Lazy, wallet opt-in |
| Plot pricing | LIVE | 0.2–1.5 ALGO by biome |
| Sub-parcel pricing | LIVE | 10–100 ASCEND by biome |
| Mining | LIVE | 5-min cooldown, biome modifiers |
| Trading | LIVE | Peer-to-peer |
| Resource generation | LIVE | Biome + richness + facilities |
| Build/upgrade costs | LIVE | Iron/Fuel/ASCEND |
| Token sinks | LIVE | Commander, facilities, attacks, drones, satellites, landmarks |
| Treasury | LIVE | 70/30 split, 24h settlement |
| On-chain settlement | LIVE | Batched ASA transfers |
| Landmarks | LIVE | Launchpad, Dome, Forge, Relay |
| Seasons | LIVE | ~90-day cycles, phases, rewards |
| Orbital events | LIVE | Cosmetic + impact |
| Recon drones | LIVE | 20 ASCEND, 15-min scout |
| Orbital satellites | LIVE | 50 ASCEND, 1-hour orbit |
| Special attacks | LIVE | Orbital Strike, EMP, Siege, Sabotage |
| Loot boxes | LIVE | Common/Rare/Epic/Legendary |
| Rare minerals | LIVE | Xenorite, Void Shard, Plasma Core, Dark Matter |
| Provable fairness | LIVE | Public seed, deterministic resolution |

---

## 27. Canonical Terminology Dictionary

| Term | Definition |
|------|-----------|
| **Main Plot** | Territorial headquarters and ownership unit |
| **Sub-Parcel / Sub-Plot** | Persistent subdivision or slot within a main plot |
| **Legacy Sub-Parcel Category** | Persisted values: resource, trade, fortress, energy (build-category axis) |
| **Facility Archetype** | Canonical Phase 1 IDs: assault_foundry, siege_battery, defense_bastion, recon_array, extraction_complex, logistics_nexus (function axis) |
| **Weapon Archetype** | Code IDs: siege_baron, artillery_marshal, hypersonic_striker, ghost_marksman, aegis_interceptor, swarm_commodore (equipped platform axis) |
| **Energy Alignment** | helios, aegis, nexus (operating axis) |
| **Attack Doctrine** | assault, siege, raid, sabotage, precision_strike (battle-method axis, PLANNED) |
| **Plot** | One of 21,000 territorial units on the world map |
| **Parcel** | Synonym for plot; also refers to the data record |
| **Biome** | Environmental type (forest, desert, mountain, plains, water, tundra, volcanic, swamp) |
| **ASCEND** | FRONTIER token — in-game currency on Algorand |
| **ASA** | Algorand Standard Asset — token standard for ASCEND and NFTs |
| **NFT** | Non-Fungible Token — each purchased plot is minted as unique ARC-3 NFT |
| **ARC-3** | Algorand Request for Comment #3 — metadata standard for NFTs |
| **Commander** | Mintable avatar (Sentinel/Phantom/Reaper) providing combat bonuses |
| **Landmark** | Mega-structure (Launchpad/Dome/Forge/Relay) with unique effects |
| **Rare Mineral** | Advanced resource (Xenorite/Void Shard/Plasma Core/Dark Matter) |
| **Loot Box** | Randomized reward container (Common/Rare/Epic/Legendary) |
| **Reconquest** | AI faction's attempt to recapture a plot taken by a human |
| **ADR** | Adaptive Dominance Regulation — auto-balancing for AI factions |
| **Morale Debuff** | Temporary attack power penalty after losing battles |
| **Pillage** | 30% resource theft on successful territory capture |
| **Season** | ~90-day competitive cycle with phases and rewards |
| **Fibonacci Sphere** | Mathematical distribution for uniform plot placement |
| **Full Control Bonus** | +50% yield for owning all 9 sub-parcels of a plot |
| **CombatProfile** | Immutable, validated, content-addressed combat profile (CONTRACT_ONLY) |
| **BattleSnapshot** | Profile frozen at launch, locks randomSeed (CONTRACT_ONLY) |
| **Brownout** | At least one facility reduced or offline (CONTRACT_ONLY) |
| **Blackout** | No facility received minimum sustainable demand (CONTRACT_ONLY) |

---

## 28. Production Acceptance Criteria

### P0 — Release Blockers

- [ ] PR #250 merged and deployed (DONE: `da35c7e`)
- [ ] Migration 0015 applied to production DB (OWNER ACTION)
- [ ] AI cost-control activation verified (OWNER ACTION: `flyctl secrets set`)
- [ ] DB cadence and connection evidence reviewed
- [ ] Unresolved schema/runtime warnings addressed
- [ ] Production health and error review completed

### P1 — Documentation Truth

- [x] Master game specification created (THIS DOCUMENT)
- [ ] Reconciliation ledger created
- [ ] Player manual corrections applied
- [ ] Glossary and terminology aligned
- [ ] Roadmap corrected

### P2 — Globe Visual Production Pass

- [ ] Surface visibility tuned (shader exposure/floor)
- [ ] Lighting/exposure balanced
- [ ] Atmosphere enhanced
- [ ] Parcel-grid distance fade implemented
- [ ] Render-order/material audit completed
- [ ] Biome/faction/ownership overlays verified
- [ ] Layer controls implemented
- [ ] Tactical transition designed
- [ ] Desktop/mobile screenshot acceptance

### P3 — Endpoint and Persistence Safety

- [ ] Phase 4B: `/archetype` idempotency
- [ ] Phase 4B: `/build` idempotency
- [ ] Facility persistence design
- [ ] Migration compatibility verified

### P4 — Facility and Energy Integration

- [ ] Persisted facility archetype (map legacy → canonical)
- [ ] Facility upgrades wired
- [ ] Numeric energy profiles defined
- [ ] Storage/generation integrated
- [ ] Brownout states implemented
- [ ] Manage Plot integration

### P5 — Combat Integration

- [ ] Live CombatProfile creation
- [ ] Immutable snapshot persistence
- [ ] Weapon equipment wired
- [ ] Doctrines implemented
- [ ] Alignments integrated
- [ ] Facility modifiers applied
- [ ] Resolver integration

### P6 — Damage and Territorial Consequences

- [ ] Integrity system
- [ ] Disablement logic
- [ ] Repair mechanics
- [ ] Capture inheritance
- [ ] Salvage system
- [ ] Conversion system
- [ ] Demolition system

### P7 — UI and Tactical Experience

- [ ] Tactical 2D/2.5D view implemented
- [ ] Manage Plot redesigned
- [ ] Battlefront mobile UX fixed
- [ ] Scroll traps resolved
- [ ] Mobile landscape accessibility
- [ ] Interaction tests added

### P8 — AI and Balancing

- [ ] AI facility construction
- [ ] AI energy prioritization
- [ ] AI doctrine selection
- [ ] AI target selection
- [ ] AI recovery from zero territory
- [ ] Simulation and balance harness

### P9 — Launch Verification

- [ ] Wallet-to-purchase flow verified
- [ ] Land NFT delivery verified
- [ ] Commander NFT delivery verified
- [ ] Build flow verified
- [ ] Attack flow verified
- [ ] Resolution flow verified
- [ ] Capture flow verified
- [ ] Reconnect/retry/recovery verified
- [ ] Observability verified
- [ ] Security verified
- [ ] Performance verified
- [ ] Accessibility verified

---

## 29. Canonical Code and Documentation Paths

### Documentation

| Document | Path | Purpose |
|----------|------|---------|
| Master Game Spec | `artifacts/frontier-al/FRONTIER_MASTER_GAME_SPEC.md` | Canonical game-design truth (THIS DOCUMENT) |
| Production Roadmap | `artifacts/frontier-al/PRODUCTION_READINESS_ROADMAP.md` | Implementation lanes and priorities |
| Reconciliation Ledger | `artifacts/frontier-al/docs/DOC_RECONCILIATION_LEDGER.md` | Doc-vs-code mismatches |
| Game Manual | `artifacts/frontier-al/GAME_MANUAL.md` | Player-facing codex |
| Economics | `artifacts/frontier-al/ECONOMICS.md` | Tokenomics and pricing |
| Strategy Guide | `artifacts/frontier-al/STRATEGY_GUIDE.md` | Tactics and playbooks |
| FAQ | `artifacts/frontier-al/FAQ.md` | Troubleshooting |
| Architecture | `artifacts/frontier-al/ARCHITECTURE.md` | System design |
| Deployment | `artifacts/frontier-al/DEPLOYMENT.md` | Ship to Fly.io + Cloudflare |
| ENV Vars | `artifacts/frontier-al/ENV_VARS.md` | Config knobs and secrets |
| Handoff | `docs/HANDOFF.md` | Current baton / next unit |
| Master Roadmap | `docs/FRONTIER_MASTER_ROADMAP.md` | 26-phase roadmap |
| Sub-Plot Architecture | `docs/memory/FRONTIER_SUBPLOT_COMBAT_ARCHITECTURE.md` | Canonical vocabulary + phased plan |
| Battle Engine Truth | `docs/memory/FRONTIER_BATTLE_ENGINE_TRUTH_AND_TARGET.md` | Current engine truth + target architecture |
| Land/Combat Audit | `artifacts/frontier-al/docs/audit/FRONTIER_LAND_COMBAT_PANEL_AUDIT.md` | End-to-end audit |

### Shared Contracts

| Contract | Path | Status |
|----------|------|--------|
| Schema | `artifacts/frontier-al/shared/schema.ts` | LIVE |
| Facility Archetypes | `artifacts/frontier-al/shared/subplotArchitecture.ts` | CATALOG_ONLY |
| Energy Grid | `artifacts/frontier-al/shared/energyGrid.ts` | CONTRACT_ONLY |
| CombatProfile | `artifacts/frontier-al/shared/combatProfile.ts` | CONTRACT_ONLY |
| Weapon Archetypes | `artifacts/frontier-al/shared/weapons/archetypes.ts` | DISCONNECTED |
| Economy Config | `artifacts/frontier-al/shared/economy-config.ts` | LIVE |

### Server

| Component | Path | Status |
|-----------|------|--------|
| Routes | `artifacts/frontier-al/server/routes.ts` | LIVE |
| Battle Resolver | `artifacts/frontier-al/server/engine/battle/resolve.ts` | LIVE |
| Game Rules | `artifacts/frontier-al/server/storage/game-rules.ts` | LIVE |
| AI Engine | `artifacts/frontier-al/server/storage/ai-engine.ts` | LIVE |
| Attack Idempotency | `artifacts/frontier-al/server/attackIdempotency.ts` | LIVE |
| Idempotency Guard | `artifacts/frontier-al/server/idempotencyGuard.ts` | LIVE |
| DB Schema | `artifacts/frontier-al/server/db-schema.ts` | LIVE |
| DB Storage | `artifacts/frontier-al/server/storage/db.ts` | LIVE |

### Client

| Component | Path | Status |
|-----------|------|--------|
| PlanetGlobe | `artifacts/frontier-al/client/src/components/game/PlanetGlobe.tsx` | LIVE |
| GlobeParcels | `artifacts/frontier-al/client/src/components/game/globe/GlobeParcels.tsx` | LIVE |
| GlobeTerrain | `artifacts/frontier-al/client/src/components/game/globe/GlobeTerrain.tsx` | LIVE |
| GlobeColorSettings | `artifacts/frontier-al/client/src/components/game/globe/GlobeColorSettings.tsx` | LIVE |
| LandSheet | `artifacts/frontier-al/client/src/components/game/LandSheet.tsx` | LIVE |
| SubParcelGrid | `artifacts/frontier-al/client/src/components/game/land/SubParcelGrid.tsx` | LIVE |
| CommanderPanel | `artifacts/frontier-al/client/src/components/game/CommanderPanel.tsx` | LIVE |
| TradeStation | `artifacts/frontier-al/client/src/components/game/TradeStation.tsx` | LIVE (scroll trap) |
| FactionPanel | `artifacts/frontier-al/client/src/components/game/FactionPanel.tsx` | LIVE (scroll trap) |

### Migrations

| Migration | Path | Status |
|-----------|------|--------|
| 0000–0014 | `artifacts/frontier-al/migrations/0000–0014` | Applied |
| 0015 | `artifacts/frontier-al/migrations/0015_action_nonce_fingerprint.sql` | Merged (PR #250), deployment pending |

---

## End of Specification

This document is the canonical game-design truth. All future implementation must align with this spec. Status labels must be updated as systems move from PLANNED → CONTRACT_ONLY → LIVE.

**Next update:** After Phase 4B (archetype/build idempotency) or Phase 5 (weapon integration).
