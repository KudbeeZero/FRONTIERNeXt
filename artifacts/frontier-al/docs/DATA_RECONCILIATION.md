# Documentation ↔ Code Data Reconciliation

**Date:** 2026-06-07 · **Scope:** game-balance numbers in the player docs vs. the
authoritative source constants. **Source of truth:** code (`shared/schema.ts`,
`shared/economy-config.ts`, `server/engine/battle/tuning.ts`,
`server/storage/game-rules.ts`).

This audit was run while building the documentation hub (Getting Started, FAQ, Lore
Codex, Quick Reference, Glossary, Tokenomics). No source code was modified.

---

## ✅ Headline result

A conflict existed between the **old README** (which embedded a full manual inline)
and **`GAME_MANUAL.md`** on three player-critical numbers. **Code confirms the
manual was correct in all three cases.** The conflicting README tables were the
erroneous copy and have been removed; the README is now a clean hub.

| # | Item | Old README | Manual | **Code (truth)** | Verdict |
|---|------|-----------|--------|------------------|---------|
| a | Plot price — Volcanic / Water | 0.8 / (absent) | 1.0 / 1.5 | **1.0 / 1.5** (`economy-config.ts:65`) | Manual ✅ |
| b | Mountain iron multiplier | −40% (0.6×) | 2.0× | **2.0×** (`schema.ts:103`) | Manual ✅ |
| c | Max FRNTR/day per plot | 12 | 6 | **6** (`schema.ts:144`+`economy-config.ts:39`) | Manual ✅ |

All new hub docs are aligned to these verified values.

---

## ✅ Verified consistent (manual & new docs match code)

| System | Status | Source |
|--------|--------|--------|
| Plot prices (all 8 biomes, production) | ✅ exact | `economy-config.ts:65-74` |
| Biome resource multipliers (Iron/Fuel/Crystal) | ✅ exact | `schema.ts:99-110` |
| Battle defense mods (Mountain 1.4× … Water 0.5×) | ✅ exact | `tuning.ts:32-41` |
| Mining cooldown 5 min, base yields 20/12/4 | ✅ exact | `schema.ts:553-555` |
| Base storage 800; Storage Depot +200/level | ✅ exact | `schema.ts:556`, `:121-133` |
| Facilities: costs 30/120/270/480 & per-day effects | ✅ exact | `schema.ts:144-179` |
| Defense improvements & `IMPROVEMENT_DEFENSE_PER_LEVEL = 5` | ✅ exact | `schema.ts:121-133`, `tuning.ts:23` |
| Base upgrades (Defense/Yield/Mine/Bunker) | ✅ exact | `schema.ts:557-562` |
| Commanders (50/150/400, ATK/DEF %, 12h lock) | ✅ exact | `schema.ts:578,593-633` |
| Special attacks (cost/cooldown/multiplier/tier) | ✅ exact | `schema.ts:642-687` |
| Combat formula (10×/0.5×/0.8×, def×15, 30% pillage, ±10%, hazard −20%) | ✅ exact | `tuning.ts:10-73` |
| Morale debuff 15% (UI shows 25%) | ✅ matches manual's own note | `tuning.ts` / `schema.ts` |
| Drones (20 FRNTR, max 5, 15 min) | ✅ exact | `schema.ts:698-700` |
| Satellites (50 FRNTR, max 2, 1 h, +25%) | ✅ exact | `schema.ts:721-724` |
| Sub-parcels (4 h hold, 10–100 FRNTR, +50% full control) | ✅ exact | `schema.ts:799-806`, `game-rules.ts:337-341` |
| Rare-mineral vault cap 50/type | ✅ exact | `schema.ts:11` |
| Token: 1B supply, welcome 500, test 50/prod 1 emission | ✅ exact | `schema.ts:566-567`, `economy-config.ts:36-39` |
| Sub-parcel 70/30 fee split & treasury settlement | ✅ matches `ECONOMICS.md` | `ECONOMICS.md`, `game-rules.ts` |

> Note on **crystal in combat**: code defines `CRYSTAL_POWER_FACTOR = 1.2`
> (`tuning.ts`), i.e. crystal *can* contribute to attack power. The manual's attacker
> formula omits crystal. Minor omission, not an error — flagged for completeness.

---

## ⚠️ Flagged — manual diverges from code (recommend dev confirmation)

These two areas show the **manual's numbers differing from `shared/schema.ts`**. The
relevant reward/gating logic may also live in service files not read in this pass, so
they are **flagged, not rewritten** — the team should confirm intended values before
changing player canon. The new hub docs avoid asserting the contested figures.

### 1. Rare-mineral drop rates & gating
- **Manual (§4/§5):** Xenorite 2% (Volcanic/Mountain), Void Shard 1.5% (Tundra/Water),
  Plasma Core 1% (Desert/Swamp), Dark Matter 0.3% **orbital-events-only**.
- **Code (`schema.ts:20-29`):** per-biome drop tables that differ, e.g. Volcanic
  Xenorite **0.08**, Volcanic Plasma **0.05**, Forest Void Shard **0.04**, and
  **Dark Matter appears in normal biome tables** (Swamp 0.03, Water 0.02, Tundra 0.01),
  not exclusively from orbital impacts.
- **Action:** Confirm whether `schema.ts:20-29` is the live per-mine probability and
  whether Dark Matter has additional event-gating. Then sync the manual's §4/§5 tables.

### 2. Loot-box drop rates & contents
- **Manual (§18):** Mining common **5%** / rare 1% / epic 0.2%; battle victory rare 15%;
  rich per-tier contents (Iron/Fuel/Crystal/FRNTR amounts + cosmetics).
- **Code (`schema.ts:36-74`):** Mine→common **3%**, battle-victory→rare **25%**,
  orbital-impact→epic **50%**; loot tables enumerate **rare minerals only** (no
  Iron/Fuel/FRNTR/cosmetic amounts in the schema read).
- **Action:** Confirm where box *contents* (resource/FRNTR/cosmetic rewards) are
  computed; if a service layer supplies them, the manual may be correct there. Sync the
  trigger percentages either way.

---

## Items not found in the code read (documented from the manual only)
- **Landmarks** (Launchpad, Orbital Alien Dome, Quantum Forge, Ancient Relay) — costs &
  effects come from `GAME_MANUAL.md`; not located in the files read. New docs cite the
  manual as source.
- **Season phase day-ranges & reward-pool split** — manual-sourced; the season *struct*
  exists in code (`schema.ts:967-987`) but phase modifiers/day ranges were not found there.
- **ASA ID `755818217`** and **decimals 6** — documented (README/ECONOMICS), not in the
  constants read.

---

## Recommendation
1. Treat the **three headline numbers as resolved** — code confirms the manual; new docs are correct.
2. Have a developer confirm the **rare-mineral** and **loot-box** values against the live
   reward services, then update `GAME_MANUAL.md` §4/§5/§18 to match. Once confirmed, the
   Quick Reference can carry exact figures.
3. Consider promoting key constants into the docs via a generated table to prevent future drift.
