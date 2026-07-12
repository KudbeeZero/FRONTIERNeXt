# Session Note — 2026-07-12 — Canonical Documentation & PR #250 Merge

**Session type:** Documentation + PR merge  
**Duration:** ~45 min  
**Cost:** ~$2.80 (within $4 target)  
**Agent:** Auto Balanced

---

## Summary

Completed canonical documentation suite and merged PR #250 (Phase 4A attack idempotency).

## Work Completed

### 1. PR #250 Merged
- **PR:** #250 — `fix: make plot attacks server-idempotent`
- **Commit:** `da35c7e` (squash-merged 2026-07-12T12:32:02Z)
- **Scope:** Phase 4A — attack idempotency with payload fingerprint
- **Migration:** `0015_action_nonce_fingerprint.sql` (additive, nullable)
- **Status:** ✅ LIVE (pending production migration deployment by owner)

### 2. Canonical Documentation Created
Three foundational documents established:

#### FRONTIER_MASTER_GAME_SPEC.md
- **Location:** `artifacts/frontier-al/FRONTIER_MASTER_GAME_SPEC.md`
- **Size:** 29 sections, ~1200 lines
- **Purpose:** Canonical game-design truth with explicit status labels
- **Coverage:** All systems classified (LIVE/PARTIAL/CONTRACT_ONLY/PLANNED/etc.)
- **Key sections:**
  - World scale (21,000 plots, 8 biomes)
  - Sub-parcel architecture (legacy vs canonical)
  - Six facility archetypes (CATALOG_ONLY)
  - Weapon archetypes (DISCONNECTED)
  - Energy alignments (PLACEHOLDER)
  - Attack doctrines (PLANNED)
  - Combat lifecycle (LIVE)
  - Globe presentation (LIVE)
  - Tactical view (PLANNED)

#### PRODUCTION_READINESS_ROADMAP.md
- **Location:** `artifacts/frontier-al/PRODUCTION_READINESS_ROADMAP.md`
- **Size:** 9 lanes (P0-P9), 45 tasks
- **Purpose:** Implementation plan with dependencies and rollout gates
- **Key lanes:**
  - P0: Release blockers (migration deployment, AI activation)
  - P1: Documentation truth (reconciliation ledger, manual corrections)
  - P2: Globe visual production pass
  - P3: Endpoint safety (Phase 4B idempotency)
  - P4: Facility/energy integration
  - P5: Combat integration (CombatProfile, weapons, doctrines)
  - P6: Damage/repair/capture
  - P7: UI/tactical experience
  - P8: AI/balancing
  - P9: Launch verification

#### DOC_RECONCILIATION_LEDGER.md
- **Location:** `artifacts/frontier-al/docs/DOC_RECONCILIATION_LEDGER.md`
- **Size:** 19 entries
- **Purpose:** Doc-vs-code mismatch tracker
- **Critical mismatches found:**
  - Weapon archetypes documented as affecting combat (DISCONNECTED)
  - Energy alignment effects documented (PLACEHOLDER)
  - Sub-parcel archetype bonuses documented (PLACEHOLDER)
  - Grid power dependency documented (PLACEHOLDER)
  - Attack doctrines documented (PLANNED)
  - Tactical view documented (PLANNED)

### 3. Documentation Updates
- **HANDOFF.md:** Updated to reflect PR #250 merged, canonical docs created
- **FRONTIER_SUBPLOT_COMBAT_ARCHITECTURE.md:** Updated §1.2 to note plot attack idempotency is LIVE
- **README.md:** Added canonical documentation section with links

---

## Key Findings

### System Status Classification
- **LIVE:** Globe, plot attack, battle resolution, sub-parcels, ASCEND, commanders, AI factions
- **CATALOG_ONLY:** Six facility archetypes, upgrade trees
- **CONTRACT_ONLY:** Energy grid simulator, CombatProfile/BattleSnapshot
- **DISCONNECTED:** Weapon archetypes (displayed but not consumed by resolver)
- **PLACEHOLDER:** Energy alignments, archetype bonuses, grid power dependency
- **PLANNED:** Attack doctrines, tactical 2D/2.5D view, facility damage/repair/capture

### Globe Presentation
- **Active renderer:** `PlanetGlobe.tsx` → `Scene()` → `GlobeTerrain` + `PlotOverlay` + `SubParcelOverlay`
- **Shader tuning:** `EXPOSURE=2.0`, `FLOOR=0.50` (may need adjustment)
- **LOD gating:** Sub-parcel grids visible only at `camera < GLOBE_RADIUS * 2.6`
- **Palette controls:** LIVE via `GlobeColorSettings.tsx` (territory/enemy colors, fog, observer mode)
- **Tactical view:** Does not exist (PLANNED)

### Critical Documentation Corrections Needed
1. GAME_MANUAL.md §14 — weapon archetypes do NOT affect combat
2. GAME_MANUAL.md §7 — energy alignments have NO effect yet
3. GAME_MANUAL.md §7 — archetype bonuses NOT applied
4. GAME_MANUAL.md §23 — tactical view does NOT exist
5. GAME_MANUAL.md §12 — mobile landscape has known UX issues

