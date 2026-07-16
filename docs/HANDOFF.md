# HANDOFF — the baton (concise)

> Single source of truth for "what's next." Full prior history:
> [docs/HANDOFF_LOG.md](./HANDOFF_LOG.md). Protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> One agent now runs the whole loop end-to-end via **/ship** — no inter-chat wait, no manual audit handoff.

## Current baton
- **Unit:** Battle Planner route + page shell — **DONE & MERGED** (PR #276 `f9fb5b6`).
  - Added `client/src/pages/battle-planner.tsx` with `BattlePlannerPage` shell wiring existing `BattlePlanner` component to `useGameState`, `useAttack`, `useCurrentPlayer`, `useWallet`, `useToast`.
  - Wired `/battle-planner` route in `App.tsx`.
  - Added smoke test `client/tests/battle-planner-page.spec.tsx`.
  - No server/API/DB/wallet/chain/combat changes. Verify gate green: `check` clean; `test:server` 706/706; `test` 9/9; `build` green.
- **Previous unit:** Memory Layer runner prompt + session updater — **DONE & MERGED** (PR #275 `76a559d`).
  - Ported clean docs onto fresh branch from current `main`: `docs/memory/KILO_RUNNER_PROMPT.md` (session-start prompt with embedded closeout block) and `docs/memory/SESSION_UPDATER_WORKFLOW.md` (standalone session-close procedure).
  - Closed obsolete PR #270 first; queue now clear.
  - Docs/process only: no app code, schema/migration, ASA/wallet/treasury, or combat changes. Verify gate green: `check` clean; `test:server` 706/706; `test` 9/9; `build` green.
- **Previous unit:** Mission Control Phase 2 — repository intelligence — **DONE & MERGED** (PR #274 `dd91980`).
  - Build-time generator (`scripts/generate-mission-control-data.mjs`) derives repo metadata, workflow status, build info, health indicators, and branch hygiene from local git + files — no GitHub auth, no API, no polling.
  - Dashboard reorganised into 9 sections (4 auto-derived + 5 hand-curated). `missionControlData.test.ts` expanded 3→9 contract tests. `testTotals.json` captures client/server test counts.
  - CI green on head `793e745`: Typecheck & server tests ✅ + Cloudflare Pages ✅.
- **Previous unit:** Mission Control Phase 1 — internal dashboard — **DONE & MERGED** (PR #273 `0913ac4`).
  - `client/src/pages/MissionControl.tsx` + `client/src/components/mission-control/` — 7 panels: System Status, Workflow Health, Current Priorities, Build Health, Owner Actions, Memory Layer, Branch Hygiene.
  - `/mission-control` route added to `App.tsx`, lazy-loaded, mounted OUTSIDE `WalletProvider` (same pattern as `/admin` + `/university`) — no wallet/chain/backend/DB.
  - Static-only (no API/polling). Status color chips, copy-SHA button, and mobile collapsible sections included. Dark-mode compatible, mobile-first.
- **Previous unit:** fix(mobile): safe-area insets, touch targets, drop duplicate render timer — **DONE & MERGED** (PR #272 `e2c94bb`).
- **Previous unit:** docs(memory): resync state index and baton — **DONE & MERGED** (PR #271 `3a15bad`).
- **Previous unit:** Memory Layer runner prompt + session updater — **DONE & MERGED** (PR #269 `ae57840`).
  - Implemented the memory-layer runner workflow: `docs/memory/KILO_RUNNER_PROMPT.md` (session-start prompt), `docs/memory/SESSION_UPDATER.md` (closeout procedure, 5 memory-write targets), `docs/memory/00-STATE-INDEX.md` (canonical current-state index — previously missing), `docs/memory/10-completed/_INDEX.md` (completed-lane index).
  - `.github/workflows/session-log.yml` confirmed as the **sole** session-updater trigger; added verification-only `.github/workflows/memory-session-check.yml` (no memory writes). Prior DRAFT's duplicate `memory-session-update.yml` + Notion scripts/secrets removed.
  - Docs/process only: no app code, schema/migration, ASA/wallet/treasury, or combat changes. CI green (typecheck + server tests + memory-session-check).
- **Previous unit:** Battle Planner Draft Persistence (Phase 4) — **DONE & MERGED** (PR #268 `88ff4ff`).
  - `feat(planner)`: Planner Draft Persistence via `localStorage`.
- **Previous unit:** Battle Planner globe attack path visualization (Phase 3) — **DONE & MERGED** (PR #267 `b96f273`).
  - `feat(frontier)`: Battle Planner globe attack path visualization.
- **Previous unit:** Battle Planner outcome preview (Phase 2) — **DONE & MERGED** (PR #266 `affaa52`).
  - `feat(frontier)`: add Battle Planner outcome preview.
- **Previous unit:** Mobile globe touch regression coverage — **DONE & MERGED** (PR #265 `ba2e71f`).
  - Added regression documentation and TODO pointers for the mobile globe touch fixes from PR #263.
  - `client/docs/testing/mobile-globe-touch.md` — explains why automated multi-touch regression coverage is impractical in the current Node/SSR test harness, documents exact manual reproduction steps, expected outcomes, and future test ideas.
  - `client/docs/testing/mobile-globe-regression-checklist.md` — QA checklist with eight mobile interaction checks.
  - `client/docs/testing/mobile-globe-e2e-investigation.md` — tool audit (Vitest present; Playwright/Cypress/Vitest Browser Mode absent) and a documented future Playwright spec if E2E is ever adopted.
  - TODO comments in `GlobeParcels.tsx`, `PlanetGlobe.tsx`, `hud.css`, `GlobeHUD.tsx`, and `index.html` pointing to the docs.
  - No production behavior changes, no gameplay changes, no server/API/wallet/chain/auth changes, no visual changes, no new dependencies, no refactors.
- **Previous unit:** Mobile plot sheet independent close — **DONE & MERGED** (PR #264 `eac4a2a`).
  - Fixed the bug where tapping the X on the top globe peek card or the bottom MobilePlotSheet closed both layers at once.
  - `GameLayout.tsx`: added `showMobileSheet` state separate from `selectedParcelId`. The bottom sheet X and backdrop now close only the sheet; the globe peek card remains visible.
  - `SelectedPlotPanel.tsx`: added `onSheetClose` prop, used for `MobilePlotSheet` on mobile while `onClose` remains the full dismiss for desktop.
  - `client/tests/mobile-overlay-close.spec.tsx`: updated regression tests to cover the independent close state machine.
- **Previous unit:** Mobile globe touch interaction — **DONE & MERGED** (PR #263 `18da3b9`).
  - Fixed three diagnosed bugs: pinch-zoom synthesising plot selection, pinch-zoom rotating the camera, and the bottom HUD dock blocking canvas touches.
  - `GlobeParcels.tsx`: pointer-count tracking guards `onClick` so pinch gestures do not select plots.
  - `PlanetGlobe.tsx`: `OrbitControls` touch config changed to `TWO: THREE.TOUCH.DOLLY_PAN` for pure pinch-to-zoom.
  - `hud.css`: `.hud-dock` is `pointer-events: none`; dock buttons `.hud-di` remain `pointer-events: auto`.
  - `GlobeHUD.tsx`: `PlayerLegend` wrapper now has `pointer-events-none`.
  - `client/index.html`: viewport meta updated with `user-scalable=no, maximum-scale=1.0`.
  - No server, API, DB, auth, wallet, chain, or archetype changes. No new dependencies.
- **Previous unit:** NFT metadata proxy (production-domain `frontierprotocol.app/nft/metadata/*` → Fly backend) — **DONE & MERGED** (PR #260 `36fbf6c`).
  - Added `artifacts/frontier-al/client/public/_redirects` proxying `/nft/metadata/{:plotId,commander/:id,weapon/:id}` to `https://frontiernext.fly.dev/nft/metadata/*` with status 200 (transparent proxy, not 3xx).
  - Rules ordered BEFORE the `/*` SPA fallback; `/nft/biomes/*` and `/api/*` deliberately NOT proxied.
  - Added 8-case regression spec (`client/tests/cloudflare-redirects.spec.ts`); full client suite 466/466 + typecheck clean + CI green (Typecheck & server tests + Cloudflare Pages).
  - No application code, no chain/ASA, no auth, no idempotency, no marketing copy, no archetype/energy changes.
- **Next lane:** Battle Planner is **DONE & MERGED** through Phase 4 (PRs #266 outcome preview, #267 globe attack path, #268 draft persistence). Faction economy / treasury / equity / contribution-ledger remain future work. The ASCEND ASA `764083761` on-chain URL reconfiguration is a separate OWNER-SIGNED ON-CHAIN ACTION, not an app-code PR (verified in the Perplexity launch-blocker audit, separate lane).
- **Owner-only blocker:** production activation was **not** performed by agents (no `flyctl`/`FLY_API_TOKEN`, no secret-setting workflow). Owner must run:
  `flyctl secrets set -a frontiernext AI_ENABLED=true AI_TURN_INTERVAL_MS=120000 DEBUFF_CLEANUP_INTERVAL_MS=60000 AI_MAX_ACTIVE_BATTLES=12`
  then confirm `/health` 200 and observe 15 min (AI ~120 s, debuff ~60 s, active battles ≤ 12). See `docs/memory/FRONTIER_BACKGROUND_LOOP_COST_CONTROL.md`.
- **Closeout facts (PR #243):** AI scheduler 20s → `AI_TURN_INTERVAL_MS` default 120s (floor 30s); parcel query `SELECT *` → 17-field projection; debuff cleanup moved to own `DEBUFF_CLEANUP_INTERVAL_MS` default 60s (floor 10s), one combined bounded UPDATE; `gameMeta.currentTurn` kept unconditional. Documented in `docs/memory/FRONTIER_BACKGROUND_LOOP_COST_CONTROL.md`.
- **Next lane (documentation complete):** sub-plot combat architecture — see `docs/memory/FRONTIER_SUBPLOT_COMBAT_ARCHITECTURE.md`. Implementation is phased (Phases 0–11) and requires owner architecture approval before any application-code PR.

## 📚 Recovery & architecture docs (pointer)
- Recovered land/combat/panel audit: `artifacts/frontier-al/docs/audit/FRONTIER_LAND_COMBAT_PANEL_AUDIT.md` (originally `fa5b125`, re-verified at `e5b423b`).
- Sub-plot combat architecture (canonical vocabulary + phased plan): `docs/memory/FRONTIER_SUBPLOT_COMBAT_ARCHITECTURE.md`.
- **Battle-engine truth and target architecture (documentation-only, no runtime changes):** `docs/memory/FRONTIER_BATTLE_ENGINE_TRUTH_AND_TARGET.md`. Verdict: live engine is operationally correct but minimal; weapon archetypes/energy alignments/sub-parcel archetypes are stored but not consumed; CombatProfile/BattleSnapshot contracts exist but are not integrated. Recommended first implementation PR: Phase A (CombatProfile launch adapter with legacy parity). See document for full connection matrix, divergence analysis, and PR-sized migration sequence.
- Background-loop cost control (merged, deploy, owner activation): `docs/memory/FRONTIER_BACKGROUND_LOOP_COST_CONTROL.md`.
- **Owner-only Fly activation blocker:** agents cannot set Fly secrets (no `flyctl`/`FLY_API_TOKEN`, no secret-setting workflow). Activation + 15-min observation + DB snapshots are owner actions.
- **Approved parallel-PR rule:** documentation/architecture/recovery PRs (doc-only, no app-code/schema/lockfile changes) may land in parallel without blocking the feature lane; application-code phases stay **one PR at a time** per the standing HARD RULES.
- **Phase 1 — DONE & MERGED:** `feat/frontier-subplot-facility-catalog` → PR #247 `a737ba8` (canonical facility-archetype + upgrade-tree contract in `shared/subplotArchitecture.ts`). No gameplay effect.
- **Phase 2 — DONE & MERGED:** `feat/frontier-energy-grid-simulation` → PR #248 `2ea4cae` (deterministic, pure energy-grid simulator in `shared/energyGrid.ts` + `shared/energyGrid.spec.ts`, 53 tests green). No production integration; `computeGridPowerDependency()` untouched. Policies owner-approved: priority critical→high→normal→low; sub-minimum facilities return energy to pool; reserve floor enforced by default.
- **Phase 3 — DONE & MERGED:** `feat/frontier-combat-profile` → PR #249 (squash-merge `87ee770`; 4-file scope: `shared/combatProfile.ts` + spec + memory + baton; CI green). Pure, deterministic, immutable `CombatProfile` + battle-snapshot contract. Zero gameplay effect; no attack route / DB / `resolveBattle()` / AI / UI wiring. Owner accepted the contract as implemented. See `docs/memory/FRONTIER_SUBPLOT_COMBAT_ARCHITECTURE.md` §Phase 3.
- **Phase 4A — DONE & MERGED:** `fix/frontier-plot-attack-idempotency` → PR #250 squash-merged at `da35c7e` (2026-07-12T12:32:02Z). Reuses existing DB-backed `action_nonces` guard; adds additive `payload_fingerprint` column (migration `0015`). Same-key/same-payload replays original 200; same-key/different-payload returns 409; missing key fails open (legacy compat). Scope limited to `POST /api/actions/attack`; `/archetype` + `/build` deferred to Phase 4B. Battle math/`resolveBattle()`/AI/wallet/chain untouched. Migration deployment pending (owner action). See `docs/memory/FRONTIER_SUBPLOT_COMBAT_ARCHITECTURE.md` §Phase 4A.
- **Canonical documentation — DONE & MERGED:** `docs/frontier-master-game-spec` → PR #251 (squash-merge `2139865`). Three canonical documents established:
  - `artifacts/frontier-al/FRONTIER_MASTER_GAME_SPEC.md` — canonical game-design truth (29 sections, status labels for all systems)
  - `artifacts/frontier-al/PRODUCTION_READINESS_ROADMAP.md` — 9-lane implementation plan (P0-P9, 45 tasks)
  - `artifacts/frontier-al/docs/DOC_RECONCILIATION_LEDGER.md` — doc-vs-code mismatch tracker (19 entries)
  - All three documents align with code reality at commit `da35c7e`. No runtime code changes.
- **Battle-engine memory — DONE & MERGED:** `docs/frontier-battle-engine-truth` → PR #252 (squash-merge `91d183d`). Defines:
  - `docs/memory/FRONTIER_BATTLE_ENGINE_TRUTH_AND_TARGET.md` — current engine truth + target architecture + 12-PR migration sequence (A-L) with crystal/proof/divergence clarifications
- **Phase A — DONE & MERGED:** `feat/frontier-battle-profile-launch-adapter` → PR #253 squash-merged at `3b3db01` (2026-07-12). Server-authoritative launch adapter wired into `deployAttack()`:
  - `server/engine/battle/profileAdapter.ts` — pure adapter that builds CombatProfile + BattleSnapshot at launch, maps to EXACT legacy EngineBattleInput (parity-safe)
  - 30 focused adapter tests proving parity (representative, minimum, commander, crystal, radar, biome/defense, unowned, morale, fixed-point modifier semantics, authoritative origin)
  - Snapshot immutability, determinism, no-new-effects, contract validation, crystal/commander separation
  - Completed replays do NOT call deployAttack or the adapter (guardClaimOrRespond returns stored response first; verified in attackIdempotency.spec.ts test #8)
  - 669 server tests passing
- **Phase B — DONE & MERGED:** `feat/frontier-battle-snapshot-persistence` → PR #254 (squash-merged). Durable BattleSnapshot persistence and replay verification: migration `0016_battles_battle_snapshot.sql` (nullable JSONB `battle_snapshot`), `server/engine/battle/snapshotReplay.ts` (`parseStoredBattleSnapshot`/`replayBattleInputFromStoredBattle`/`replayLegacyPersistedFieldsFromSnapshot`), `deployAttack()` persists the snapshot in the same transaction, 19 replay tests, 669 server tests passing. Live resolver unchanged.
- **Phase 1 — Faction-identity / economy foundation — DONE & MERGED:** `feat/frontier-faction-identity-territory` → PR #256 (squash-merged `5f0989a`, 2026-07-12T16:34:02Z). An authenticated human's persisted faction (`players.playerFactionId`) now server-authoritatively drives:
  - `shared/factionIdentity.ts` — `resolvePlayerFaction` / `resolveParcelFaction` / `classifyRelationship` (ally/enemy/neutral) / `computeFactionTerritory`. Canonical design rule: no owner → neutral; AI canonical faction account (name===faction id) → that faction; human with `playerFactionId` → that faction; human w/o → neutral. **Human faction is NEVER inferred from display name.**
  - `/api/factions` territory totals now count human members' parcels (defects #1/#5 fixed; AI territory still counted — verified live: KRONOS/VANGUARD include human members; NEXUS-7 360 / SPECTRE 338 AI-held).
  - `LandParcel.effectiveFaction` (nullable) exposed by BOTH `DbStorage` and `MemStorage` `getGameState()` (defect #3). Verified live in `/api/game/state` payloads (759 attributed: NEXUS-7 360 / KRONOS 54 / SPECTRE 338 / VANGUARD 7; 20,241 neutral).
  - Globe colors owned plots by server-derived faction via `factionColor` (defect #2) — human KRONOS member land reads KRONOS purple, not enemy red/neutral.
  - Tests: `shared/factionIdentity.spec.ts` (16), `server/storage/factionTerritory.mem.spec.ts` (2), `client/tests/globe-faction-color.spec.ts` (5). `pnpm run check` clean; `pnpm run build` clean; CI green (Typecheck & server tests + Cloudflare Pages).
  - Deployed: Fly `Deploy to Fly` run #29200366134 green; `/health` 200, `/readiness` 200; no startup/serialization/faction-route/DB errors observed.
  - **No migrations, no funds/ASA/chain/mainnet, no battle-resolver, no AI-behavior, no faction-treasury changes.** Exposed `effectiveFaction` is computed at serialization, not stored.
  - **Explicitly NOT done (future work):** faction treasury / equity / contribution ledger / leadership / full faction economy; Battle Planner + Battle Target Selector; human mining/building/combat/finance faction-aggregation.

## LAST RESULT
- **Shipped:** Battle Planner route + page shell — PR #276 `f9fb5b6` (2026-07-16). Added `/battle-planner` route and `BattlePlannerPage` shell. Verify gate green: `check` clean; `test:server` 706/706; `test` 9/9; `build` green.
- **Shipped:** Memory Layer runner prompt + session updater — PR #275 `76a559d` (2026-07-16). Clean port of `docs/memory/KILO_RUNNER_PROMPT.md` + `docs/memory/SESSION_UPDATER_WORKFLOW.md` onto fresh branch after closing obsolete PR #270. Verify gate green: `check` clean; `test:server` 706/706; `test` 9/9; `build` green.
- **Shipped:** Mission Control Phase 2 — PR #274 `dd91980` (2026-07-16). Build-time generator + 9-section dashboard. CI green on head `793e745`: Typecheck & server tests ✅ + Cloudflare Pages ✅. `missionControlData.test.ts` 9/9 pass.
- **Shipped:** Mission Control Phase 1 — PR #273 `0913ac4` (2026-07-16). Internal `/mission-control` dashboard, 7 panels, mounted outside WalletProvider. Typecheck clean; server tests 706/706; client tests 9/9; CI green.
- **Shipped:** fix(mobile) safe-area + touch targets — PR #272 `e2c94bb` (2026-07-15). Dropped duplicate render timer.
- **Shipped:** docs(memory) resync state index and baton — PR #271 `3a15bad` (2026-07-15).
- **Previous result:** Mobile globe touch regression coverage — PR #265 `ba2e71f` (2026-07-14).

## NEXT
- **Next lane:** Resume feature roadmap — Battle Planner planner UI, or faction economy / treasury / equity / contribution-ledger foundation, per `PRODUCTION_READINESS_ROADMAP.md`. Owner approval required before any sub-plot combat application-code PR.
- **Owner-only follow-up (separate lane, NOT an app-code PR):** reconfigure ASCEND ASA `764083761` on-chain URL to a valid endpoint. The ASA's current URL points at a dead Replit placeholder. This is an OWNER-SIGNED ON-CHAIN ACTION (Algosdk `asset_config` tx signed by the ASA manager). Verified in the Perplexity launch-blocker audit; intentionally NOT bundled with the NFT-metadata proxy PR.
- **Canonical documentation:** Master game spec, production roadmap, and reconciliation ledger are LIVE. All future implementation must align with `FRONTIER_MASTER_GAME_SPEC.md`. See `PRODUCTION_READINESS_ROADMAP.md` for lane priorities.
- **Off-limits:** standard HARD RULES below. Do NOT touch `server/services/chain/`, transaction amounts, ASA destinations, or the parked auth cleanup branch. Do **not** start `chore/ts7-migration` until owner approves.

## 🛑 HARD RULES / off-limits (absolute)
- No funds/ASA/transfer code toward mainnet without **`/mainnet-gate` PASS + `algo-auditor` PASS** (both required).
- **Don't merge `wip/atomic-purchase`**; nothing in `ops/kestra/` may point at mainnet.
- Don't reintroduce mock/demo data into plot/HUD surfaces (they are live, server-driven).
- Don't change globe/combat/canvas behavior outside a scoped, audited unit.
- **Standing mainnet-gate item:** `VITE_DEV_MODE` + `DEV_LOGIN_ENABLED` ship `'true'` in prod `fly.toml` — deliberate for TestNet; M3-4 is the exit path.
- **Do NOT unify `mem.ts`/`db.ts`** game methods (combat/economy divergence risk).
- Pre-deploy: migrations `0000`–`0016` applied; `VITE_TEST_GLOBE` reads `false`; keep `SESSION_SECRET` stable.
- **Standing owner directive:** proceed without asking when approval is a foregone conclusion; still one-PR-at-a-time and HARD RULES remain absolute.
- One open PR at a time; never commit to `main` directly; never over-claim — say "untested" when untested.
