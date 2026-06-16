# Land / Parcel Upgrade → Combat Audit

> READ-ONLY audit. Companion to `land-upgrades-combat-matrix.csv`.

## Canonical vocabulary (verified, `shared/schema.ts`, `server/db-schema.ts`)

- **Plot / Parcel** — synonyms. The in-code type is `LandParcel`; the table is `parcels`.
  21,000 of them, lat/lng + biome + owner + resources.
- **Sub-parcel** — a 1/9 subdivision of a plot (3×3 grid), human-exclusive, individually
  owned (`schema.ts:814`).
- **Improvement** — any built structure, stored as `{type, level}[]` on a parcel.
  Two classes: **defense improvements** (turret, shield_gen, fortress, radar,
  storage_depot — cost iron/fuel) and **facilities** (electricity, blockchain_node,
  data_centre, ai_lab — cost ASCEND).
- **Archetype** — sub-parcel role (resource/trade/fortress/energy) gating buildables.
- "Upgrade" / "module" are loose synonyms for building/leveling an improvement.

## What actually affects battle (verified)

| Improvement | Battle effect | Wired? | Evidence |
|---|---|---|---|
| turret | +5 defender power / level | YES | resolve.ts:57-59 |
| shield_gen | +5 defender power / level | YES (power) | resolve.ts:57-59 |
| fortress | +5 defender power | YES | resolve.ts:57-59 |
| radar | ×0.9 attacker power | YES | storage/db.ts:1259 |
| defenseLevel | ×15 defender (base term) | YES | resolve.ts:61 |
| storage_depot | none (storage cap only) | NO | storage/db.ts:1085 |
| electricity / blockchain_node | none (ASCEND/day) | NO | schema.ts:1140 |
| data_centre | **claims +yield, not applied** | **NOT WIRED** | storage/db.ts:1086 |
| ai_lab | **claims -cooldown, not applied** | **NOT WIRED** | schema.ts:568 |

## Honest flags

- **data_centre**: a `yieldMultiplier` is computed (`db.ts:1086`) but never multiplied
  into mining yield (`BASE_YIELD` is hardcoded) — its advertised +5/10/15% does nothing
  observable. NOT VERIFIED that it affects anything.
- **ai_lab**: cooldown reduction is advertised but `MINE_COOLDOWN_MS` is hardcoded and
  nothing reads `ai_lab` level — NOT WIRED.
- **fortress**: schema text implies +8 defense / +50 storage, but the battle engine
  treats it like any improvement (`level*5`). Reconcile the description with the math.
- **shield_gen** "reduces influence loss" is computed but unused in outcome — NOT VERIFIED.
- **Level 2+**: turret/shield_gen/storage_depot scale linearly with level and ARE read
  per-level in battle (turret/shield_gen) — so level 2+ defense upgrades do work. The
  facility level scaling (blockchain_node) works for ASCEND/day; data_centre/ai_lab
  levels do not.

## Parcel acquisition / unlock (verified)

- **Plot**: buy with ALGO (`/api/actions/purchase`); biome-priced (0.2–1.5 ALGO prod,
  0.1 test). Immediately buildable; facilities gated behind electricity.
- **Sub-parcel**: unlocked by the plot owner subdividing after a hold period; then any
  player buys for 50 ASCEND; assign archetype to gate buildables.
- Progression is **real**, not placeholder, but is economy/ownership-driven; there is no
  combat-XP-gated parcel unlock.

## Verdicts

- **Do land upgrades work?** Defense improvements: yes. data_centre/ai_lab: no.
- **Do they affect battle?** turret/shield_gen/fortress/radar/defenseLevel: yes.
- **Do level 2+ upgrades apply?** Yes for the battle-wired defense improvements.
- **Do upgrades unlock parcels?** No — parcels are economy/ownership-gated, not upgrade-gated.
- **Are parcel unlocks real?** Yes (purchase + subdivide flows are implemented).
- **Smallest safe wiring:** none needed for the invasion path (already wired). The
  highest-value cleanup is deciding data_centre/ai_lab: wire them or label their effects
  PROPOSED/inactive so the UI stops over-claiming.
