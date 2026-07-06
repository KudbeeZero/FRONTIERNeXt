# FRONTIER Master Roadmap

> The updated master plan, derived from the 2026-07-06 repo audit — not assumptions.
> Companions: [`FRONTIER_ARCHITECTURE_TRUTH.md`](./FRONTIER_ARCHITECTURE_TRUTH.md) (facts),
> [`FRONTIER_AGENT_REGISTRY.md`](./FRONTIER_AGENT_REGISTRY.md) (agents),
> [`FRONTIER_AGENT_DASHBOARD_SPEC.md`](./FRONTIER_AGENT_DASHBOARD_SPEC.md) (Mission Control),
> [`FRONTIER_FIRST_10_PRS.md`](./FRONTIER_FIRST_10_PRS.md) (immediate queue),
> [`FRONTIER_BRANCH_MACHINE.md`](./FRONTIER_BRANCH_MACHINE.md) (execution rules),
> [`../artifacts/frontier-al/docs/NEXT_LEVEL_PLAYBOOK.md`](../artifacts/frontier-al/docs/NEXT_LEVEL_PLAYBOOK.md)
> (game-content units — this roadmap references playbook units rather than duplicating them).
> Supersedes `artifacts/frontier-al/ROADMAP.md` (stale, "March 2026").

Field key per phase: **Purpose · Exists · Missing · Files · Agents · ⛓ risk (none/read/write/funds)
· UI · Tests · Branch · PR · Accept · 🚫 Don't touch**. One phase ≈ 1–3 PRs; branch names are the
first PR's. Ordering is dependency-driven; owner may reprioritize via the baton.

---

## Phase 1 — Architecture Truth Audit ✅ (this PR)
**Purpose** one verified map of what exists. **Exists** now: `FRONTIER_ARCHITECTURE_TRUTH.md` from
read-only audit. **Missing** keep-current discipline. **Files** `docs/FRONTIER_ARCHITECTURE_TRUTH.md`.
**Agents** scouts (read-only). **⛓** none. **UI** none. **Tests** n/a (docs). **Branch**
`feat/frontier-architecture-agent-roadmap`. **PR** "docs: add FRONTIER architecture, agent registry,
and roadmap". **Accept** facts carry file:line-level evidence; unknowns marked unknown.
**🚫** any code.

## Phase 2 — Agent Registry / Agent Map ✅ (this PR)
**Purpose** inventory every real agent/watcher + kill-switch policy. **Exists** now:
`FRONTIER_AGENT_REGISTRY.md` (10 live workers, Veritas, 4 Kestra flows, process skills, blueprints).
**Missing** machine-readable registry (JSON) for the dashboard — PR #1 of FIRST_10. **Files**
`docs/FRONTIER_AGENT_REGISTRY.md`. **⛓** none. **Accept** every `setInterval`/cron in repo appears.
**🚫** any behavior change.

## Phase 3 — Mission Control Dashboard V1
**Purpose** make agents visible + killable. **Exists** dashboard v2 widget grid, `/admin` ops page,
`AiFactionLog`, admin API (`/api/admin/*`), WS health. **Missing** `/mission-control` route,
`GET /api/ops/*` aggregation, agent cards, kill switches for write agents #2/#5/#6/#7.
**Files** `client/src/pages/mission-control.tsx`, `client/src/components/game/dashboard/ops/*`,
`server/routes/ops.ts` (or routes.ts block), registry JSON. **Agents** all registry rows render.
**⛓** read (+ flag writes for kill switches). **UI** per `FRONTIER_AGENT_DASHBOARD_SPEC.md`.
**Tests** ops-endpoint spec + card render tests. **Branch** `feat/mission-control-shell`.
**PR** "feat: add Mission Control agent dashboard shell". **Accept** owner sees live agent states
at `/mission-control`; kill switch stops the ASCEND transfer worker within one cycle (test-backed).
**🚫** the agents' own logic; no mock data presented as live.

