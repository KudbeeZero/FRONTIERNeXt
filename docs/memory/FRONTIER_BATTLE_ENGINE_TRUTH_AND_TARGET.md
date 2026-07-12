# FRONTIER Battle Engine Truth and Target Architecture

**Authority:** This document is the canonical battle-engine truth for FRONTIER-AL.
**Evidence date:** 2026-07-12
**Governing commit:** `91d183d` (PR #252 merged)
**Status:** Documentation-only. No runtime behavior changed.

**Phase A status (2026-07-12, PR #253):** MERGED at `3b3db01` — server-authoritative launch adapter wired into `deployAttack()`. The adapter wraps the legacy deployAttack() input construction in the CombatProfile/BattleSnapshot contract. It produces an immutable CombatProfile + BattleSnapshot for the live state, the EXACT same EngineBattleInput the legacy path built (so resolveBattle() sees byte-identical inputs), and the legacy persisted battle-row values used by the insert. No durable snapshot persistence yet (Phase B). No schema/migration changes. No new combat effects. 30 new focused adapter tests, 669 server tests passing.

**Phase B status (2026-07-12, PR open):** `feat/frontier-battle-snapshot-persistence` — durable BattleSnapshot persistence and replay verification:
- Migration `0016_battles_battle_snapshot.sql` adds nullable JSONB column `battle_snapshot` to the `battles` table
- `server/engine/battle/snapshotReplay.ts` — pure replay utility: `parseStoredBattleSnapshot()` (Zod-validated strict parsing), `replayBattleInputFromStoredBattle()` (reconstructs exact legacy EngineBattleInput), `replayLegacyPersistedFieldsFromSnapshot()` (reconstructs legacy persisted fields)
- `deployAttack()` now persists the snapshot alongside the battle row in the same transaction
- 19 new focused replay tests covering JSONB round-trip, key reordering, identity verification, and parity
- 669 server tests passing (baseline 650 + 19 new)
- Live resolver unchanged — snapshot is for evidence and replay verification only

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

## 2. Current Live Human Plot-Attack Pipeline

**Route:** `POST /api/actions/attack`
**Handler:** `server/routes.ts:1952-2009`
**Persistence:** `server/storage/db.ts:deployAttack() (line 1414)`
**Resolver:** `server/engine/battle/resolve.ts:resolveBattle()`

### Pipeline Steps

1. **Client creates attack intent**
   - File: `client/src/components/game/CommanderPanel.tsx`
   - Function: `handleLaunchPlotAttack()`
   - Payload: `{ attackerId, targetParcelId, troopsCommitted, resourcesBurned: { iron, fuel }, crystalBurned?, commanderId?, sourceParcelId?, idempotencyKey }`

2. **Authentication and ownership**
   - File: `server/routes.ts:1954`
   - Function: `assertPlayerOwnership(req, res, req.body?.attackerId)`
   - Verifies: session playerId matches attackerId

3. **Schema validation**
   - File: `server/routes.ts:1956`
   - Function: `attackActionSchema.parse(req.body)`
   - Schema: `shared/schema.ts:517-530`

4. **Idempotency**
   - File: `server/routes.ts:1962-1964`
   - Function: `guardClaimOrRespond(res, scope, nonce)`
   - Scope: `{ playerId: action.attackerId, action: "attack", target: encodeURIComponent(action.targetParcelId) }`
   - Fingerprint: `attackPayloadFingerprint(action)` (actor, source, target, troops, iron, fuel, crystal, commander)
   - Behavior: same key + same payload → replay 200; same key + different payload → 409 conflict; missing key → fail-open (legacy compat)

5. **Origin and target lookup**
   - File: `server/storage/db.ts:1414-1440`
   - Function: `deployAttack(action)`
   - Queries: attacker player row, target parcel row
   - Validates: target exists, target not already under attack (`activeBattleId` is null), attacker is not targeting self

6. **Resource validation**
   - File: `server/storage/db.ts:1470-1475`
   - Checks: `attacker.iron >= iron`, `attacker.fuel >= fuel`, `attacker.crystal >= crystal`

7. **Commander and crystal bonus calculation**
   - File: `server/storage/db.ts:1477-1488`
   - Commander: validates availability, applies `attackBonus` from `CommanderAvatar.attackBonus`
   - Crystal: contributes to attack power via `CRYSTAL_POWER_FACTOR` (defined in `db.ts`)
   - **Note:** Implementation combines commander and crystal into a single `commanderBonus` variable, but they are conceptually distinct:
     - Commander-derived modifier: `cmd.attackBonus` (percentage-based)
     - Crystal-derived power contribution: `crystal × CRYSTAL_POWER_FACTOR` (additive)
     - Implementation variable: `commanderBonus = cmd.attackBonus + (crystal × CRYSTAL_POWER_FACTOR)`

8. **Radar Array modifier**
   - File: `server/storage/db.ts:1490-1492`
   - If defender has Radar Array improvement: all attacker inputs scaled ×0.9
   - Applied: `troopsCommitted × 0.9`, `iron × 0.9`, `fuel × 0.9`, `commanderBonus × 0.9`

9. **Morale debuff check**
   - File: `server/storage/db.ts:1493`
   - Checks: `attacker.moraleDebuffUntil && now < attacker.moraleDebuffUntil`

10. **Battle input construction**
    - File: `server/storage/db.ts:1495-1517`
    - Fields: battleId, attackerId, defenderId, plotId, troopsCommitted, resourcesBurned, commanderBonus, moraleDebuffActive, defenseLevel, biome, improvements, orbitalHazardActive, randomSeed
    - Seed: `hashSeed(battleId, now)`

11. **Resolver invocation**
    - File: `server/storage/db.ts:1521`
    - Function: `resolveBattle(battleInput)`
    - Returns: `{ winner, attackerPower, defenderPower, randFactor, outcome, pillagedIron, pillagedFuel, pillagedCrystal, log }`

12. **Power extraction**
    - File: `server/storage/db.ts:1523-1524`
    - Extracts pre-randFactor powers: `attackerPower = deployResult.attackerPower / (1 + deployResult.randFactor / 100)`

13. **Battle row insertion**
    - File: `server/storage/db.ts:1526-1547`
    - Table: `battles`
    - Fields: id, attackerId, defenderId, targetParcelId, attackerPower (pre-randFactor), defenderPower, troopsCommitted, resourcesBurned, crystalBurned, startTs, resolveTs (now + BATTLE_DURATION_MS), status="pending", commanderId, sourceParcelId

14. **Resource deduction**
    - File: `server/storage/db.ts:1547`
    - Updates: `players` table (iron, fuel, crystal)
    - Transactional, atomic

15. **Activity/history creation**
    - File: `server/storage/db.ts:1560-1580`
    - Inserts: `game_events` row (type="battle_started")

16. **Transactional target claim**
    - File: `server/storage/db.ts:1548-1560`
    - Atomic UPDATE on `parcels` table: `activeBattleId = battleId`
    - WHERE: `id = target.id AND activeBattleId IS NULL`
    - Prevents double-claim

17. **Resolver scheduling**
    - File: `server/storage/db.ts:1871`
    - Function: `resolveBattles()` (runs every 5s via background loop)
    - Queries: battles WHERE status="pending" AND resolveTs < now

18. **Resolution**
    - File: `server/storage/db.ts:1896-1902`
    - Function: `resolveBattleFromPowers(attackerPower, defenderPower, randomSeed)`
    - Inputs: frozen at launch (stored in battle row)
    - Seed: `hashSeed(battle.id, battle.startTs)`

19. **Persistent updates**
    - File: `server/storage/db.ts:1902-1970`
    - On attacker win: transfer ownership, reset defenseLevel to floor(half), apply influence damage, pillage resources
    - On defender win: apply influence damage, cascade defense penalty to adjacent plots
    - Updates: `battles` row (status="resolved", outcome, randFactor), `parcels` row (ownerId, defenseLevel, activeBattleId=null), `players` row (moraleDebuffUntil, attackCooldownUntil, consecutiveLosses)

20. **Proof/history/result**
    - File: `server/storage/db.ts:1970-2000`
    - Inserts: `battle_replays` row (full resolution log), `game_events` row (battle_resolved)
    - Proof endpoint: `GET /api/battle/:id/proof` returns seed, re-derived result, hash, valid=true

21. **Client and globe presentation**
    - File: `client/src/components/game/globe/GlobeBattleSequence.tsx`
    - Renders: battle arc, impact, capture burst, HUD callout
    - Respects: OS reduced-motion, Battle Cinematics toggle

---

## 3. Current Formula Truth

### Attack Power

```
rawAttackerPower = (troops × 10) + (iron × 0.5) + (fuel × 0.8) + commanderBonus
```

**Where:**
- `troops` = client-supplied `troopsCommitted`
- `iron` = client-supplied `resourcesBurned.iron`
- `fuel` = client-supplied `resourcesBurned.fuel`
- `commanderBonus` = Commander.attackBonus + (crystal × CRYSTAL_POWER_FACTOR)
  - **Conceptual distinction:** Commander.attackBonus is a percentage-based modifier from the active Commander avatar. Crystal contributes additive power via CRYSTAL_POWER_FACTOR. The implementation combines these into a single variable for convenience, but they are logically separate inputs.
- `crystal` = client-supplied `crystalBurned`
- CRYSTAL_POWER_FACTOR = (defined in `server/storage/db.ts`, not in `tuning.ts`)

**Modifiers:**
- Radar Array (defender improvement): all attacker inputs ×0.9
- Morale debuff (attacker): `attackerPower = rawAttackerPower × 0.85`

### Defense Power

```
rawDefenderPower = (defenseLevel × 15 + improvementBonus) × biomeMod
```

**Where:**
- `defenseLevel` = parcel.defenseLevel (server-derived)
- `improvementBonus` = sum of (level × 5) for turret, shield_gen, fortress improvements
- `biomeMod` = BIOME_DEFENSE_MOD[biome] (e.g., mountain=1.4, water=0.5)

**Modifiers:**
- Orbital hazard: `rawDefenderPower × 0.8`

### Resolution

```
adjustedAttackerPower = attackerPower × (1 + randFactor / 100)
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
- commanderBonus (from player.commanders[commanderId].attackBonus + crystal × CRYSTAL_POWER_FACTOR)
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

## 4. Battle-Path Divergence

### A. Human Plot Attacks

**Route:** `POST /api/actions/attack`
**Handler:** `server/routes.ts:1952-2009`
**Persistence:** `server/storage/db.ts:deployAttack()`
**Resolver:** `server/engine/battle/resolve.ts:resolveBattle()`

**Characteristics:**
- Passes through authenticated attack route
- Uses attack idempotency (PR #250)
- Calls `deployAttack()` for full pipeline
- Later uses `resolveBattle()` via `resolveBattles()` scheduler
- Creates battle row with frozen powers
- Generates battle proof and replay log
- Applies cooldown, morale debuff, capture logic
- Transactional resource deduction and target claim

### B. AI Plot Attacks

**Launcher:** `server/storage/ai-engine.ts:launchAttack()`
**Persistence:** `server/storage/db.ts:deployAttack()` (same as human)
**Resolver:** `server/engine/battle/resolve.ts:resolveBattle()` (same)

**Characteristics:**
- AI calls `ops.deployAttack()` with the same `AttackAction` schema
- Same idempotency, resource validation, transactional claim, battle insert, scheduling
- Same resolver, same proof
- **Differences from human:**
  - AI-specific troop/resource allocation logic (faction-based)
  - AI-specific target selection (expansion, defensive, raid, economic strategies)
  - AI cooldown enforcement (separate from human cooldown)
  - AI active-battle cap enforcement (global cap across all AI factions)
  - No client-supplied idempotency key (AI generates internally)

**Verdict:** AI and human attacks are **fully unified** through `deployAttack()`. The only differences are in intent generation and target selection, not in combat-state construction or resolution.

### C. Sub-Parcel Attacks

**Route:** `POST /api/sub-parcels/:id/attack`
**Handler:** `server/routes.ts` (sub-parcel attack endpoint)
**Persistence:** `server/storage/db.ts:2720-2760`
**Resolver:** `server/engine/battle/resolve.ts:resolveBattle()` (same resolver)

**Characteristics:**
- Calls `resolveBattle()` directly (no `deployAttack()` wrapper)
- No idempotency guard (client-side `isPending` only)
- No transactional target claim (no `activeBattleId` on sub-parcels)
- No battle scheduling (immediate resolution)
- defenseLevel hardcoded to 1 (sub-parcels have base defense of 1)
- No cooldown applied
- No morale debuff applied
- No battle proof/replay log
- No battle row persisted
- Resources deducted but no persistent battle record

**Divergences from plot attacks:**
- ❌ Bypasses idempotency
- ❌ Bypasses scheduling
- ❌ Bypasses proof generation
- ❌ Bypasses cooldown
- ❌ Bypasses battle persistence
- ✅ Uses same resolver formula

**Verdict:** Sub-parcel attacks use the same resolver but lack the full battle pipeline safeguards.

### D. EMP and Sabotage

**Routes:**
- EMP Blast: `POST /api/actions/special-attack` (type="emp_blast")
- Sabotage: `POST /api/actions/special-attack` (type="sabotage")

**Characteristics:**
- Immediate effect (no battle scheduling)
- No `resolveBattle()` call
- No battle row persisted
- No proof/replay log
- Resources deducted, cooldown applied
- Direct state mutation (disable improvements, reduce mining yield)

**Divergences from plot attacks:**
- ❌ Bypasses resolver entirely
- ❌ Bypasses idempotency (special-attack idempotency is separate)
- ❌ Bypasses battle persistence
- ❌ Bypasses proof generation
- ✅ Uses same resource deduction pattern

**Verdict:** EMP and sabotage are instant-effect strategic actions, not battles. They bypass the canonical battle resolver.

### E. Drones, Satellites, Shields, and Other Special Systems

**Drones:**
- Route: `POST /api/actions/deploy-drone`
- Behavior: Deployment only (no attack resolution)
- Effect: Reveals enemy resource stockpiles and improvement layouts for 15 minutes
- Classification: **Deployment action**, not an attack

**Satellites:**
- Route: `POST /api/actions/deploy-satellite`
- Behavior: Deployment only (no attack resolution)
- Effect: +25% mining yield on all owned parcels while active (1 hour)
- Classification: **Deployment action**, not an attack

**Shields:**
- Implementation: `shield_gen` improvement contributes to `improvementBonus` in defense calculation
- Effect: Each level adds 5 defense power
- Classification: **Defense modifier**, not a separate system

**Orbital Strike:**
- Route: `POST /api/actions/special-attack` (type="orbital_strike")
- Behavior: Immediate effect (3.0× damage, ignores 50% of target defense)
- Classification: **Special attack**, bypasses resolver

**Siege Barrage:**
- Route: `POST /api/actions/special-attack` (type="siege_barrage")
- Behavior: Immediate effect (2.0× damage, damages up to 3 nearby enemy plots)
- Classification: **Special attack**, bypasses resolver

---

## 5. Battle-System Connection Matrix

| System | Status | Evidence Path | Current Consumer | Missing Connection | Future Phase |
|--------|--------|---------------|------------------|-------------------|--------------|
| main plot | LIVE_AND_CONSUMED | `parcels` table, `deployAttack()` | resolver (defenseLevel, biome, improvements) | — | — |
| origin subplot | STORED_NOT_CONSUMED | `battles.sourceParcelId` | stored but not used in resolver | wire into CombatProfile | Phase E |
| target subplot | ABSENT | not in schema | — | add to schema, wire into resolver | Phase E |
| legacy subplot category | STORED_NOT_CONSUMED | `subParcels.archetype` | stored but not used in plot attacks | wire into CombatProfile | Phase G |
| facility archetype | CATALOG_ONLY | `shared/subplotArchitecture.ts` | defined but not persisted | persist, wire into resolver | Phase G |
| facility level | ABSENT | not in schema | — | add to schema, wire into resolver | Phase G |
| facility upgrades | CATALOG_ONLY | `shared/subplotArchitecture.ts:FacilityUpgradeBranch` | defined but not persisted | persist, wire into resolver | Phase G |
| facility integrity | ABSENT | not in schema | — | add to schema, wire into resolver | Phase I |
| weapon archetype | DISCONNECTED | `shared/weapons/archetypes.ts`, Armory UI | displayed but not consumed by resolver | wire into CombatProfile, apply effects | Phase E |
| equipped weapon | ABSENT | not in schema | — | add to schema, wire into resolver | Phase E |
| energy alignment | STORED_NOT_CONSUMED | `subParcels.energyAlignment` | stored but not used in resolver | wire into CombatProfile, apply effects | Phase G |
| energy generation/storage | CONTRACT_ONLY | `shared/energyGrid.ts` | simulator exists, not integrated | persist, wire into resolver | Phase G |
| power state/brownout | CONTRACT_ONLY | `shared/energyGrid.ts:EnergyGridResult.brownout` | simulator exists, not integrated | persist, wire into resolver | Phase G |
| attack doctrine | ABSENT | not in schema | — | add to schema, wire into resolver | Phase F |
| CombatProfile | CONTRACT_ONLY | `shared/combatProfile.ts` | contract exists, not integrated | build from live attack, persist | Phase A |
| BattleSnapshot | CONTRACT_ONLY | `shared/combatProfile.ts:BattleSnapshot` | contract exists, not integrated | persist, use for proof | Phase B |
| Commander | LIVE_AND_CONSUMED | `players.commanders`, `deployAttack()` | resolver (commanderBonus) | — | — |
| faction | STORED_NOT_CONSUMED | `players.playerFactionId` | stored but not used in resolver | wire into CombatProfile, apply effects | Phase G |
| biome | LIVE_AND_CONSUMED | `parcels.biome`, `resolve.ts:BIOME_DEFENSE_MOD` | resolver (biomeMod) | — | — |
| recon | STORED_NOT_CONSUMED | `players.drones` | deployed but not used in resolver | wire into CombatProfile, apply effects | Phase G |
| shields | PARTIAL | `parcels.improvements` (shield_gen) | contributes to improvementBonus | no separate shield mechanic | Phase G |
| EMP | DISCONNECTED | special attack route | bypasses resolver | integrate into resolver as phased effect | Phase D |
| sabotage | DISCONNECTED | special attack route | bypasses resolver | integrate into resolver as phased effect | Phase D |
| drones | STORED_NOT_CONSUMED | `players.drones` | deployed but not used in resolver | wire into CombatProfile, apply effects | Phase G |
| satellites | STORED_NOT_CONSUMED | `players.satellites` | deployed but not used in resolver | wire into CombatProfile, apply effects | Phase G |
| troops | LIVE_AND_CONSUMED | `battles.troopsCommitted`, `resolve.ts` | resolver (troops×10) | — | — |
| iron | LIVE_AND_CONSUMED | `battles.resourcesBurned.iron`, `resolve.ts` | resolver (iron×0.5) | — | — |
| fuel | LIVE_AND_CONSUMED | `battles.resourcesBurned.fuel`, `resolve.ts` | resolver (fuel×0.8) | — | — |
| crystal | LIVE_AND_CONSUMED | `battles.crystalBurned`, `deployAttack()` | folded into commanderBonus (conceptually distinct) | — | — |
| cooldown | LIVE_AND_CONSUMED | `players.attackCooldownUntil` | enforced pre-attack | — | — |
| range | ABSENT | not in schema | — | add to schema, wire into resolver | Phase F |
| persistent damage | ABSENT | not in schema | — | add to schema, wire into resolver | Phase I |
| repair | ABSENT | not in schema | — | add route, wire into resolver | Phase I |
| capture | LIVE_AND_CONSUMED | `deployAttack()`, `resolveBattles()` | ownership transfer on win | — | — |
| salvage | ABSENT | not in schema | — | add route, wire into resolver | Phase J |
| conversion | ABSENT | not in schema | — | add route, wire into resolver | Phase J |
| proof | PARTIAL | `battle_replays` table, `/api/battle/:id/proof` | deterministic verification | does not store full snapshot | Phase B |
| timeline | ABSENT | not in schema | — | add phased resolution, timeline events | Phase K |

---

## 6. Transaction and Persistence Boundaries

### deployAttack() Transaction

**Boundary:** Single atomic transaction
**Operations:**
1. Read attacker player row
2. Read target parcel row
3. Validate resources
4. Validate commander availability
5. Calculate commander and crystal bonuses
6. Apply Radar Array modifier
7. Check morale debuff
8. Construct battle input
9. Invoke resolver (pre-resolution)
10. Insert battle row
11. Deduct resources from attacker
12. Insert game event (battle_started)
13. Claim target parcel (activeBattleId)

**Atomicity:** All operations succeed or fail together
**Isolation:** Prevents double-claim via `activeBattleId IS NULL` check

### resolveBattles() Transaction

**Boundary:** Per-battle transaction
**Operations:**
1. Read battle row (frozen powers)
2. Invoke resolver (post-resolution)
3. Update battle row (status, outcome, randFactor)
4. On attacker win: transfer ownership, reset defenseLevel, pillage resources
5. On defender win: apply influence damage, cascade defense penalty
6. Update attacker player (moraleDebuffUntil, attackCooldownUntil, consecutiveLosses)
7. Insert game event (battle_resolved)
8. Insert battle replay log
9. Release target parcel (activeBattleId=null)

**Atomicity:** Per-battle operations succeed or fail together
**Isolation:** Each battle resolved independently

---

## 7. Randomness, Proof, and Replayability

### Random Number Generation

**Algorithm:** mulberry32 (fast 32-bit PRNG)
**File:** `server/engine/battle/random.ts:mulberry32()`
**Seed construction:** `hashSeed(battleId, startTs)`
**File:** `server/engine/battle/random.ts:hashSeed()`
**Algorithm:** djb2-style hash of concatenated parts

**Properties:**
- Deterministic: same seed → same sequence
- Reproducible: can be re-derived from battleId and startTs
- No cryptographic security (not suitable for security-critical randomness)
- Fast: suitable for high-frequency battle resolution

### Battle Proof

**Endpoint:** `GET /api/battle/:id/proof`
**File:** `server/routes.ts` (proof endpoint)
**Storage:** `battle_replays` table

**What the proof stores:**
- battleId
- attackerPower (pre-randFactor)
- defenderPower
- randomSeed
- randFactor
- outcome
- pillagedIron, pillagedFuel, pillagedCrystal
- Full resolution log (BattleLogEntry[])

**What the proof can verify:**
- That the stored outcome matches the deterministic resolution
- That the randFactor was correctly derived from the seed
- That the pillage amounts are correct

**What the proof cannot verify:**
- Full replay from original inputs (troops, iron, fuel, crystal, commander, biome, defenseLevel, improvements)
- Verification that the frozen powers were correctly calculated from the original inputs
- Verification that the seed was correctly constructed from battleId and startTs

**Replayability verdict:** **Partial.** The proof can verify that the resolution was deterministic given the frozen powers, but it cannot verify that the frozen powers were correctly derived from the original battle inputs. Full replay would require storing the complete battle input (all resolver inputs, frozen state values, formula version, and random seed).

### Deterministic Reconstruction

**Current state:** **Partial.** The resolver is deterministic, but the proof does not store enough information to reconstruct the battle from scratch. To achieve full deterministic reconstruction, the proof would need to store:
- All resolver inputs (troops, iron, fuel, crystal, commanderBonus, moraleDebuffActive, defenseLevel, biome, improvements, orbitalHazardActive)
- Formula version (to handle future formula changes)
- Random seed (already stored)
- Frozen state values (already stored as attackerPower and defenderPower)

---

## 8. Existing Test Coverage and Untested Assumptions

### Test Coverage

**resolve.spec.ts:**
- Determinism (same inputs → same output)
- Power calculation (troops, iron, fuel, commanderBonus)
- Pillage calculation (30% of stored resources)
- Biome modifiers (mountain=1.4, water=0.5)
- Morale debuff (15% attack penalty)
- Orbital hazard (20% defense penalty)
- Improvement defense contributions (turret, shield_gen, fortress)

**tuning.spec.ts:**
- Balance invariants (constants are reasonable)

**verify.spec.ts:**
- Proof verification (re-derive outcome from stored data)

**replayLog.spec.ts:**
- Replay log serialization

**random.spec.ts:**
- mulberry32 determinism
- hashSeed determinism

### Untested Assumptions

1. **Radar Array modifier:** No test verifies that Radar Array correctly scales attacker inputs ×0.9
2. **Crystal power contribution:** No test verifies that crystal correctly contributes via CRYSTAL_POWER_FACTOR
3. **Commander availability:** No test verifies that locked commanders are correctly rejected
4. **Concurrent attacks:** No test verifies that concurrent attacks on the same target are correctly prevented
5. **Sub-parcel attack divergence:** No test verifies that sub-parcel attacks bypass idempotency, scheduling, and proof
6. **Special attack divergence:** No test verifies that special attacks bypass the resolver
7. **AI attack unification:** No test verifies that AI attacks use the same deployAttack() path as human attacks

---

## 9. Critical Architectural Gaps

1. **Weapon archetypes are disconnected:** Displayed in Armory UI but not consumed by resolver
2. **Energy alignments are placeholders:** Stored on sub-parcels but have zero gameplay effect
3. **Sub-parcel archetypes are not consumed:** Persisted but not used in plot attacks
4. **Attack doctrines do not exist:** No schema field, no UI selector, no resolver logic
5. **CombatProfile and BattleSnapshot are not integrated:** Contracts exist but are not built or persisted
6. **Facility integrity is absent:** No HP-like state, no damage, no repair
7. **Tactical timeline is absent:** No phased resolution, no timeline events
8. **Battle proof is incomplete:** Cannot verify full replay from original inputs
9. **Sub-parcel attacks lack safeguards:** No idempotency, no scheduling, no proof
10. **Special attacks bypass resolver:** No unified battle pipeline

---

## 10. Target Authoritative Battle Pipeline

**TARGET (not implemented):**

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

## 11. Planned Resolution Phases

**PLANNED (not implemented):**

1. **Intelligence and detection**
   - Eligible systems: recon, drones, satellites, sensor range
   - Authoritative inputs: origin facility recon level, target facility stealth level
   - Outputs: detection probability, target visibility
   - Deterministic calculation boundary: seeded random for detection rolls
   - Permitted seeded randomness: detection success/failure
   - Timeline events: "Recon sweep initiated", "Target detected", "Target hidden"
   - Persistence timing: immediate
   - Required tests: detection probability tests, stealth interaction tests

2. **Approach and interception**
   - Eligible systems: weapon range, interception, shields
   - Authoritative inputs: origin weapon range, target interception level
   - Outputs: interception probability, approach success
   - Deterministic calculation boundary: seeded random for interception rolls
   - Permitted seeded randomness: interception success/failure
   - Timeline events: "Attack force launched", "Interception attempt", "Approach successful"
   - Persistence timing: immediate
   - Required tests: interception probability tests, range validation tests

3. **Long-range / siege engagement**
   - Eligible systems: siege weapons, artillery, fortification penetration
   - Authoritative inputs: origin weapon archetype, target fortification level
   - Outputs: siege damage, fortification reduction
   - Deterministic calculation boundary: seeded random for damage rolls
   - Permitted seeded randomness: damage variance
   - Timeline events: "Siege barrage initiated", "Fortification damaged", "Defenses weakened"
   - Persistence timing: immediate
   - Required tests: siege damage tests, fortification interaction tests

4. **Main assault**
   - Eligible systems: troops, iron, fuel, crystal, commander
   - Authoritative inputs: committed resources, commander bonus
   - Outputs: attacker power, defender power, outcome
   - Deterministic calculation boundary: seeded random for randFactor
   - Permitted seeded randomness: randFactor ∈ [-10, +10]
   - Timeline events: "Assault commenced", "Attacker power: X", "Defender power: Y"
   - Persistence timing: immediate
   - Required tests: power calculation tests, outcome determination tests

5. **Defensive response**
   - Eligible systems: defenseLevel, improvements, biome, orbital hazard
   - Authoritative inputs: target defenses, biome modifiers
   - Outputs: defense power, damage reduction
   - Deterministic calculation boundary: none (deterministic formula)
   - Permitted seeded randomness: none
   - Timeline events: "Defenses activated", "Damage reduced", "Biome advantage applied"
   - Persistence timing: immediate
   - Required tests: defense calculation tests, biome modifier tests

6. **Facility and system damage**
   - Eligible systems: facility integrity, EMP, sabotage
   - Authoritative inputs: attack power, target facility integrity
   - Outputs: facility damage, system disablement
   - Deterministic calculation boundary: seeded random for damage rolls
   - Permitted seeded randomness: damage variance, disablement probability
   - Timeline events: "Facility damaged", "System disabled", "Integrity reduced"
   - Persistence timing: immediate
   - Required tests: facility damage tests, disablement tests

7. **Retreat, hold, or capture**
   - Eligible systems: capture logic, morale, cooldown
   - Authoritative inputs: outcome, defender morale, attacker cooldown
   - Outputs: capture success, morale debuff, cooldown applied
   - Deterministic calculation boundary: none (deterministic formula)
   - Permitted seeded randomness: none
   - Timeline events: "Territory captured", "Defender retreats", "Morale debuff applied"
   - Persistence timing: immediate
   - Required tests: capture logic tests, morale debuff tests

8. **Persistent aftermath**
   - Eligible systems: pillage, influence damage, cascade defense
   - Authoritative inputs: stored resources, influence level, adjacent plots
   - Outputs: pillaged resources, influence damage, cascade penalties
   - Deterministic calculation boundary: none (deterministic formula)
   - Permitted seeded randomness: none
   - Timeline events: "Resources pillaged", "Influence damaged", "Adjacent defenses reduced"
   - Persistence timing: immediate
   - Required tests: pillage calculation tests, cascade penalty tests

---

## 12. Legacy Resolver KEEP/WRAP/EXTRACT/REPLACE/DEFER Decision

### KEEP

- Deterministic seeded resolution (mulberry32 PRNG, hashSeed)
- Stable random generator and seed construction where sound
- Current production-tested troop/resource formula during parity migration
- Existing transactional resource deduction and target-claim safeguards
- Current result/capture behavior until replacements are independently tested

### WRAP

- Current resolver input construction (wrap to build CombatProfile)
- Current battle launch flow (wrap to create BattleSnapshot)
- Legacy battle records that lack CombatProfile/BattleSnapshot data
- Existing proof generation during the transition

### EXTRACT

- Attack-power calculation (extract to pure function)
- Defense-power calculation (extract to pure function)
- Biome modifier (extract to pure function)
- Casualty calculation (extract to pure function)
- Pillage/reward calculation (extract to pure function)
- Capture decision (extract to pure function)
- Seeded-random adjustment (extract to pure function)
- Any other formula that can become a pure versioned function

### REPLACE LATER

- Mutable-state reads performed after launch (replace with snapshot-based reads)
- Divergent sub-parcel resolution assumptions (replace with unified pipeline)
- Proof records that cannot reproduce the full result (replace with complete snapshot)
- Overloaded variables that combine conceptually different modifiers (replace with separate fields)
- Any special-attack behavior that bypasses required accounting or safety rules

### DEFER

- Final numeric weapon effects
- Doctrine balance
- Facility bonuses
- Energy-alignment bonuses
- Brownout combat penalties
- Persistent structural damage
- Salvage and conversion
- Tactical visualization

---

## 13. PR-Sized Migration Sequence

### PR A — CombatProfile/BattleSnapshot Launch Adapter

**Branch:** `feat/frontier-battle-profile-launch-adapter`
**Goal:** Construct a server-authoritative CombatProfile from the existing live attack, create an immutable BattleSnapshot at launch, adapt the snapshot into the existing resolver inputs, keep the existing resolver formula unchanged, prove exact output parity against the legacy path, add no weapon/doctrine/facility/alignment/energy/upgrade effects, preserve an immediate rollback path to the current resolver input builder.

**Files:**
- `server/storage/db.ts` (deployAttack: build CombatProfile and BattleSnapshot)
- `shared/combatProfile.ts` (already exists, no changes needed)

**Forbidden:**
- No resolver changes
- No weapon/facility/alignment/doctrine effects
- No schema changes
- No migration
- No client changes

**DB impact:** None (in-memory only, no persistence)

**Tests:**
- Parity test: verify that snapshot-based resolution produces identical output to legacy path
- Rollback test: verify that legacy path still works if snapshot construction fails

**Rollout gate:** Parity test green, no production behavior change

**Rollback:** Revert code (no migration to rollback)

**Risk:** LOW (no persistence, no schema changes, immediate rollback)

**Agent mode:** Auto Efficient

---

### PR B — Snapshot Persistence and Replay Verification

**Branch:** `feat/frontier-battle-snapshot-persistence`
**Goal:** Persist immutable snapshot data, add formula/profile versioning, verify deterministic replay from stored evidence, add an additive migration only if required, preserve compatibility with battles created before the migration.

**Files:**
- `server/db-schema.ts` (add nullable `combatProfileJson` column)
- `migrations/0016_battles_combat_profile.sql` (additive migration)
- `server/storage/db.ts` (persist snapshot JSON)
- `server/engine/battle/resolve.ts` (add replay test)

**Forbidden:**
- No resolver changes
- No weapon/facility/alignment/doctrine effects
- No destructive migration

**DB impact:** Additive nullable column

**Tests:**
- Replay test: load snapshot, re-derive outcome, verify match
- Compatibility test: verify that battles created before migration still resolve correctly

**Rollout gate:** Replay test green, compatibility test green

**Rollback:** Drop column, revert code

**Risk:** LOW (additive migration, rollback-safe)

**Agent mode:** Auto Efficient

---

### PR C — Human and AI Launch-Path Unification

**Branch:** `feat/frontier-unified-battle-launch`
**Goal:** Make both human and AI attacks use the same authoritative profile builder, keep actor-specific intent and target-selection behavior separate, prevent divergence in combat-state construction.

**Files:**
- `server/storage/ai-engine.ts` (verify AI uses same CombatProfile builder)
- `server/storage/db.ts` (verify deployAttack() is shared)

**Forbidden:**
- No resolver changes
- No weapon/facility/alignment/doctrine effects
- No schema changes

**DB impact:** None

**Tests:**
- Unification test: verify AI attack produces same snapshot structure as human

**Rollout gate:** Unification test green

**Rollback:** Revert code

**Risk:** LOW (verification only, no behavior change)

**Agent mode:** Auto Efficient

---

### PR D — Sub-Parcel and Special-Path Normalization

**Branch:** `feat/frontier-normalized-battle-paths`
**Goal:** Decide which paths become normal battles, decide which remain immediate strategic effects, apply compatible authorization, idempotency, accounting, proof, and consequence rules.

**Files:**
- `server/routes.ts` (sub-parcel attack, special attacks)
- `server/storage/db.ts` (sub-parcel attack persistence)

**Forbidden:**
- No resolver changes
- No weapon/facility/alignment/doctrine effects

**DB impact:** May require additive columns for sub-parcel battles

**Tests:**
- Normalization test: verify sub-parcel attacks use same pipeline as plot attacks
- Special-attack test: verify special attacks use compatible consequence rules

**Rollout gate:** Normalization test green, special-attack test green

**Rollback:** Revert code, drop columns

**Risk:** MEDIUM (behavior change for sub-parcel attacks)

**Agent mode:** Auto Balanced

---

### PR E — Weapon Equipment Connection with Effects Disabled

**Branch:** `feat/frontier-weapon-equipment`
**Goal:** Persist and validate equipped weapon identity, include it in CombatProfile and BattleSnapshot, do not apply numeric weapon effects yet.

**Files:**
- `server/db-schema.ts` (add `weaponArchetype` column)
- `migrations/0017_weapon_archetype.sql` (additive migration)
- `server/storage/db.ts` (persist weapon archetype)
- `shared/combatProfile.ts` (include weapon in profile)

**Forbidden:**
- No resolver changes
- No weapon effects
- No destructive migration

**DB impact:** Additive nullable column

**Tests:**
- Persistence test: verify weapon archetype is persisted
- Profile test: verify weapon is included in CombatProfile
- No-effect test: verify resolver ignores weapon

**Rollout gate:** Persistence test green, profile test green, no-effect test green

**Rollback:** Drop column, revert code

**Risk:** LOW (additive migration, no behavior change)

**Agent mode:** Auto Efficient

---

### PR F — Attack Doctrine Contract and Selection

**Branch:** `feat/frontier-attack-doctrine`
**Goal:** Add server-validated doctrine identity, include it in the immutable snapshot, initially use neutral/no-effect behavior if needed for safe rollout.

**Files:**
- `shared/schema.ts` (add `attackDoctrine` field)
- `migrations/0018_attack_doctrine.sql` (additive migration)
- `server/routes.ts` (accept doctrine in attack request)
- `shared/combatProfile.ts` (include doctrine in profile)

**Forbidden:**
- No resolver changes
- No doctrine effects (initially)
- No destructive migration

**DB impact:** Additive nullable column

**Tests:**
- Validation test: verify doctrine is validated
- Profile test: verify doctrine is included in CombatProfile
- No-effect test: verify resolver ignores doctrine

**Rollout gate:** Validation test green, profile test green, no-effect test green

**Rollback:** Drop column, revert code

**Risk:** LOW (additive migration, no behavior change)

**Agent mode:** Auto Efficient

---

### PR G — Facility and Energy-State Consumption

**Branch:** `feat/frontier-facility-energy-integration`
**Goal:** Read facility archetype, upgrades, alignment, integrity, and power state, apply only documented and tested effects, define brownout behavior explicitly.

**Files:**
- `server/db-schema.ts` (add facility state columns)
- `migrations/0019_facility_state.sql` (additive migration)
- `server/storage/db.ts` (persist facility state)
- `shared/combatProfile.ts` (include facility state in profile)
- `server/engine/battle/resolve.ts` (apply facility effects)

**Forbidden:**
- No destructive migration
- No undocumented effects

**DB impact:** Additive nullable columns

**Tests:**
- Facility effect tests: verify facility effects are applied
- Brownout tests: verify brownout behavior is correct
- Integration tests: verify facility state is read correctly

**Rollout gate:** Facility effect tests green, brownout tests green

**Rollback:** Drop columns, revert code

**Risk:** HIGH (behavior change, complex integration)

**Agent mode:** Auto Frontier

---

### PR H — Phased Resolver Introduction

**Branch:** `feat/frontier-phased-resolver`
**Goal:** Introduce intelligence, approach, siege, assault, defense, damage, capture/retreat, and aftermath phases, preserve deterministic seeded behavior and versioning.

**Files:**
- `server/engine/battle/resolve.ts` (implement phased resolution)
- `server/engine/battle/types.ts` (add phase types)

**Forbidden:**
- No schema changes
- No persistence changes

**DB impact:** None

**Tests:**
- Phase tests: verify each phase produces correct output
- Parity tests: verify phased resolution matches legacy resolution for simple cases
- Versioning tests: verify formula versioning works

**Rollout gate:** Phase tests green, parity tests green

**Rollback:** Revert code

**Risk:** HIGH (major behavior change, complex implementation)

**Agent mode:** Auto Frontier

---

### PR I — Persistent Facility Damage and Repair

**Branch:** `feat/frontier-facility-damage-repair`
**Goal:** Add facility integrity, damage on attack, repair route.

**Files:**
- `server/db-schema.ts` (add `integrity` column)
- `migrations/0020_facility_integrity.sql` (additive migration)
- `server/storage/db.ts` (persist integrity, apply damage)
- `server/routes.ts` (add repair route)
- `server/engine/battle/resolve.ts` (apply damage)

**Forbidden:**
- No destructive migration

**DB impact:** Additive nullable column

**Tests:**
- Damage tests: verify damage is applied correctly
- Repair tests: verify repair works correctly
- Integrity tests: verify integrity is persisted

**Rollout gate:** Damage tests green, repair tests green

**Rollback:** Drop column, revert code

**Risk:** HIGH (behavior change, complex integration)

**Agent mode:** Auto Frontier

---

### PR J — Capture, Salvage, Conversion, and Demolition

**Branch:** `feat/frontier-capture-salvage-conversion`
**Goal:** Add salvage route, conversion route, capture inheritance.

**Files:**
- `server/routes.ts` (add salvage, conversion routes)
- `server/storage/db.ts` (implement salvage, conversion logic)
- `server/engine/battle/resolve.ts` (apply capture inheritance)

**Forbidden:**
- No schema changes (use existing columns)

**DB impact:** None

**Tests:**
- Salvage tests: verify salvage works correctly
- Conversion tests: verify conversion works correctly
- Capture inheritance tests: verify capture inheritance works correctly

**Rollout gate:** Salvage tests green, conversion tests green, capture inheritance tests green

**Rollback:** Revert code

**Risk:** MEDIUM (behavior change, complex logic)

**Agent mode:** Auto Balanced

---

### PR K — Tactical Timeline and Battle Presentation

**Branch:** `feat/frontier-tactical-timeline`
**Goal:** Add battle timeline events, tactical view rendering.

**Files:**
- `server/engine/battle/resolve.ts` (emit timeline events)
- `client/src/components/game/TacticalView.tsx` (new component)

**Forbidden:**
- No resolver changes

**DB impact:** Additive table for timeline events

**Tests:**
- Timeline event tests: verify timeline events are emitted
- Tactical view tests: verify tactical view renders correctly

**Rollout gate:** Timeline event tests green, tactical view tests green

**Rollback:** Drop table, revert code

**Risk:** MEDIUM (new UI component, complex rendering)

**Agent mode:** Auto Balanced

---

### PR L — Simulation and Balancing Harness

**Branch:** `feat/frontier-simulation-harness`
**Goal:** Build simulation harness for balance testing, generate balance reports.

**Files:**
- `server/engine/battle/sim.ts` (build simulation harness)

**Forbidden:**
- No resolver changes
- No schema changes

**DB impact:** None

**Tests:**
- Simulation tests: verify simulation runs correctly
- Balance report tests: verify balance reports are generated

**Rollout gate:** Simulation tests green, balance report tests green

**Rollback:** Revert code

**Risk:** LOW (tooling only, no behavior change)

**Agent mode:** Auto Balanced

---

## 14. Explicit Non-Goals

- Do not change the deterministic formula during initial migration (preserve production behavior)
- Do not add weapon/facility/alignment/doctrine effects until later phases
- Do not implement phased resolution until snapshot persistence is proven
- Do not implement persistent damage/repair until facility archetypes are persisted
- Do not implement tactical view until phased resolution is complete
- Do not unify special attacks with plot attacks until phased resolution is ready
- Do not move high-frequency state (integrity, energy, cooldowns) on-chain

---

## 15. Production Safety and Compatibility Rules

- One PR at a time (application-code phases)
- Additive migrations only (no destructive changes)
- Parity tests required for any resolver change
- Rollback flag required for any snapshot-based change
- No client-trusted combat bonuses (all derived server-side)
- No mutable state reread after launch (snapshot-based resolution)
- No double-spend (idempotency with payload fingerprint)
- No mainnet changes without `/mainnet-gate` PASS + `algo-auditor` PASS

---

## 16. Owner Decisions Required

1. **Weapon archetype effects:** Should weapon archetypes connect to plot attacks, or remain a separate interception system?
2. **Energy alignment effects:** Should helios/aegis/nexus have gameplay effects? If so, what?
3. **Attack doctrine balance:** What are the final numeric values for doctrine modifiers?
4. **Facility archetype mapping:** How should legacy sub-parcel categories map to canonical facility archetypes?
5. **Phased resolution scope:** Should all attacks (plot, sub-parcel, special) use phased resolution, or only plot attacks?
6. **Persistent damage balance:** What are the final numeric values for integrity, damage, and repair?
7. **Tactical view scope:** Should the tactical view be 2D, 2.5D, or 3D? What layers should be visible?

---

## 17. Canonical Source Paths

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
