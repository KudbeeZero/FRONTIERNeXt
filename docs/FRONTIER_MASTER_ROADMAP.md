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
**Missing** — corrected 2026-07-06: payment verification already EXISTS on the purchase route
(`routes.ts:1930`, gated on `FREE_PURCHASES=false`); what remains is a TestNet click-test proving
it end-to-end, removing/wiring dead `forwardLiquiditySplit`, claim no-op surfacing (SEV2), and the
`smoke:testnet` live run. **Added 2026-07-07 (full-scope audit):** (a) **no atomic
delivery/rollback** — a paid purchase whose background mint fails leaves ALGO consumed, no NFT,
no refund, no retry; recovery is manual (`routes.ts:2091-2098`; `attemptDelivery` is one-shot at
`routes.ts:2084`) → build a mint-retry worker + refund-or-retry policy (funds-gated);
(b) **ASCEND ASA id not pinned** — resolved by name-lookup of admin-created assets
(`services/chain/asa.ts:117,128`), with no env-pinned ID; `755818217` appears only as free-text
in source/docs (`shared/university/curriculum.ts` + several markdown docs), never as a config
value → pin via `ASCEND_ASA_ID` env + startup assert, lookup as fallback; (c) **residual wallet-popup
vectors** (the #175/#176 popup-storm fix holds; these are what's left): P1 per-route
`WalletProvider` remount re-arms the auto-auth signature prompt (`App.tsx:40` +
`WalletContext.tsx:252,355-361` — guards are per-instance refs), P2 landing↔game cross-origin
split forces a second connect (`App.tsx:14-17`, `lib/gameUrl.ts`; wallet session is per-origin
localStorage), P3 purge-on-connect can abort an in-flight session resume and open a fresh
QR/deeplink (`WalletContext.tsx:405`). Fix P1+P3 in code (single app-level provider +
module-level auth guard; don't purge mid-resume); P2 needs an owner decision (single origin vs
session handoff) — ADR first. **Files** `server/routes.ts` purchase/claim blocks, `services/chain/*`
(+ specs). **Agents** Transaction Watcher panel (Phase 3) first or together. **⛓ funds** — full
gates: TestNet click-test + txn watcher capture + `/security-pass` + owner approval. **Tests**
fails-before/passes-after for any code change. **Branch** `fix/purchase-payment-clicktest`.
**PR** "test: prove paid purchase path on TestNet + retire stale SEV1". **Accept** paid purchase
verified on TestNet with FREE_PURCHASES=false; `chain-services-audit.md` updated to current truth.
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
engine, proof endpoint, sim, veritas; 42-weapon catalog fully specced & integrity-checked
(`shared/weapons/catalog.ts:56`). **Missing** system map doc, globe arc layer (B1).
**Added 2026-07-07 — this phase is now a feature lane, not docs-only:** (W1) **weapon fire never
damages plots** — `engagementStore.launch` computes `engagement.damage`
(`server/weapons/engagementStore.ts:156`) but nothing settles it; `"impacted"` status is never
set; no server tick exists (module header says routes should "settle damage at the edges" —
that edge is unimplemented). The missile system is cosmetic/stat-only today. (W3) missile
engagements and the plot-conquest engine are **disconnected** — a missile kill never affects
plot defense/ownership. Build: server-side engagement settlement (impact at time-of-flight),
then feed settled damage into plot state as an *input* to the existing resolver — the
provably-fair resolution math itself stays untouched.
**⛓** write (settlement mutates plot state). **UI** battle lab panel (dashboard). **Branch**
`feat/weapon-damage-settlement` then `feat/combat-convergence`.
**Accept** a non-intercepted shot measurably changes the target plot (test-backed);
`verifyBattleProof` still green. **🚫** resolution math; `battle-sequence.ts`/cinematics.

## Phase 9 — Ship / Aether Voyager System
**Purpose** connect prologue → game arrival (the Voyager as a persistent player asset/HUB).
**Exists** prologue handoff (`aether-journey/src/lib/chain/handoff.ts`). **Missing** everything
in-game; design first. **⛓** none in design; NFT later (gated). **Branch**
`docs/voyager-system-design`. **Accept** ADR with owner sign-off before any code. **🚫** minting.

## Phase 10 — Armory / Loadout System
**Purpose** finish weapons UX: playbook B2 (defensive DEPLOY UI), loadout presets, armory panel.
**Exists** weapon engine, `/armory` page, weapon NFTs, upgradeTier→damage wiring. **Missing**
deploy UI, loadout persistence. **Added 2026-07-07:** (W2) **loadout is dead state** — persisted
via `/api/weapons/loadout` (`server/weapons/service.ts:103`) but `fireWeapon` fires by explicit
`specId` and never consults it → wire loadout into fire/deploy; (W4) badges credit
kills/precision hits for shots that never impact anything (`service.ts:202-206`) → credit on
settled impact only (depends on Phase 8 W1); (U3) armory UX fixes — currency mislabeled
"FR"→"ASCEND" (`ArmoryPanel.tsx:253`), hidden upgrade price, inverted radius, desktop-rail grid
squeeze; (U2) delete dead `BottomNav.tsx` (superseded by `HudShell.tsx`).
**⛓** write (ASCEND spends via existing sinks only). **Branch**
`feat/armory-loadout-polish` then `feat/armory-deploy-ui`. **Accept** deploy flow test-covered;
spends only through existing guarded endpoints; loadout demonstrably affects fire.
**🚫** weapon-economy constants.

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
**Branch** `chore/state-registry-json` (same unit as FIRST_10 PR 1 — this phase's remainder rides
follow-up branches `chore/state-supersession-notices`). **Accept** dashboard reads registry from
one JSON source.
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
`design_guidelines.md`; `index.html` meta/OG/canonical healthy. **Missing** consolidated token
sheet + panel patterns doc. **Added 2026-07-07 (UI consistency findings, corrected on
audit):** (U1) `/university` is the only route missing the `WalletProvider` wrapper
(`App.tsx:84-86`) — **but `university.tsx`'s own doc-comment says this is deliberate** (no
wallet needed, the panel touches neither chain nor funds); confirm there's an actual failure
mode before treating this as a bug, not just add the wrapper reflexively; (U4) time drift —
**`WarRoomPanel.tsx:29,154`** uses `Date.now()` against server-relative timestamps (the real
clock-drift risk); `BattlesPanel.tsx:35,197` already correctly uses `serverNow()` (its one
`Date.now()` at line 194 is an unrelated local-freshness check, not a server-time comparison —
leave it); (U5) `/admin` dashboard is built but unlinked from any nav; (U6) `index.html` shows
a blank `#root` until React mounts → add an inline loading state. **⛓** none.
**Branch** `fix/ui-consistency-pass` (quick fixes) then `docs/ui-master-design`.
**Accept** owner-approved; new panels reference it. **🚫** globe visuals.

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

