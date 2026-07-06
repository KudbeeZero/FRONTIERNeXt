# FRONTIER Agent Registry

> Every agent, watcher, and autonomous system in this repo — real ones first, blueprints after.
> Companion to [`FRONTIER_ARCHITECTURE_TRUTH.md`](./FRONTIER_ARCHITECTURE_TRUTH.md) and the data
> source for the Mission Control dashboard ([`FRONTIER_AGENT_DASHBOARD_SPEC.md`](./FRONTIER_AGENT_DASHBOARD_SPEC.md)).
> Verified 2026-07-06. Legend — risk: `none/read/write/funds` · status: `active/sleeping/stale/unknown/planned`.

## A. Live runtime agents (server boot, `setInterval`)

| # | Name | Path | Purpose | Status | Inputs → Outputs | Writes? | Risk | Dashboard? | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| 1 | AI Faction Engine | `server/storage/ai-engine.ts` (loop `routes.ts:~3062`, pure core `engine/ai/reconquest.ts`) | 4 AI factions mine/expand/attack/reconquest every 20s | active (gated `AI_ENABLED`) | game state → DB mutations + `ai_action` events + taunts (`engine/narrative/factionVoice.ts`) | yes | write | **yes** (card + AiFactionLog feed) | KEEP. Next: telegraphed "operations" (playbook B4). Fix: empty `catch {}` swallows failures — add error surface |
| 2 | Battle Auto-Resolver | `routes.ts:~2996` | resolves due battles | active | battles → DB + WS | yes | write | yes | KEEP |
| 3 | Battle Tick Broadcaster | `routes.ts:~3093` | countdown WS ticks | active | clock → WS | no | none | roll into #2's card | KEEP |
| 4 | Orbital Event Checker | `routes.ts:~3074` | impact events every 5 min | active | schedule → DB | yes | write | yes | KEEP |
| 5 | Market Resolver | `routes.ts:~3230` | auto-resolves prediction markets, no human in loop | active | market state → DB | yes | write | **yes** (it settles player winnings) | KEEP; add resolution audit log line to chain-event feed |
| 6 | Season Manager | `server/engine/season/manager.ts` | auto-settles seasons + distributes rewards | active | season clock → DB + WS | yes | write | yes | KEEP; settle action already admin-triggerable |
| 7 | **ASCEND Transfer Worker** | `server/services/chain/transferQueue.ts` | drains Postgres queue → real on-chain ASCEND transfers, 30s | active | queue rows → **testnet txns** | yes | **funds** | **yes — top of wallet-safety panel** (queue depth, oldest age, fail count) | KEEP. Highest-risk live agent; must get kill switch first |
| 8 | Price Oracle | `server/services/priceOracle.ts` | ALGO price refresh | active | HTTP → memory | no | read | minor | KEEP |
| 9 | Reapers (nonce, purchase-intent) | `server/index.ts:~242–252` | DB hygiene prune | active | clock → DB prune | yes | write (prune) | no | KEEP |
| 10 | WS Health Broadcaster | `server/wsServer.ts` | chain-health frames 1.5s/60s | active | probes → WS | no | read | feeds status chip | KEEP |

## B. On-demand / external agents

| # | Name | Path | Purpose | Status | Writes? | Risk | Dashboard? | Recommendation |
|---|---|---|---|---|---|---|---|---|
| 11 | Veritas Robot Player | `server/veritas/run.ts` (+ `reporter.ts`, README) | provable-fairness QA grind against live TestNet backend — **real testnet txns** (`VERITAS_TEST_MNEMONIC`) | unknown (manual / Kestra `veritas-grind`) | on-chain + JSON report | funds (testnet) | **yes** (last run, PASS/FAIL/DRIFT) | KEEP; wire last-report into `/api/ops` |
| 12 | Kestra: uptime | `ops/kestra/uptime.yml` | 1-min health poll → Discord SEV | **unknown if deployed** | Kestra KV + Discord | read | yes (last heartbeat) | VERIFY deployment, then KEEP |
| 13 | Kestra: deep-health | `ops/kestra/deep-health.yml` | 5-min `/api/admin/status` probe | unknown | Discord | read (admin key) | yes | VERIFY, KEEP |
| 14 | Kestra: veritas-grind | `ops/kestra/veritas-grind.yml` | 30-min Veritas run in Docker | unknown | testnet txns + Discord | funds (testnet) | yes | VERIFY, KEEP; testnet-only HARD RULE |
| 15 | Kestra: severity-router | `ops/kestra/severity-router.yml` | Discord webhook dispatch subflow | unknown | Discord | none | no | KEEP |
| 16 | Smoke: `smoke:testnet` | `artifacts/frontier-al/script/testnet-nft-smoke.ts` | mint plot/commander/weapon NFT + upgrade note, explorer links; fail-closed off mainnet | sleeping (awaits funded wallet) | testnet txns, no DB | funds (testnet) | last-run row | RUN once wallet funded (next unit) |

