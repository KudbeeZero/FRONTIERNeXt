# FRONTIER Battle Engine Truth and Target Architecture

**Authority:** This document is the canonical battle-engine truth for FRONTIER-AL.  
**Evidence date:** 2026-07-12  
**Governing commit:** `2139865` (PR #251 merged)  
**Status:** Documentation-only. No runtime behavior changed.

---

## 1. Executive Verdict

The live battle engine is **operationally correct and deterministic**, but it does **not yet represent the intended strategic war system**.

**What works today:**
- Deterministic resolution with provable fairness (public seed, mulberry32 PRNG)
- Human and AI attacks share the same canonical `deployAttack()` path
- Idempotency prevents double-spend on plot attacks (PR #250)
- Resource accounting is transactional and atomic
- Capture, cooldown, and morale debuff are correctly persisted
- Battle proof and replay log enable independent verification

**What is missing:**
- Weapon archetypes are displayed but not consumed by the resolver
- Energy alignments are stored but have zero gameplay effect
- Sub-parcel archetypes are persisted but not consumed by plot attacks
- Attack doctrines do not exist in the schema or resolver
- CombatProfile and BattleSnapshot contracts exist but are not integrated
- Facility integrity, damage, repair, salvage, and conversion are absent
- Tactical timeline and phased resolution are absent

**Verdict:** The engine is a **correct but minimal** implementation. It provides a stable foundation for incremental migration toward the intended authoritative battle system.

---

## 2. Current Live Battle Pipeline

### Human Plot Attack (Canonical Path)

**Route:** `POST /api/actions/attack`  
**Handler:** `server/routes.ts:1952-2009`  
**Persistence:** `server/storage/db.ts:deployAttack() (line 1414)`  
**Resolver:** `server/engine/battle/resolve.ts:resolveBattle()`

**Pipeline steps:**

1. **Client creates attack intent**  
   - File: `client/src/components/game/CommanderPanel.tsx`  
   - Function: `handleLaunchPlotAttack()`  
   - Payload: `{ attackerId, targetParcelId, troopsCommitted, resourcesBurned: { iron, fuel }, crystalBurned?, commanderId?, sourceParcelId?, idempotencyKey }`

2. **Client payload**  
   - Schema: `shared/schema.ts:attackActionSchema (line 517)`  
   - Fields: attackerId, targetParcelId, troopsCommitted, resourcesBurned.iron, resourcesBurned.fuel, crystalBurned (optional), commanderId (optional), sourceParcelId (optional), idempotencyKey (optional)

3. **Authentication and ownership**  
   - File: `server/routes.ts:1954`  
   - Function: `assertPlayerOwnership(req, res, req.body?.attackerId)`  
   - Verifies: session playerId matches attackerId  
   - Boundary: pre-validation, no DB transaction yet

4. **Schema validation**  
   - File: `server/routes.ts:1956`  
   - Function: `attackActionSchema.parse(req.body)`  
   - Throws: ZodError on invalid input  
   - Boundary: pre-validation

5. **Idempotency**  
   - File: `server/routes.ts:1962-1964`  
   - Function: `guardClaimOrRespond(res, scope, nonce)`  
   - Scope: `{ playerId: action.attackerId, action: "attack", target: encodeURIComponent(action.targetParcelId) }`  
   - Nonce: `actionNonce(req, action)` (body field or header fallback)  
   - Fingerprint: `attackPayloadFingerprint(action)` (actor, source, target, troops, iron, fuel, crystal, commander)  
   - Behavior: same key + same payload → replay 200; same key + different payload → 409 conflict; missing key → fail-open (legacy compat)  
   - Boundary: pre-transaction, atomic claim

6. **Origin and target lookup**  
   - File: `server/storage/db.ts:1414-1440`  
   - Function: `deployAttack(action)`  
   - Queries: attacker player row, target parcel row  
   - Validates: target exists, target not already under attack (`activeBattleId` is null), attacker is not targeting self  
   - Boundary: read-only, no transaction yet

7. **Resource validation**  
   - File: `server/storage/db.ts:1470-1475`  
   - Checks: `attacker.iron >= iron`, `attacker.fuel >= fuel`, `attacker.crystal >= crystal`  
   - Throws: "Insufficient resources for attack"  
   - Boundary: pre-transaction

8. **Transactional target claim**  
   - File: `server/storage/db.ts:1548-1560`  
   - Function: atomic UPDATE on `parcels` table  
   - Sets: `activeBattleId = battleId`  
   - WHERE: `id = target.id AND activeBattleId IS NULL`  
   - Boundary: transactional, prevents double-claim

9. **Battle insert**  
   - File: `server/storage/db.ts:1539-1547`  
   - Table: `battles`  
   - Fields: id, attackerId, defenderId, targetParcelId, attackerPower (pre-randFactor), defenderPower, troopsCommitted, resourcesBurned, crystalBurned, startTs, resolveTs (now + BATTLE_DURATION_MS), status="pending", commanderId, sourceParcelId  
   - Boundary: transactional

10. **Resource deduction**  
    - File: `server/storage/db.ts:1547`  
    - Updates: `players` table (iron, fuel, crystal)  
    - Boundary: transactional, atomic

11. **Activity/history creation**  
    - File: `server/storage/db.ts:1560-1580`  
    - Inserts: `game_events` row (type="battle_started")  
    - Boundary: transactional

12. **Resolver scheduling**  
    - File: `server/storage/db.ts:1871`  
    - Function: `resolveBattles()` (runs every 5s via background loop)  
    - Queries: battles WHERE status="pending" AND resolveTs < now  
    - Boundary: background scheduler, not request-path

13. **Resolver inputs**  
    - File: `server/storage/db.ts:1896-1902`  
    - Function: `resolveBattleFromPowers(attackerPower, defenderPower, randomSeed)`  
    - Inputs: frozen at launch (stored in battle row)  
    - Seed: `hashSeed(battle.id, battle.startTs)`  
    - Boundary: deterministic, no DB reads during resolution

14. **Seed/randomness**  
    - File: `server/engine/battle/random.ts:hashSeed()`  
    - Algorithm: djb2-style hash of `battleId|startTs`  
    - PRNG: `mulberry32(seed)` (fast 32-bit PRNG)  
    - randFactor: `randInt(rng, -RAND_FACTOR_MAX, RAND_FACTOR_MAX)` where RAND_FACTOR_MAX=10  
    - Boundary: deterministic, reproducible

15. **Attack calculation**  
    - File: `server/engine/battle/resolve.ts:31-35`  
    - Formula: `rawAttackerPower = troops×TROOPS_POWER_FACTOR + iron×IRON_POWER_FACTOR + fuel×FUEL_POWER_FACTOR + commanderBonus`  
    - Constants: TROOPS_POWER_FACTOR=10, IRON_POWER_FACTOR=0.5, FUEL_POWER_FACTOR=0.8  
    - Crystal: folded into commanderBonus via CRYSTAL_POWER_FACTOR (see db.ts:1517)  
    - Radar Array: applies ×0.9 to all attacker inputs (see db.ts:1511-1517)  
    - Morale debuff: `attackerPower = rawAttackerPower × (1 - MORALE_ATTACK_PENALTY)` where MORALE_ATTACK_PENALTY=0.15  
    - Boundary: deterministic

16. **Defense calculation**  
    - File: `server/engine/battle/resolve.ts:55-61`  
    - Formula: `rawDefenderPower = (defenseLevel×BASE_DEFENSE_POWER + improvementBonus) × biomeMod`  
    - Constants: BASE_DEFENSE_POWER=15  
    - improvementBonus: sum of (level×IMPROVEMENT_DEFENSE_PER_LEVEL) for turret, shield_gen, fortress  
    - biomeMod: BIOME_DEFENSE_MOD[biome] (e.g., mountain=1.4, water=0.5)  
    - Orbital hazard: `rawDefenderPower × (1 - ORBITAL_HAZARD_DEFENSE_PENALTY)` where ORBITAL_HAZARD_DEFENSE_PENALTY=0.2  
    - Boundary: deterministic

17. **Casualties**  
    - File: `server/engine/battle/resolve.ts:141-143`  
    - Pillage rates: `PILLAGE_RATE = 0.3` (30% of stored resources on attacker win)  
    - Applied: pillagedIron, pillagedFuel, pillagedCrystal  
    - Boundary: deterministic

18. **Capture decision**  
    - File: `server/engine/battle/resolve.ts:131-133`  
    - Formula: `adjustedAttackerPower = attackerPower × (1 + randFactor/100)`  
    - Winner: `attackerWins = adjustedAttackerPower > defenderPower`  
    - Boundary: deterministic

19. **Persistent updates**  
    - File: `server/storage/db.ts:1902-1970`  
    - On attacker win: transfer ownership, reset defenseLevel to floor(half), apply influence damage, pillage resources  
    - On defender win: apply influence damage, cascade defense penalty to adjacent plots  
    - Updates: `battles` row (status="resolved", outcome, randFactor), `parcels` row (ownerId, defenseLevel, activeBattleId=null), `players` row (moraleDebuffUntil, attackCooldownUntil, consecutiveLosses)  
    - Boundary: transactional

20. **Proof/history/result**  
    - File: `server/storage/db.ts:1970-2000`  
    - Inserts: `battle_replays` row (full resolution log), `game_events` row (battle_resolved)  
    - Proof endpoint: `GET /api/battle/:id/proof` returns seed, re-derived result, hash, valid=true  
    - Boundary: post-resolution, read-only

21. **Client and globe presentation**  
    - File: `client/src/components/game/globe/GlobeBattleSequence.tsx`  
    - Renders: battle arc, impact, capture burst, HUD callout  
    - Respects: OS reduced-motion, Battle Cinematics toggle  
    - Boundary: visual-only, no state mutation

### Sub-Parcel Attack (Divergent Path)

**Route:** `POST /api/sub-parcels/:id/attack`  
**Handler:** `server/routes.ts` (sub-parcel attack endpoint)  
**Persistence:** `server/storage/db.ts:2720-2760`  
**Resolver:** `server/engine/battle/resolve.ts:resolveBattle()` (same resolver)

**Differences from plot attack:**
- No idempotency guard (client-side `isPending` only)
- No `deployAttack()` wrapper (direct `resolveBattle()` call)
- No transactional target claim (no `activeBattleId` on sub-parcels)
- No battle scheduling (immediate resolution)
- defenseLevel hardcoded to 1 (sub-parcels have base defense of 1)
- No cooldown applied
- No morale debuff applied
- No battle proof/replay log
- Resources deducted but no battle row persisted

**Verdict:** Sub-parcel attacks bypass the canonical battle pipeline. They use the same resolver but lack idempotency, scheduling, and proof.

### AI Plot Attack (Shared Canonical Path)

**Launcher:** `server/storage/ai-engine.ts:launchAttack()`  
**Persistence:** `server/storage/db.ts:deployAttack()` (same as human)  
**Resolver:** `server/engine/battle/resolve.ts:resolveBattle()` (same)

**Behavior:**
- AI calls `ops.deployAttack()` with the same `AttackAction` schema
- Same idempotency, resource validation, transactional claim, battle insert, scheduling
- Same resolver, same proof
- AI-specific: faction-based troop/resource allocation, cooldown enforcement, active-battle cap

**Verdict:** AI and human attacks are **fully unified** through `deployAttack()`. No divergence.

### Special Attacks (Bypass Resolver)

**Routes:**
- EMP Blast: `POST /api/actions/special-attack` (type="emp_blast")
- Sabotage: `POST /api/actions/special-attack` (type="sabotage")
- Orbital Strike: `POST /api/actions/special-attack` (type="orbital_strike")
- Siege Barrage: `POST /api/actions/special-attack` (type="siege_barrage")

**Behavior:**
- Immediate effect (no battle scheduling)
- No `resolveBattle()` call
- No battle row persisted
- No proof/replay log
- Resources deducted, cooldown applied, but no deterministic resolution

**Verdict:** Special attacks bypass the canonical resolver entirely. They are instant-effect actions, not battles.

### Drones and Satellites (Deployment, Not Attacks)

**Routes:**
- Deploy drone: `POST /api/actions/deploy-drone`
- Deploy satellite: `POST /api/actions/deploy-satellite`

**Behavior:**
- Deployment only (no attack resolution)
- Resources deducted, duration tracked
- No battle row, no resolver call

**Verdict:** Drones and satellites are deployment actions, not attack paths.

---

## 3. Current Formula Truth

### Attack Power

```
rawAttackerPower = troops×10 + iron×0.5 + fuel×0.8 + commanderBonus
```

**Where:**
- `troops` = client-supplied `troopsCommitted`
- `iron` = client-supplied `resourcesBurned.iron`
- `fuel` = client-supplied `resourcesBurned.fuel`
- `commanderBonus` = Commander.attackBonus + (crystal × CRYSTAL_POWER_FACTOR)
- `crystal` = client-supplied `crystalBurned`
- CRYSTAL_POWER_FACTOR = (defined in db.ts, not in tuning.ts)

**Modifiers:**
- Radar Array (defender improvement): all attacker inputs ×0.9
- Morale debuff (attacker): `attackerPower = rawAttackerPower × 0.85`

### Defense Power

```
rawDefenderPower = (defenseLevel×15 + improvementBonus) × biomeMod
```

**Where:**
- `defenseLevel` = parcel.defenseLevel (server-derived)
- `improvementBonus` = sum of (level×5) for turret, shield_gen, fortress improvements
- `biomeMod` = BIOME_DEFENSE_MOD[biome] (e.g., mountain=1.4, water=0.5)

**Modifiers:**
- Orbital hazard: `rawDefenderPower × 0.8`

### Resolution

```
adjustedAttackerPower = attackerPower × (1 + randFactor/100)
winner = adjustedAttackerPower > defenderPower ? "attacker" : "defender"
```

**Where:**
- `randFactor` ∈ [-10, +10] (integer)
- Seed: `hashSeed(battleId, startTs)`
- PRNG: `mulberry32(seed)`

### Pillage

```
pillagedIron = attackerWins ? floor(parcel.ironStored × 0.3) : 0
pillagedFuel = attackerWins ? floor(parcel.fuelStored × 0.3) : 0
pillagedCrystal = attackerWins ? floor(parcel.crystalStored × 0.3) : 0
```

### What the Resolver Consumes

**Server-derived:**
- defenseLevel (from parcel)
- biome (from parcel)
- improvements (from parcel)
- orbitalHazardActive (from orbital event state)

**Client-supplied:**
- troopsCommitted
- resourcesBurned.iron
- resourcesBurned.fuel
- crystalBurned
- commanderId (optional)

**Database-derived:**
- commanderBonus (from player.commanders[commanderId].attackBonus)
- moraleDebuffActive (from player.moraleDebuffUntil)

**Seeded random:**
- randFactor (from mulberry32(hashSeed(battleId, startTs)))

**Not consumed (stored but ignored):**
- origin subplot (sourceParcelId is stored but not used in resolver)
- target subplot (not in schema)
- legacy subplot category (not in schema)
- facility archetype (not in schema)
- facility level (not in schema)
- facility upgrades (not in schema)
- facility integrity (absent)
- weapon archetype (not in schema)
- equipped weapon (not in schema)
- energy alignment (not in schema)
- energy generation/storage (not in schema)
- power state/brownout (not in schema)
- attack doctrine (absent)
- CombatProfile (contract exists, not integrated)
- BattleSnapshot (contract exists, not integrated)
- faction (playerFactionId stored but not used in resolver)
- recon (drones deployed but not used in resolver)
- shields (shield_gen improvement contributes to defense, but no separate shield mechanic)
- EMP (special attack, bypasses resolver)
- sabotage (special attack, bypasses resolver)
- drones (deployment only, not used in resolver)
- satellites (deployment only, not used in resolver)
- range (absent)
- persistent damage (absent)
- repair (absent)
- salvage (absent)
- conversion (absent)
- timeline (absent)

---

## 4. Battle-System Connection Matrix

| System | Status | Evidence Path | Current Consumer | Missing Connection | Future Phase |
|--------|--------|---------------|------------------|-------------------|--------------|
| main plot | LIVE_AND_CONSUMED | `parcels` table, `deployAttack()` | resolver (defenseLevel, biome, improvements) | — | — |
| origin subplot | STORED_NOT_CONSUMED | `battles.sourceParcelId` | stored but not used in resolver | wire into CombatProfile | Phase 5 |
| target subplot | ABSENT | not in schema | — | add to schema, wire into resolver | Phase 5 |
| legacy subplot category | STORED_NOT_CONSUMED | `subParcels.archetype` | stored but not used in plot attacks | wire into CombatProfile | Phase 7 |
| facility archetype | CATALOG_ONLY | `shared/subplotArchitecture.ts` | defined but not persisted | persist, wire into resolver | Phase 4 |
| facility level | ABSENT | not in schema | — | add to schema, wire into resolver | Phase 4 |
| facility upgrades | CATALOG_ONLY | `shared/subplotArchitecture.ts:FacilityUpgradeBranch` | defined but not persisted | persist, wire into resolver | Phase 4 |
| facility integrity | ABSENT | not in schema | — | add to schema, wire into resolver | Phase 6 |
| weapon archetype | DISCONNECTED | `shared/weapons/archetypes.ts`, Armory UI | displayed but not consumed by resolver | wire into CombatProfile, apply effects | Phase 5 |
| equipped weapon | ABSENT | not in schema | — | add to schema, wire into resolver | Phase 5 |
| energy alignment | STORED_NOT_CONSUMED | `subParcels.energyAlignment` | stored but not used in resolver | wire into CombatProfile, apply effects | Phase 7 |
| energy generation/storage | CONTRACT_ONLY | `shared/energyGrid.ts` | simulator exists, not integrated | persist, wire into resolver | Phase 4 |
| power state/brownout | CONTRACT_ONLY | `shared/energyGrid.ts:EnergyGridResult.brownout` | simulator exists, not integrated | persist, wire into resolver | Phase 4 |
| attack doctrine | ABSENT | not in schema | — | add to schema, wire into resolver | Phase 6 |
| CombatProfile | CONTRACT_ONLY | `shared/combatProfile.ts` | contract exists, not integrated | build from live attack, persist | Phase 5 |
| BattleSnapshot | CONTRACT_ONLY | `shared/combatProfile.ts:BattleSnapshot` | contract exists, not integrated | persist, use for proof | Phase 5 |
| Commander | LIVE_AND_CONSUMED | `players.commanders`, `deployAttack()` | resolver (commanderBonus) | — | — |
| faction | STORED_NOT_CONSUMED | `players.playerFactionId` | stored but not used in resolver | wire into CombatProfile, apply effects | Phase 7 |
| biome | LIVE_AND_CONSUMED | `parcels.biome`, `resolve.ts:BIOME_DEFENSE_MOD` | resolver (biomeMod) | — | — |
| recon | STORED_NOT_CONSUMED | `players.drones` | deployed but not used in resolver | wire into CombatProfile, apply effects | Phase 7 |
| shields | PARTIAL | `parcels.improvements` (shield_gen) | contributes to improvementBonus | no separate shield mechanic | Phase 7 |
| EMP | DISCONNECTED | special attack route | bypasses resolver | integrate into resolver as phased effect | Phase 6 |
| sabotage | DISCONNECTED | special attack route | bypasses resolver | integrate into resolver as phased effect | Phase 6 |
| drones | STORED_NOT_CONSUMED | `players.drones` | deployed but not used in resolver | wire into CombatProfile, apply effects | Phase 7 |
| satellites | STORED_NOT_CONSUMED | `players.satellites` | deployed but not used in resolver | wire into CombatProfile, apply effects | Phase 7 |
| troops | LIVE_AND_CONSUMED | `battles.troopsCommitted`, `resolve.ts` | resolver (troops×10) | — | — |
| iron | LIVE_AND_CONSUMED | `battles.resourcesBurned.iron`, `resolve.ts` | resolver (iron×0.5) | — | — |
| fuel | LIVE_AND_CONSUMED | `battles.resourcesBurned.fuel`, `resolve.ts` | resolver (fuel×0.8) | — | — |
| crystal | LIVE_AND_CONSUMED | `battles.crystalBurned`, `deployAttack()` | folded into commanderBonus | — | — |
| cooldown | LIVE_AND_CONSUMED | `players.attackCooldownUntil` | enforced pre-attack | — | — |
| range | ABSENT | not in schema | — | add to schema, wire into resolver | Phase 6 |
| persistent damage | ABSENT | not in schema | — | add to schema, wire into resolver | Phase 6 |
| repair | ABSENT | not in schema | — | add route, wire into resolver | Phase 6 |
| capture | LIVE_AND_CONSUMED | `deployAttack()`, `resolveBattles()` | ownership transfer on win | — | — |
| salvage | ABSENT | not in schema | — | add route, wire into resolver | Phase 6 |
| conversion | ABSENT | not in schema | — | add route, wire into resolver | Phase 6 |
| proof | LIVE_AND_CONSUMED | `battle_replays` table, `/api/battle/:id/proof` | deterministic verification | — | — |
| timeline | ABSENT | not in schema | — | add phased resolution, timeline events | Phase 8 |

---

## 5. Battle-Path Divergence

| Path | Launch Route | Resolver | Idempotency | Resource Accounting | Cooldown | Proof | CombatProfile | BattleSnapshot | Persistent Consequences |
|------|--------------|----------|-------------|---------------------|----------|-------|---------------|----------------|------------------------|
| Human plot attack | `POST /api/actions/attack` | `resolveBattle()` | ✅ (PR #250) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| AI plot attack | `ai-engine.ts:launchAttack()` → `deployAttack()` | `resolveBattle()` | ✅ (shared) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Sub-parcel attack | `POST /api/sub-parcels/:id/attack` | `resolveBattle()` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (immediate) |
| EMP | `POST /api/actions/special-attack` | ❌ (bypass) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (immediate) |
| Sabotage | `POST /api/actions/special-attack` | ❌ (bypass) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (immediate) |
| Orbital Strike | `POST /api/actions/special-attack` | ❌ (bypass) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (immediate) |
| Siege Barrage | `POST /api/actions/special-attack` | ❌ (bypass) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (immediate) |
| Drone deploy | `POST /api/actions/deploy-drone` | ❌ (not attack) | ✅ | ✅ | N/A | ❌ | ❌ | ❌ | ❌ |
| Satellite deploy | `POST /api/actions/deploy-satellite` | ❌ (not attack) | ✅ | ✅ | N/A | ❌ | ❌ | ❌ | ❌ |

**Key divergences:**
- Sub-parcel attacks lack idempotency, scheduling, and proof
- Special attacks bypass the resolver entirely (instant effect)
- Drones/satellites are deployment actions, not attacks
- Only human and AI plot attacks use the full canonical pipeline

---

## 6. Target Authoritative Pipeline

**Target architecture (PLANNED, not implemented):**

```
BattleIntent (client)
  → authenticated validation (server)
  → authoritative origin lookup (plot + subplot + facility)
  → authoritative target lookup (plot + subplot + facility)
  → energy operating-state calculation (brownout/power state)
  → CombatProfile construction (server-generated, immutable)
  → immutable BattleSnapshot (frozen at launch)
  → deterministic phased resolution (8 phases)
  → persistent consequences (damage, repair, capture, salvage)
  → battle timeline (event log)
  → reproducible proof (seed + snapshot + resolution)
  → globe/tactical presentation
```

**Required principles:**
- No trusted client combat bonuses (all derived server-side)
- Launch facts frozen before resolution (immutable snapshot)
- Human and AI attacks use the same profile builder (unified path)
- Retries cannot double-spend (idempotency with payload fingerprint)
- Mutable state is not reread after launch (snapshot-based resolution)
- Special attacks share compatible consequence rules (phased resolution)
- Persistent consequences are transactional (atomic updates)
- Current production results remain stable during initial migration (parity tests)

---

## 7. Legacy Resolver Decision

### KEEP (correct and reusable)

- Deterministic formula (troops×10 + iron×0.5 + fuel×0.8 + commanderBonus)
- mulberry32 PRNG (fast, reproducible)
- hashSeed (djb2-style, deterministic)
- Pillage calculation (30% of stored resources)
- Biome defense modifiers
- Improvement defense contributions
- Morale debuff application
- Orbital hazard penalty
- Radar Array attacker scaling

### WRAP (temporarily behind adapters)

- `deployAttack()` input construction (wrap to build CombatProfile)
- `resolveBattleFromPowers()` (wrap to accept BattleSnapshot)
- Battle persistence (wrap to store snapshot JSON)

### EXTRACT (reusable pure functions)

- Power calculation (extract to pure functions for testing)
- Pillage calculation (extract to pure function)
- Seed generation (already pure, no change needed)

### REPLACE (incompatible with target)

- Nothing yet (preserve production behavior during initial migration)

### DEFER (change in later phases)

- Weapon archetype effects (Phase 5)
- Facility archetype effects (Phase 4)
- Energy alignment effects (Phase 7)
- Attack doctrine effects (Phase 6)
- Phased resolution (Phase 8)
- Persistent damage/repair (Phase 6)

### Recommended First Implementation PR

**Goal:** Build CombatProfile from existing live attack, create immutable BattleSnapshot, continue using existing resolver, prove exact legacy output parity, add no weapon/doctrine/facility/alignment effects, allow immediate rollback.

**Scope:**
1. In `deployAttack()`, after building `battleInput`, construct `CombatProfile` from the same inputs
2. Create `BattleSnapshot` from the profile + startTs
3. Store snapshot JSON in a new nullable `battles.combatProfileJson` column (additive migration)
4. Continue using existing `resolveBattle()` path (no resolver changes)
5. Add parity test: verify that snapshot-based resolution produces identical output to legacy path
6. Add rollback flag: if snapshot construction fails, fall back to legacy path (no snapshot stored)

**Files:**
- `server/storage/db.ts` (deployAttack)
- `server/db-schema.ts` (add column)
- `migrations/0016_battles_combat_profile.sql` (additive)
- `server/storage/db.spec.ts` (parity test)

**Forbidden:**
- No resolver changes
- No weapon/facility/alignment/doctrine effects
- No schema changes beyond additive column
- No client changes

**Risk:** LOW (additive, rollback-safe, parity-tested)

---

## 8. PR-Sized Migration Sequence

### A. CombatProfile launch adapter with legacy parity

**Goal:** Build CombatProfile from live attack, store snapshot, prove parity  
**Files:** `server/storage/db.ts`, `server/db-schema.ts`, `migrations/0016_*.sql`, `server/storage/db.spec.ts`  
**DB impact:** additive nullable column  
**Tests:** parity test (snapshot-based resolution = legacy resolution)  
**Rollout gate:** parity test green, no production behavior change  
**Rollback:** drop column, revert code  
**Risk:** LOW  
**Agent mode:** Auto Efficient

### B. Snapshot persistence and replay tests

**Goal:** Persist snapshot JSON, add replay tests (re-derive outcome from snapshot + seed)  
**Files:** `server/storage/db.ts`, `server/engine/battle/resolve.spec.ts`  
**DB impact:** none (column exists from A)  
**Tests:** replay test (load snapshot, re-derive outcome, verify match)  
**Rollout gate:** replay test green  
**Rollback:** revert code  
**Risk:** LOW  
**Agent mode:** Auto Efficient

### C. Human/AI launch-path unification

**Goal:** Ensure AI uses same CombatProfile builder as human (already unified via deployAttack, verify and document)  
**Files:** `server/storage/ai-engine.ts`, `server/storage/db.ts`  
**DB impact:** none  
**Tests:** verify AI attack produces same snapshot structure as human  
**Rollout gate:** test green  
**Rollback:** revert code  
**Risk:** LOW  
**Agent mode:** Auto Efficient

### D. Special-attack normalization

**Goal:** Route special attacks through phased resolution (EMP, sabotage, orbital strike, siege barrage)  
**Files:** `server/routes.ts`, `server/storage/db.ts`, `server/engine/battle/resolve.ts`  
**DB impact:** additive columns for special-attack effects  
**Tests:** special-attack resolution tests  
**Rollout gate:** tests green, no regression in plot attacks  
**Rollback:** revert code, drop columns  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

### E. Weapon-equipment connection with effects disabled

**Goal:** Persist equipped weapon on facilities, wire into CombatProfile, but apply zero effects (preparation for Phase 5)  
**Files:** `server/db-schema.ts`, `migrations/0017_*.sql`, `server/storage/db.ts`, `shared/combatProfile.ts`  
**DB impact:** additive nullable columns  
**Tests:** verify weapon persisted, CombatProfile includes weapon, resolver ignores it  
**Rollout gate:** tests green, no behavior change  
**Rollback:** drop columns, revert code  
**Risk:** LOW  
**Agent mode:** Auto Efficient

### F. Doctrine contract and selection

**Goal:** Add attack doctrine to schema, add UI selector, wire into CombatProfile, apply effects  
**Files:** `shared/schema.ts`, `migrations/0018_*.sql`, `server/routes.ts`, `client/src/components/game/CommanderPanel.tsx`, `server/engine/battle/resolve.ts`  
**DB impact:** additive nullable column  
**Tests:** doctrine selection tests, resolution tests with doctrine effects  
**Rollout gate:** tests green, behavior change documented  
**Rollback:** drop column, revert code  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

### G. Facility/energy-state consumption

**Goal:** Persist canonical facility archetypes, wire energy grid into CombatProfile, apply brownout effects  
**Files:** `server/db-schema.ts`, `migrations/0019_*.sql`, `server/storage/db.ts`, `shared/energyGrid.ts`, `server/engine/battle/resolve.ts`  
**DB impact:** additive columns for facility state  
**Tests:** facility persistence tests, energy grid integration tests, resolution tests with facility effects  
**Rollout gate:** tests green, behavior change documented  
**Rollback:** drop columns, revert code  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

### H. Phased resolver introduction

**Goal:** Replace single-step resolution with 8-phase resolution (intelligence, approach, long-range, assault, defense, facility damage, retreat/hold/capture, aftermath)  
**Files:** `server/engine/battle/resolve.ts`, `server/engine/battle/types.ts`  
**DB impact:** none  
**Tests:** phased resolution tests, parity tests (phased = legacy for simple cases)  
**Rollout gate:** tests green, behavior change documented  
**Rollback:** revert code  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

### I. Persistent facility damage and repair

**Goal:** Add facility integrity, damage on attack, repair route  
**Files:** `server/db-schema.ts`, `migrations/0020_*.sql`, `server/storage/db.ts`, `server/routes.ts`, `server/engine/battle/resolve.ts`  
**DB impact:** additive columns for integrity  
**Tests:** damage tests, repair tests  
**Rollout gate:** tests green, behavior change documented  
**Rollback:** drop columns, revert code  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

### J. Capture, salvage, and conversion

**Goal:** Add salvage route, conversion route, capture inheritance  
**Files:** `server/routes.ts`, `server/storage/db.ts`, `server/engine/battle/resolve.ts`  
**DB impact:** none (use existing columns)  
**Tests:** salvage tests, conversion tests, capture inheritance tests  
**Rollout gate:** tests green, behavior change documented  
**Rollback:** revert code  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

### K. Tactical timeline/presentation

**Goal:** Add battle timeline events, tactical view rendering  
**Files:** `server/engine/battle/resolve.ts`, `client/src/components/game/TacticalView.tsx` (new)  
**DB impact:** additive table for timeline events  
**Tests:** timeline event tests, tactical view rendering tests  
**Rollout gate:** tests green, visual acceptance  
**Rollback:** drop table, revert code  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

### L. Simulation and balancing harness

**Goal:** Build simulation harness for balance testing, generate balance reports  
**Files:** `server/engine/battle/sim.ts`  
**DB impact:** none  
**Tests:** simulation tests  
**Rollout gate:** simulation runs, reports generated  
**Rollback:** revert code  
**Risk:** LOW  
**Agent mode:** Auto Balanced

---

## 9. Explicit Non-Goals

- Do not change the deterministic formula during initial migration (preserve production behavior)
- Do not add weapon/facility/alignment/doctrine effects until later phases
- Do not implement phased resolution until snapshot persistence is proven
- Do not implement persistent damage/repair until facility archetypes are persisted
- Do not implement tactical view until phased resolution is complete
- Do not unify special attacks with plot attacks until phased resolution is ready
- Do not move high-frequency state (integrity, energy, cooldowns) on-chain

---

## 10. Production Safety Rules

- One PR at a time (application-code phases)
- Additive migrations only (no destructive changes)
- Parity tests required for any resolver change
- Rollback flag required for any snapshot-based change
- No client-trusted combat bonuses (all derived server-side)
- No mutable state reread after launch (snapshot-based resolution)
- No double-spend (idempotency with payload fingerprint)
- No mainnet changes without `/mainnet-gate` PASS + `algo-auditor` PASS

---

## 11. Owner Decisions Required

1. **Weapon archetype effects:** Should weapon archetypes connect to plot attacks, or remain a separate interception system?
2. **Energy alignment effects:** Should helios/aegis/nexus have gameplay effects? If so, what?
3. **Attack doctrine balance:** What are the final numeric values for doctrine modifiers?
4. **Facility archetype mapping:** How should legacy sub-parcel categories map to canonical facility archetypes?
5. **Phased resolution scope:** Should all attacks (plot, sub-parcel, special) use phased resolution, or only plot attacks?
6. **Persistent damage balance:** What are the final numeric values for integrity, damage, and repair?
7. **Tactical view scope:** Should the tactical view be 2D, 2.5D, or 3D? What layers should be visible?

---

## 12. Canonical Source Paths

### Documentation

- Master game spec: `artifacts/frontier-al/FRONTIER_MASTER_GAME_SPEC.md`
- Production roadmap: `artifacts/frontier-al/PRODUCTION_READINESS_ROADMAP.md`
- Reconciliation ledger: `artifacts/frontier-al/docs/DOC_RECONCILIATION_LEDGER.md`
- Sub-plot combat architecture: `docs/memory/FRONTIER_SUBPLOT_COMBAT_ARCHITECTURE.md`
- Land/combat panel audit: `artifacts/frontier-al/docs/audit/FRONTIER_LAND_COMBAT_PANEL_AUDIT.md`
- Handoff: `docs/HANDOFF.md`

### Live Resolver

- `server/engine/battle/resolve.ts`
- `server/engine/battle/random.ts`
- `server/engine/battle/tuning.ts`
- `server/engine/battle/types.ts`

### Attack Launch

- `server/routes.ts:1952-2009` (human plot attack)
- `server/storage/db.ts:1414-1580` (deployAttack)
- `server/storage/ai-engine.ts:302-330` (AI launchAttack)
- `server/routes.ts` (sub-parcel attack, special attacks)

### Foundation Contracts

- `shared/combatProfile.ts`
- `shared/energyGrid.ts`
- `shared/subplotArchitecture.ts`
- `shared/weapons/archetypes.ts`
- `shared/weapons/types.ts`

### Schema

- `shared/schema.ts:517-530` (attackActionSchema)
- `shared/schema.ts:328-360` (Battle interface)

---

## End of Document

This document is the canonical battle-engine truth. All future implementation must align with this architecture. Status labels must be updated as systems move from CONTRACT_ONLY → LIVE_AND_CONSUMED.

**Next update:** After Phase A (CombatProfile launch adapter) is merged.
