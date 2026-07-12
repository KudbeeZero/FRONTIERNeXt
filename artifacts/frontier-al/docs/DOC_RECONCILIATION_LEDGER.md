# Documentation Reconciliation Ledger

**Status:** Living document tracking doc-vs-code mismatches  
**Last updated:** 2026-07-12  
**Governing commit:** `da35c7e` (PR #250 merged)

---

## Purpose

This ledger tracks discrepancies between documentation and code reality. Each entry includes:
- Document path and section
- Claim in documentation
- Actual code behavior
- Status (LIVE/PARTIAL/CONTRACT_ONLY/PLANNED/REMOVE/OWNER_DECISION)
- Recommended action

**Priority order:**
1. Systems documented as LIVE but not connected
2. Contract-only behavior presented as live
3. Numerical mismatches
4. Terminology mismatches
5. Stale status claims

---

## Critical Mismatches

### 1. Weapon Archetypes in Combat

**Document:** `artifacts/frontier-al/GAME_MANUAL.md` §14 (Combat System)  
**Claim:** Weapon archetypes (Siege Baron, Artillery Marshal, etc.) affect combat resolution  
**Code reality:** `server/engine/battle/resolve.ts:resolveBattle()` never reads weapon profile  
**Status:** DISCONNECTED  
**Recommended action:** Mark as DISCONNECTED in manual, add note that weapon system is separate from plot attacks

**Evidence:**
- `shared/weapons/archetypes.ts` defines 6 archetypes
- `server/engine/battle/resolve.ts:31-35` calculates attacker power from troops/iron/fuel/commanderBonus only
- No weapon archetype parameter in `BattleInput` type

---

### 2. Energy Alignment Effects

**Document:** `artifacts/frontier-al/GAME_MANUAL.md` §7 (Sub-Parcels)  
**Claim:** Energy alignments (helios/aegis/nexus) provide gameplay effects  
**Code reality:** `subParcels.energyAlignment` stored but never consumed by any game logic  
**Status:** PLACEHOLDER  
**Recommended action:** Mark as PLACEHOLDER, note that alignment is stored but has no effect yet

**Evidence:**
- `shared/schema.ts:SubParcel` has `energyAlignment` field
- `server/storage/game-rules.ts:261` reads alignment from DB
- Zero references to `energyAlignment` in `server/engine/battle/resolve.ts`

---

### 3. Sub-Parcel Archetype Faction Bonuses

**Document:** `artifacts/frontier-al/GAME_MANUAL.md` §7 (Sub-Parcels)  
**Claim:** Sub-parcel archetypes provide faction bonuses (e.g., KRONOS +25% defense for fortress)  
**Code reality:** `computeArchetypeFactionBonus()` exists but never called from battle resolver  
**Status:** PLACEHOLDER  
**Recommended action:** Mark as PLACEHOLDER, note that bonuses are defined but not applied

**Evidence:**
- `shared/schema.ts:ARCHETYPE_FACTION_BONUSES` defines bonus table
- `server/storage/game-rules.ts:309-315` implements `computeArchetypeFactionBonus()`
- Zero calls to `computeArchetypeFactionBonus()` in `server/engine/battle/resolve.ts`

---

### 4. Grid Power Dependency

**Document:** `artifacts/frontier-al/GAME_MANUAL.md` §7 (Sub-Parcels)  
**Claim:** Fortress requires energy archetype to function; resource extraction requires power  
**Code reality:** `computeGridPowerDependency()` exists but never called  
**Status:** PLACEHOLDER  
**Recommended action:** Mark as PLACEHOLDER, note that dependency logic exists but is not enforced

**Evidence:**
- `server/storage/game-rules.ts:324-335` implements `computeGridPowerDependency()`
- Zero calls to `computeGridPowerDependency()` in production code paths

---

### 5. Attack Doctrines

**Document:** `docs/memory/FRONTIER_SUBPLOT_COMBAT_ARCHITECTURE.md` §5  
**Claim:** Five attack doctrines (assault/siege/raid/sabotage/precision_strike) are approved design  
**Code reality:** No `attackMethod` field in `attackActionSchema`, no UI selector, no column in `battles` table  
**Status:** PLANNED  
**Recommended action:** Already marked as PLANNED in architecture doc, but GAME_MANUAL.md §14 implies they exist

**Evidence:**
- `shared/schema.ts:attackActionSchema` (lines 517-530) has no doctrine field
- `server/routes.ts:1952-2009` attack handler has no doctrine logic
- No UI component for doctrine selection

---

### 6. Tactical 2D/2.5D View

**Document:** `artifacts/frontier-al/GAME_MANUAL.md` §23 (Tactical Parcel-View)  
**Claim:** Tactical view exists for selected plot  
**Code reality:** No tactical view component, no orthographic camera, no 2D/2.5D renderer  
**Status:** PLANNED  
**Recommended action:** Remove tactical view section from GAME_MANUAL.md or mark as PLANNED

**Evidence:**
- Glob search for `Tactical*.tsx` returns no results
- `client/src/components/game/PlanetGlobe.tsx` uses perspective camera only
- No orthographic camera implementation

---

### 7. Commander Battlefront Mobile Usability

**Document:** `artifacts/frontier-al/GAME_MANUAL.md` §12 (Commander Avatars)  
**Claim:** Commander panel is fully functional on all devices  
**Code reality:** Launch button below fold on 667×375 landscape viewport  
**Status:** PARTIAL  
**Recommended action:** Add known issues section, note mobile landscape limitations

**Evidence:**
- `artifacts/frontier-al/docs/audit/FRONTIER_LAND_COMBAT_PANEL_AUDIT.md:543` documents the issue
- CommanderPanel Battlefront requires ~400px height, mobile landscape provides ~247px

---

### 8. Six Facility Archetypes

**Document:** `docs/memory/FRONTIER_SUBPLOT_COMBAT_ARCHITECTURE.md` §4  
**Claim:** Six canonical facility archetypes are defined  
**Code reality:** Defined in `shared/subplotArchitecture.ts` but `implementationStatus: "catalog_only"` on all  
**Status:** CATALOG_ONLY  
**Recommended action:** Already correctly marked in architecture doc, but ensure GAME_MANUAL.md doesn't imply they're live

**Evidence:**
- `shared/subplotArchitecture.ts:FACILITY_ARCHETYPES` defines 6 archetypes
- Each has `implementationStatus: "catalog_only"` (line 208, 245, 282, 319, 356, 393)
- Zero consumption in production code

---

### 9. Energy Grid Simulation

**Document:** `docs/memory/FRONTIER_SUBPLOT_COMBAT_ARCHITECTURE.md` §7  
**Claim:** Energy grid with demand/priority/brownout is designed  
**Code reality:** `shared/energyGrid.ts` implements simulator but zero production integration  
**Status:** CONTRACT_ONLY  
**Recommended action:** Already correctly marked in architecture doc

**Evidence:**
- `shared/energyGrid.ts` implements `simulateEnergyGrid()` (564 lines)
- Zero imports of `energyGrid` in server code
- `computeGridPowerDependency()` in `game-rules.ts` is separate, older implementation

---

### 10. CombatProfile and BattleSnapshot

**Document:** `docs/memory/FRONTIER_SUBPLOT_COMBAT_ARCHITECTURE.md` §6  
**Claim:** Immutable combat profile and battle snapshot contract exists  
**Code reality:** `shared/combatProfile.ts` implements contract but zero production integration  
**Status:** CONTRACT_ONLY  
**Recommended action:** Already correctly marked in architecture doc

**Evidence:**
- `shared/combatProfile.ts` implements `CombatProfile` and `BattleSnapshot` (557 lines)
- Zero imports of `combatProfile` in server code
- No DB columns for snapshot storage

---

## Numerical Mismatches

### 11. ASCEND Generation Rates

**Document:** `artifacts/frontier-al/ECONOMICS.md` §5 (FRONTIER Tokenomics)  
**Claim:** Base plot ownership = 1 ASCEND/day, Electricity = +1/day, Blockchain Node L3 = +4/day  
**Code reality:** Matches `shared/schema.ts:calculateAscendPerDay()`  
**Status:** ✅ CORRECT  
**Recommended action:** No change needed

**Evidence:**
- `shared/schema.ts:1186-1206` implements `calculateAscendPerDay()`
- Rates match documentation exactly

---

### 12. Plot Pricing

**Document:** `artifacts/frontier-al/ECONOMICS.md` §1 (Parcel Prices)  
**Claim:** Desert = 0.2 ALGO, Plains = 0.3 ALGO, ..., Water = 1.5 ALGO  
**Code reality:** Matches `shared/schema.ts:LAND_PURCHASE_ALGO`  
**Status:** ✅ CORRECT  
**Recommended action:** No change needed

**Evidence:**
- `shared/schema.ts:LAND_PURCHASE_ALGO` defines pricing table
- Values match documentation exactly

---

### 13. Sub-Parcel Pricing

**Document:** `artifacts/frontier-al/ECONOMICS.md` §2 (Sub-Parcel Prices)  
**Claim:** Formula: `max(10, min(100, round(algoBase × 50)))`  
**Code reality:** Matches `server/storage/game-rules.ts:computeSubParcelPrice()`  
**Status:** ✅ CORRECT  
**Recommended action:** No change needed

**Evidence:**
- `server/storage/game-rules.ts:371-375` implements formula
- Values match documentation exactly

---

### 14. Commander Costs

**Document:** `artifacts/frontier-al/ECONOMICS.md` §5 (FRONTIER Tokenomics)  
**Claim:** Sentinel = 50 ASCEND, Phantom = 150 ASCEND, Reaper = 400 ASCEND  
**Code reality:** Matches `shared/schema.ts:COMMANDER_INFO`  
**Status:** ✅ CORRECT  
**Recommended action:** No change needed

**Evidence:**
- `shared/schema.ts:663-693` defines `COMMANDER_INFO`
- Values match documentation exactly

---

### 15. Facility Costs

**Document:** `artifacts/frontier-al/ECONOMICS.md` §5 (FRONTIER Tokenomics)  
**Claim:** Electricity = 30 ASCEND, Blockchain Node L1-L3 = 120/270/480 ASCEND  
**Code reality:** Matches `shared/schema.ts:FACILITY_INFO`  
**Status:** ✅ CORRECT  
**Recommended action:** No change needed

**Evidence:**
- `shared/schema.ts:FACILITY_INFO` defines costs
- Values match documentation exactly

---

## Terminology Mismatches

### 16. Legacy vs Canonical Archetypes

**Document:** `artifacts/frontier-al/GAME_MANUAL.md` §7 (Sub-Parcels)  
**Claim:** Uses "archetype" to refer to resource/trade/fortress/energy  
**Code reality:** These are legacy categories; canonical facility archetypes are assault_foundry/siege_battery/etc.  
**Status:** TERMINOLOGY MISMATCH  
**Recommended action:** Clarify terminology: "legacy sub-parcel category" vs "canonical facility archetype"

**Evidence:**
- `shared/schema.ts:SubParcelArchetype` = "resource" | "trade" | "fortress" | "energy"
- `shared/subplotArchitecture.ts:FacilityArchetypeId` = 6 canonical IDs
- `shared/subplotArchitecture.ts:408` explicitly documents the distinction

---

### 17. Attack Method vs Attack Doctrine

**Document:** `docs/memory/FRONTIER_SUBPLOT_COMBAT_ARCHITECTURE.md` §5  
**Claim:** Uses "attack doctrine" for assault/siege/raid/sabotage/precision_strike  
**Code reality:** No implementation yet, but term is clear  
**Status:** ✅ CORRECT  
**Recommended action:** No change needed (term is well-defined in architecture doc)

---

## Stale Status Claims

### 18. PR #250 Status in HANDOFF.md

**Document:** `docs/HANDOFF.md` line 27  
**Claim:** "Active lane (Phase 4A, server-side plot-attack idempotency): ... PR **OPEN** to `main`"  
**Code reality:** PR #250 merged at `da35c7e` on 2026-07-12T12:32:02Z  
**Status:** STALE  
**Recommended action:** Update HANDOFF.md to reflect merged status

**Evidence:**
- `gh pr view 250` returns `state: "MERGED"`, `mergedAt: "2026-07-12T12:32:02Z"`
- `git log origin/main` shows `da35c7e` as latest commit

---

### 19. Phase 3 Status in HANDOFF.md

**Document:** `docs/HANDOFF.md` line 26  
**Claim:** "Phase 3 — DONE & MERGED: ... PR #249 (squash-merge `87ee770`)"  
**Code reality:** Correct, PR #249 merged at `87ee770`  
**Status:** ✅ CORRECT  
**Recommended action:** No change needed

**Evidence:**
- `git log origin/main` shows `87ee770` as second-latest commit
- Commit message: "feat: add immutable sub-plot CombatProfile and battle-snapshot contract (#249)"

---

## Summary

**Total entries:** 19  
**Critical mismatches:** 10 (items 1-10)  
**Numerical mismatches:** 5 (items 11-15, all correct)  
**Terminology mismatches:** 2 (items 16-17)  
**Stale status claims:** 2 (items 18-19)

**Priority actions:**
1. Update GAME_MANUAL.md to mark weapon archetypes, energy alignments, archetype bonuses, grid power dependency, and tactical view as DISCONNECTED/PLACEHOLDER/PLANNED
2. Update HANDOFF.md to reflect PR #250 merged status
3. Clarify legacy vs canonical archetype terminology in GAME_MANUAL.md
4. Add mobile landscape known issues to GAME_MANUAL.md

**Next update:** After P1.1 (reconciliation ledger) and P1.2 (player manual corrections) complete.

---

## End of Ledger

This ledger is the canonical doc-vs-code mismatch tracker. All future documentation updates must consult this ledger to avoid reintroducing known mismatches.