## Phase 4 — Aether AI Companion
**Purpose** bring the prologue's Aether into the main game as an in-HUD companion (advice,
mission narration, whisper channel). **Exists** `apps/aether-journey` (voice pipeline, persona),
`engine/narrative/{whispers,advisor,commentator}.ts`, terraform-advice endpoint. **Missing**
companion panel, server "companion report" composer, voice asset reuse. **Files**
`client/.../CompanionPanel.tsx`, `server/engine/narrative/companion.ts` (+spec). **⛓** none.
**UI** dashboard widget + report drawer. **Tests** deterministic composer spec. **Branch**
`feat/aether-companion-panel`. **PR** "feat: add Aether companion report panel". **Accept**
panel shows real game-state-derived reports; no LLM calls server-side in v1 (template composer).
**🚫** game balance; ElevenLabs keys client-side.

## Phase 5 — Core Game Loop hardening
**Purpose** the playbook's Phase A (first five minutes): onboarding quest chain, objective HUD
real lose-detection, cinematic taste pass. **Exists/Missing/Accept** → playbook units A1–A3.
**⛓** none. **Branch** `feat/onboarding-quest-chain`. **🚫** combat/economy math.

## Phase 6 — Algorand Wallet / Transaction Safety
**Purpose** close the SEV1s and put every txn behind visible safety. **Exists** custody model,
idempotency guards, `verifyAlgoPayment` (commander path), chain event log, `chain-services-audit.md`.
**Missing** payment verification on the plot purchase route (SEV1), claim no-op surfacing (SEV2),
`smoke:testnet` live run (settles SEV2 upgrade-note question). **Files** `server/routes.ts`
purchase/claim blocks, `services/chain/*` (+ specs). **Agents** Transaction Watcher panel (Phase 3)
must land first or together. **⛓ funds** — full gates: TestNet click-test + txn watcher capture +
`/security-pass` + owner approval. **Tests** fails-before/passes-after spec per fix. **Branch**
`fix/purchase-payment-verification`. **PR** "fix: verify ALGO payment on plot purchase (SEV1)".
**Accept** unverified purchase rejected on TestNet with FREE_PURCHASES=false; audit doc updated.
**🚫** mainnet config; ASA params of the live token.

## Phase 7 — ASCEND / Claim / Armory Safety Review
**Purpose** full `/security-pass` over ASCEND sinks/claims (claim-frontier, weapon spends,
market claims, sub-parcel 70/30 split). **Exists** centralized guards + 36 audit reports.
**Missing** a single current pass over the post-refactor surface. **Files** audit report under
`artifacts/frontier-al/docs/audit/`. **⛓** read (fixes it spawns are funds-gated PRs).
**Branch** `docs/security-pass-ascend-claims`. **Accept** every finding fixed-with-test or
accepted-risk-documented. **🚫** broad refactors (surgical only).

## Phase 8 — Battle System Architecture
**Purpose** document + visualize the battle engine as a system map (engine → resolver →
proof → cinematics) and land playbook B1 (weapon engagement cinematics). **Exists** deterministic
engine, proof endpoint, sim, veritas. **Missing** system map doc, globe arc layer (B1).
**⛓** none. **UI** battle lab panel (dashboard). **Branch** `feat/battle-lab-system-map`.
**Accept** map doc + panel reading real battle stats. **🚫** resolution math.

## Phase 9 — Ship / Aether Voyager System
**Purpose** connect prologue → game arrival (the Voyager as a persistent player asset/HUB).
**Exists** prologue handoff (`aether-journey/src/lib/chain/handoff.ts`). **Missing** everything
in-game; design first. **⛓** none in design; NFT later (gated). **Branch**
`docs/voyager-system-design`. **Accept** ADR with owner sign-off before any code. **🚫** minting.

## Phase 10 — Armory / Loadout System
**Purpose** finish weapons UX: playbook B2 (defensive DEPLOY UI), loadout presets, armory panel.
**Exists** weapon engine, `/armory` page, weapon NFTs, upgradeTier→damage wiring. **Missing**
deploy UI, loadout persistence. **⛓** write (ASCEND spends via existing sinks only). **Branch**
`feat/armory-deploy-ui`. **Accept** deploy flow test-covered; spends only through existing
guarded endpoints. **🚫** weapon-economy constants.

