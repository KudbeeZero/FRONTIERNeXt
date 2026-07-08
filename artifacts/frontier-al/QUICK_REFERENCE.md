<div align="center">

```
   .  ✦      .         *           .          ✦      .       .
       ┌───────────────────────────────────────────────────┐
   *   │   ⚡  F R O N T I E R   Q U I C K   R E F E R E N C E │   .
       │        one-screen field card · all the numbers      │
       └───────────────────────────────────────────────────┘
   .        *          .              .         *        .
```

# ⚡ Quick Reference Card

**FRONTIERNeXt** · Commander cheat-sheet

<a href="../../README.md"><img src="https://img.shields.io/badge/⟵_Docs_Home-0B0E2A?style=for-the-badge" alt="Docs Home"></a>
<a href="GAME_MANUAL.md"><img src="https://img.shields.io/badge/📖_Manual-2D7FF9?style=for-the-badge&labelColor=0B0E2A" alt="Manual"></a>
<a href="STRATEGY_GUIDE.md"><img src="https://img.shields.io/badge/🎯_Strategy-2EE6A6?style=for-the-badge&labelColor=0B0E2A" alt="Strategy"></a>
<a href="GLOSSARY.md"><img src="https://img.shields.io/badge/📒_Glossary-B26BFF?style=for-the-badge&labelColor=0B0E2A" alt="Glossary"></a>

</div>

> Every number on this card is sourced from the **[Game Manual](GAME_MANUAL.md)** — your
> single source of truth. Use this page as the fast lookup; use the manual for the *why*.

---

## 🗺️ Biomes — Cost & Signature

| Biome | Claim (ALGO) | Standout Modifier | Battle Defense |
|-------|:---:|---|:---:|
| 🏜️ Desert | 0.2 | Fuel **2.5×** | Low |
| 🌾 Plains | 0.3 | All **1.0×** (baseline) | Average |
| 🐊 Swamp | 0.3 | Crystal **2.0×** | Weak |
| 🧊 Tundra | 0.4 | Fuel **1.8×** | **1.2×** |
| 🌲 Forest | 0.5 | Crystal **1.5×** | Decent |
| ⛰️ Mountain | 0.8 | Iron **2.0×** | **1.4×** (best) |
| 🌋 Volcanic | 1.0 | Iron **1.8×** + Crystal **2.5×** | Fragile |
| 🌊 Water | 1.5 | Crystal **3.0×** | **0.5×** (near-uncapturable) |

> Plot **richness** (1–100, fixed at generation) further scales all yields.

---

## ⛏️ Mining

| Property | Value |
|---|---|
| Cooldown | **5 min** (300,000 ms) per plot |
| Yield formula | `baseYield × biomeMod × (richness / 100)` |
| Collect | **Collect** action gathers all owned plots at once |
| Cooldown reduction (AI Lab) | Lv1 −30s · Lv2 −60s · Lv3 −90s |

---

## 💠 Rare Minerals

| Mineral | Drop chance per mine (by biome) | Used For |
|---|---|---|
| Xenorite | Volcanic 8% · Mountain 4% · Desert 3% · Plains 2% | Launchpad, Quantum Forge |
| Void Shard | Tundra 6% · Forest 4% · Mountain 3% · Swamp 2% | Orbital Alien Dome, upgrades |
| Plasma Core | Volcanic 5% · Desert 5% · Forest 2% · Water 2% | Launchpad ops, siege weaponry |
| Dark Matter | Swamp 3% · Water 2% · Tundra 1% | Orbital Alien Dome, endgame |

> Each mine rolls independently per mineral (per `shared/schema.ts` / `server/storage/db.ts`).
> Vault holds **50 per type**, separate from normal storage.

---

## 🛡️ Defense Improvements *(Iron / Fuel)*

| Improvement | Iron | Fuel | Max Lv | Effect / Level |
|---|:---:|:---:|:---:|---|
| Turret | 40 | 20 | 3 | +3 defense |
| Shield Generator | 60 | 40 | 2 | +5 defense |
| Storage Depot | 35 | 15 | 3 | +200 capacity |
| Radar Array | 45 | 35 | 1 | −10% incoming attack power |
| Fortress | 200 | 150 | 1 | +8 defense, +50 storage |

> In battle, each improvement **level = 5 defense power** (`IMPROVEMENT_DEFENSE_PER_LEVEL`).