## Phase 25 — 30 / 60 / 90 Day Plan (rewritten 2026-07-07 from the full-scope audit)

> Unit queue for Sonnet sessions: one unit = one chat = one audited PR, in order within each
> month (owner may reprioritize via the baton). Every claim below carries file:line evidence in
> the phase it belongs to (Phases 6/8/10/15/26). Funds lanes take the full gates
> (`/security-pass`, TestNet click-test, owner approval); no fix without a failing-first test.

**Month 1 — funds safety + wallet truth** (money paths must not lie):
| # | Unit | Branch | ⛓ |
|---|---|---|---|
| M1-1 | A3: `grantWelcomeBonus`+login concurrent double-enqueue of the on-chain 500-ASCEND transfer (`routes.ts:444`) — atomic `UPDATE … WHERE welcomeBonusReceived=false RETURNING` gates the enqueue | `fix/welcome-bonus-double-enqueue` | funds |
| M1-2 | A4: `placeBet` non-atomic double-credit (`db.ts:3216`) — proven #204/#205 txn + `FOR UPDATE` pattern | `fix/placebet-atomicity` | write |
| M1-3 | Wallet popups P1+P3 (Phase 6): single app-level WalletProvider + module-level auth guard; stop purge aborting session resume; ADR for P2 cross-origin (owner decision) | `fix/wallet-single-provider` | none |
| M1-4 | Pin ASCEND ASA id: `ASCEND_ASA_ID` env + startup assert, name-lookup fallback (Phase 6b) | `fix/pin-ascend-asa` | read |
| M1-5 | Mint-retry worker + failed-mint recovery policy (refund-or-retry), custody/claim state surfaced in HUD (Phase 6a + 26) | `feat/mint-retry-delivery` | funds |
| M1-6 | DB indexes (migration 0013) + strict rate-limiter extension to trade/markets/weapons/sub-parcels/factions + middleware-binding coverage test | `chore/db-indexes-ratelimit` | none |

