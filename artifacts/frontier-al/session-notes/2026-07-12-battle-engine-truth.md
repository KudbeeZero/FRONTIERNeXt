# Session Note — 2026-07-12 — Battle Engine Truth and Target Architecture

**Session type:** Documentation (memory-first architecture lane)  
**Duration:** ~30 min  
**Cost:** ~$1.50 (within $2 target)  
**Agent:** Auto Balanced

---

## Summary

Established canonical battle-engine truth document that traces the exact current implementation, identifies all disconnected/placeholder systems, and defines the target authoritative pipeline with a safe migration sequence.

## Work Completed

### 1. Battle Engine Memory Document Created
- **Location:** `docs/memory/FRONTIER_BATTLE_ENGINE_TRUTH_AND_TARGET.md`
- **Size:** ~1200 lines
- **Sections:**
  1. Executive verdict
  2. Current live battle pipeline (21-step trace)
  3. Current formula truth (exact resolver consumption)
  4. Human/AI/sub-parcel/special-attack divergence analysis
  5. Battle-system connection matrix (40 systems classified)
  6. Transaction and persistence boundaries
  7. Randomness and proof behavior
  8. Current test coverage
  9. Critical architectural gaps
  10. Target authoritative pipeline
  11. Proposed resolution phases (8 phases)
  12. Legacy resolver keep/wrap/extract/replace decision
  13. PR-sized migration sequence (12 PRs: A-L)
  14. Explicit non-goals
  15. Production safety rules
  16. Owner decisions required
  17. Canonical source paths

### 2. Key Findings

**Current Engine Status:**
- ✅ Deterministic resolution with provable fairness (public seed, mulberry32 PRNG)
- ✅ Human and AI attacks share same canonical `deployAttack()` path
- ✅ Idempotency prevents double-spend on plot attacks (PR #250)
- ✅ Resource accounting is transactional and atomic
- ✅ Capture, cooldown, and morale debuff correctly persisted
- ✅ Battle proof and replay log enable independent verification

**Disconnected Systems:**
- ❌ Weapon archetypes displayed but not consumed by resolver
- ❌ Energy alignments stored but have zero gameplay effect
- ❌ Sub-parcel archetypes persisted but not consumed by plot attacks
- ❌ Attack doctrines do not exist in schema or resolver
- ❌ CombatProfile and BattleSnapshot contracts exist but not integrated
- ❌ Facility integrity, damage, repair, salvage, conversion absent
- ❌ Tactical timeline and phased resolution absent

**Battle-Path Divergence:**
- Human plot attack: uses full canonical pipeline (deployAttack → resolveBattle)
- AI plot attack: uses same canonical pipeline (shared via deployAttack)
- Sub-parcel attack: bypasses idempotency, scheduling, and proof (direct resolveBattle)
- Special attacks (EMP/sabotage/orbital strike/siege barrage): bypass resolver entirely (instant effect)
- Drones/satellites: deployment only, not attacks

**Connection Matrix (40 systems):**
- LIVE_AND_CONSUMED: 8 systems (troops, iron, fuel, crystal, Commander, biome, defense, cooldown, proof)
- STORED_NOT_CONSUMED: 15 systems (origin subplot, legacy archetype, weapon archetype, energy alignment, faction, recon, shields, EMP, sabotage, drones, satellites, etc.)
- CONTRACT_ONLY: 2 systems (CombatProfile, BattleSnapshot)
- CATALOG_ONLY: 2 systems (facility archetypes, weapon archetypes)
- DISCONNECTED: 1 system (weapon archetypes)
- ABSENT: 12 systems (attack doctrines, facility integrity, persistent damage, repair, salvage, conversion, timeline, etc.)

### 3. Recommended Migration Sequence

**First Implementation PR (Phase A):**
- Build CombatProfile from existing live attack
- Create immutable BattleSnapshot
- Continue using existing resolver (no changes)
- Prove exact legacy output parity
- Add no weapon/doctrine/facility/alignment effects
- Allow immediate rollback

**Files:**
- `server/storage/db.ts` (deployAttack)
- `server/db-schema.ts` (add nullable column)
- `migrations/0016_battles_combat_profile.sql` (additive)
- `server/storage/db.spec.ts` (parity test)

**Risk:** LOW (additive, rollback-safe, parity-tested)

**Full Migration Sequence (12 PRs):**
- A. CombatProfile launch adapter with legacy parity
- B. Snapshot persistence and replay tests
- C. Human/AI launch-path unification
- D. Special-attack normalization
- E. Weapon-equipment connection with effects disabled
- F. Doctrine contract and selection
- G. Facility/energy-state consumption
- H. Phased resolver introduction
- I. Persistent facility damage and repair
- J. Capture, salvage, and conversion
- K. Tactical timeline/presentation
- L. Simulation and balancing harness

### 4. Documentation Updates

- **HANDOFF.md:** Added reference to battle-engine memory document with verdict and recommended first PR
- **Session note:** This file

---

## Verification

### PR #251 Verification
- ✅ PR #251 merged at `2139865` (2026-07-12T12:47:03Z)
- ✅ No open PRs after merge
- ✅ Working tree clean before branch creation

### Battle Engine Memory Verification
- ✅ All 21 pipeline steps documented with exact file/function/field references
- ✅ All resolver inputs classified (server-derived, client-supplied, DB-derived, seeded random)
- ✅ All 40 systems classified in connection matrix
- ✅ All 8 battle paths compared (human/AI/sub-parcel/EMP/sabotage/orbital strike/siege barrage/drones/satellites)
- ✅ Target pipeline defined with required principles
- ✅ Legacy resolver decision documented (keep/wrap/extract/replace/defer)
- ✅ 12-PR migration sequence defined with files, tests, rollout gates, rollback boundaries, risk levels
- ✅ Owner decisions required listed (7 open questions)

---

## Files Created/Modified

### Created
- `docs/memory/FRONTIER_BATTLE_ENGINE_TRUTH_AND_TARGET.md` (~1200 lines)
- `artifacts/frontier-al/session-notes/2026-07-12-battle-engine-truth.md` (this file)

### Modified
- `docs/HANDOFF.md` (added battle-engine memory reference)

---

## Cost Control

- **Target:** ≤$2.00
- **Actual:** ~$1.50
- **Checkpoint:** Stopped discovery at $1.00 and began writing
- **Hard stop:** Not triggered (document complete before $2.50)

---

## Handoff

**Next agent:** Auto Efficient or Auto Balanced  
**Next task:** Phase A (CombatProfile launch adapter with legacy parity)  
**Branch:** `docs/frontier-battle-engine-truth` (pending PR #252)  
**PR:** #252 (pending merge)

**Baton:**
- ✅ PR #251 merged (canonical documentation)
- ✅ Battle-engine memory established (truth + target architecture)
- ⏳ Migration 0015 deployment pending (owner action)
- ⏳ AI cost-control activation pending (owner action)
- 📝 Next: Phase A (CombatProfile launch adapter) or P1.2 (manual corrections)

---

**Session complete.** All objectives met within budget.
