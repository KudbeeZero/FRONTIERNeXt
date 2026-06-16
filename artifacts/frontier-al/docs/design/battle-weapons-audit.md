# Weapon System Audit

> READ-ONLY audit. Companion to `battle-weapons-matrix.csv` (all 38 weapons).

## Inventory (verified)

38 weapons in `shared/weapons/`, aggregated by `catalog.ts` (`ALL_WEAPONS`):

| Line | Count | File | Category field |
|---|---|---|---|
| Ballistic missiles | 4 | missiles.ts | `ballistic` |
| Cruise missiles | 4 | missiles.ts | `cruise` |
| Hypersonic missiles | 4 | missiles.ts | `hypersonic` |
| Towed artillery | 4 | artillery.ts | `artillery` |
| Rocket artillery + MLRS | 8 | artillery.ts | `rocket_artillery` |
| Anti-air interceptors | 8 | antiAir.ts | `anti_air` (defensive) |
| Missile-defense batteries | 6 | defense.ts | `missile_defense` (defensive) |

`validateCatalog()` (`catalog.ts:54`) enforces: positive range/speed/damage/cost/cooldown,
defensive ⇔ has `intercept` envelope, `basePk ∈ [0,1]`, `magazine > 0`, no dup ids.

## Field completeness (`WeaponSpec`, `shared/weapons/types.ts`)

Present for every weapon: `id, name, category, tier, realWorldRef, rangeKm, speedMps,
flightProfile, guidance, payloadKg, cepM, damage, splashRadius, cooldownMs, costAscend,
attributeAffinity, unlock{badge,tier}` (+ `intercept` for defensive).

**MISSING field: `description`.** There is no player-facing description field — only
`name` and `realWorldRef`. This is the direct cause of the user's "descriptions missing
or weak." Recommendation: add an optional `description` to `WeaponSpec` and populate it,
or render `realWorldRef` + derived stat blurb in the UI.

## Pricing (verified, `shared/weapon-economy.ts`)

Derived from each spec's `costAscend` (per-shot fire cost):
- Fire = `costAscend` · (prod) / `×0.25` (test)
- Unlock = `costAscend × 6`
- Upgrade to tier N = `costAscend × 3 × N`
- Deploy battery = `costAscend × 4`

So **prices are NOT missing** — every weapon has a fire cost, and unlock/upgrade/deploy
are formula-derived. (UI note: ArmoryPanel labels the cost "FR", while the economy unit
is ASCEND — a labeling inconsistency to reconcile.)

## Progression model (important nuance)

Weapons do **not** have per-weapon levels 1–5. Each "tier" is a **separate spec** (e.g.
`msl_ballistic_1..4`) gated by a **badge tier** earned through combat stats
(`shared/weapons/{attributes,badges,archetypes,unlocks}.ts`). The requested
`upgrade_cost_l1..l5` columns therefore don't map; the CSV records `tier` + the
tier-upgrade formula instead.

## Firing path (verified)

`server/weapons/service.ts:fireWeapon` → validate ownership + range (`inRange`, great-circle)
→ spend ASCEND → `engagementStore.launch` → time-of-flight + layered interception →
status. Broadcast as `weapon_engagement` WS event → client `LiveWeaponLayer` renders.

## Verdicts

- **Can weapons be fired?** Logic yes; **no in-game fire button** wires `/api/weapons/fire`.
- **Are upgrades priced?** Yes (formula-derived from `costAscend`).
- **Do upgrades change stats?** Higher tier = stronger spec (separate spec), gated by badge.
- **Are descriptions good enough?** **No** — there is no `description` field at all.
- **Do weapons affect the invasion battle math?** **NOT VERIFIED** — `damage` is not an
  input to `resolveBattle`; impact-application path not found.
- **Immediate cleanup:** add `description`; fix "FR" vs "ASCEND" label; decide whether
  weapons feed the invasion engine or remain a separate strike layer (and document it).