**Month 2 — combat convergence + on-chain completeness:**
| # | Unit | Branch | ⛓ |
|---|---|---|---|
| M2-1 | W1: weapon damage settlement — `"impacted"` becomes real (Phase 8) | `feat/weapon-damage-settlement` | write |
| M2-2 | W3+W4: settled damage feeds plot state; badges credit on impact only (Phase 8/10) | `feat/combat-convergence` | write |
| M2-3 | W2 loadout wiring + U3 armory UX fixes + U2 delete BottomNav + U1 university WalletProvider — **first confirm U1 is an actual bug, not the app's deliberate wallet-free design** (Phase 10/15) | `feat/armory-loadout-polish` | none |
| M2-4 | ADR + impl: sub-parcel & upgrade on-chain recording via ARC-69 config notes on the plot ASA; fix the algosdk-v3 Address bug in `upgrades.ts` (Phase 26) | `feat/subparcel-onchain-arc69` | write |
| M2-5 | W5: weapon-NFT mint completion — custody+claim parity with land NFTs (Phase 26) | `feat/weapon-nft-claim` | write |
| M2-6 | U4: fix `WarRoomPanel.tsx` `Date.now()`→`serverNow()` drift (not `BattlesPanel`, which is already correct) + U5 admin nav link + U6 index.html loading state (Phase 15) | `fix/ui-consistency-pass` | none |

**Month 3 — AAA security posture + launch path:**
| # | Unit | Branch | ⛓ |
|---|---|---|---|
| M3-1 | `/security-pass` over the post-fix ASCEND/claim/purchase surface (Phase 7) | `docs/security-pass-ascend-claims` | read |
| M3-2 | `/test-matrix` refresh + Playwright browser smoke pack (Phase 17) | `test/browser-smoke-pack` | none |
| M3-3 | NFT metadata immutability for mainnet: ARC-19 + IPFS pinning; mainnet ASA role ADR (drop `manager`/`reserve`?) (Phase 26) | `feat/nft-metadata-immutability` | write |
| M3-4 | Flag governance: `shared/flags.ts` + CI guard that dev flags never coexist with mainnet — covers the fly.toml `VITE_DEV_MODE`/`DEV_LOGIN_ENABLED` exit (Phase 16) | `chore/central-flag-module` | none |
| M3-5 | UI master design pass + menus consistency audit (Phase 15) | `docs/ui-master-design` | none |
| M3-6 | `/mainnet-gate` dry run — the expected-FAIL list becomes the final punch list; MVP definition signed (Phase 23) | `docs/mainnet-gate-dryrun` | read |

Still live from the old 30/60/90 (slot in where capacity allows, not dropped): FIRST_10_PRS
#1–#6 / Mission Control v1 + kill switches (Phases 3/14), `smoke:testnet` live run (owner funds
the session wallet — also settles the `upgrades.ts` algosdk-v3 question), onboarding quest
chain (Phase 5), HERMES contracts (Phase 12), econ telemetry → marketplace design (Phase 11).

**Added 2026-07-07 (external reference review — owner asked whether
[`ammaarreshi/Generals-Mac-iOS-iPad`](https://github.com/ammaarreshi/Generals-Mac-iOS-iPad),
a native macOS/iOS port of C&C Generals Zero Hour, had anything applicable). Different stack
entirely (C++/DirectX8→DXVK→Metal vs. this repo's TS/React/three.js), so nothing ports
directly — but two of its solved problems map to real, currently-unaddressed gaps here,
verified by grep against the current tree, not assumed):**
- **(G1) Globe touch-gesture vocabulary.** Plot selection today is single tap/click only
  (`GlobeParcels.tsx`); camera pan/zoom rides on drei `OrbitControls`' built-in touch support,
  but there is no drag-box multi-select or long-press-deselect pattern anywhere in
  `client/src/components/game/globe/`. The Generals port's RTS touch vocabulary (tap-select,
  drag-box select, long-press deselect, two-finger pan, pinch-zoom) is a candidate reference if
  multi-plot selection (bulk actions, sub-parcel picking) becomes a real need — slot into
  Phase 15 (UI/UX Master Design) if/when scoped.
