# Battle Engine Audit

> READ-ONLY audit. Branch `claude/combat-upgrade-matrix-2a3gl2`. No code changed.
> Evidence is `file:line` against the repo at audit time. "NOT VERIFIED" = could not
> be confirmed from code in this pass.

## TL;DR

There **is** a real, deterministic battle engine — but it is the **parcel-invasion**
engine, and it is a **separate system** from the missile/artillery weapon engine. The
38 catalog weapons and their `damage` values are **not read** by the invasion engine.

## The invasion battle engine

- Core: `server/engine/battle/resolve.ts` — `resolveBattle(input)` and
  `resolveBattleFromPowers(...)`. Pure, deterministic, no DB/network/RNG except a
  seeded `mulberry32` (`resolve.ts:8`, `random.ts`).
- Constants centralized in `server/engine/battle/tuning.ts`.

### Formulas (verified)

Attacker power (`resolve.ts:31-35`):
```
attackerPower = troops*10 + iron*0.5 + fuel*0.8 + commanderBonus
```
Morale debuff (`resolve.ts:43-45`): `*0.85` when active.

Defender power (`resolve.ts:57-61`):
```
improvementBonus = Σ(level*5) for type ∈ {turret, shield_gen, fortress}
defenderPower   = (defenseLevel*15 + improvementBonus) * BIOME_DEFENSE_MOD
```
Biome mods (`tuning.ts:32-41`): mountain 1.4 … water 0.5.
Orbital hazard (`resolve.ts:69-70`): defender `*0.8` when active.

Outcome (`resolve.ts:122-132`):
```
randFactor ∈ [-10,+10] (seeded); attacker wins if attacker*(1+rand/100) > defender
```
Pillage (`resolve.ts:141-143`): 30% of stored resources on attacker win, else 0.

### What feeds it

- **Commanders** → `commanderBonus` (attacker term). Wired.
- **turret / shield_gen / fortress** → `improvementBonus` (defender term). Wired.
- **radar** → applied as `*0.9` attacker debuff at input-build time
  (`server/storage/db.ts:1259`), not via `improvementBonus`. Wired.
- **biome / defenseLevel** → defender term. Wired.

### State machine

There is **no explicit battle state machine**. Battles are a snapshot resolution:
powers are locked at launch (`resolve.ts:101-106` comment) and resolved as a single
deterministic computation, with a textual `BattleLogEntry[]` for phases
(`power_calc`, `morale`, `terrain`, `resolution`). The client renders a *simulated*
progress timer + 8 seeded log lines in `BattleWatchModal.tsx`, and can fetch a real
replay via `GET /api/battle/replay/:battleId`.

## The weapon engagement engine (separate)

- `server/weapons/engagementStore.ts` + `shared/weapons/{ballistics,intercept}.ts`.
- Handles launch → time-of-flight → layered interception (seeded Pk) → status
  `in_flight | intercepted | impacted`.
- Deterministic, unit-tested.

### The gap

- Weapon `damage` is used inside the engagement store, but **who applies an
  `impacted` engagement's damage to the target parcel's defense/resources is NOT
  VERIFIED** — the path from "missile impacts" to "parcel state changes / invasion
  outcome changes" was not found in code. (Sub-agent 1 flagged the same.)
- Net effect: the weapon system currently behaves as a **fire-FX + ASCEND sink**
  layered over the globe, not as an input to `resolveBattle`.

## Verdicts

- **Is there a battle engine?** Yes — deterministic, tested (`resolve.spec.ts`).
- **Can a player engage?** Yes, via parcel invasion (`Initiate Invasion`).
- **Can a player fire a weapon?** The server route exists (`/api/weapons/fire`) and
  FX render, but **no in-game fire button** calls it (see combat-ui-audit.md).
- **Do weapons affect the battle outcome?** **NOT VERIFIED / appears not wired** —
  weapon damage is not an input to `resolveBattle`.
- **Do land upgrades affect outcome?** Yes for turret/shield_gen/fortress/radar.
- **Smallest playable loop:** wire one offensive weapon's `fire` into the HUD and make
  an `impacted` shot apply a concrete, tested effect (e.g. reduce target `defenseLevel`
  or pillage), so a fired weapon demonstrably changes parcel state. See
  `first-playable-combat-loop.md`.