## 🔧 Base Upgrades *(one-time, Iron / Fuel)*

| Upgrade | Iron | Fuel | Effect |
|---|:---:|:---:|---|
| Defense | 50 | 25 | +1 defense level (→ +15 battle power) |
| Yield | 75 | 50 | +20% all yields (permanent) |
| Mine | 100 | 75 | +10 richness (recovers depletion) |
| Bunker | 150 | 100 | +5 influence repair/day |

---

## 🏭 FRONTIER Facilities *(burn ASCEND · Electricity required first)*

| Facility | Prereq | Lv1 | Lv2 | Lv3 | Effect |
|---|---|:---:|:---:|:---:|---|
| Electricity | — | 30 | — | — | +1 ASCEND/day, unlocks the rest |
| Blockchain Node | Electricity | 120 | 270 | 480 | +2 / +3 / +4 ASCEND/day |
| Data Centre | Electricity | 120 | 270 | 480 | +5% / +10% / +15% yield |
| AI Lab | Electricity | 120 | 270 | 480 | −30s / −60s / −90s cooldown |

**Max ASCEND/plot/day = 6** (Base 1 + Electricity 1 + Blockchain Node Lv3 +4).
Data Centre & AI Lab give **0 ASCEND** — they boost yield / cut cooldown instead.
Max-output investment per plot: **900 ASCEND** (30 + 120 + 270 + 480).

---

## 🎖️ Commanders *(mint by burning ASCEND · 12h lock after deploy)*

| Tier | Cost | ATK | DEF | Ability | Max Concurrent Attacks |
|---|:---:|:---:|:---:|---|:---:|
| Sentinel | 50 | +10% | +10% | Fortify | 1 |
| Phantom | 150 | +18% | +6% | Cloak | 2 |
| Reaper | 400 | +30% | +5% | Annihilate | 3 |

## 💥 Special Attacks *(need active commander)*

| Attack | Cost | Cooldown | Mult | Effect | Tier |
|---|:---:|:---:|:---:|---|---|
| Orbital Strike | 25 | 30 min | 3.0× | Ignores 50% of defense | Any |
| EMP Blast | 15 | 20 min | 1.5× | Disables improvements 10 min | Phantom+ |
| Siege Barrage | 40 | 45 min | 2.0× | Hits up to 3 nearby plots | Reaper |
| Sabotage | 10 | 15 min | 0.5× | Halves enemy yield 30 min | Phantom+ |

> **Combo:** EMP Blast → Orbital Strike shreds fortified targets.

---

## ⚔️ Combat Math

```
attackerPower = (troops × 10) + (iron_burned × 0.5) + (fuel_burned × 0.8) + commanderBonus
defenderPower = (defenseLevel × 15 + improvementBonus) × biomeDefenseMod
```

- **Battle duration:** 10 min (600,000 ms), resolved server-side
- **Morale debuff:** attacker power × 0.85 (−15%) · **UI shows 25%** as a deterrent
- **Random factor:** ±10% swing on power
- **Orbital hazard:** defender power −20% if active
- **Win:** `attackerPower > defenderPower` → capture
- **Pillage:** winner steals **30%** of stored Iron/Fuel/Crystal

### Morale & Cooldowns *(stack per consecutive loss, reset on a win/defense)*
| Penalty | Value |
|---|---|
| Morale debuff | 5 min base × consecutive losses (−15% ATK) |
| Attack cooldown | 2 min × consecutive losses |
| Cascade penalty | Captured plot's adjacent allies lose 1 defense level |

---

## 🛰️ Recon Drones & Orbital Satellites

| | Drone | Satellite |
|---|---|---|
| Cost | 20 ASCEND (10 w/ Launchpad) | 50 ASCEND (25 w/ Launchpad) |
| Duration | 15 min | 1 hour |
| Max | 5 (7 w/ Launchpad) | 2 (3 w/ Launchpad) |
| Effect | Reveals enemy resources + improvements | +25% mining on **all** plots (stacks) |

---

## 🧩 Sub-Parcels

- Macro-plot → **3×3 grid (9 sub-parcels)**, human-only
- Requires **4-hour ownership hold**; cost **10–100 ASCEND** by biome
- Each sub-parcel = **1/9** of parent daily ASCEND
- **Own all 9 → +50% yield** on that plot (e.g. 6 → 9 ASCEND/day)
- Sub-parcels inherit parent defense; can be captured independently

