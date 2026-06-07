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

## ✅ Resolved (2026-06-07) — investigated against the reward services & synced

Both previously-flagged areas were verified against the runtime (`server/storage/db.ts`)
and the docs were updated to match.

### 1. Rare-mineral drop rates & gating — FIXED in `GAME_MANUAL.md` §4/§5/§21
- **Truth:** `server/storage/db.ts:697-701` rolls each biome's minerals as **independent
  per-mine probabilities** (the `schema.ts:20-29` values are absolute chances). Confirmed:
  Xenorite — Volcanic 8% / Mountain 4% / Desert 3% / Plains 2%; Void Shard — Tundra 6% /
  Forest 4% / Mountain 3% / Swamp 2%; Plasma Core — Volcanic 5% / Desert 5% / Forest 2% /
  Water 2%; Dark Matter — Swamp 3% / Water 2% / Tundra 1%.
- **Dark Matter is NOT orbital-only** — it drops from normal mining in Swamp/Water/Tundra,
  and there is **no separate orbital dark-matter roll** (`db.ts:346-376`). The §4/§5 tables
  and the §21 note were corrected; `QUICK_REFERENCE.md`, `LORE_CODEX.md`, and `handbook.html`
  now carry the accurate per-biome rates.
- **Vault:** 50 **per type**, enforced independently via SQL `LEAST()` (`db.ts:729-732`).

### 2. Loot boxes — `GAME_MANUAL.md` §18 marked PLANNED (not implemented)
- **Truth:** Trigger constants exist (`schema.ts:62-74`: mine→common 3%, battle→rare 25%,
  orbital→epic 50%) **but no runtime code awards or opens loot boxes** — `mineResources`,
  `resolveBattles`, and orbital resolution never roll them, there is no open endpoint, and
  `Player.lootBoxes` is hardcoded `[]` (`game-rules.ts:151`). The drop-table/contents
  constants (`schema.ts:36-60`) are never read.
- **Action taken:** §18 now carries a "Planned — not yet active" banner, its trigger table
  was corrected to the defined constants (3 / 25 / 50%), and the contents tables are labeled
  intended design. `QUICK_REFERENCE.md` carries the same "planned" note.
- **Remaining for engineering (not a docs issue):** either implement the loot system
  (award/open/reward logic) or keep it documented as planned.

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
1. The **three headline numbers** and both **flagged areas (rare minerals, loot boxes)** are
   now resolved — docs match the code/runtime as of 2026-06-07.
2. **Engineering follow-up (not docs):** decide whether to implement the loot-box system
   (award + open + reward logic) or leave it documented as planned.
3. Consider promoting key constants into the docs via a generated table to prevent future drift.
