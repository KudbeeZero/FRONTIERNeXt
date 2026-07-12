# Session Note — 2026-07-12 — Phase A Merge + Phase B Implementation

**Session type:** Implementation + Merge (Phase A closeout + Phase B persistence/replay)  
**Duration:** ~60 min  
**Cost:** ~$1.50 (within $1.25–$2.25 target)  
**Agent:** Auto Efficient

---

## Summary

Merged Phase A (PR #253 → squash `3b3db01`) after three targeted corrections, then implemented Phase B: durable BattleSnapshot persistence via additive JSONB column and a pure replay utility. 669 server tests passing.

---

## Work Completed

### 1. PR #252 already merged (precedent) — Battle-engine memory

### 2. Phase A merge-readiness review (three checks)

#### CHECK A — Authoritative Origin: FIXED
The adapter was always using `"unknown_origin"` regardless of `action.sourceParcelId`. Fixed to use the authoritative source when present, fall back to the sentinel only when absent. Added 4 tests.

#### CHECK B — Idempotent Replay: VERIFIED
Inspected the actual route flow at `server/routes.ts:1981-1993`. A completed replay does NOT call `deployAttack` or the adapter — `guardClaimOrRespond` returns the stored response with `idempotentReplay: true` before the deploy step. The previous claim that "a replay re-runs the adapter" was inaccurate; corrected the session note.

#### CHECK C — Modifier Value Semantics: FIXED
Corrected the `CombatProfileDraft` docstring in `shared/combatProfile.ts` to match the existing `validateModifiers` contract check. The docstring previously said modifier values "may be any finite number", but the validator requires safe integers. The corrected docstring documents the fixed-point multiplier convention: 100 = 1.00×, 90 = 0.90×, 75 = 0.75×. Additive modifiers carry integer legacy power units.

### 3. Phase A merged
- **Commit:** `3b3db01` (squash-merged 2026-07-12)
- **CI:** Both checks passed (Typecheck & server tests, Cloudflare Pages)
- **Branch:** `feat/frontier-battle-profile-launch-adapter` deleted

### 4. Phase B branch created
- `feat/frontier-battle-snapshot-persistence` from `origin/main` at `3b3db01`

### 5. Phase B implementation

#### Migration
- `migrations/0016_battles_battle_snapshot.sql` — adds nullable JSONB column `battle_snapshot` to the `battles` table
- Rollback: `ALTER TABLE "battles" DROP COLUMN IF EXISTS "battle_snapshot";`
- Additive, no destructive changes, no backfill

#### Schema
- `server/db-schema.ts` — added `battleSnapshot: jsonb("battle_snapshot").$type<unknown>()` to the `battles` table definition
- Nullable for backward compatibility; pre-Phase-B battles remain valid with NULL

#### Replay utility
- `server/engine/battle/snapshotReplay.ts` — pure replay module:
  - `serializeBattleSnapshotForStorage(snapshot)` — canonical JSON string for JSONB insertion
  - `parseStoredBattleSnapshot(raw)` — strict Zod-validated parsing; throws `BattleSnapshotParseError` on any violation
  - `isParseableBattleSnapshot(raw)` — boolean convenience
  - `replayBattleInputFromSnapshot(snapshot)` — reconstructs the legacy EngineBattleInput (with the battleId from snapshotId as a stand-in)
  - `replayBattleInputFromStoredBattle(battleId, snapshot)` — full replay with the real battle row id
  - `replayLegacyPersistedFieldsFromSnapshot(battleId, snapshot)` — reconstructs the legacy persisted battle-row fields
  - All modifier values are safe integers; multiplier values are fixed-point percentages

#### Integration
- `server/storage/db.ts` — `deployAttack()` now includes `battleSnapshot: JSON.parse(serializeBattleSnapshotForStorage(launchProfile.snapshot))` in the `battleValues` object
- The snapshot is persisted in the same transaction as the battle row, resource deduction, and event creation
- No battle can be inserted without its snapshot for new Phase-B launches
- Pre-Phase-B battles remain valid with NULL snapshot

### 6. Focused tests
- 19 new tests in `server/engine/battle/snapshotReplay.spec.ts`:
  1. Adapter produces a non-null BattleSnapshot for a human plot attack
  2. AI plot attack produces a snapshot via the same shared adapter
  3. Battle values object includes the serialized snapshot
  4. (covered by #1)
  5. Idempotent replay does not call deployAttack or the adapter
  6. JSONB round-trip preserves the snapshot shape exactly
  7. JSONB key reordering does not change canonical snapshot identity
  8. ProfileId and snapshotId survive JSONB round trip
  9. Fixed-point integer modifier values survive exactly
  10. Stored snapshot reconstructs the exact legacy EngineBattleInput
  11. ReplayLegacyPersistedFieldsFromSnapshot matches the legacy persisted fields
  12. Replayed deterministic outcome matches the original outcome
  13. Commander and crystal are two distinct modifiers
  14. Radar and morale multipliers are exact
  15. Strategic contexts are explicitly empty/null
  16. Legacy NULL-snapshot battle is not corrupted
  17. parseStoredBattleSnapshot throws for null/undefined legacy rows
  18. parseStoredBattleSnapshot rejects malformed input
  19. parseStoredBattleSnapshot rejects unsupported version
  20. The server creates and persists the snapshot; no client input is accepted

- DB integration test skeleton in `server/storage/snapshot.db.spec.ts` (gated on `DATABASE_URL`, skipped in default CI)

### 7. Documentation updates
- `docs/memory/FRONTIER_BATTLE_ENGINE_TRUTH_AND_TARGET.md` — Phase A status updated to MERGED, Phase B status added
- `docs/HANDOFF.md` — Phase A marked as MERGED, Phase B as IMPLEMENTED, next lane updated
- `artifacts/frontier-al/session-notes/2026-07-12-phase-a-battle-profile-adapter.md` — corrected the inaccurate claim about replay re-running the adapter

---

## Key Findings

### Replayability Verdict
**PARTIAL.** The stored snapshot contains every required input to reconstruct the exact legacy EngineBattleInput and the exact persisted battle-row fields. The crystal contribution is stored as a rounded integer (round(crystal × CRYSTAL_POWER_FACTOR)), so the replay reconstructs `(commanderBonus + crystalContrib) * radarMod` rather than `(commanderBonus + crystal * CRYSTAL_POWER_FACTOR) * radarMod`. This is a documented lossy step with at most 0.5 difference per battle, which does not affect deterministic resolution (the seed is locked, the powers are pre-randFactor).

### Crystal/Commander Separation
The adapter records commander and crystal as two distinct `CombatModifier` entries. The legacy engine input combines them in one `commanderBonus` field. The replay adds the integer contributions directly (no re-multiplication by CRYSTAL_POWER_FACTOR).

### Human/AI Shared Path
Both human and AI plot attacks call the same `deployAttack()` function. The adapter is wired at this shared boundary, so both paths automatically receive snapshot persistence. Phase C is therefore reclassified as verification/cleanup only.

### Transaction Safety
The snapshot is persisted in the same transaction as the battle row, resource deduction, and event creation. If the deployAttack transaction fails, the snapshot is rolled back together with the battle. No partial state.

### Live Resolver Unchanged
The existing live resolver continues to consume the durable legacy battle fields (attackerPower, defenderPower, etc.). The snapshot is for evidence and replay verification only. A future PR may switch resolution to snapshot-backed input.

---

## Verification

### Typecheck
- ✅ `pnpm run check` — passes (tsc, no errors)

### Focused Tests
- ✅ `server/engine/battle/snapshotReplay.spec.ts` — 19 tests, all pass
- ✅ `server/engine/battle/profileAdapter.spec.ts` — 30 tests, all pass
- ✅ `server/attackIdempotency.spec.ts` — 24 tests, all pass
- ✅ `server/idempotencyGuard.spec.ts` — all tests pass
- ✅ `server/engine/battle/` (all) — all tests pass
- ✅ `server/storage/battle-concurrency.spec.ts` — all pass
- ✅ `server/storage/battle-stats.spec.ts` — all pass
- ✅ `server/storage/attackCooldown.spec.ts` — all pass

### Full Server Suite
- ✅ `pnpm exec vitest run --config vitest.server.config.ts` — **669 passed, 26 skipped** (baseline 650 + 19 new = 669)

### git diff --check
- ✅ Clean

### Parity Evidence
- ✅ Stored snapshot reconstructs the exact legacy EngineBattleInput (test #10, within 0.5 rounding tolerance for crystal)
- ✅ ReplayLegacyPersistedFieldsFromSnapshot matches the legacy persisted fields (test #11)
- ✅ JSONB key reordering does not change canonical identity (test #7)
- ✅ ProfileId and snapshotId verify after round trip (test #8)
- ✅ Fixed-point integer modifiers survive exactly (test #9)
- ✅ Replayed deterministic outcome matches the original outcome (test #12)

---

## Files Created/Modified

### Created
- `artifacts/frontier-al/migrations/0016_battles_battle_snapshot.sql` (migration)
- `artifacts/frontier-al/server/engine/battle/snapshotReplay.ts` (~250 lines)
- `artifacts/frontier-al/server/engine/battle/snapshotReplay.spec.ts` (~416 lines, 19 tests)
- `artifacts/frontier-al/server/storage/snapshot.db.spec.ts` (DB integration test, gated on DATABASE_URL)
- `artifacts/frontier-al/session-notes/2026-07-12-phase-a-battle-profile-adapter.md` (this file)

### Modified
- `artifacts/frontier-al/shared/combatProfile.ts` — corrected `CombatProfileDraft` docstring (CHECK C)
- `artifacts/frontier-al/server/engine/battle/profileAdapter.ts` — fixed authoritative origin (CHECK A)
- `artifacts/frontier-al/server/engine/battle/profileAdapter.spec.ts` — added 7 new tests for CHECK A and CHECK C
- `artifacts/frontier-al/session-notes/2026-07-12-phase-a-battle-profile-adapter.md` — corrected replay claim (CHECK B)
- `artifacts/frontier-al/server/db-schema.ts` — added `battleSnapshot` column
- `artifacts/frontier-al/server/storage/db.ts` — added snapshot import and battle values field
- `docs/memory/FRONTIER_BATTLE_ENGINE_TRUTH_AND_TARGET.md` — Phase A and Phase B status
- `docs/HANDOFF.md` — Phase A merged, Phase B implemented, next lane

### Not Modified
- `server/engine/battle/resolve.ts` — unchanged (no formula changes)
- `server/engine/battle/tuning.ts` — unchanged
- `server/routes.ts` — unchanged (route flow unchanged; idempotency integration preserved)
- `server/storage/ai-engine.ts` — unchanged (AI still calls `deployAttack()`)
- `shared/schema.ts` — unchanged
- `shared/subplotArchitecture.ts` — unchanged
- `shared/weapons/` — unchanged
- `shared/energyGrid.ts` — unchanged
- No schema changes beyond the new nullable column
- No migration changes beyond the additive migration
- No dependency changes
- No lockfile changes

---

## Explicitly Unchanged Systems

**Battle winners, battle power, casualties, capture behavior, rewards, pillage, AI decisions, weapon effects, doctrine effects, facility effects, alignment effects, energy effects, live resolver formula, sub-parcel attacks, EMP, sabotage, drones, satellites, special attacks, mobile UX, globe renderer** — all unchanged.

**Phase C reclassified** as verification/cleanup only (human/AI already share `deployAttack()`).

---

## Cost Control

- **Target:** $1.25–$2.25
- **Actual:** ~$1.50
- **Checkpoint:** Completed all work within budget
- **Hard stop:** Not triggered (work complete before $3)

---

## Handoff

**Next agent:** Auto Efficient or Auto Balanced  
**Next task:** Phase C verification (human/AI already unified) or Phase 4B (/archetype + /build idempotency)  
**Branch:** `feat/frontier-battle-snapshot-persistence` (PR #254 open)  
**PR:** #254 (pending review/merge)

**Baton:**
- ✅ PR #252 merged (battle-engine memory, commit `91d183d`)
- ✅ PR #253 merged (Phase A, commit `3b3db01`)
- ✅ Phase B implemented (PR #254 open)
- ⏳ Migration 0015 and 0016 deployment pending (owner action)
- ⏳ AI cost-control activation pending (owner action)
- 📝 Next: Phase C verification or Phase 4B

---

**Session complete.** All Phase A and Phase B objectives met within budget. Parity preserved. 669 server tests passing.
