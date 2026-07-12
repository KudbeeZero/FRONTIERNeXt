# FRONTIER Sub-Plot Combat Architecture

**Status:** Canonical design memory — approved vocabulary and phased blueprint.
**Authored:** 2026-07-12
**Based on:** `docs/audit/FRONTIER_LAND_COMBAT_PANEL_AUDIT.md` (recovered at `e5b423b`)
**Related:** `docs/memory/FRONTIER_BACKGROUND_LOOP_COST_CONTROL.md` (PR #243)

This document is the single source of truth for the sub-plot combat architecture:
terminology, the authoritative combat contract, and the phased implementation
plan. It does **not** implement any feature. All gameplay code changes happen in
later, separately-reviewed PRs per the phase boundaries below.

---

## 1. Classification of System State

### 1.1 Confirmed current implementation (LIVE)
- Land purchase, mine, upgrade, build (`parcels` table) — fully wired, validated, persisted.
- Sub-parcel subdivide, purchase, build, archetype assign (`subParcels` table) — fully wired.
- Plot attack (`POST /api/actions/attack`) and battle resolution (`resolveBattle()` every 5 s) — fully functional, deterministic, provably fair.
- Special attack, Commander mint, drone/satellite deploy — wired.
- ASCEND generation/storage/claim/consumption — lazy, server-validated, never negative.
- Authorization on every mutation — ownership-gated server-side (STRONG).

### 1.2 Confirmed disconnected or placeholder systems
- **Attack-method concept does not exist.** No selector in the UI, no field in `attackActionSchema`, no column in `battles`, no parameter in `resolveBattle()`. (Confirmed: `attackMethod` appears nowhere in `server/`, `shared/`, `client/`.)
- **Commander Battlefront uses troop / iron / fuel / crystal commitments only.** No doctrine, weapon, or alignment input on launch.
- **Armory weapon archetypes do not influence `resolveBattle()`.** The weapon system and the plot-attack engine are two separate, disconnected systems.
- **`energyAlignment` is stored and displayed but unused.** Zero game logic reads it.
- **`computeArchetypeFactionBonus()` is not called from the resolver.** It is only invoked inside the archetype-assignment mutation to return a display bonus.
- **`computeGridPowerDependency()` is never called.** Fortress offline penalties and resource power requirements are unenforced.
- **Sub-parcel archetype battle effects are not consumed by the resolver.** Only sub-parcel *attacks* read stored sub-parcel improvements; plot attacks ignore them.
- **`/attack`, `/archetype`, and `/build` idempotency is weaker than plot attacks.** Sub-parcel operations rely on client-side `isPending` only; rapid concurrent calls can double-apply.

### 1.3 Approved future design
- Six canonical **facility archetypes** (Section 4).
- Three distinct axes: **facility archetype**, **weapon archetype**, **energy alignment** (Section 5).
- Five **attack doctrines**: Assault, Siege, Raid, Sabotage, Precision Strike.
- Three **energy alignments**: Helios, Aegis, Nexus.
- A server-generated, immutable **`CombatProfile` + battle snapshot** contract (Section 6).
- An **energy grid with demand, priority, and brownout** (Section 7).
- Persistent **facility damage, repair, capture, salvage, conversion** (Section 8).

### 1.4 Deferred implementation
- Final numeric balance values for energy demand, brownout thresholds, and modifier magnitudes (explicitly **not** invented here).
- AI faction facility-building behavior (Phase 10) beyond the existing four-faction presets.
- Any blockchain/on-chain representation of sub-plot or facility state (stays off-chain; see Section 10).

### 1.5 Explicit non-goals
- Reworking the existing deterministic `resolveBattle()` math for plot attacks in a way that breaks replay/provable fairness.
- Moving high-frequency gameplay state (integrity, energy, cooldowns) on-chain.
- A new attack UX that removes the existing troop/resource commitment model — doctrines layer **on top of** it.
- Touching the background-loop cost-control already shipped in PR #243.

---

## 2. Confirmed Audit Findings (evidence anchors)

These were re-verified against `main` at `e5b423b` and are carried into the design:

1. No attack-method selector or backend attack-method concept exists.
2. Commander Battlefront currently uses troop, iron, fuel, and crystal commitments.
3. Armory weapon archetypes do not influence `resolveBattle()`.
4. `energyAlignment` is stored/displayed but unused.
5. `computeArchetypeFactionBonus()` is not called from the resolver.
6. `computeGridPowerDependency()` is not called.
7. Sub-parcel archetype battle effects are not consumed by the resolver.
8. `/attack`, `/archetype`, and `/build` require stronger server idempotency.
9. Trade Station and Faction panel `overflow-hidden` scroll traps (desktop right rail).
10. Commander Battlefront mobile-landscape accessibility problem (launch button below the fold at ~667×375 landscape).
11. Current panel interaction-test gaps (12 of 16 panels have no tests; existing ones are SSR smoke only).

---

## 3. Plot Command vs Sub-Plot Responsibilities

### 3.1 Main plot (territorial headquarters) responsibilities
- Territorial headquarters level.
- Sub-plot slot unlocks.
- Grid generation and storage (the 3×3 sub-parcel grid layout).
- Global resource storage (iron/fuel/crystal aggregates for the plot).
- Baseline territory defense (`defenseLevel`).
- Reinforcement speed (how fast troops/units replenish to the plot).
- Maximum sub-plot level (cap derived from HQ level).
- Radar/sensor coverage (derived from Recon facilities in the grid).
- Repair and recovery (passive regeneration of HQ/plot state).
- Commander and faction-wide modifiers (applied at the plot level).

### 3.2 Sub-plot (facility) responsibilities
- Persistent facility archetype (one of the six in Section 4).
- Level (per-facility upgrade level).
- Integrity and damage (persistent HP-like state).
- Upgrade branches (three per archetype; see Section 4).
- Idle, active, and burst energy demand.
- Operational priority (which facilities shed load first under brownout).
- Support radius (effect footprint across the grid / adjacent plots).
- Equipped weapon platform (weapon archetype mounted on the facility).
- Cooldowns (facility ability / weapon fire cadence).
- Production or combat role (what the facility contributes each tick).

The plot command layer **orchestrates**; the sub-plot layer **executes** a role. Combat
resolution reads a facility only through the `CombatProfile` snapshot (Section 6), never by
re-reading live mutable loadout.

---

## 4. Canonical Facility Archetypes

### 4.1 Assault Foundry
- **Strategic purpose:** Rapid generation and commitment of offensive ground strength.
- **Resource role:** Converts iron + fuel into troop readiness; consumes crystal for elite muster.
- **Combat role:** High-frequency attacks; fast troop commitment; pressure gameplay.
- **Upgrade branches:** (a) Rapid Mustering — shorter muster time; (b) Heavy Plating — survivable pushes; (c) Forward Logistics — faster reinforcement from HQ.
- **Capstone direction:** Spearhead Command — grants adjacent plot attack-speed bonus.
- **Energy profile:** Low idle, high active burst when mustering.
- **Strengths:** Tempo, sustained pressure, cheap per-hit.
- **Counters:** Siege Batteries (out-ranged) and Defense Bastions (attrition).
- **Risks:** Energy-starved under brownout; weak against fortified targets.
- **Compatible weapon archetypes:** Hypersonic Striker, Swarm Commodore.
- **Compatible energy alignments:** Helios (offensive burst).

### 4.2 Siege Battery
- **Strategic purpose:** Long-range, high-yield destruction of fortifications.
- **Resource role:** Consumes crystal + fuel heavily per volley.
- **Combat role:** Breaks Defense Bastions and high-`defenseLevel` targets; slow cadence.
- **Upgrade branches:** (a) Extended Range — larger support radius; (b) Penetrator Rounds — ignores a fraction of defender improvement bonus; (c) Barrage Control — reduced self-cooldown.
- **Capstone direction:** Orbital Link — enables a one-shot precision barrage.
- **Energy profile:** High burst per fire; moderate idle.
- **Strengths:** Best vs fortified/emplacements; large reach.
- **Counters:** Mobile Raid (hit-and-run) and Recon-blindness.
- **Risks:** Immobile, expensive, vulnerable while cooling down.
- **Compatible weapon archetypes:** Artillery Marshal, Railgun Sentinel.
- **Compatible energy alignments:** Helios (output) / Aegis (survivability while reloading).

### 4.3 Defense Bastion
- **Strategic purpose:** Anchor territorial defense and shield generation.
- **Resource role:** Consumes iron for plating; stores reserves.
- **Combat role:** Raises defender power, shields, EMP resistance for the plot/grid.
- **Upgrade branches:** (a) Reactive Armor — % damage reduction; (b) Shield Harmonizer — shield uptime/regeneration; (c) Layered Emplacement — bonus to adjacent facilities.
- **Capstone direction:** Aegis Citadel — grid-wide shield on brownout.
- **Energy profile:** Steady draw; benefits from Aegis alignment.
- **Strengths:** Survivability, denial, synergy with fortifications.
- **Counters:** Siege Batteries and Precision Strikes.
- **Risks:** Passive; contributes little offense; prime Sabotage target.
- **Compatible weapon archetypes:** EMP Bastion, Aegis Interceptor.
- **Compatible energy alignments:** Aegis.

### 4.4 Recon Array
- **Strategic purpose:** Intelligence, targeting, and sensor coverage.
- **Resource role:** Minimal; small crystal upkeep.
- **Combat role:** Extends support radius, reveals targets, improves attack accuracy/range.
- **Upgrade branches:** (a) Deep Scan — larger radar coverage; (b) Signal Boost — stronger uplink to weapons; (c) Targeting Uplink — +range / −miss to friendly attacks.
- **Capstone direction:** Omniscient Grid — grid-wide target sharing.
- **Energy profile:** Low steady draw; benefits from Nexus efficiency.
- **Strengths:** Vision, force multiplier, counters stealth.
- **Counters:** Stealth/EMP that blinds sensors.
- **Risks:** Near-zero direct defense; must be protected.
- **Compatible weapon archetypes:** Ghost Marksman, Hypersonic Striker.
- **Compatible energy alignments:** Nexus.

### 4.5 Extraction Complex
- **Strategic purpose:** Sustained resource production feeding the grid.
- **Resource role:** Generates iron / fuel / crystal; the economic engine of the plot.
- **Combat role:** None direct; light self-defense only.
- **Upgrade branches:** (a) Yield Optimization — higher output; (b) Surplus Storage — larger buffer; (c) Auto-Refine — converts raw to higher-tier resource.
- **Capstone direction:** Mega-Harvester — plot-wide yield multiplier.
- **Energy profile:** Idle draw only; Nexus alignment improves efficiency.
- **Strengths:** Economy, sustains everything else.
- **Counters:** Raid/Sabotage (resource drain) and capture.
- **Risks:** Prime raid target; no offense of its own.
- **Compatible weapon archetypes:** (support only) Logistics Nexus pairing.
- **Compatible energy alignments:** Nexus.

### 4.6 Logistics Nexus
- **Strategic purpose:** Movement, storage, and reinforcement across the grid.
- **Resource role:** Transfers/stores resources; speeds reinforcement.
- **Combat role:** Faster reinforcement speed, extended support radius, reserve pooling.
- **Upgrade branches:** (a) Rapid Transit — faster troop/resource transit; (b) Reserve Pool — shared buffer for the grid; (c) Forward Depot — pre-positioned reserves near front.
- **Capstone direction:** Continental Web — grid-wide instant reinforcement.
- **Energy profile:** Steady; Nexus alignment reduces cost.
- **Strengths:** Sustain, reach, recovery.
- **Counters:** Isolation (cut supply lines).
- **Risks:** Indirect; little standalone punch.
- **Compatible weapon archetypes:** Swarm Commodore, Aegis Interceptor.
- **Compatible energy alignments:** Nexus.

---

## 5. Keep These Systems Distinct

| Concept | Definition | Current state |
|---|---|---|
| **Facility archetype** | What the sub-plot is *built to do* (Section 4). | Persisted (`subParcels.archetype`); not consumed by resolver. |
| **Weapon archetype** | The equipped combat platform (Siege Baron, Artillery Marshal, Hypersonic Striker, Railgun Sentinel, EMP Bastion, Stealth Viper). | Displayed; disconnected from plot attacks. |
| **Energy alignment** | How the facility *operates* (Helios / Aegis / Nexus). | Stored/displayed; unused. |
| **Attack doctrine** | The method selected for a *specific battle* (Assault / Siege / Raid / Sabotage / Precision Strike). | Does not exist yet. |

**Approved doctrines**
- **Assault** — balanced, fast, general-purpose pressure.
- **Siege** — slow, high-damage vs fortifications; high resource cost.
- **Raid** — fast hit-and-run, resource theft, low commitment.
- **Sabotage** — debuff/disable (EMP/sabotage timers), not destruction.
- **Precision Strike** — single high-value target, high accuracy/cost.

**Approved energy alignments**
- **Helios** — offensive burst, high output, high energy use.
- **Aegis** — shields, repair, defense, EMP resistance.
- **Nexus** — efficiency, support range, transfers, recon, regeneration.

These four axes are orthogonal: a Siege Battery (facility) can carry a Railgun Sentinel
(weapon) under Helios (alignment) executing a Siege (doctrine). The resolver must treat each
axis independently and compose modifiers from the immutable snapshot (Section 6).

---

## 6. Authoritative Combat Contract

### 6.1 Server-generated `CombatProfile`
The server builds a `CombatProfile` at attack launch from authoritative stored state:

- attacker player / faction;
- origin main plot;
- origin sub-plot (the launching facility);
- target plot / sub-plot;
- facility archetype;
- facility level and integrity;
- equipped weapon archetype;
- selected attack doctrine;
- energy alignment;
- applicable upgrades (from the facility's chosen branch);
- available grid energy;
- idle / active / burst energy demand;
- troops committed;
- iron committed;
- fuel committed;
- crystal committed;
- attack modifiers (doctrine × facility × weapon × alignment × upgrades);
- defense modifiers (target facility/plot state);
- range (facility + weapon + Recon uplift);
- cooldown (facility + weapon);
- resource cost;
- target defense state (defenseLevel, improvements, shields, debuffs);
- faction and Commander modifiers.

### 6.2 Immutable battle snapshot
At launch the server writes an **immutable snapshot** of the `CombatProfile` into the
`battles` row (new columns, nullable, backward-compatible). `resolveBattle()` and
`resolveBattles()` read **only** the snapshot, never live mutable loadout values
(`energyAlignment`, `archetype`, weapon profile, grid energy at resolve time).

- The client may **preview** computed values before launch, but must **not** provide trusted
  final modifiers. All authoritative modifiers are computed server-side from the snapshot.
- This preserves the existing provable-fairness/replay property: a battle's outcome is
  determined by the frozen snapshot + the public `randFactor` seed.

### 6.3 Schema impact (deferred to Phase 3)
Add nullable columns to `battles`: `attackDoctrine`, `facilityArchetype`,
`facilityLevel`, `weaponArchetype`, `energyAlignment`, `combatProfileJson` (the frozen
snapshot). Default safely; no reset of existing rows.

---

## 7. Energy and Brownout Design

- **Main-grid generation:** sum of facility generation (Extraction Complex, energy archetype
  facilities) minus base plot draw.
- **Energy storage:** plot-level buffer; facilities draw from it.
- **Facility idle draw:** constant small draw when online but not acting.
- **Facility active draw:** larger draw while performing its role (muster, fire, refine).
- **Burst ability cost:** one-time large draw for capstone/doctrine abilities.
- **Operational priorities:** each facility has a priority tier used during brownout
  (Defense > Extraction > Logistics > Recon > Assault > Siege, as a starting proposal — final
  ordering is a balance decision, not fixed here).
- **Brownout threshold:** when available grid energy < total demanded draw.
- **Automatic shutdown order:** lowest-priority facilities shed load first.
- **Reduced-performance state:** shed facilities run at degraded output (e.g., weaker shields,
  slower cooldown recovery) rather than full off.
- **Recovery rules:** when energy returns above threshold, facilities re-enable in priority
  order after a short stabilization delay.
- **Alignment switching cost and cooldown:** changing a facility's `energyAlignment` costs
  ASCEND and imposes a cooldown during which the old alignment's bonus is lost and the new one
  is not yet active.

**Brownout consequences (non-exhaustive):** weakened shields; paused attack preparation;
reduced mining; shorter recon range; slower cooldown recovery; temporary facility shutdown.

Final numeric values (draw magnitudes, thresholds, cooldown durations) are **explicitly not
specified here** — they are set during Phase 2/11 balance work.

---

## 8. Facility Damage and Capture

Future persistent consequences (deferred to Phase 8):

- **Integrity damage:** facilities lose integrity from incoming attacks.
- **Temporary disablement:** at 0 integrity, facility is disabled until repaired.
- **Upgrade impairment:** damaged facilities lose the benefit of higher upgrade tiers.
- **EMP:** temporary disable + reduced output (uses existing `empDebuffUntil` mechanism).
- **Sabotage:** resource drain / production pause (uses existing `sabotageDebuffUntil`).
- **Energy drain:** targeted facilities lose grid energy.
- **Stored-resource loss:** pillage of facility/plot buffers on capture.
- **Repair time:** integrity regenerates over a duration (scales with damage).
- **Repair resource cost:** iron/crystal to accelerate repair.
- **Capture of damaged facilities:** a captured plot inherits facilities in their damaged state.
- **Salvage:** raider may strip a facility for resources instead of holding it.
- **Conversion:** new owner may re-roll a facility's archetype/alignment (subject to grid limits).
- **Demolition:** owner may raze a facility to free the slot.
- **Retained infrastructure after ownership change:** grid layout, slot unlocks, and HQ level
  persist; only ownership, integrity, and loadout reset/convert.

---

## 9. Phased Implementation Plan

Strict PR boundaries; one concern per PR. No phase is implemented here.

### Phase 0 — Documentation and contract approval
- **Goal:** Approve this vocabulary and the `CombatProfile` contract.
- **Files:** `docs/memory/*`, `docs/audit/*`, `HANDOFF.md`.
- **DB impact:** none. **Migration risk:** none. **API impact:** none. **Client impact:** none.
- **Tests:** doc/link checks.
- **Rollout gate:** owner architecture approval. **Rollback:** n/a.
- **Depends on:** none.

### Phase 1 — Canonical facility archetypes and upgrade definitions
- **Goal:** Define the six archetypes + three upgrade branches as data/constants.
- **Files:** `shared/schema.ts`, `server/storage/game-rules.ts`, facility config module.
- **DB impact:** new nullable facility columns defaulted. **Migration risk:** low (additive).
- **API impact:** extend `/archetype` validation with canonical set. **Client impact:** archetype picker.
- **Tests:** archetype/upgrade definition unit tests; `game-rules.spec.ts` extensions.
- **Rollout gate:** additive, backward-compatible. **Rollback:** drop PR (no destructive migration).
- **Depends on:** Phase 0.

### Phase 2 — Energy grid, demand, priority, and brownout simulation
- **Goal:** Model grid generation/storage/draw, priority shedding, brownout states.
- **Files:** `server/storage/*` (grid sim), `shared/economy-config.ts`.
- **DB impact:** energy columns on `subParcels`/plot. **Migration risk:** medium (new state).
- **API impact:** energy read in game-state. **Client impact:** energy HUD.
- **Tests:** grid sim unit tests (demand > supply → shed order).
- **Rollout gate:** sim deterministic, covered. **Rollback:** revert PR.
- **Depends on:** Phase 1.

### Phase 3 — Server `CombatProfile` and immutable battle snapshot foundation
- **Goal:** Build `CombatProfile` at launch; freeze snapshot into `battles`; resolver reads snapshot.
- **Files:** `server/storage/db.ts` (deployAttack), `server/engine/battle/resolve.ts`, `shared/schema.ts`.
- **DB impact:** new nullable `battles` columns. **Migration risk:** low (additive, nullable).
- **API impact:** `/attack` returns/accepts doctrine; snapshot stored. **Client impact:** preview only.
- **Tests:** snapshot immutability test (resolve ignores post-launch loadout change); replay parity.
- **Rollout gate:** replay/fairness preserved. **Rollback:** revert PR.
- **Depends on:** Phase 1, Phase 2.

### Phase 4 — Server-side idempotency for `/attack`, `/archetype`, and `/build`
- **Goal:** Replace client-only `isPending` guards with server idempotency (extend `withIdempotency()`).
- **Files:** `server/routes.ts`, `server/storage/*`, `shared/schema.ts`.
- **DB impact:** idempotency keys. **Migration risk:** low. **API impact:** idempotency headers.
- **Client impact:** rely on server guard. **Tests:** concurrency/double-apply tests.
- **Rollout gate:** no double-apply under burst. **Rollback:** revert PR.
- **Depends on:** Phase 0 (prerequisite for safe later writes).

### Phase 5 — Weapon archetype equipment integration
- **Goal:** Mount weapon archetype on facilities; consume in snapshot (no plot-attack change yet).
- **Files:** `server/storage/db.ts`, `shared/schema.ts`, Armory wiring.
- **DB impact:** weapon linkage column. **Migration risk:** low. **API impact:** equip endpoint.
- **Client impact:** Armory → facility equip. **Tests:** equipment unit tests.
- **Rollout gate:** no resolver behavior change yet. **Rollback:** revert PR.
- **Depends on:** Phase 3.

### Phase 6 — Attack doctrines
- **Goal:** Implement the five doctrines as snapshot modifiers.
- **Files:** `server/engine/battle/*`, `shared/schema.ts`, `server/routes.ts`.
- **DB impact:** `attackDoctrine` column. **Migration risk:** low. **API impact:** `/attack` doctrine field.
- **Client impact:** doctrine selector (replaces the missing "attack method"). **Tests:** doctrine modifier tests; resolve parity.
- **Rollout gate:** determinism + replay preserved. **Rollback:** revert PR.
- **Depends on:** Phase 3, Phase 5.

### Phase 7 — Facility upgrades and energy alignment modifiers in battle
- **Goal:** Wire `computeArchetypeFactionBonus()` and `computeGridPowerDependency()` into the resolver via the snapshot; apply alignment effects.
- **Files:** `server/engine/battle/resolve.ts`, `server/storage/game-rules.ts`.
- **DB impact:** none new. **Migration risk:** none. **API impact:** none new.
- **Client impact:** effects visible. **Tests:** bonus/dependency unit tests; regression vs current resolve.
- **Rollout gate:** no regression in existing battles. **Rollback:** revert PR.
- **Depends on:** Phase 2, Phase 3, Phase 6.

### Phase 8 — Integrity, damage, repair, capture, salvage, conversion
- **Goal:** Persistent facility state through combat lifecycle.
- **Files:** `server/storage/db.ts`, `server/engine/battle/*`, `shared/schema.ts`.
- **DB impact:** integrity/state columns. **Migration risk:** medium. **API impact:** state in game-state.
- **Client impact:** facility HP/damage UI. **Tests:** capture/repair/salvage unit tests.
- **Rollout gate:** migration reviewed; rollback/compat path. **Rollback:** revert + down-migration.
- **Depends on:** Phase 3, Phase 7.

### Phase 9 — Manage Plot and Battlefront UI
- **Goal:** Fix scroll traps, mobile-landscape Battlefront, doctrine/weapon/alignment pickers, idempotency UX.
- **Files:** `client/src/components/game/*` (TradeStation, FactionPanel, CommanderPanel, WarRoomPanel).
- **DB impact:** none. **Migration risk:** none. **API impact:** none. **Client impact:** major.
- **Tests:** panel interaction tests (jsdom, not just SSR smoke); responsive viewport tests.
- **Rollout gate:** accessibility + interaction tests green. **Rollback:** revert PR.
- **Depends on:** Phase 4, Phase 6 (needs server fields).

### Phase 10 — AI faction facility-building and combat behavior
- **Goal:** AI factions build/manage facilities and choose doctrines within the 12-battle cap.
- **Files:** `server/storage/ai-engine.ts`, `server/engine/ai/*`.
- **DB impact:** none new. **Migration risk:** none. **API impact:** none. **Client impact:** none.
- **Tests:** AI facility/doctrine unit tests; cap enforcement.
- **Rollout gate:** AI cadence still 120 s (PR #243); cap ≤ 12. **Rollback:** revert PR.
- **Depends on:** Phase 7, Phase 8.

### Phase 11 — Balance simulation and controlled production rollout
- **Goal:** Tune numeric values via sim; enable behind flags; monitor DB cost.
- **Files:** `server/engine/battle/sim.ts`, config/env, dashboards.
- **DB impact:** none. **Migration risk:** none. **API impact:** feature flags. **Client impact:** flag-gated.
- **Tests:** `sim` + `veritas` runs; coverage gate intact.
- **Rollout gate:** CI green; observed cost within budget; rollback flag available.
- **Depends on:** all prior phases.

---

## 10. Safe Migration Principles

Future schema changes affecting plots/sub-plots/facilities MUST:

- preserve current plot ownership;
- preserve sub-parcel ownership and purchases;
- preserve current builds and archetype selections;
- default new fields safely (nullable / zero / false);
- avoid resetting production territory;
- avoid destructive `db:push`;
- use reviewed migrations (Drizzle migration files, not ad-hoc push);
- support rollback or backward compatibility;
- keep blockchain ownership records (NFTs, ASA) untouched;
- avoid moving high-frequency gameplay state (integrity, energy, cooldowns) on-chain.

---

## 11. Open Questions for Owner (not decided here)
- Final numeric balance for energy demand / brownout thresholds.
- Exact operational-priority ordering (proposal in Section 7 is a starting point).
- Whether weapon archetypes connect to plot attacks or remain a separate interception system.
- Mobile Battlefront simplification scope (remove Advanced sliders? auto-max troops?).
- Sub-parcel attack idempotency acceptability for TestNet vs required before mainnet.

---

## 12. Phase 1 Implementation Status (catalog-only)

**Branch:** `feat/frontier-subplot-facility-catalog` · **PR:** (Phase 1 PR into `main`).

### Exact catalog path
- `artifacts/frontier-al/shared/subplotArchitecture.ts` (contract + catalog + adapters + validation).
- `artifacts/frontier-al/shared/subplotArchitecture.spec.ts` (18 focused tests).

### Stable facility IDs
`assault_foundry`, `siege_battery`, `defense_bastion`, `recon_array`, `extraction_complex`, `logistics_nexus`.

### Branch IDs (3 per facility)
- **assault_foundry:** `mobilization`, `armor_fabrication`, `reinforcement_logistics`
- **siege_battery:** `range_targeting`, `fortification_breaking`, `firing_cycle`
- **defense_bastion:** `fortress`, `shield_grid`, `defensive_support`
- **recon_array:** `sensor_range`, `intelligence_analysis`, `precision_targeting`
- **extraction_complex:** `iron_operations`, `fuel_refining`, `crystal_processing`
- **logistics_nexus:** `grid_distribution`, `repair_network`, `resource_mobility`

Each branch has a 3-tier node chain (`<archetype>.<branch>.t1..t3`), node IDs globally
unique, prerequisites chained (tier *i* requires tier *i−1*), no cycles.

### Effect-key approach
Intent-only `FacilityEffectKey` set (e.g. `troop_production`, `fortification_penetration`,
`shield_capacity`, `sensor_range`, `iron_output`, `repair_speed`, `transfer_capacity`).
**Not consumed by any resolver/route/AI/UI in this phase.**

### Qualitative energy model
`FacilityEnergyProfile` uses `idleDemand` / `activeDemand` (`low|medium|high`) and
`burstDemand` (`none|low|medium|high|extreme`) only — **no numeric values**. Profiles match
the approved expectations (e.g. Siege Battery: low idle / high active / extreme burst).

### Compatibility behavior
- Alignments reuse the existing `EnergyAlignment` union (`helios|aegis|nexus`); fit is
  `preferred|compatible|inefficient` (descriptive).
- Weapon references reuse the **existing** `shared/weapons/archetypes` IDs
  (`siege_baron`, `artillery_marshal`, `hypersonic_striker`, `ghost_marksman`,
  `aegis_interceptor`, `swarm_commodore`) — no duplication. Compatibility is descriptive
  until Phase 5.

### Legacy adapter behavior
- `SubParcelArchetype` (`resource|trade|fortress|energy`) is a **different axis** (build
  category) and does **not** map to facility IDs.
- `isFacilityArchetypeId()`, `normalizeFacilityArchetypeId()`, `resolveLegacySubplotArchetype()`
  provided. Legacy values are preserved, never silently coerced; unknown values return
  `undefined`. No data rewritten, no migration, no persistence change.

### Tests
18 focused unit tests (six-archetype completeness, stable IDs, exactly 3 branches, branch/node
uniqueness, prerequisite validity + no cycle, alignment compatibility, weapon-reference
validity, qualitative energy profiles, legacy normalization, unknown-value handling, no live
effects, deterministic serialized catalog). Full `test:server` suite: 534 passed / 24 skipped.
`validateFacilityCatalog()` returns zero errors.

### Explicit statement
**No gameplay effects are active.** DB schema, migrations, routes, attack schema, battle
resolver, AI, energy simulation, brownout, Armory persistence, Plot/Commander UI, wallet, and
blockchain behavior are all unchanged by this phase.

### Next phase
Phase 2 — energy-grid contract/simulation (qualitative profiles from this phase become the
contract input).
