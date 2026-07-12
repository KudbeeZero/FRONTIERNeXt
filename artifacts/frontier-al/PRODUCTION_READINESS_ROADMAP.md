# FRONTIER Production Readiness Roadmap

**Status:** Canonical implementation plan  
**Last updated:** 2026-07-12  
**Governing commit:** `da35c7e` (PR #250 merged)

---

## Overview

This roadmap defines the implementation lanes for FRONTIER-AL production readiness. Each lane has explicit goals, dependencies, and rollout gates.

**One-PR-at-a-time rule:** Application-code phases stay one PR at a time per HARD RULES. Documentation PRs may land in parallel.

---

## P0 — Active Release Blockers

**Goal:** Resolve immediate deployment and verification gaps

### Current Status

- ✅ PR #250 merged (`da35c7e`) — attack idempotency LIVE
- ⏳ Migration 0015 deployment pending (owner action)
- ⏳ AI cost-control activation pending (owner action)
- ⏳ Production health review pending

### Tasks

#### P0.1 — Migration 0015 Deployment

**Goal:** Apply `payload_fingerprint` column to production DB  
**Status:** PENDING (owner action)  
**Risk:** LOW  
**Agent mode:** N/A (owner action)

**Steps:**
1. Owner runs: `flyctl postgres connect -a frontiernext-db -d frontiernext`
2. Execute: `ALTER TABLE "action_nonces" ADD COLUMN IF NOT EXISTS "payload_fingerprint" TEXT;`
3. Verify: `\d action_nonces` shows column
4. Test: Launch attack with idempotency key, verify fingerprint stored

**Rollback:** `ALTER TABLE "action_nonces" DROP COLUMN IF EXISTS "payload_fingerprint";`

**Dependencies:** None  
**Files:** `artifacts/frontier-al/migrations/0015_action_nonce_fingerprint.sql`

---

#### P0.2 — AI Cost-Control Activation

**Goal:** Enable AI background loops with cost-optimized intervals  
**Status:** PENDING (owner action)  
**Risk:** LOW  
**Agent mode:** N/A (owner action)

**Steps:**
1. Owner runs:
   ```bash
   flyctl secrets set -a frontiernext \
     AI_ENABLED=true \
     AI_TURN_INTERVAL_MS=120000 \
     DEBUFF_CLEANUP_INTERVAL_MS=60000 \
     AI_MAX_ACTIVE_BATTLES=12
   ```
2. Verify: `flyctl logs -a frontiernext | grep "AI scheduler"`
3. Observe 15 min: AI turns ~120s, debuff cleanup ~60s, active battles ≤ 12
4. Check: `/health` returns 200

**Rollback:** `flyctl secrets unset -a frontiernext AI_ENABLED`

**Dependencies:** None  
**Files:** `docs/memory/FRONTIER_BACKGROUND_LOOP_COST_CONTROL.md`

---

#### P0.3 — Production Health Review

**Goal:** Verify production DB, API, and error rates  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Efficient

**Steps:**
1. Review Fly dashboard: CPU, memory, request rates
2. Review Neon dashboard: query performance, connection count
3. Review error logs: 5xx rates, timeout patterns
4. Verify: `/api/game/state` responds < 2s
5. Verify: Battle resolution cadence (5s interval)
6. Document findings in `session-notes/YYYY-MM-DD-prod-health.md`

**Dependencies:** P0.1, P0.2  
**Files:** `docs/DEPLOY_FLY.md`, `artifacts/frontier-al/DEPLOYMENT.md`

---

## P1 — Documentation Truth

**Goal:** Align all documentation with code reality

### Current Status

- ✅ Master game spec created
- ⏳ Reconciliation ledger pending
- ⏳ Player manual corrections pending

### Tasks

#### P1.1 — Reconciliation Ledger

**Goal:** Document all doc-vs-code mismatches  
**Status:** PENDING  
**Risk:** LOW  
**Agent mode:** Auto Balanced

**Steps:**
1. Create `artifacts/frontier-al/docs/DOC_RECONCILIATION_LEDGER.md`
2. For each major document, record:
   - Path and intended audience
   - Sections verified against code
   - Stale statements
   - Contract-only behavior presented as live
   - Numerical mismatches
   - Terminology mismatches
3. Prioritize corrections by player impact

**Dependencies:** None  
**Files:** All player-facing docs

---

#### P1.2 — Player Manual Corrections

**Goal:** Fix GAME_MANUAL.md inaccuracies  
**Status:** PENDING  
**Risk:** LOW  
**Agent mode:** Auto Efficient

**Steps:**
1. Review ledger from P1.1
2. Correct:
   - Weapon archetype claims (mark as DISCONNECTED)
   - Energy alignment claims (mark as PLACEHOLDER)
   - Sub-parcel archetype bonus claims (mark as PLACEHOLDER)
   - Tactical map claims (mark as PLANNED)
   - Battlefront mobile usability (note known issues)
3. Add status labels to each section
4. Update "Last updated" date

**Dependencies:** P1.1  
**Files:** `artifacts/frontier-al/GAME_MANUAL.md`

---

#### P1.3 — Economics Document Verification

**Goal:** Verify ECONOMICS.md against code  
**Status:** PENDING  
**Risk:** LOW  
**Agent mode:** Auto Efficient

**Steps:**
1. Verify all pricing tables against `shared/schema.ts` and `shared/economy-config.ts`
2. Verify ASCEND generation rates against `calculateAscendPerDay()`
3. Verify facility costs against `FACILITY_INFO`
4. Verify commander costs against `COMMANDER_INFO`
5. Correct any mismatches

**Dependencies:** None  
**Files:** `artifacts/frontier-al/ECONOMICS.md`, `shared/schema.ts`, `shared/economy-config.ts`

---

## P2 — Globe Visual Production Pass

**Goal:** Polish globe presentation for production

### Current Status

- ✅ Globe renderer LIVE
- ⏳ Surface visibility tuning needed
- ⏳ Distance-based fade not implemented
- ⏳ Tactical transition not designed

### Tasks

#### P2.1 — Shader Exposure and Brightness

**Goal:** Tune GlobeTerrain shader for optimal visibility  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Test current shader (EXPOSURE=2.0, FLOOR=0.50) on multiple devices
2. Adjust EXPOSURE if too bright/dark
3. Adjust FLOOR if dark texels still read as black
4. Verify biome colors distinguishable
5. Screenshot acceptance on desktop + mobile

**Dependencies:** None  
**Files:** `client/src/components/game/globe/GlobeTerrain.tsx`

**Tests:** Headless visual test (`pnpm run smoke:visual`)

---

#### P2.2 — Parcel-Grid Distance Fade

**Goal:** Implement smooth opacity fade based on camera distance  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Define fade curve: opacity = f(camera.distance)
2. Far orbit (> GLOBE_RADIUS * 4): borders nearly invisible
3. Mid orbit (GLOBE_RADIUS * 2.5–4): borders fade in
4. Tactical zoom (< GLOBE_RADIUS * 2.5): borders fully visible
5. Update `PlotOverlay` to read camera distance per frame
6. Test performance (no frame drops)

**Dependencies:** None  
**Files:** `client/src/components/game/globe/GlobeParcels.tsx`

**Tests:** Visual regression test

---

#### P2.3 — Atmosphere Enhancement

**Goal:** Add atmospheric glow and cloud layer  
**Status:** PENDING  
**Risk:** LOW  
**Agent mode:** Auto Balanced

**Steps:**
1. Review existing `GlobeAtmosphere.tsx`
2. Add Fresnel-based atmospheric glow
3. Add optional cloud layer (texture or procedural)
4. Tune opacity and color
5. Verify performance

**Dependencies:** None  
**Files:** `client/src/components/game/globe/GlobeAtmosphere.tsx`

---

#### P2.4 — Layer Controls

**Goal:** Implement explicit layer toggle UI  
**Status:** PENDING  
**Risk:** LOW  
**Agent mode:** Auto Balanced

**Steps:**
1. Design layer toggle UI (biome, ownership, battle, resource, facility)
2. Add state management for layer visibility
3. Wire toggles to renderer
4. Persist preferences to localStorage
5. Test accessibility

**Dependencies:** None  
**Files:** `client/src/components/game/globe/GlobeColorSettings.tsx`

---

#### P2.5 — Tactical Transition Design

**Goal:** Design transition from globe to tactical view  
**Status:** PENDING  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

**Steps:**
1. Define tactical view requirements (2D vs 2.5D, orthographic vs perspective)
2. Design camera transition animation
3. Define tactical view components (facility slots, layer toggles, action controls)
4. Create mockups
5. Get owner approval before implementation

**Dependencies:** None  
**Files:** Design document (new)

---

## P3 — Endpoint and Persistence Safety

**Goal:** Extend idempotency to all mutating endpoints

### Current Status

- ✅ Plot attack idempotency LIVE (PR #250)
- ⏳ Archetype assignment idempotency pending
- ⏳ Build idempotency pending

### Tasks

#### P3.1 — Phase 4B: Archetype Idempotency

**Goal:** Add server idempotency to `/api/sub-parcels/:id/archetype`  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Efficient

**Steps:**
1. Add `idempotencyKey` field to archetype assignment schema
2. Extend `idempotencyGuard` to handle archetype scope
3. Update route handler to use guard
4. Add tests (same key + same payload → replay, different payload → 409)
5. Update client to send stable key

**Dependencies:** P0.1  
**Files:** `server/routes.ts`, `server/idempotencyGuard.ts`, `shared/schema.ts`

**Tests:** `server/archetypeIdempotency.spec.ts`

---

#### P3.2 — Phase 4B: Build Idempotency

**Goal:** Add server idempotency to `/api/sub-parcels/:id/build`  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Efficient

**Steps:**
1. Add `idempotencyKey` field to build schema
2. Extend `idempotencyGuard` to handle build scope
3. Update route handler to use guard
4. Add tests
5. Update client

**Dependencies:** P0.1, P3.1  
**Files:** `server/routes.ts`, `server/idempotencyGuard.ts`, `shared/schema.ts`

**Tests:** `server/buildIdempotency.spec.ts`

---

#### P3.3 — Facility Persistence Design

**Goal:** Design persistence model for canonical facility archetypes  
**Status:** PENDING  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

**Steps:**
1. Define mapping: legacy archetype → canonical facility archetype
2. Design DB schema for facility state (integrity, energy, cooldowns)
3. Design migration strategy (additive, backward-compatible)
4. Get owner approval before implementation

**Dependencies:** P3.1, P3.2  
**Files:** Design document (new)

---

## P4 — Facility and Energy Integration

**Goal:** Wire canonical facility archetypes and energy grid into production

### Current Status

- ✅ Facility archetypes defined (CATALOG_ONLY)
- ✅ Energy grid simulator defined (CONTRACT_ONLY)
- ⏳ Persistence pending
- ⏳ Integration pending

### Tasks

#### P4.1 — Persisted Facility Archetype

**Goal:** Map legacy archetypes to canonical facility archetypes  
**Status:** PENDING  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

**Steps:**
1. Define mapping table (legacy → canonical)
2. Add `facilityArchetype` column to `subParcels` table (nullable)
3. Write migration to populate from legacy archetype
4. Update archetype assignment route to accept canonical IDs
5. Update UI to display canonical archetype

**Dependencies:** P3.3  
**Files:** `server/db-schema.ts`, `migrations/0016_*.sql`, `server/routes.ts`

**Tests:** Migration tests, archetype assignment tests

---

#### P4.2 — Facility Upgrades Wired

**Goal:** Wire facility upgrade trees into production  
**Status:** PENDING  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

**Steps:**
1. Add `upgradeBranch` and `upgradeTier` columns to `subParcels`
2. Update upgrade route to validate against canonical trees
3. Update UI to show canonical upgrade paths
4. Test upgrade persistence and validation

**Dependencies:** P4.1  
**Files:** `server/db-schema.ts`, `migrations/0017_*.sql`, `server/routes.ts`

---

#### P4.3 — Numeric Energy Profiles

**Goal:** Define numeric energy demand/production for each facility  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Define numeric profiles for each facility archetype
2. Add `energyProfile` JSON column to `subParcels`
3. Update facility build/upgrade to set profile
4. Test profile persistence

**Dependencies:** P4.1  
**Files:** `shared/subplotArchitecture.ts`, `server/db-schema.ts`, `migrations/0018_*.sql`

---

#### P4.4 — Energy Grid Integration

**Goal:** Integrate energy grid simulator into production  
**Status:** PENDING  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

**Steps:**
1. Replace `computeGridPowerDependency()` with `simulateEnergyGrid()`
2. Add energy state to game state response
3. Update UI to display energy status
4. Implement brownout/blackout logic
5. Test grid simulation in production-like scenario

**Dependencies:** P4.3  
**Files:** `server/storage/game-rules.ts`, `server/routes.ts`, `shared/energyGrid.ts`

---

## P5 — Combat Integration

**Goal:** Wire CombatProfile, weapons, doctrines, and alignments into battle resolver

### Current Status

- ✅ CombatProfile contract defined (CONTRACT_ONLY)
- ⏳ Integration pending

### Tasks

#### P5.1 — Live CombatProfile Creation

**Goal:** Create CombatProfile at attack launch  
**Status:** PENDING  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

**Steps:**
1. Update `/api/actions/attack` to build CombatProfile from request + stored state
2. Validate profile using `validateCombatProfileDraft()`
3. Build immutable profile using `buildCombatProfile()`
4. Test profile creation

**Dependencies:** P4.1  
**Files:** `server/routes.ts`, `shared/combatProfile.ts`

---

#### P5.2 — Immutable Snapshot Persistence

**Goal:** Store BattleSnapshot in battles table  
**Status:** PENDING  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

**Steps:**
1. Add `combatProfileJson` column to `battles` table (nullable)
2. Create snapshot at launch using `createBattleSnapshot()`
3. Store snapshot JSON in battle row
4. Update `resolveBattle()` to read snapshot instead of live state
5. Test snapshot immutability

**Dependencies:** P5.1  
**Files:** `server/db-schema.ts`, `migrations/0019_*.sql`, `server/routes.ts`, `server/engine/battle/resolve.ts`

---

#### P5.3 — Weapon Equipment

**Goal:** Wire weapon archetypes into facilities  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Add `weaponArchetype` column to `subParcels`
2. Update Armory to equip weapon on facility
3. Validate weapon compatibility with facility archetype
4. Test equipment persistence

**Dependencies:** P4.1  
**Files:** `server/db-schema.ts`, `migrations/0020_*.sql`, `server/routes.ts`

---

#### P5.4 — Doctrines Implemented

**Goal:** Implement five attack doctrines  
**Status:** PENDING  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

**Steps:**
1. Add `attackDoctrine` column to `battles` table
2. Add doctrine selector to CommanderPanel Battlefront
3. Update `attackActionSchema` to accept doctrine
4. Define doctrine modifiers (power, cost, cooldown)
5. Apply modifiers in CombatProfile
6. Test doctrine selection and application

**Dependencies:** P5.2  
**Files:** `server/db-schema.ts`, `migrations/0021_*.sql`, `server/routes.ts`, `shared/combatProfile.ts`

---

#### P5.5 — Alignments Integrated

**Goal:** Wire energy alignments into combat  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Define alignment modifiers (helios → attack, aegis → defense, nexus → efficiency)
2. Apply modifiers in CombatProfile
3. Update UI to display alignment effects
4. Test alignment application

**Dependencies:** P5.2, P4.4  
**Files:** `shared/combatProfile.ts`, `server/engine/battle/resolve.ts`

---

#### P5.6 — Facility Modifiers Applied

**Goal:** Apply facility archetype modifiers to battle resolution  
**Status:** PENDING  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

**Steps:**
1. Define facility archetype modifiers (assault_foundry → attack, defense_bastion → defense, etc.)
2. Apply modifiers in CombatProfile
3. Update `resolveBattle()` to read facility context
4. Test modifier application

**Dependencies:** P5.2, P4.1  
**Files:** `shared/combatProfile.ts`, `server/engine/battle/resolve.ts`

---

## P6 — Damage and Territorial Consequences

**Goal:** Implement facility integrity, damage, repair, capture, salvage, conversion

### Current Status

- ⏳ No implementation

### Tasks

#### P6.1 — Integrity System

**Goal:** Add integrity HP to facilities  
**Status:** PENDING  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

**Steps:**
1. Add `integrity` column to `subParcels` (0–100)
2. Define integrity loss formula (based on attack power)
3. Update battle resolution to apply integrity damage
4. Update UI to display integrity

**Dependencies:** P5.6  
**Files:** `server/db-schema.ts`, `migrations/0022_*.sql`, `server/engine/battle/resolve.ts`

---

#### P6.2 — Disablement Logic

**Goal:** Disable facilities at 0 integrity  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Define disablement threshold (integrity = 0)
2. Update facility logic to check integrity
3. Apply disablement penalties (no energy, no modifiers)
4. Update UI to display disabled state

**Dependencies:** P6.1  
**Files:** `server/storage/game-rules.ts`, `server/routes.ts`

---

#### P6.3 — Repair Mechanics

**Goal:** Implement facility repair  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Define repair cost formula (iron + crystal)
2. Define repair time formula (based on damage)
3. Add repair route
4. Update UI with repair controls
5. Test repair flow

**Dependencies:** P6.1  
**Files:** `server/routes.ts`, `server/storage/db.ts`

---

#### P6.4 — Capture Inheritance

**Goal:** Inherit damaged facilities on capture  
**Status:** PENDING  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

**Steps:**
1. Update capture logic to preserve facility state
2. Reset ownership but keep integrity, archetype, upgrades
3. Test capture inheritance

**Dependencies:** P6.1  
**Files:** `server/storage/db.ts`, `server/engine/battle/resolve.ts`

---

#### P6.5 — Salvage System

**Goal:** Allow raiders to salvage facilities  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Define salvage formula (resources based on facility level)
2. Add salvage route
3. Update UI with salvage controls
4. Test salvage flow

**Dependencies:** P6.1  
**Files:** `server/routes.ts`, `server/storage/db.ts`

---

#### P6.6 — Conversion System

**Goal:** Allow new owners to convert facility archetype  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Define conversion cost (ASCEND)
2. Add conversion route
3. Update UI with conversion controls
4. Test conversion flow

**Dependencies:** P6.4  
**Files:** `server/routes.ts`, `server/storage/db.ts`

---

#### P6.7 — Demolition System

**Goal:** Allow owners to demolish facilities  
**Status:** PENDING  
**Risk:** LOW  
**Agent mode:** Auto Efficient

**Steps:**
1. Define demolition refund (partial resource return)
2. Add demolition route
3. Update UI with demolition controls
4. Test demolition flow

**Dependencies:** P6.1  
**Files:** `server/routes.ts`, `server/storage/db.ts`

---

## P7 — UI and Tactical Experience

**Goal:** Implement tactical view and fix mobile UX

### Current Status

- ⏳ No tactical view
- ⏳ Mobile UX issues known

### Tasks

#### P7.1 — Tactical 2D/2.5D View

**Goal:** Implement tactical view for selected plot  
**Status:** PENDING  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

**Steps:**
1. Design tactical view layout (2D vs 2.5D)
2. Implement orthographic camera
3. Implement facility slot rendering
4. Implement layer toggles
5. Implement action controls (Manage Plot, upgrades, attack)
6. Test tactical view on desktop + mobile

**Dependencies:** P2.5  
**Files:** New component `client/src/components/game/TacticalView.tsx`

---

#### P7.2 — Manage Plot Redesign

**Goal:** Redesign Manage Plot panel for tactical view  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Design new Manage Plot layout
2. Implement facility management UI
3. Implement upgrade tree UI
4. Implement energy status UI
5. Test Manage Plot flow

**Dependencies:** P7.1  
**Files:** New component `client/src/components/game/ManagePlotPanel.tsx`

---

#### P7.3 — Battlefront Mobile UX

**Goal:** Fix CommanderPanel Battlefront on mobile landscape  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Reduce stats header size on mobile
2. Increase touch targets to 44px minimum
3. Add landscape-specific max-height
4. Test on 667×375, 844×390, 932×430 viewports

**Dependencies:** None  
**Files:** `client/src/components/game/CommanderPanel.tsx`

---

#### P7.4 — Scroll Traps Resolved

**Goal:** Fix TradeStation and FactionPanel scroll traps  
**Status:** PENDING  
**Risk:** LOW  
**Agent mode:** Auto Efficient

**Steps:**
1. Change `overflow-hidden` to `overflow-auto` on right-rail aside
2. Change `overflow-hidden` to `overflow-auto` on TradeStation wrapper
3. Change `overflow-hidden` to `overflow-auto` on FactionPanel wrapper
4. Add `min-h-0` to flex children
5. Test scroll behavior

**Dependencies:** None  
**Files:** `client/src/components/game/GameLayout.tsx`, `TradeStation.tsx`, `FactionPanel.tsx`

---

#### P7.5 — Interaction Tests

**Goal:** Add panel interaction tests  
**Status:** PENDING  
**Risk:** LOW  
**Agent mode:** Auto Efficient

**Steps:**
1. Add jsdom tests for WarRoomPanel, CommanderPanel, InventoryPanel, LandSheet
2. Add viewport-specific tests (3 mobile viewports)
3. Test attack mutation flow
4. Test sub-parcel mutation flows

**Dependencies:** None  
**Files:** `client/tests/*.spec.tsx`

---

## P8 — AI and Balancing

**Goal:** Extend AI to use facilities, energy, and doctrines

### Current Status

- ✅ AI factions LIVE
- ⏳ Facility construction pending
- ⏳ Doctrine selection pending

### Tasks

#### P8.1 — AI Facility Construction

**Goal:** AI builds facilities based on strategy  
**Status:** PENDING  
**Risk:** HIGH  
**Agent mode:** Auto Frontier

**Steps:**
1. Define facility selection logic per faction
2. Update AI engine to build facilities
3. Test AI facility construction

**Dependencies:** P4.1  
**Files:** `server/storage/ai-engine.ts`, `server/engine/ai/`

---

#### P8.2 — AI Energy Prioritization

**Goal:** AI prioritizes facilities based on energy state  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Define energy prioritization logic per faction
2. Update AI engine to read energy state
3. Test AI energy prioritization

**Dependencies:** P4.4, P8.1  
**Files:** `server/storage/ai-engine.ts`

---

#### P8.3 — AI Doctrine Selection

**Goal:** AI selects doctrines based on target  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Define doctrine selection logic per faction
2. Update AI engine to select doctrine
3. Test AI doctrine selection

**Dependencies:** P5.4  
**Files:** `server/storage/ai-engine.ts`

---

#### P8.4 — AI Target Selection

**Goal:** AI selects targets based on strategy  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Define target selection logic per faction
2. Update AI engine to evaluate targets
3. Test AI target selection

**Dependencies:** None  
**Files:** `server/storage/ai-engine.ts`

---

#### P8.5 — AI Recovery from Zero Territory

**Goal:** AI recovers from zero territory  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Define recovery logic (prioritize unclaimed plots)
2. Update AI engine to detect zero territory
3. Test AI recovery

**Dependencies:** None  
**Files:** `server/storage/ai-engine.ts`

---

#### P8.6 — Simulation and Balance Harness

**Goal:** Build simulation harness for balance testing  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Balanced

**Steps:**
1. Define simulation parameters
2. Build simulation runner
3. Generate balance reports
4. Test simulation harness

**Dependencies:** P5.6  
**Files:** `server/engine/battle/sim.ts`

---

## P9 — Launch Verification

**Goal:** End-to-end verification of all flows

### Current Status

- ⏳ Verification pending

### Tasks

#### P9.1 — Wallet-to-Purchase Flow

**Goal:** Verify wallet connection → plot purchase  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Efficient

**Steps:**
1. Connect wallet (Pera/LUTE)
2. Receive welcome bonus
3. Purchase plot
4. Verify NFT mint
5. Test on TestNet

**Dependencies:** P0.1, P0.2  
**Files:** N/A (manual verification)

---

#### P9.2 — Build and Attack Flow

**Goal:** Verify build → attack → resolution → capture  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Efficient

**Steps:**
1. Build improvements
2. Launch attack
3. Verify resolution
4. Verify capture
5. Verify pillage

**Dependencies:** P0.1, P0.2  
**Files:** N/A (manual verification)

---

#### P9.3 — Observability

**Goal:** Verify logging and monitoring  
**Status:** PENDING  
**Risk:** LOW  
**Agent mode:** Auto Efficient

**Steps:**
1. Review Fly logs
2. Review Neon query logs
3. Verify error reporting
4. Verify metrics collection

**Dependencies:** P0.3  
**Files:** N/A (manual verification)

---

#### P9.4 — Security

**Goal:** Verify security posture  
**Status:** PENDING  
**Risk:** HIGH  
**Agent mode:** Auto Efficient

**Steps:**
1. Run `/security-pass`
2. Review findings
3. Fix critical issues
4. Document accepted risks

**Dependencies:** P0.3  
**Files:** N/A (security review)

---

#### P9.5 — Performance

**Goal:** Verify performance under load  
**Status:** PENDING  
**Risk:** MEDIUM  
**Agent mode:** Auto Efficient

**Steps:**
1. Load test API endpoints
2. Load test globe rendering
3. Verify response times < 2s
4. Verify frame rates > 30fps

**Dependencies:** P0.3  
**Files:** N/A (performance testing)

---

#### P9.6 — Accessibility

**Goal:** Verify accessibility compliance  
**Status:** PENDING  
**Risk:** LOW  
**Agent mode:** Auto Efficient

**Steps:**
1. Run axe-core audit
2. Verify keyboard navigation
3. Verify screen reader compatibility
4. Verify color contrast

**Dependencies:** P7.3, P7.4  
**Files:** N/A (accessibility testing)

---

## Summary

**Total tasks:** 45  
**P0 (release blockers):** 3  
**P1 (documentation):** 3  
**P2 (globe):** 5  
**P3 (endpoints):** 3  
**P4 (facilities):** 4  
**P5 (combat):** 6  
**P6 (damage):** 7  
**P7 (UI):** 5  
**P8 (AI):** 6  
**P9 (verification):** 6  

**Critical path:** P0 → P3 → P4 → P5 → P6 → P7 → P8 → P9

**Estimated effort:** 6–12 months (depending on owner availability for P0 actions)

**Next PR:** P1.1 (reconciliation ledger) or P2.1 (shader tuning)

---

## End of Roadmap

This roadmap is the canonical implementation plan. All future work must align with this roadmap. Status must be updated as tasks complete.

**Next update:** After P0 completion or P1.1 merge.