---

## 🏛️ Landmarks *(1 per player · Dome = 1 per server)*

| Landmark | Cost | Requires | Headline Effect |
|---|---|---|---|
| 🚀 Launchpad | 500 ASCEND + 50 Xenorite + 30 Plasma Core | 10+ plots, Electricity | −50% drone/sat cost, +slots, Deep Space Probe |
| 🛸 Orbital Alien Dome | 800 ASCEND + 40 Void Shard + 20 Dark Matter | 25+ plots, active season | +100% ASCEND in season, +5% reward pool to owner |
| ⚗️ Quantum Forge | 600 ASCEND + 30 Xenorite + 25 Void Shard + 10 Plasma Core | 15+ plots, Data Centre Lv2+ | Refine minerals, Legendary box / 48h, +30% Crystal |
| 📡 Ancient Relay | 400 ASCEND + 20 Plasma Core + 15 Void Shard | 20+ plots, AI Lab Lv2+ | Teleport resources, +2 ASCEND/day, −25% attack cooldown |

---

## 🎁 Loot Boxes *(max 20 unopened)*

**Designed drop triggers** (per `shared/schema.ts`)

| Source | Box tier | Drop chance |
|---|---|:---:|
| Mining (per action) | Common | 3% |
| Battle victory | Rare | 25% |
| Orbital impact | Epic | 50% |
| Quantum Forge | Legendary | planned |

> ✅ **Live.** Boxes are awarded on these triggers at runtime (`server/engine/lootbox/open.ts`,
> deterministic per-action roll) and are openable from the Inventory panel
> (`InventoryPanel.tsx`). Quantum Forge (Legendary) is the one trigger still unimplemented —
> `LOOT_BOX_TRIGGERS` in `shared/schema.ts` only defines mine/battle/orbital today.

---

## 🤖 AI Factions

| Faction | Doctrine | Aggression | ATK / DEF | Soft Spot |
|---|---|:---:|:---:|---|
| 🔵 NEXUS-7 | Expansionist | 1.3× | 1.2× / 1.0× | Thinly-defended frontier plots |
| 🟣 KRONOS | Defensive | 0.6× | 0.9× / 1.3× | Passive — cedes open ground |
| 🔴 VANGUARD | Raider | 1.4× | 1.3× / 0.9× | Weakest defense (best prey) |
| 🟢 SPECTRE | Economic | 1.0× | 1.0× / 1.0× | Values richness over armor |

- **AI turn interval:** every 2 min · **ADR triggers** when a faction passes ~2,000 plots (~10%)
- **Reconquest:** 6h grace → 48h window → permanent; cost +25% each change of hands

---

## 🌗 Seasons *(~90 days, 3 phases)*

| Phase | Days | Modifiers |
|---|---|---|
| 🌱 Expansion | 1–30 | Land −20%, welcome bonus ×2 (1,000), AI starts small |
| ⚔️ Conflict | 31–60 | Cooldowns −25%, pillage 40%, 2× orbital events |
| 👑 Domination | 61–90 | +50% ASCEND globally, board locks final 24h |

**Reward pool (top 10):** 30 / 20 / 12 / 8 / 6 / 5 / 5 / 5 / 5 / 4 %

---

## 🪙 ASCEND Essentials

| | |
|---|---|
| Total supply | 1,000,000,000 (immutable ASA) · 6 decimals |
| Welcome bonus | 500 ASCEND (one-time) |
| Two-layer model | DB = instant authoritative · On-chain = batched |
| Sinks | Facilities 30–480 · Commanders 50–400 · Special attacks 10–40 · Drone 20 · Satellite 50 |

**Trading:** 1–10,000 units/order · can't self-trade · Open → Filled/Cancelled.

---

<div align="center">

<a href="../../README.md"><img src="https://img.shields.io/badge/⟵_Back_to_Docs_Home-0B0E2A?style=for-the-badge" alt="Back to Docs Home"></a>
<a href="GAME_MANUAL.md"><img src="https://img.shields.io/badge/📖_Full_Manual-2D7FF9?style=for-the-badge&labelColor=0B0E2A" alt="Manual"></a>

<sub>🛰️ FRONTIERNeXt · Claim your sky.</sub>

</div>