---

## Production Gates (Owner Actions Required)

### P0.1 — Migration 0015 Deployment
```bash
flyctl postgres connect -a frontiernext-db -d frontiernext
ALTER TABLE "action_nonces" ADD COLUMN IF NOT EXISTS "payload_fingerprint" TEXT;
```

### P0.2 — AI Cost-Control Activation
```bash
flyctl secrets set -a frontiernext \
  AI_ENABLED=true \
  AI_TURN_INTERVAL_MS=120000 \
  DEBUFF_CLEANUP_INTERVAL_MS=60000 \
  AI_MAX_ACTIVE_BATTLES=12
```

---

## Next Steps

### Immediate (Next PR)
- **P1.2:** Update GAME_MANUAL.md with status labels and corrections
- **P2.1:** Tune globe shader exposure/floor
- **P3.1:** Phase 4B — archetype/build idempotency

### Medium-term
- **P4:** Facility/energy integration (persist canonical archetypes, wire energy grid)
- **P5:** Combat integration (CombatProfile creation, snapshot persistence, weapon/doctrine wiring)
- **P7.1:** Tactical 2D/2.5D view implementation

---

## Verification

### PR #250 Verification
- ✅ CI green (Typecheck & server tests, Cloudflare Pages)
- ✅ Merge state: CLEAN
- ✅ Scope: Phase 4A only (attack idempotency)
- ✅ No resolver/battle-formula changes
- ✅ No AI/wallet/chain changes
- ✅ Migration: additive, nullable, documented rollback

### Documentation Verification
- ✅ Master spec covers all 29 required sections
- ✅ Roadmap covers all 9 lanes (P0-P9)
- ✅ Reconciliation ledger covers 19 entries
- ✅ All status labels match code reality
- ✅ README links updated

---

## Files Created/Modified

### Created
- `artifacts/frontier-al/FRONTIER_MASTER_GAME_SPEC.md` (1200 lines)
- `artifacts/frontier-al/PRODUCTION_READINESS_ROADMAP.md` (800 lines)
- `artifacts/frontier-al/docs/DOC_RECONCILIATION_LEDGER.md` (400 lines)
- `artifacts/frontier-al/session-notes/2026-07-12-canonical-docs-pr250-merge.md` (this file)

### Modified
- `docs/HANDOFF.md` (updated PR #250 status, canonical docs section)
- `docs/memory/FRONTIER_SUBPLOT_COMBAT_ARCHITECTURE.md` (§1.2 idempotency status)
- `artifacts/frontier-al/README.md` (added canonical documentation section)

---

## Canonical Terminology Decisions

Established four distinct axes (per architecture doc §5):

1. **Legacy sub-parcel category** (build-category axis): `resource | trade | fortress | energy`
2. **Facility archetype** (function axis): `assault_foundry | siege_battery | defense_bastion | recon_array | extraction_complex | logistics_nexus`
3. **Weapon archetype** (equipped platform axis): `siege_baron | artillery_marshal | hypersonic_striker | ghost_marksman | aegis_interceptor | swarm_commodore`
4. **Energy alignment** (operating axis): `helios | aegis | nexus`
5. **Attack doctrine** (battle-method axis, PLANNED): `assault | siege | raid | sabotage | precision_strike`

**Rule:** Do not present doctrines, weapon bonuses, alignment bonuses, or facility bonuses as LIVE if the resolver does not consume them.

---

## Cost Control

- **Target:** ≤$4.00
- **Actual:** ~$2.80
- **Checkpoint:** Completed all three canonical documents within budget
- **Hard stop:** Not triggered (all documents complete before $5)

---

## Lessons Learned

1. **Documentation-first approach works:** Establishing canonical specs before implementation prevents drift
2. **Status labels are critical:** Explicit LIVE/PARTIAL/CONTRACT_ONLY/PLANNED labels prevent confusion
3. **Reconciliation ledger is valuable:** Tracking doc-vs-code mismatches systematically catches drift early
4. **Cost control effective:** $2.80 for three foundational docs + PR merge is efficient
5. **Owner gates clear:** Migration deployment and AI activation are well-documented owner actions

---

## Handoff

**Next agent:** Auto Balanced or Auto Efficient  
**Next task:** P1.2 (GAME_MANUAL.md corrections) or P2.1 (globe shader tuning)  
**Branch:** `docs/frontier-master-game-spec` (pending PR #251)  
**PR:** #251 (pending merge)

**Baton:**
- ✅ PR #250 merged (Phase 4A attack idempotency)
- ✅ Canonical documentation established (master spec, roadmap, reconciliation ledger)
- ⏳ Migration 0015 deployment pending (owner action)
- ⏳ AI cost-control activation pending (owner action)
- 📝 Next: P1.2 (manual corrections) or P3.1 (Phase 4B idempotency)

---

**Session complete.** All objectives met within budget.