- **(G2) WebGL context-loss / backgrounding on mobile.** Grepped the whole client for
  `webglcontextlost`/`visibilitychange`/`onContextLost` — **zero hits**. The three.js globe
  Canvas has no handler for a lost/restored WebGL context (common on mobile when a tab is
  backgrounded long enough for the OS to reclaim the GPU context) or for `visibilitychange`.
  Today this would likely present as "the globe goes black/frozen after switching apps and
  never recovers without a manual reload" — plausible, not owner-confirmed. Not the same fix as
  the Generals port (that's native Metal drawable lifecycle; this needs a JS
  `canvas.addEventListener('webglcontextlost'/'webglcontextrestored', …)` + `three.js` renderer
  re-init), but the *problem class* is the same. Candidate unit: reproduce on a real mobile
  device first (owner smoke-test), then a small, test-backed fix in the globe's R3F `Canvas`
  wrapper — not scoped or started; would need its own audited unit, not bundled into whatever
  PR is open when it's picked up.

Both are genuinely new findings (G1/G2), not yet part of the M1→M3 queue above — they slot in
wherever capacity allows per the cadence rule below, same as the rest of this backlog
paragraph. Neither is funds/mainnet-adjacent.

Standing cadence: baton every session · one PR at a time · truth/registry updated when facts
change.

## Phase 26 — NFT & On-Chain State Completeness (added 2026-07-07)
**Purpose** every owned thing verifiable on-chain, every claim flow obvious — land plots,
sub-parcels, upgrades, weapons. **Exists** land NFTs: ARC-3 1-of-1 ASA minted into admin
custody (`server/services/chain/land.ts:35`); claim = wallet opt-in + `POST
/api/nft/deliver/:plotId` (`routes.ts:994`, ownership-gated); claim UI
(`NftClaimNotification.tsx`, `signOptInToPlotNft` in `useBlockchainActions.ts:478`, LandSheet
"Claim NFT"); wallet images = biome PNGs (`client/public/nft/biomes/*.png`, all 8 present)
served via dynamic ARC-3 metadata (`routes.ts:864,929`); ASCEND claim flow with opt-in gate +
batched atomic transfers (`routes.ts:2144`, `asa.ts:277`). **Missing** (N4) **sub-parcels are
DB-only** — purchase (`routes.ts:3565`) never mints; sub-parcel upgrades are anchored only as
detached admin self-transfer note txns (`upgrades.ts:28`, fire-and-forget at `routes.ts:3642`),
not tied to the plot's ASA, and likely silently broken under algosdk v3
(`docs/audit/chain-services-audit.md` §upgrades — Address-vs-string). (N5) metadata + images
are **mutable and centrally hosted** — no IPFS, no integrity hash (`routes.ts:929`); host
outage breaks all NFT art in wallets. (N6) mainnet plot ASAs would keep admin
`manager`/`reserve` (`land.ts:57-60`) — reconfigurable/destroyable, not trustless. (W5)
weapon-NFT mint is partial — 503 without `PUBLIC_BASE_URL` (`routes.ts:2644`), `nftAssetId`
marked Phase-2. Claim UX: first delivery always lands in custody (buyer not yet opted in) —
surface custody state + one-click opt-in-then-claim. **Approach** ADR first: near-term, record
upgrade/sub-parcel state as **ARC-69**-style asset-config notes on the parent plot ASA (admin
holds `manager`, so config txns are possible today); at mainnet, move metadata to **ARC-19 +
IPFS pinning** for immutability; per-sub-parcel ASAs rejected as default (21,000×9 assets) —
revisit only with owner sign-off. **Files** `server/services/chain/{land,asa,upgrades}.ts`,
`routes.ts` NFT blocks, `NftClaimNotification.tsx`. **⛓** write→funds (mainnet role changes are
funds-gated). **UI** claim status in HUD/LandSheet. **Tests** fail-before/pass-after per change;
`smoke:testnet` proves notes/config txns land on Lora. **Branch** `feat/subparcel-onchain-arc69`
(first unit). **Accept** an upgrade produces a verifiable on-chain record tied to the plot ASA;
claim flow demonstrated end-to-end on TestNet. **🚫** ASA params of the live ASCEND token;
mainnet config; `wip/atomic-purchase`.

---

### Cross-phase invariants (never violated by any phase)
No funds/ASA/transfer toward mainnet without `/mainnet-gate` PASS + `algo-auditor` ·
`wip/atomic-purchase` never merges · `ops/kestra/` never points at mainnet · no mock data on
live surfaces · mem/db game methods stay parallel · no fix without a test · secrets never in
repo or agent context.
