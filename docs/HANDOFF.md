# HANDOFF — the baton (concise)

> Single source of truth for "what's next." Full prior history:
> [docs/HANDOFF_LOG.md](./HANDOFF_LOG.md). Protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> One agent now runs the whole loop end-to-end via **/ship** — no inter-chat wait, no manual audit handoff.

## Current baton
- **Unit:** background-loop cost-control — **DONE & MERGED** (all three doc PRs closed).
  - PR #243 `729c5ec` merged → auto-deployed; `/health` 200.
  - PR #244 `f13d9f5` merged (recovery verification doc).
  - PR #245 `e5b423b` merged (prod-verification limits; activation blocked on owner Fly/Neon access).
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
- **Phase B — IMPLEMENTED, PR OPEN:** `feat/frontier-battle-snapshot-persistence` (PR #254 open). Durable BattleSnapshot persistence and replay verification:
  - Migration `0016_battles_battle_snapshot.sql` adds nullable JSONB column `battle_snapshot` to the `battles` table
  - `server/engine/battle/snapshotReplay.ts` — pure replay utility: `parseStoredBattleSnapshot()` (Zod-validated strict parsing), `replayBattleInputFromStoredBattle()` (reconstructs exact legacy EngineBattleInput), `replayLegacyPersistedFieldsFromSnapshot()` (reconstructs legacy persisted fields)
  - `deployAttack()` persists the snapshot alongside the battle row in the same transaction
  - 19 focused replay tests covering JSONB round-trip, key reordering, identity verification, and parity
  - 669 server tests passing (baseline 650 + 19 new)
  - Live resolver unchanged — snapshot is for evidence and replay verification only
  - Phase C reclassified as verification/cleanup only (human/AI already share deployAttack())
  - Recommended next PR: Phase C verification, or Phase D (sub-parcel/special-path normalization)

## NEXT
- **Next lane:** (1) owner applies migration `0015` and `0016` to production DB (see P0.1 in roadmap); (2) owner activates cost-control via `flyctl secrets set` (see blocker above) and observes 15 min; (3) **Phase C verification** (human/AI already unified) or **Phase 4B** (`/archetype` + `/build` idempotency) is next. Later phases stay one-PR-at-a-time per HARD RULES.
- **Canonical documentation:** Master game spec, production roadmap, and reconciliation ledger are LIVE. All future implementation must align with `FRONTIER_MASTER_GAME_SPEC.md`. See `PRODUCTION_READINESS_ROADMAP.md` for lane priorities.
- **Off-limits:** standard HARD RULES below. Do NOT touch `server/services/chain/`, transaction amounts, ASA destinations, or the parked auth cleanup branch. Do **not** start `chore/ts7-migration` until owner approves.

## Last result (for fast auditor sanity-check)
- **Shipped:** TS7 migration scan — `docs/audits/chore-ts7-migration-scan.md` only. No TS7 installed, no dependencies upgraded, no source files edited. Scan surfaced gates:
  - `minimumReleaseAge: 1440` / TypeScript not excluded (`minimumReleaseAgeExclude`) → may block fresh TS7 install.
  - TS version mismatch: root ~5.9.3 vs frontier-al 5.6.3 vs aether-journey 5.6.3.
  - `@types/node` mismatch: catalog ^25.3.3 vs frontier-al 20.19.33.
  - `esbuild` pinned 0.27.3 may need a bump decision.
  - Vite target `es2020` vs tsconfig `ES2022` mismatch noted.
  - `allowImportingTsExtensions: true` present in frontier-al / aether-journey / mockup-sandbox.
  - `api-server` `node16` trial from prior lane failed and reverted.
- **Verified (from PR #236):** CI green (Typecheck & server tests, Cloudflare Pages). Recorded local tests green: root typecheck clean · `frontier-al run check` clean · `test:server` **480 passed / 24 skipped** · `test` **355 passed**.
- **TS7 status:** TS7 stable reported as **7.0.2**; `@typescript/native-preview` still preview-only. **No TS7 installed, no TypeScript upgraded.** This lane is scan only.
- **Scope:** docs only. Zero funds/ASA/wallet/on-chain/mainnet/auth/globe/combat files touched. Protected paths untouched.
- **Self-audit:** `docs/audits/chore-ts7-migration-scan.md` — no funds/ASA/auth lanes touched, so no independent auditor required.
- **Parked:** the **auth cleanup branch** remains parked and must NOT be merged without owner approval.

## Kilo Efficiency Profile (post-closeout)
- prior observed prompt context use: ~16%; current target: ~40%. Use the extra context for **more verification**, not wider scope.
- best terminal commands: `git status --short` · `gh pr checks <n>` · `gh pr diff <n> --name-only` · `gh run list --limit 5`.
- strongest future prompt pattern: main task → one same-lane adjacent fix → efficiency notes → terminal verification → **Asked / Done / Needs you**.
- workflow notes: session folder may be the repo root (normal); `rg` may be missing → use `grep`/`find`; `pnpm install --frozen-lockfile` is allowed when `node_modules` is missing (locks existing deps only, NOT a TS7 install); temp paths may be blocked → workspace edit + revert-on-fail is acceptable for config experiments; terminal verifies PR files/checks as source of truth; use a same-lane adjacent fix only if proven.

## Definition of done (tightened)
A session is NOT finished until ALL hold — verify mechanically, don't assume:
1. **Local checks green:** `pnpm install --frozen-lockfile` · `frontier-al run check` · `test:server` · `test` — recorded pass counts, no red.
2. **One PR, reviewed:** exactly one PR into `main` with an `## Audit checklist`; nothing merged unreviewed. Funds/ASA/auth units require `/mainnet-gate` PASS + `algo-auditor` PASS + a `USE_INDEPENDENT_AUDITOR=1` second pass.
3. **Loop closed:** unit committed → pushed → PR'd → baton rewritten (Current -> NEXT) → merged.
4. **Local == GitHub:** `git status` clean · `git fetch && git log origin/<branch>..HEAD` empty · PR head matches what was tested.
5. **No `[skip ci]`** on the final baton-rewrite commit (so CI runs on the head).
6. **Session note** written to `artifacts/frontier-al/session-notes/YYYY-MM-DD-<topic>.md`.

## 🛑 HARD RULES / off-limits (absolute)
- No funds/ASA/transfer code toward mainnet without **`/mainnet-gate` PASS + `algo-auditor` PASS** (both required).
- **Don't merge `wip/atomic-purchase`**; nothing in `ops/kestra/` may point at mainnet.
- Don't reintroduce mock/demo data into plot/HUD surfaces (they are live, server-driven).
- Don't change globe/combat/canvas behavior outside a scoped, audited unit.
- **Standing mainnet-gate item:** `VITE_DEV_MODE` + `DEV_LOGIN_ENABLED` ship `'true'` in prod `fly.toml` — deliberate for TestNet; M3-4 is the exit path.
- **Do NOT unify `mem.ts`/`db.ts`** game methods (combat/economy divergence risk).
- Pre-deploy: migrations `0000`–`0012` applied; `VITE_TEST_GLOBE` reads `false`; keep `SESSION_SECRET` stable.
- **Standing owner directive:** proceed without asking when approval is a foregone conclusion; still one-PR-at-a-time and HARD RULES remain absolute.
- One open PR at a time; never commit to `main` directly; never over-claim — say "untested" when untested.