## Phase 11 — Economy / Resource System
**Purpose** economy with a destination: playbook D1 (plot marketplace) + D2 (season arcs) +
sink/faucet dashboard. **Exists** markets engine, treasury split, season manager, economy config.
**Missing** P2P marketplace, arc definitions, econ telemetry panel. **⛓ funds** (marketplace) —
full gates. **Branch** `feat/econ-telemetry-panel` (read-only first). **Accept** telemetry panel
live before any marketplace code. **🚫** `economy-config.ts` constants without owner sign-off.

## Phase 12 — HERMES Router Integration
**Purpose** the message/task router between agents (owner's HERMES). **Exists** nothing (name
only). **Missing** everything — contracts first. **Files** `shared/hermes/contracts.ts` (types +
zod, mock only), later `server/services/hermes/`. **⛓** none (mock). **Branch**
`feat/hermes-router-contracts`. **PR** "feat: add HERMES router mock contracts". **Accept**
typed message envelope + routing table types + spec; zero runtime wiring. **🚫** giving any agent
new write powers via the router in v1.

## Phase 13 — Memory / State Layer
**Purpose** durable machine-readable state: registry JSON, baton stays authoritative, retire the
stale ASCENDANCY `PROJECT MEMORY.md` layer (mark superseded). **Exists** baton, 75 session notes,
audits. **Missing** `docs/state/registry.json` (+ generator), supersession notices. **⛓** none.
**Branch** `chore/state-registry-json`. **Accept** dashboard reads registry from one JSON source.
**🚫** deleting historical notes.

## Phase 14 — Agent Security Model
**Purpose** codify agent permissions: per-agent allowed/forbidden actions, kill-switch flags,
fail-closed defaults (registry §Kill-switch), secrets never in agent context. **Exists**
`AI_ENABLED` pattern, `requireAdminKey`, branch-machine gates. **Missing** flags for workers
#2/#5/#6/#7, a `server/agentFlags.ts` module + spec. **⛓** write. **Branch**
`feat/agent-kill-switches`. **Accept** each write agent stoppable at runtime, test-backed;
Mission Control toggles them. **🚫** changing what agents do when ON.

## Phase 15 — UI/UX Master Design
**Purpose** one design language across game HUD + Mission Control (tokens, spacing, dark-first),
leveraging `.agents/skills/ui-ux-pro-max`. **Exists** Tailwind 4, shadcn components,
`design_guidelines.md`. **Missing** consolidated token sheet + panel patterns doc. **⛓** none.
**Branch** `docs/ui-master-design`. **Accept** owner-approved; new panels reference it.
**🚫** globe visuals.

## Phase 16 — Feature Flag / Config Governance
**Purpose** central flag module + pre-deploy flag audit (truth §7 table is the seed). **Exists**
inline reads everywhere; `ENV_VARS.md`. **Missing** `shared/flags.ts` accessor + Flag Auditor
panel + CI check that fly.toml dev flags never coexist with `ALGORAND_NETWORK=mainnet`.
**⛓** none. **Branch** `chore/central-flag-module`. **Accept** all reads through the module
(mechanical), CI guard test. **🚫** flipping any flag's current value.

## Phase 17 — Test Strategy / QA
**Purpose** keep the deterministic core ≥80%, refresh `/test-matrix`, add browser-level smoke
(Playwright is preinstalled in the remote env) for the untested UI claims. **Exists** 415 server +
213 client tests, coverage gate, veritas, sim. **Missing** the visible matrix refresh + 2–3
Playwright smokes (landing → dev login → globe mounts). **Branch** `test/browser-smoke-pack`.
**Accept** matrix doc current; smokes run in CI. **🚫** lowering the coverage gate.