## C. Process agents (chat-loop layer — govern sessions, not runtime)

| # | Name | Path | Purpose | Status | Recommendation |
|---|---|---|---|---|---|
| 17 | SessionStart hook | `.claude/hooks/session-start.sh` (+ `.grok/hooks/` mirror) | install + typecheck + print baton, nudge audit | active | KEEP |
| 18 | Gate skills | `.claude/skills/{handoff-audit,closeout,end-session,pr-gate,security-pass,mainnet-gate,test-matrix}` | Session Relay Protocol + mainnet gates | active | KEEP — these are the merge gates the branch machine references |
| 19 | App skill packs | `artifacts/frontier-al/.agents/skills/{ui-ux-pro-max,audit-website,agent-tools}` | design/audit tooling | stale/unknown usage | AUDIT usage; archive if unused |

## D. Blueprints — documented but NOT implemented (do not mistake for live)

| # | Name | Doc | Status | Recommendation |
|---|---|---|---|---|
| 20 | Automation Factory (7 factories) | `docs/AUTOMATION_FACTORY_ARCHITECTURE.md` | planned | Fold the useful parts into this registry + Mission Control; mark doc as blueprint |
| 21 | Agent Chain of Authority | `docs/AGENT_CHAIN_OF_AUTHORITY.md` | planned | KEEP as governance reference; registry supersedes for inventory |
| 22 | Factory Registry (AUTO-001) | `docs/FACTORY_REGISTRY.md` | planned (F5 ops partially real via Kestra) | Superseded by this file for "what exists"; keep for directive history |
| 23 | Kestra expansion (auto-remediation, auto-triage, chaos drills) | `docs/KESTRA_EXPANSION_PLAN.md` | planned | Future units after Mission Control v1 |
| 24 | HERMES (router) | name appears only in owner plans — **no doc, no code** | not started | Define contracts first (mock types PR), build later |

## E. Future agents (owner's categories → mapped to reality)

Build order rationale: visibility first (dashboard), then safety (watchers/gates), then game
depth. Each is one branch/PR per the branch machine.

| Future agent | Maps to | Foundation that already exists |
|---|---|---|
| Mission Commander | Mission Control orchestrator card + "next owner action" panel | baton (`docs/HANDOFF.md`) + this registry |
| Transaction Watcher | dashboard panel over `chainEventLog`/`chainEventStore` + `transferQueue` | tables + WS health broadcaster |
| Wallet Safety Agent | wallet-safety panel + kill switch on agent #7 | `security.ts` predicates, `eligibility.ts` |
| PR Command Watcher | server-side GitHub poller panel | CI + Cloudflare checks |
| Security Reviewer | scheduled `/security-pass` + panel row | 36 existing audit reports |
| Battle Systems Agent | battle lab map over `engine/battle` + sim | `sim`, `veritas`, proof endpoint |
| Armory Agent | armory panel + weapon economy checks | `shared/weapon-economy.ts` |
| Economy Balancer | report-only tuning agent over `economy-config` | `coverage:server` gated math |
| Aether AI Companion | in-game companion (voice via ElevenLabs) | `apps/aether-journey` pipeline + whispers (`engine/narrative/whispers.ts`) |
| Lore/Narrative Agent | extends `engine/narrative/*` | factionVoice, commentator, whispers |
| UI/Visual Director | design-review process agent | `.agents/skills/ui-ux-pro-max` |
| QA/Test Runner | CI + Veritas + `test-matrix` skill | already 3 layers |
| Release Captain | `pr-gate`/`closeout` skills + PR watcher panel | skills exist |
| Memory/State Librarian | baton + session-notes indexer | 75 session notes + audits |
| Training Scribe | session-note distiller into durable docs | this suite |
| HERMES Router | message/task router between agents | **contracts-first mock PR** (FIRST_10_PRS #9) |
| Deployment Watcher | Fly/Cloudflare deploy status panel | fly-deploy workflow |
| Feature Flag Auditor | flag inventory panel + pre-deploy check | truth doc §7 flag table |

## Kill-switch policy (applies to A + B)

Every write/funds agent gets a per-agent enable flag surfaced in Mission Control, fail-closed
(missing flag = OFF for write/funds, ON only for read-only). `AI_ENABLED` already implements
this pattern for agent #1 — replicate it for #2, #5, #6, #7 as part of Mission Control v1.
