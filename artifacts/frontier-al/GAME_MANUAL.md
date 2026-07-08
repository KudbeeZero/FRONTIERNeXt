# FRONTIER-AL — Game Manual

> The definitive guide to every system, mechanic, and feature in FRONTIER-AL.
> All numeric values sourced directly from the game engine.

---

## Table of Contents

- [1. Welcome to FRONTIER](#1-welcome-to-frontier)
- [2. The World](#2-the-world)
- [3. Resources](#3-resources)
- [4. Rare Minerals](#4-rare-minerals)
- [5. Mining](#5-mining)
- [6. Land Purchase](#6-land-purchase)
- [7. Sub-Parcels](#7-sub-parcels)
- [8. Defense Improvements](#8-defense-improvements)
- [9. Base Upgrades](#9-base-upgrades)
- [10. FRONTIER Facilities](#10-frontier-facilities)
- [11. Landmarks](#11-landmarks)
- [12. Commander Avatars](#12-commander-avatars)
- [13. Special Attacks](#13-special-attacks)
- [14. Combat System](#14-combat-system)
- [15. Morale & Cooldowns](#15-morale--cooldowns)
- [16. Recon Drones](#16-recon-drones)
- [17. Orbital Satellites](#17-orbital-satellites)
- [18. Loot Boxes](#18-loot-boxes)
- [19. AI Factions](#19-ai-factions)
- [20. Reconquest System](#20-reconquest-system)
- [21. Orbital Events](#21-orbital-events)
- [22. Trading](#22-trading)
- [23. Seasons](#23-seasons)
- [24. Token Economics](#24-token-economics)
- [25. Wallet Integration](#25-wallet-integration)
- [26. Glossary](#26-glossary)

---

## 1. Welcome to FRONTIER

FRONTIER-AL is a persistent globe-based strategy game powered by the Algorand blockchain. You compete with other players and four AI factions for control of a shared 21,000-plot world map rendered as a 3D rotating planet.

### Getting Started

1. **Connect your wallet** — Pera Wallet (mobile + web) or LUTE Wallet (browser extension)
2. **Receive your welcome bonus** — 500 ASCEND credited on first wallet connection
3. **Purchase your first plot** — Pay ALGO to claim a territory on the globe
4. **Start mining** — Extract Iron, Fuel, and Crystal from your plots
5. **Build and expand** — Construct improvements, facilities, and landmarks to grow your empire

### UI Overview

- **3D Globe** — Three.js GPU-accelerated rendering of all 21,000 plots on a rotating planet
- **Bottom Navigation** — Map, Inventory, Battles, Rankings, Commander tabs
- **Resource HUD** — Top bar showing Iron, Fuel, Crystal, ASCEND balances with daily generation rate

---

## 2. The World

The world consists of **21,000 plots** distributed over a globe using a Fibonacci sphere algorithm for near-uniform density. Each plot is assigned one of 8 biomes based on latitude and plot-index noise.

### Biome Modifiers

| Biome | Iron Mod | Fuel Mod | Crystal Mod | Defense Mod | Battle Defense Mod | ALGO Cost |
|-------|----------|----------|-------------|-------------|-------------------|-----------|
| Forest | 1.2x | 1.0x | 1.5x | 1.1x | 1.1x | 0.5 |
| Plains | 1.0x | 1.0x | 1.0x | 1.0x | 1.0x | 0.3 |
| Mountain | 2.0x | 0.4x | 0.5x | 1.3x | 1.4x | 0.8 |
| Desert | 0.6x | 2.5x | 0.3x | 0.9x | 0.9x | 0.2 |
| Volcanic | 1.8x | 0.6x | 2.5x | 0.8x | 1.3x | 1.0 |
| Tundra | 0.8x | 1.8x | 0.8x | 1.2x | 1.2x | 0.4 |
| Swamp | 0.7x | 0.9x | 2.0x | 0.6x | 1.1x | 0.3 |
| Water | 0.3x | 0.3x | 3.0x | 0.7x | 0.5x | 1.5 |

> **Note:** The "Defense Mod" column comes from `schema.ts` (used for general defense calculations). The "Battle Defense Mod" column comes from `tuning.ts` (used specifically in the battle engine). Water plots have a 0.5x battle defense modifier, making them effectively uncapturable through normal combat.

### Plot Richness

Each plot has a **richness score from 1–100** that affects resource yield quality. Higher richness plots produce more resources per mine action.

---

## 3. Resources

### Standard Resources

| Resource | Base Yield per Mine | Use |
|----------|-------------------|-----|
| **Iron** | 20 | Upgrades, attacks, defense improvements |
| **Fuel** | 12 | Operations, improvements, attacks |
| **Crystal** | 4 | High-level upgrades, advanced crafting |

### FRONTIER Token (ASCEND)

- Passive generation: every owned plot earns a baseline **1 ASCEND/day**
- Enhanced by FRONTIER Facilities (Electricity, Blockchain Node)
- Used for: Commanders, special attacks, drones, satellites, facilities, landmarks

### Storage

- **Base capacity**: 800 units (Iron + Fuel + Crystal combined)
- Expandable via Storage Depot: **+200 per level** (max level 3 = +600)
- Fortress provides an additional **+50 storage**
- Mining stops contributing when storage is full — collect regularly!

---

## 4. Rare Minerals

Rare minerals are an advanced resource tier that drops while mining, based on the plot's biome. They are used for Landmark construction and advanced upgrades.

### Mineral Types & Drop Rates

Each mine action rolls **independently** for every mineral its biome can yield — so a single mine can return more than one. Drop chances per mine (verified against `shared/schema.ts` and `server/storage/db.ts`):

| Mineral | Drops in (chance per mine) | Description |
|---------|---------------------------|-------------|
| **Xenorite** | Volcanic 8% · Mountain 4% · Desert 3% · Plains 2% | Crystallized volcanic compounds. Used for the Launchpad and Quantum Forge |
| **Void Shard** | Tundra 6% · Forest 4% · Mountain 3% · Swamp 2% | Frozen dark-energy fragments. Required for the Orbital Alien Dome and Commander upgrades |
| **Plasma Core** | Volcanic 5% · Desert 5% · Forest 2% · Water 2% | Condensed thermal plasma. Powers Launchpad operations and Siege-tier weaponry |
| **Dark Matter** | Swamp 3% · Water 2% · Tundra 1% | Ultra-rare exotic matter. Used for the Orbital Alien Dome and endgame upgrades |

### Storage Rules

- Rare minerals have a **dedicated vault** — they do not count against your standard storage capacity
- Vault capacity: **50 units per mineral type**, enforced independently per type
- Rare minerals are tradeable through the Trading system

---

## 5. Mining

### Basic Mechanics

- **Cooldown**: 5 minutes (300,000 ms) between mine actions per plot
- **Yields**: Base yields modified by biome multipliers and plot richness
- **Formula**: `yield = baseYield × biomeMod × (richness / 100)`

### Cooldown Reduction

The AI Lab facility reduces mining cooldown:
- Level 1: -30 seconds (4 min 30 sec cooldown)
- Level 2: -60 seconds (4 min cooldown)
- Level 3: -90 seconds (3 min 30 sec cooldown)

### Rare Mineral Drops

Every mine action rolls independently for rare minerals based on the plot's biome (chance per mine):
- **Volcanic:** Xenorite 8%, Plasma Core 5%
- **Mountain:** Xenorite 4%, Void Shard 3%
- **Forest:** Void Shard 4%, Plasma Core 2%
- **Desert:** Plasma Core 5%, Xenorite 3%
- **Tundra:** Void Shard 6%, Dark Matter 1%
- **Swamp:** Dark Matter 3%, Void Shard 2%
- **Water:** Dark Matter 2%, Plasma Core 2%
- **Plains:** Xenorite 2%

### Collection

Use the **Collect** action to gather all stored resources from all your owned plots at once. Resources remain in plot storage until collected — watch your capacity!

---

## 6. Land Purchase

### Pricing by Biome

| Biome | ALGO Cost | Value Proposition |
|-------|-----------|------------------|
| Desert | 0.2 ALGO | Cheapest — excellent fuel (2.5x), low defense |
| Plains | 0.3 ALGO | Balanced — all modifiers at 1.0x |
| Swamp | 0.3 ALGO | Budget crystal (2.0x), weak defense |
| Tundra | 0.4 ALGO | Good fuel (1.8x), solid defense (1.2x) |
| Forest | 0.5 ALGO | Good crystal (1.5x), decent all-around |
| Mountain | 0.8 ALGO | Best iron (2.0x), best defense (1.4x battle mod) |
| Volcanic | 1.0 ALGO | Premium iron (1.8x) + crystal (2.5x) |
| Water | 1.5 ALGO | Best crystal (3.0x), nearly uncapturable (0.5x battle def) |

### Purchase Flow

1. Select an unclaimed plot on the globe
2. Confirm the ALGO price in the purchase modal
3. Sign the Algorand transaction with your wallet
4. Plot is minted as a unique **ARC-3 NFT** on Algorand TestNet
5. Your wallet must be **opted in** to the FRONTIER ASA to receive the NFT

### Plot Richness

Each plot has a richness value from 1–100 that is fixed at world generation. Higher richness means better mining yields. The richness value is visible in the plot detail panel before purchase.

---

## 7. Sub-Parcels

Each macro-plot can be subdivided into a **3×3 grid of 9 sub-parcels**, enabling fine-grained territorial control and strategic depth.

### Grid Layout

```
┌───┬───┬───┐
│ 0 │ 1 │ 2 │
├───┼───┼───┤
│ 3 │ 4 │ 5 │
├───┼───┼───┤
│ 6 │ 7 │ 8 │
└───┴───┴───┘
```

Sub-parcel indices are row-major (0 = top-left, 4 = center, 8 = bottom-right).

### Requirements

- **4-hour hold requirement** — You must own the macro-plot for at least 4 hours before subdividing
- **Human-exclusive** — AI factions cannot subdivide plots; they own whole macro-plots only
- **Cost**: Subdivision cost scales by biome (10–100 ASCEND per sub-parcel)

### Yield Mechanics

- Each sub-parcel generates **1/9 of the parent plot's daily FRONTIER yield**
- **Full Control Bonus**: If you own all 9 sub-parcels of a plot, you receive a **+50% yield bonus** (1.5x multiplier)
- Example: A plot generating 6 ASCEND/day, fully subdivided and controlled = 6 × 1.5 = **9 ASCEND/day**

### Defense

- Sub-parcels inherit the defense level of the parent plot
- Individual sub-parcels can be attacked and captured independently
- Losing sub-parcels removes the Full Control Bonus until all 9 are reclaimed

### Trading

- Sub-parcels can be traded and transferred between players
- Ownership of individual sub-parcels is tracked independently

---

## 8. Defense Improvements

Defense improvements are built using Iron and Fuel. They strengthen your plots against enemy attacks.

| Improvement | Iron Cost | Fuel Cost | Max Level | Effect per Level |
|-------------|-----------|-----------|-----------|-----------------|
| **Turret** | 40 | 20 | 3 | +3 defense, adds to battle power |
| **Shield Generator** | 60 | 40 | 2 | +5 defense, reduces influence damage |
| **Storage Depot** | 35 | 15 | 3 | +200 storage capacity |
| **Radar Array** | 45 | 35 | 1 | -10% incoming attack power |
| **Fortress** | 200 | 150 | 1 | +8 defense, +50 storage |

### Defense Power Contribution

In battle, each improvement level contributes **5 defense power** (from `IMPROVEMENT_DEFENSE_PER_LEVEL`).

**Example — Maximum defense build:**
- Turret Lv3: 3 levels × 5 = 15 defense power
- Shield Generator Lv2: 2 levels × 5 = 10 defense power
- Fortress Lv1: 1 level × 5 = 5 defense power
- Total improvement bonus: **30 defense power**

---

## 9. Base Upgrades

Base upgrades are one-time improvements purchased with Iron and Fuel.

| Upgrade | Iron Cost | Fuel Cost | Effect |
|---------|-----------|-----------|--------|
| **Defense** | 50 | 25 | +1 defense level → +15 battle power |
| **Yield** | 75 | 50 | +20% all resource yields permanently |
| **Mine** | 100 | 75 | +10 richness (recovers depletion) |
| **Bunker** | 150 | 100 | +5 influence repair rate/day |

> **Tip:** The Yield upgrade stacks multiplicatively with biome modifiers and Data Centre bonuses.

---

## 10. FRONTIER Facilities

FRONTIER Facilities are advanced structures that require ASCEND tokens to build. All advanced facilities require Electricity as a prerequisite.

### Facility Chain

```
Electricity (Lv1)
├── Blockchain Node (Lv1-3) → Pure ASCEND income
├── Data Centre (Lv1-3)     → Resource yield bonus
└── AI Lab (Lv1-3)          → Mining cooldown reduction
```

### Costs & Effects

| Facility | Prerequisite | Lv1 Cost | Lv2 Cost | Lv3 Cost | Effect |
|----------|-------------|----------|----------|----------|--------|
| **Electricity** | — | 30 ASCEND | — | — | +1 ASCEND/day, unlocks advanced facilities |
| **Blockchain Node** | Electricity | 120 ASCEND | 270 ASCEND | 480 ASCEND | +2 / +3 / +4 ASCEND/day |
| **Data Centre** | Electricity | 120 ASCEND | 270 ASCEND | 480 ASCEND | +5% / +10% / +15% resource yield |
| **AI Lab** | Electricity | 120 ASCEND | 270 ASCEND | 480 ASCEND | -30s / -60s / -90s mine cooldown |

### ASCEND/Day Breakdown

> **Important:** Data Centre and AI Lab produce **0 ASCEND/day** — they provide yield bonuses and cooldown reductions instead. Only Electricity and Blockchain Node generate passive ASCEND.

A fully-upgraded plot's daily ASCEND generation:

| Source | ASCEND/day |
|--------|-----------|
| Base plot ownership | 1 |
| Electricity Lv1 | +1 |
| Blockchain Node Lv3 | +4 |
| Data Centre Lv3 | +0 (gives +15% yield instead) |
| AI Lab Lv3 | +0 (gives -90s cooldown instead) |
| **Total** | **6 ASCEND/day** |

Total investment for max ASCEND output per plot: 30 + 120 + 270 + 480 = **900 ASCEND**

---

## 11. Landmarks

Landmarks are unique mega-structures that provide powerful, game-changing effects. Each has strict requirements and a limit of one per player (except the Orbital Alien Dome, which is limited to one per server).

### The Launchpad

> *"Mission control for all orbital operations."*

| Property | Value |
|----------|-------|
| **Cost** | 500 ASCEND + 50 Xenorite + 30 Plasma Core |
| **Limit** | 1 per player |
| **Requirement** | Own 10+ plots, Electricity facility on plot |
| **Effects** | -50% satellite deploy cost, -50% drone deploy cost, +1 max satellite slot (3 total), +2 max drone slots (7 total) |
| **Special** | **Deep Space Probe** — deploy every 24h, reveals all enemy plots within 5-plot radius for 2 hours |

### Orbital Alien Dome

> *"The nexus of seasonal power. A relic of alien origin that channels the energy of each season."*

| Property | Value |
|----------|-------|
| **Cost** | 800 ASCEND + 40 Void Shard + 20 Dark Matter |
| **Limit** | 1 per server (first to build claims it for the season) |
| **Requirement** | Own 25+ plots, active season must be running |
| **Effects** | +100% ASCEND generation during active season, +10% defense bonus to all players within 3-plot radius |
| **Special** | Season Nexus — houses the Season Leaderboard hologram. Dome owner receives a bonus **5% of the season reward pool** at season end |

### Quantum Forge

> *"A molecular assembly chamber for transmuting rare minerals and crafting legendary equipment."*

| Property | Value |
|----------|-------|
| **Cost** | 600 ASCEND + 30 Xenorite + 25 Void Shard + 10 Plasma Core |
| **Limit** | 1 per player |
| **Requirement** | Own 15+ plots, Data Centre Lv2+ on plot |
| **Effects** | Rare mineral refining (convert 10 of any type → 3 of another), craft 1 Legendary loot box per 48h, +30% Crystal mining yield on this plot |

### Ancient Relay

> *"A network node from a forgotten civilization. Enables instant resource teleportation across your empire."*

| Property | Value |
|----------|-------|
| **Cost** | 400 ASCEND + 20 Plasma Core + 15 Void Shard |
| **Limit** | 1 per player |
| **Requirement** | Own 20+ plots, AI Lab Lv2+ on plot |
| **Effects** | Instant resource teleport between all owned plots (no need to collect individually), +2 ASCEND/day passive, -25% attack cooldown for attacks from this plot |
| **Special** | Detects cloaked Phantom commanders within 4-plot radius |

---

## 12. Commander Avatars

Commanders are unique on-chain avatars minted by burning FRONTIER tokens. You can collect multiple commanders but only deploy one at a time.

### Commander Tiers

| Tier | Cost | ATK Bonus | DEF Bonus | Special Ability | Max Concurrent Attacks |
|------|------|-----------|-----------|-----------------|----------------------|
| **Sentinel** | 50 ASCEND | +10% | +10% | Fortify | 1 |
| **Phantom** | 150 ASCEND | +18% | +6% | Cloak | 2 |
| **Reaper** | 400 ASCEND | +30% | +5% | Annihilate | 3 |

### Deployment Rules

- **12-hour lock** after deploying a commander in an attack
- One active commander at a time — switch between collected commanders
- Commanders are required for all special attacks
- Each commander tracks total kills independently

### Special Abilities

- **Fortify** (Sentinel): Bolsters defense on the plot the commander is deployed from
- **Cloak** (Phantom): Reduces enemy detection, enables Sabotage and EMP Blast
- **Annihilate** (Reaper): Maximum destruction capability, unlocks Siege Barrage

---

## 13. Special Attacks

Special attacks are powerful abilities that require an active commander and cost ASCEND to execute.

| Attack | Cost | Cooldown | Damage Multiplier | Effect | Required Commander |
|--------|------|----------|-------------------|--------|-------------------|
| **Orbital Strike** | 25 ASCEND | 30 min | 3.0x | Ignores 50% of target defense | Any tier |
| **EMP Blast** | 15 ASCEND | 20 min | 1.5x | Disables all improvements for 10 minutes | Phantom or Reaper |
| **Siege Barrage** | 40 ASCEND | 45 min | 2.0x | Damages up to 3 nearby enemy plots | Reaper only |
| **Sabotage** | 10 ASCEND | 15 min | 0.5x | Halves target mining yield for 30 minutes | Phantom or Reaper |

> **Tip:** Chain EMP Blast (disable improvements) immediately before an Orbital Strike for maximum damage against fortified targets.

---

## 14. Combat System

### Battle Duration

All battles last **10 minutes** (600,000 ms) after initiation. The outcome is computed server-side when the timer expires.

### Attacker Power Formula

```
attackerPower = (troops × 10) + (iron_burned × 0.5) + (fuel_burned × 0.8) + commanderBonus
```

Where:
- `troops` — number of troops committed (each worth 10 power)
- `iron_burned` — iron resources spent on the attack (0.5 power each)
- `fuel_burned` — fuel resources spent on the attack (0.8 power each)
- `commanderBonus` — percentage bonus from active commander (e.g., Reaper = +30%)

**Modifiers:**
- If **morale debuffed**: power × 0.85 (15% reduction, from `tuning.ts`)
- **Random factor**: ±10% swing (`randFactor` in range [-10, +10], applied as `power × (1 + randFactor/100)`)

### Defender Power Formula

```
defenderPower = (defenseLevel × 15 + improvementBonus) × biomeDefenseMod
```

Where:
- `defenseLevel` — base defense level of the plot (each level = 15 power)
- `improvementBonus` — sum of (level × 5) for each turret, shield generator, and fortress improvement
- `biomeDefenseMod` — battle defense modifier from `tuning.ts` (e.g., Mountain = 1.4x)

**Modifiers:**
- If **orbital hazard active**: defender power reduced by 20%

### Outcome

- `attackerPower > defenderPower` → **Attacker wins** — captures the territory
- `attackerPower ≤ defenderPower` → **Defender wins** — territory remains

### Pillage

On a successful attack, the attacker steals **30% of all stored resources** (Iron, Fuel, Crystal) from the captured plot.

### Worked Example

**Attacker** — 5 troops, burns 100 iron + 80 fuel, Reaper commander:
```
base = (5 × 10) + (100 × 0.5) + (80 × 0.8) = 50 + 50 + 64 = 164
with Reaper (+30%): 164 × 1.30 = 213.2
with random factor (+5%): 213.2 × 1.05 = 223.9
```

**Defender** — Mountain plot, defense level 3, Turret Lv2 + Shield Gen Lv1:
```
improvementBonus = (2 × 5) + (1 × 5) = 15
base = (3 × 15 + 15) = 60
with Mountain biome (1.4x): 60 × 1.4 = 84.0
```

Result: 223.9 > 84.0 → **Attacker wins**

### Battle Theater

When a battle resolves you'll see it play out as one **connected cinematic** on the
globe: an *incoming-attack* telegraph builds on the defending plot, a strike arcs across
the planet, and impact + a faction-coloured capture burst land on the target, with a HUD
callout narrating the beats (the battle watch modal shows the same sequence). It honours
your OS **reduced-motion** setting and a **Battle Cinematics** toggle in globe settings.
Two extras are **off by default** there — **Cinematic Camera** (gently follows *your*
battles) and **Battle Sound** (synth cues). Resolved battles can be re-watched from the
battle log.

### Provable Fairness

That `randFactor` swing isn't something the server can rig. It's derived deterministically
from a **public seed** (the battle's id + start time), and resolution is fully
deterministic — so **anyone can independently re-derive a resolved battle's `randFactor`
and outcome and confirm the server recorded exactly what the rule produces**. Fetch the
proof at `GET /api/battle/<battleId>/proof` (it returns the seed, the re-derived result, a
reproducible hash, and `valid: true`). An automated checker (veritas) verifies live
battles continuously.

---

## 15. Morale & Cooldowns

### Morale Debuff

When you lose a battle:
- **Duration**: 5 minutes base (scales with consecutive losses)
- **Effect**: Attack power reduced by **15%** during battle resolution (from `tuning.ts`)
- UI displays a **25%** penalty indicator (from `schema.ts` — the UI shows a higher penalty as a deterrent)

### Attack Cooldown

- **2 minutes per consecutive loss** — stacks additively
- Example: 3 consecutive losses = 6-minute cooldown before next attack
- Resets when you successfully defend or win an attack

### Cascade Defense Penalty

When a territory is captured, all **adjacent plots** owned by the defender lose **1 defense level**. This creates a cascading vulnerability effect across border territories.

### Consecutive Loss Counter

- Each territory loss increments the counter
- Counter resets to 0 on any successful defense
- Affects both morale debuff duration and attack cooldown

---

## 16. Recon Drones

| Property | Value |
|----------|-------|
| **Cost** | 20 ASCEND per drone |
| **Duration** | 15 minutes per scout mission |
| **Maximum** | 5 drones per player (7 with Launchpad) |
| **Effect** | Reveals enemy resource stockpiles and improvement layouts |

### How Drones Work

1. Deploy a drone to a target plot (yours or enemy's)
2. Drone scouts for 15 minutes
3. When scouting completes, a report is available showing:
   - Iron, Fuel, Crystal stored on the target plot
   - All improvements and their levels
   - Current defense level

> **Tip:** Always scout before attacking high-value targets to calculate whether your attack power will overcome their defense.

---

## 17. Orbital Satellites

| Property | Value |
|----------|-------|
| **Cost** | 50 ASCEND per satellite (25 ASCEND with Launchpad) |
| **Duration** | 1 hour per orbit |
| **Maximum** | 2 per player (3 with Launchpad) |
| **Effect** | +25% mining yield on ALL owned parcels while active |

### Deployment

- Satellites are deployed globally — they boost all your plots, not just one
- Multiple satellites stack: 2 satellites = +50% mining yield
- Satellites appear on the 3D globe as orbital overlays
- Timer visible in the Resource HUD

---

## 18. Loot Boxes

Loot boxes are designed to contain randomized rewards including resources, ASCEND, rare minerals, and exclusive items.

> ✅ **Status: Live.** Mine/battle/orbital outcomes award boxes at runtime
> (`server/engine/lootbox/open.ts`, a deterministic per-action roll), and boxes are
> openable from the Inventory panel. Quantum Forge (Legendary) is the one trigger not
> yet wired up — it isn't in `LOOT_BOX_TRIGGERS` in `shared/schema.ts` today.

### How to Obtain

Each trigger awards a single box tier at the rate defined in `shared/schema.ts`:

| Source | Box tier | Drop chance |
|--------|----------|-------------|
| **Mining** (per action) | Common | 3% |
| **Battle Victory** | Rare | 25% |
| **Orbital Impact Event** | Epic | 50% |
| **Quantum Forge** (crafting) | Legendary | planned |

### Tiers & Contents

> Reward tables are weighted rolls defined in `shared/schema.ts`; the ranges below are
> illustrative of that live table, not hand-verified against every exact weight.

#### Common (Gray)

| Reward | Amount |
|--------|--------|
| Iron / Fuel | 50–200 |
| Crystal | 10–50 |
| ASCEND | 5–20 |
| Rare Mineral (random) | 1% chance of 1 unit |

#### Rare (Blue)

| Reward | Amount |
|--------|--------|
| Iron / Fuel | 200–500 |
| Crystal | 50–150 |
| ASCEND | 20–80 |
| Rare Minerals (random) | 15% chance of 2–5 units |
| 1h Satellite Boost | 5% chance |

#### Epic (Purple)

| Reward | Amount |
|--------|--------|
| Iron / Fuel | 500–1,000 |
| Crystal | 150–400 |
| ASCEND | 80–200 |
| Rare Minerals (guaranteed) | 5–10 units |
| Free Commander Reroll | 20% chance |
| 24h Double ASCEND | 10% chance |

#### Legendary (Gold)

| Reward | Amount |
|--------|--------|
| Iron / Fuel | 1,000–2,500 |
| Crystal | 400–1,000 |
| ASCEND | 200–500 |
| Rare Minerals (guaranteed) | 10–25 units (including 1–3 Dark Matter) |
| 24h Double ASCEND | Guaranteed |
| Exclusive Cosmetic Title | 25% chance |
| Golden Plot NFT Badge | 5% chance |

### Inventory Rules

- Maximum: **20 unopened boxes** at a time
- Must open boxes to make room for new drops
- Opening is instant with an animated reveal sequence
- Results are added to your inventory immediately

---

## 19. AI Factions

Four AI commanders compete alongside human players, each with a distinct strategy and personality.

### Faction Profiles

| Faction | Strategy | Aggression | Readiness Threshold | Min Defense Before Reconquest | Special Trait |
|---------|----------|-----------|--------------------|-----------------------------|---------------|
| **NEXUS-7** | Expansionist | 1.3x | 0.6 | 2 | Aggressive land grab, acquires adjacent unclaimed territory |
| **KRONOS** | Defensive | 0.6x | 1.2 | 5 | Fortifies heavily, slow to attack but hard to crack |
| **VANGUARD** | Raider | 1.4x | 0.5 | 1 | Prioritizes weak targets, raids for resources then may abandon |
| **SPECTRE** | Economic | 1.0x | 0.8 | 3 | Prefers high-richness plots, focuses on FRONTIER accumulation |

### Battle Modifiers

| Faction | Attack Modifier | Defense Modifier |
|---------|----------------|-----------------|
| NEXUS-7 | 1.2x | 1.0x |
| KRONOS | 0.9x | 1.3x |
| VANGUARD | 1.3x | 0.9x |
| SPECTRE | 1.0x | 1.0x |

### AI Behavior

- AI turns run every **2 minutes** on a server-side interval
- Each faction independently evaluates expansion, defense, and attack opportunities
- When suppressed, AI factions escalate attack posture

### Adaptive Dominance Regulation (ADR)

If any single AI faction exceeds **~2,000 plots (~10% of the map)**, the remaining factions automatically increase aggression to prevent runaway dominance. This creates a natural balancing mechanism — no single AI should dominate unchecked.

---

## 20. Reconquest System

When a human player captures an AI-held plot, the AI faction may attempt to reconquer it.

### Timing

| Phase | Duration | Description |
|-------|----------|-------------|
| **Grace Period** | 6 hours | AI cannot attempt reconquest during this window |
| **Reconquest Window** | 48 hours | AI must attempt reconquest within this period or forfeit the claim |
| **After Window** | Permanent | Plot is permanently yours (no further AI reconquest attempts) |

### Cost Escalation

Each time a plot changes hands, the reconquest cost increases by **+25%**. This makes repeatedly contested plots increasingly expensive for the AI to reclaim.

### Faction-Specific Behavior

- **NEXUS-7**: Low readiness threshold (0.6), will reconquest aggressively if it has resources
- **KRONOS**: Won't reconquest until it has defense level 5+ on its home territory
- **VANGUARD**: Reconquests are actually raids — may capture and abandon for resources
- **SPECTRE**: Only reconquests plots with richness 60+; ignores low-value territory

### Requirements

AI factions must own at least **3 territories** to attempt reconquest. Factions with fewer territories focus on expansion instead.

### Deterrence

Build up defense on captured plots during the 6-hour grace period. High defense levels can deter reconquest entirely — the AI will evaluate whether it has enough resources to overcome your defenses.

---

## 21. Orbital Events

### Event Types

| Event | Type | Description |
|-------|------|-------------|
| Meteor Shower | Cosmetic | Visual trail across the sky |
| Single Bolide | Cosmetic | Bright streak across the globe |
| Comet Pass | Cosmetic | Extended luminous trail |
| Orbital Debris | Cosmetic | Scattered debris field |
| Atmospheric Burst | Cosmetic / Impact | Flash effect, may affect gameplay |
| Impact Strike | Impact | Direct hit on a target plot |

### Cosmetic Events

- Generated client-side from a deterministic seed — all players see the same events
- 15-second epoch windows with up to 4 events per window
- No server communication required
- Visual-only — no gameplay effect

### Impact Events

- **Server-authoritative** — stored in the database
- **15% chance** per orbital check to generate an impact event
- Two possible effects:

| Effect | Modifier | Duration | Description |
|--------|----------|----------|-------------|
| **Resource Burst** | +50% yield | 10 minutes | Boosted mining output on affected plot |
| **Tile Hazard** | -40% yield | 8 minutes | Reduced mining output; -20% defense in battle |

> **Note:** Dark Matter is **not** exclusive to orbital events — it drops from normal mining in Swamp (3%), Water (2%), and Tundra (1%). See §4 for the full per-biome table.

---

## 22. Trading

### Peer-to-Peer Exchange

Players can trade resources directly with each other through the trading system.

### Tradeable Resources

- Iron
- Fuel
- Crystal
- FRONTIER (ASCEND)
- Rare Minerals (Xenorite, Void Shard, Plasma Core, Dark Matter)

### Trade Rules

| Rule | Value |
|------|-------|
| Minimum per trade | 1 unit |
| Maximum per trade | 10,000 units |
| Self-trade | Cannot trade a resource for itself |
| Order statuses | Open → Filled or Cancelled |

### How to Trade

1. Create a trade order: specify what you're giving and what you want
2. Your offer appears in the Trade Station for all players
3. Another player fills your order by providing what you want
4. Both sides receive their resources instantly
5. Cancel unfilled orders at any time

---

## 23. Seasons

Seasons are **~90-day meta-cycles** that add progression, phases, and competitive rewards to the persistent world.

### Season Phases

| Phase | Days | Modifiers |
|-------|------|-----------|
| **Expansion** | 1–30 | Land purchase prices -20%, welcome bonus doubled to 1,000 ASCEND, AI factions start with minimal territory |
| **Conflict** | 31–60 | Attack cooldowns -25%, pillage rate increased to 40% (from 30%), orbital event frequency doubled |
| **Domination** | 61–90 | ASCEND generation +50% globally, leaderboard positions locked in final 24h, Orbital Alien Dome bonus active |

### Season Rewards

Top 10 players at season end receive FRONTIER from the reward pool:

| Rank | Reward Share |
|------|-------------|
| 1st | 30% |
| 2nd | 20% |
| 3rd | 12% |
| 4th | 8% |
| 5th | 6% |
| 6th | 5% |
| 7th | 5% |
| 8th | 5% |
| 9th | 5% |
| 10th | 4% |

### Persistence

- **The world persists between seasons** — territory ownership, improvements, sub-parcels, and landmarks all carry forward
- Seasons add competitive layers on top of the persistent world
- Season-exclusive cosmetic titles and badges are awarded to top performers

### Countdowns

- Broadcast warnings at 24h, 6h, and 1h before season end
- Leaderboard positions lock in the final 24 hours — last-minute land grabs matter!

### Season Statuses

| Status | Meaning |
|--------|---------|
| `active` | Season is running, all phases apply |
| `settling` | Season ended, rewards being calculated |
| `complete` | Rewards distributed, next season pending |

### Orbital Alien Dome Integration

The player who builds the Orbital Alien Dome claims the Season Nexus. During the Domination phase, the Dome provides +100% ASCEND generation and the owner receives a bonus 5% of the season reward pool.

---

## 24. Token Economics

### Total Supply

**1,000,000,000 ASCEND** — immutable, set at ASA creation on Algorand TestNet.

### Supply Breakdown

| Metric | Description |
|--------|-------------|
| **Max Supply** | 1 billion ASCEND (on-chain ASA `total` field) |
| **In Circulation** | Tokens actively held by all players (DB: sum of `frntr_balance_micro`) |
| **Burned** | Tokens permanently spent in-game (commanders, facilities, drones, attacks) |
| **Treasury Reserve** | Undistributed tokens held by the admin wallet |

### Two-Layer Model

| Layer | Speed | Purpose |
|-------|-------|---------|
| **Database** | Instant | Source-of-truth for player balances; updated immediately on every action |
| **On-Chain** | Batched | Algorand ASA transfers settled in batches; may lag behind DB state |

### Welcome Bonus

- **500 ASCEND** credited on first wallet connection
- One-time only — tracked by `welcomeBonusReceived` flag

### Token Sinks

| Sink | Cost Range |
|------|-----------|
| FRONTIER Facilities | 30–480 ASCEND per level |
| Commander Minting | 50–400 ASCEND per tier |
| Special Attacks | 10–40 ASCEND per attack |
| Recon Drones | 20 ASCEND each |
| Orbital Satellites | 50 ASCEND each |
| Landmarks | 400–800 ASCEND each (+ rare minerals) |
| Loot Box Crafting | 5 Dark Matter + rare minerals per Legendary box |

---

## 25. Wallet Integration

### Supported Wallets

| Wallet | Platform | Connection Method |
|--------|----------|------------------|
| **Pera Wallet** | Mobile + Web | WalletConnect protocol |
| **LUTE Wallet** | Browser Extension | Direct injection |

### Connection Flow

1. Open the app — `WalletContext` checks `localStorage` for a saved wallet type
2. If a saved wallet is found, reconnection is attempted automatically
3. On successful connect: address saved to `localStorage`, ALGO balance fetched
4. Player record created (or loaded) from the server
5. Welcome bonus (500 ASCEND) granted if first-time player
6. ASA transfer fires in the background if opted in

### Network

- **Algorand TestNet** (chainId: 416002)
- All on-chain operations use TestNet ALGO
- Fund your wallet from the [Algorand TestNet Faucet](https://bank.testnet.algorand.network/)

### Opt-In

Your wallet must be opted into the FRONTIER ASA to receive ASCEND tokens and Plot NFTs on-chain. The app will prompt you to opt-in if needed.

### Tester Fallback

If no wallet is connected, a placeholder address (`PLAYER_WALLET`) is used so the UI remains fully functional. No on-chain operations are available in tester mode.

---

## 26. Glossary

| Term | Definition |
|------|-----------|
| **Plot** | One of 21,000 territorial units on the world map |
| **Parcel** | Synonym for plot; also refers to the data record of a plot |
| **Sub-Parcel** | One of 9 subdivisions within a macro-plot (3×3 grid) |
| **Biome** | Environmental type of a plot (Forest, Desert, Mountain, etc.) |
| **ASCEND** | FRONTIER token — the in-game currency on Algorand |
| **ASA** | Algorand Standard Asset — the token standard for ASCEND and NFTs |
| **NFT** | Non-Fungible Token — each purchased plot is minted as a unique ARC-3 NFT |
| **ARC-3** | Algorand Request for Comment #3 — the metadata standard for NFTs |
| **Commander** | A mintable avatar (Sentinel/Phantom/Reaper) that provides combat bonuses |
| **Landmark** | A mega-structure (Launchpad/Dome/Forge/Relay) with powerful unique effects |
| **Rare Mineral** | Advanced resource (Xenorite/Void Shard/Plasma Core/Dark Matter) for landmarks and endgame |
| **Loot Box** | Randomized reward container in four tiers (Common/Rare/Epic/Legendary) |
| **Reconquest** | AI faction's attempt to recapture a plot taken by a human player |
| **ADR** | Adaptive Dominance Regulation — auto-balancing mechanism for AI factions |
| **Morale Debuff** | Temporary attack power penalty after losing battles |
| **Pillage** | 30% resource theft on successful territory capture |
| **Season** | ~90-day competitive cycle with phases and rewards |
| **Fibonacci Sphere** | Mathematical distribution method for placing plots uniformly on a sphere |
| **Full Control Bonus** | +50% yield for owning all 9 sub-parcels of a plot |

---

*FRONTIER-AL Game Manual — Last updated March 2026*
