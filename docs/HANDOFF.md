# HANDOFF — the baton (concise)

> Single source of truth for "what's next." Full prior history:
> [docs/HANDOFF_LOG.md](./HANDOFF_LOG.md). Protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> One agent now runs the whole loop end-to-end via **/ship** — no inter-chat wait, no manual audit handoff.

## Current baton
- **Unit:** NFT metadata proxy (production-domain `frontierprotocol.app/nft/metadata/*` → Fly backend) — **DONE & MERGED** (PR #260 `36fbf6c`).
  - Added `artifacts/frontier-al/client/public/_redirects` proxying `/nft/metadata/{:plotId,commander/:id,weapon/:id}` to `https://frontiernext.fly.dev/nft/metadata/*` with status 200 (transparent proxy, not 3xx).
  - Rules ordered BEFORE the `/*` SPA fallback; `/nft/biomes/*` and `/api/*` deliberately NOT proxied.
  - Added 8-case regression spec (`client/tests/cloudflare-redirects.spec.ts`); full client suite 466/466 + typecheck clean + CI green (Typecheck & server tests + Cloudflare Pages).
  - No application code, no chain/ASA, no auth, no idempotency, no marketing copy, no archetype/energy changes.
- **Next lane:** Battle Planner (Battle Target Selector pre-cursor shipped; next is the planner UI). Faction economy / treasury / equity / contribution-ledger remain future work. The ASCEND ASA `764083761` on-chain URL reconfiguration is a separate OWNER-SIGNED ON-CHAIN ACTION, not an app-code PR (verified in the Perplexity launch-blocker audit, separate lane).
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
- **Shipped:** NFT metadata proxy — PR #260 `36fbf6c` (2026-07-13). Added `client/public/_redirects` proxying `/nft/metadata/{:plotId,commander/:id,weapon/:id}` to `https://frontiernext.fly.dev/nft/metadata/*` with status 200. Wallets now resolve ARC-3 JSON from the branded domain. No application code, no chain, no auth, no idempotency, no marketing copy, no archetype/energy changes. CI green: typecheck clean · full client 466/466.
- **Verified:** 8 new test cases for the redirects file. Production curl post-deploy is the owner's responsibility (see PR body).

## NEXT
- **Next lane:** Battle Planner (Battle Target Selector shipped; next is the planner UI). Faction economy / treasury / equity / contribution-ledger remain future work.
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