## Phase 18 — Deployment / DevOps
**Purpose** verify Kestra flows are actually deployed (unknown today), wire deploy watcher panel,
prune the ~140 dead remote branches (owner, delete-scoped token), decide the parked
`api-server`/`lib/*` island. **Exists** Fly + Cloudflare + fly-deploy workflow + Kestra YAMLs.
**⛓** none. **Branch** `docs/ops-verification`. **Accept** each ops flow marked
verified-running / not-deployed; owner decision recorded for the island. **🚫** pointing anything
at mainnet.

## Phase 19 — TDE / Developer Command Center
**Purpose** the developer-side console: baton viewer, session-note index, audit-trail browser,
one-click smoke/test runners (local only). **Exists** raw markdown everywhere. **Missing** the
console (can be a Mission Control tab). **⛓** none. **Branch** `feat/dev-command-center-tab`.
**Accept** reads real files; no write actions in v1. **🚫** running privileged commands from UI.

## Phase 20 — Narrative / Lore / Worldbuilding
**Purpose** deepen faction identity: LORE_CODEX integration in-game, faction operation narratives
(with Phase B4 of the playbook), whisper channel expansion. **Exists** LORE_CODEX.md, factionVoice,
whispers, commentator. **⛓** none. **Branch** `feat/lore-surface`. **Accept** lore panels read
from one lore source module; copy owner-approved. **🚫** economy-relevant text (prices/rates).

## Phase 21 — Visual / Asset Pipeline
**Purpose** systematize art: commander/weapon/biome asset manifest, generation workflow (Adobe/
Figma MCPs available in sessions), size budgets (client bundle is code-split three.js). **Exists**
ad-hoc `@assets/*` images. **Missing** manifest + budget check. **⛓** none. **Branch**
`chore/asset-manifest`. **Accept** manifest + CI size guard. **🚫** swapping live art unreviewed.

## Phase 22 — Monetization / Business Model
**Purpose** the revenue thesis, honestly gated: primary sales (plots/commanders/weapons in ALGO),
ASCEND sinks, marketplace fee (Phase 11), season passes — modeled in ECONOMICS/TOKENOMICS today.
**Missing** a priced launch funnel model and the owner's revenue targets; the 2026-07-05
deep-research run for external benchmarks FAILED on session limits (claims captured but
unverified — rerun before citing numbers). **⛓** funds decisions are owner-only. **Branch**
`docs/monetization-model`. **Accept** model doc with owner-set targets; no code. **🚫** any
pricing change without owner sign-off.

## Phase 23 — MVP Definition
**Purpose** define the launchable cut: TestNet playtest → gated mainnet MVP (which phases above
are launch-blocking vs post-launch). Proposal: blocking = 3, 5, 6, 7, 14, 16, 17; everything else
post-launch. **Branch** `docs/mvp-definition`. **Accept** owner signs the cut; baton reordered
to match. **🚫** scope creep into the blocking set.

## Phase 24 — Branch / PR Execution Machine ✅ (this PR)
**Purpose** the rules that keep all of the above serial and safe. **Exists** now:
`FRONTIER_BRANCH_MACHINE.md` + Session Relay Protocol + gate skills. **Accept** every future PR
cites its gate lane. **🚫** weakening funds-path gates.

## Phase 25 — 30 / 60 / 90 Day Plan
**Day 0–30** (visibility + safety): FIRST_10_PRS #1–#6 → Mission Control v1 live with kill
switches; `smoke:testnet` run (wallet funded); SEV1 purchase-verification fix through full gates;
security-pass refresh. **Day 31–60** (depth): onboarding quest chain, armory deploy UI, battle
lab, HERMES contracts, flag governance, browser smoke pack. **Day 61–90** (economy + launch
path): econ telemetry, marketplace design (gated build), season arc, MVP definition signed,
mainnet-gate dry run (expected FAIL list = the real to-do list). Standing cadence: baton every
session · one PR at a time · truth/registry updated when facts change.

---

### Cross-phase invariants (never violated by any phase)
No funds/ASA/transfer toward mainnet without `/mainnet-gate` PASS + `algo-auditor` ·
`wip/atomic-purchase` never merges · `ops/kestra/` never points at mainnet · no mock data on
live surfaces · mem/db game methods stay parallel · no fix without a test · secrets never in
repo or agent context.
