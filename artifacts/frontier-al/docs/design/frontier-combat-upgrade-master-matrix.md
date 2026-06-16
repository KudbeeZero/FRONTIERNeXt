# FRONTIER Combat + Upgrade Master Matrix

> Narrative companion to `frontier-combat-upgrade-master-matrix.csv`. READ-ONLY audit,
> branch `claude/combat-upgrade-matrix-2a3gl2`. All numbers are PRODUCTION-mode unless
> noted; TEST mode applies discounts (weapons ×0.25; land/facility have separate test
> tables). Nothing here invents balance numbers — every value is from code, or labeled
> PROPOSED / MISSING / NOT VERIFIED.

## The one big finding

FRONTIER-AL has **two parallel combat systems that are not connected**:

1. **Invasion engine** — `server/engine/battle/resolve.ts`. Troops + burned
   resources + commander vs. defenseLevel + defense improvements + biome. Deterministic,
   tested, and **this is what land upgrades and commanders feed**. Driven by the
   "Initiate Invasion" button + `BattleWatchModal`.
2. **Weapon engine** — `shared/weapons/**` + `server/weapons/**`. 38 missiles/artillery/
   AA/defense specs with ballistics + layered interception + live globe FX. Driven by
   the `/armory` route and `/api/weapons/fire`.

The 38 weapons' `damage` is **not an input to the invasion engine**, and the path from a
weapon "impact" to any parcel-state change is **NOT VERIFIED**. So today, firing a weapon
is essentially **FX + an ASCEND sink**, while the upgrade that actually wins land battles
is the humble turret. Closing this gap is the heart of "make combat playable."

## System status at a glance

| System | Exists | Priced | Affects invasion battle | UI to use it |
|---|---|---|---|---|
| Land defense (turret/shield_gen/fortress/radar) | ✅ | ✅ iron+fuel | ✅ | ✅ build |
| Base defenseLevel | ✅ | ✅ | ✅ | ✅ |
| Commanders (sentinel/phantom/reaper) | ✅ | ✅ ASCEND | ✅ (commanderBonus) | ✅ deploy |
| storage_depot | ✅ | ✅ | ❌ (storage only) | ✅ |
| electricity / blockchain_node | ✅ | ✅ | ❌ (ASCEND/day) | ✅ |
| data_centre | ✅ | ✅ | ❌ **claims yield, not wired** | ✅ |
| ai_lab | ✅ | ✅ | ❌ **claims cooldown, not wired** | ✅ |
| Offensive weapons (24) | ✅ | ✅ | ⚠️ NOT VERIFIED | ⚠️ armory only, no fire button |
| Defensive weapons (14) | ✅ | ✅ | defensive (intercept) | ⚠️ no deploy UI |
| Special attacks | ✅ | ✅ | ⚠️ orbital_strike maybe; rest NOT VERIFIED | ✅ action |

## Things that are real

- Deterministic invasion engine with seeded RNG and 244 passing server tests.
- A complete, validated 38-weapon catalog with real-world-grounded stats.
- Formula-driven weapon economy (fire/unlock/upgrade/deploy).
- Live weapon FX on the globe driven by WS engagement events.

## Things that are placeholder / duplicated / missing

- **Missing descriptions:** `WeaponSpec` has **no `description` field** (only `name` +
  `realWorldRef`). All 38 weapons read as MISSING description.
- **Not wired:** `data_centre` yield bonus, `ai_lab` cooldown bonus.
- **NOT VERIFIED:** weapon→invasion damage link; special-attack effects; shield_gen
  influence-loss reduction.
- **Duplicated verbs:** "Initiate Invasion" vs. weapon firing — two attack paths with no
  visible relationship.
- **Label bug:** Armory shows "FR" where the unit is ASCEND.

## What should affect combat first (recommendation)

Pick **one offensive weapon line** (towed artillery — cheapest, `art_towed_1` fire = 4
ASCEND) and make a fired+`impacted` shot apply a **concrete, tested** effect to the target
parcel (reduce `defenseLevel` or pillage a small fixed fraction). That single wiring turns
the weapon system from cosmetic into the start of a real loop, without touching chain,
admin, or the globe render core.

## Proposed first playable battle loop

See `first-playable-combat-loop.md`. Scope is deliberately tiny and testable.
