# FRONTIER Architecture Truth

> What actually exists in this repo — verified by read-only audit on 2026-07-06 against
> `main` @ `eab3eef`. No guesses: anything unverifiable is marked **unknown**. Any PR that
> changes these facts must update this file in the same PR.

## 1. Repo structure (real)

pnpm monorepo (pnpm 10.33.0, Node 22+). The game is `artifacts/frontier-al/`; everything else
is support or parked.

| Package | Status | What it is |
|---|---|---|
| `artifacts/frontier-al` | **ACTIVE** — the product | Full-stack game: Express + `ws` + Drizzle/Postgres server, React 19 + three.js client, Algorand TestNet chain layer |
| `apps/aether-journey` | ACTIVE (side) | Story-mode prologue (Vite/React/three.js + ElevenLabs voice/music pipeline); testnet note-only chain writes (`src/lib/chain/` — "never moves value") |
| `artifacts/api-server` + `lib/{api-client-react,api-spec,api-zod,db}` | **PARKED / ORPHANED** | Scaffold island — nothing deployed imports it (2026-07-05 survey). Owner decision pending: delete or keep |
| `artifacts/mockup-sandbox` | PARKED | Prototyping; excluded from aggregate typecheck |
| `scripts` | ACTIVE | build/utility scripts |
| `ops/kestra/` | DEFINED, deployment **unknown** | 4 testnet ops flows (see §5) |
| root `src/App.tsx` | OBSOLETE | dead Replit stub (real client is `artifacts/frontier-al/client/src`) |

## 2. Client routes (real, from `client/src/App.tsx`)

`/` landing (DEV_MODE login button) · `/game` main game · `/testnet` mission checklist + AI
faction log · `/battles` history · `/armory` weapons · `/university` courses · `/admin`
**admin ops dashboard** (ADMIN_KEY-gated: metrics, live battles, chain events, purchase funnel,
AI activity, season control) · `/info/*`, `/privacy-policy`.

**Dashboard v2 widget system** exists (`components/game/dashboard/`: dnd-kit snap-grid,
resizable widgets, 9 default widgets) — default OFF via `?dashboard=1` / localStorage flag
(`lib/dashboard/flag.ts`). There is **no `/mission-control` route and no `/api/ops/*`** —
`FRONTIER_AGENT_DASHBOARD_SPEC.md` is a spec, not shipped code.

## 3. Server architecture (real)

- `server/routes.ts` (~4,200 lines, ~130 handlers) — all HTTP routes; split planned (playbook D3).
- Centralized guards: `security.ts` (rate limiters, wallet predicates `isRealWallet`/
  `isRealVerifiedWallet`, `isAdminRequest`/`requireAdminKey`, NFT-delivery claim evaluation),
  `auth.ts`, `idempotencyGuard.ts` (+ `withIdempotency` in routes), `routeOwnership.ts`,
  `stateScope.ts`, `rateLimitStore.ts` (Redis-backed when `UPSTASH_*` set, else per-instance).
- Engine (deterministic, coverage-gated ≥80%): `engine/{ai,battle,markets,narrative,season}`.
- Storage: `storage/db.ts` (Postgres, deployed) ∥ `storage/mem.ts` (dev/test twin).
  **Parallel by design — do not unify game methods** (combat/economy divergence risk).
- Chain layer: `services/chain/` — `client.ts` (network/env; default TestNet via
  `testnet-api.algonode.cloud`), `land.ts`/`commander.ts`/`weapon.ts` (ARC-3 1-of-1 NFT mints,
  custody model), `delivery.ts` (shared delivery), `asa.ts` (ASCEND ASA `755818217`, batched
  transfers, clawback), `transferQueue.ts` (Postgres retry queue → real testnet transfers),
  `upgrades.ts` (sub-parcel 0-ALGO note txns), `factions.ts`, `eligibility.ts` (Sybil gate),
  `chainEventLog.ts`/`chainEventStore.ts`.
- DB: `server/db-schema.ts` + `shared/schema.ts`; migrations `0000`–`0011`.

## 4. Autonomous workers — the REAL "agents" (all live at server boot)

| Worker | Where | Cadence | Writes |
|---|---|---|---|
| AI faction turn (4 factions act: mine/expand/attack/reconquest) | `routes.ts:~3062` → `storage/ai-engine.ts` | 20s | DB + events. **Double-gated on `AI_ENABLED==='true'`** (loop + every mutation) |
| Battle auto-resolver | `routes.ts:~2996` | 5s (env-tunable) | DB + WS |
| Battle countdown tick | `routes.ts:~3093` | 1s | WS only |
| Orbital event check | `routes.ts:~3074` | 5 min | DB |
| Prediction-market resolver (no human in loop) | `routes.ts:~3230` | 60s | DB |
| Season manager (auto-settle + rewards) | `engine/season/manager.ts` | 60s | DB + WS |
| **ASCEND transfer retry worker** | `services/chain/transferQueue.ts` | 30s | **on-chain testnet transfers** |
| Price oracle | `services/priceOracle.ts` | env | in-memory |
| Nonce/intent reapers, WS health broadcast, DB pool stats | `index.ts` / `wsServer.ts` / `db.ts` | various | prune/logs/WS |

Plus **Veritas robot player** (`server/veritas/run.ts`) — QA agent making real testnet
transactions against a live backend; run manually or looped via `VERITAS_INTERVAL_MS` / Kestra.

**What does NOT exist in code:** HERMES, an AI router/orchestrator, Mission Control,
the Automation Factory / chain-of-authority agents (`docs/AUTOMATION_FACTORY_ARCHITECTURE.md`,
`docs/AGENT_CHAIN_OF_AUTHORITY.md`, `docs/FACTORY_REGISTRY.md` are `PLANNED` blueprints —
governance docs, not running systems). Full inventory: `FRONTIER_AGENT_REGISTRY.md`.

## 5. Ops layer (`ops/kestra/`, namespace `frontier.ops`) — testnet-only by HARD RULE

`uptime.yml` (1-min health poll → Discord SEV routing) · `deep-health.yml` (5-min
`/api/admin/status`) · `veritas-grind.yml` (30-min robot-player run — **real testnet txns**) ·
`severity-router.yml` (Discord webhook dispatch). Secrets: Discord webhooks, `FRONTIER_ADMIN_KEY`,
`GITHUB_TOKEN`, `VERITAS_*_MNEMONIC`. **Whether a live Kestra instance is running these is
unknown** (definitions in repo; placeholders like `YOUR-REPLIT-DEPLOYMENT` present).

## 6. Wallet / transaction / ASCEND / claim paths (PROTECTED)

Single admin/custodian wallet signs everything (TestNet:
`ZK55X7SGIGMLGORVNJHHPTYZMZOGSQNVROBHX7N27X6ZEQRHAZ2UPKOXQU`, mnemonic in host secrets only).
Custody NFT model: admin mints 1-of-1 ASA → buyer opts in → delivery transfer.

Protected paths (per `FRONTIER_BRANCH_MACHINE.md` gate matrix — owner approval always):
- `server/services/chain/**` (all of it)
- `routes.ts`: `POST /api/actions/purchase` (~1883) · `POST /api/actions/claim-frontier` (~2121)
  · `POST /api/sub-parcels/:id/purchase` (70/30 treasury split, ~3495) · `POST /api/markets/:id/claim`
  (~3300) · weapon mint/fire/upgrade ASCEND sinks (~2506–2673) · NFT deliver/retry (~1202–1311)
  · admin season settle (~4079)
- Client: `lib/algorand.ts`, `lib/walletManager.ts`, `contexts/WalletContext.tsx`,
  `hooks/useBlockchainActions.ts`, `components/game/WalletConnect.tsx`
- `apps/aether-journey/src/lib/chain/*` (note-only, still chain-touching)
- `ops/kestra/**` (must never point at mainnet) · branch `wip/atomic-purchase` (never merge)

### Known chain defects (vs `artifacts/frontier-al/docs/audit/chain-services-audit.md` — re-verified 2026-07-06)
- ~~SEV1 plot purchase gratis~~ **STALE**: the purchase route DOES call `verifyAlgoPayment` + a
  replay guard when `FREE_PURCHASES` is off (`routes.ts:1930`; independent Sonnet review
  2026-07-06). Remaining gap: a TestNet click-test with `FREE_PURCHASES=false` to prove the path
  end-to-end, and `forwardLiquiditySplit` is genuinely dead code (imported, never called).
- **SEV1 — burn/clawback silently fails**: live ASA `755818217` was created without a clawback
  address (immutable). New-asset code already sets clawback correctly; the fix is "create the
  mainnet ASA clawback-correct from genesis," not a code change.
- SEV2 — claim-frontier silent no-op when ASA unset; SEV2 — `recordUpgradeOnChain` algosdk-v3
  Address-vs-string question (code inspection suggests v3 accepts `Address`; the
  `smoke:testnet` script settles it live once the session wallet is funded).

## 7. Feature flags (no central module — read inline; see `ENV_VARS.md`)

Server: `AI_ENABLED` (master AI switch, double-checked at 11+ sites) · `FREE_PURCHASES`
(testnet-only, force-off on mainnet via `ECONOMY_MODE`) · `DEV_LOGIN_ENABLED` (fail-closed) ·
`ADMIN_KEY` · `BATTLE_*_INTERVAL_MS` · `UPSTASH_REDIS_*`.
Client: `VITE_DEV_MODE`, `VITE_DEV_AUTOLOGIN`, `VITE_TEST_GLOBE` (must read false pre-deploy),
`VITE_DEBUG`, `VITE_ALGORAND_NETWORK`, `VITE_{ALGOD,INDEXER,API,WS,GAME}_URL`.
Non-env: dashboard v2 flag (`?dashboard=1` + localStorage).
`fly.toml` ships `VITE_DEV_MODE=true`, `FREE_PURCHASES=true` for the TestNet playtest — **must
be removed before mainnet**. `VITE_DEV_AUTOLOGIN` was ALSO `true` here until 2026-07-06: it
zero-click-hijacked every visitor (real wallet or not) into the shared dev/test identity on page
load, and `WalletContext.disconnect()` never cleared that dev session, so "Disconnect" silently
did nothing — a real production bug
(`artifacts/frontier-al/session-notes/2026-07-06-fix-dev-autologin-wallet-hijack.md`). Removed
from `fly.toml`; `disconnect()` now also ends any dev session as defense in depth.

## 8. Tests / CI / deploy (real)

- CI (`.github/workflows/ci.yml`, every PR + main): install → `check` → `test:server` →
  `test:server:db` (Postgres 16) → `coverage:server` (≥80% game-math core) → client `test`.
  Last green: server **415/14 skipped**, client **213**, on `main` @ `eab3eef`.
- Also: `db-push.yml`, `fly-deploy.yml`; app-local scanners (`codacy`, `semgrep`, `njsscan`,
  `mayhem-for-api`) in `artifacts/frontier-al/.github/workflows/` — active state unknown.
- Scripts: `sim`, `veritas`, `smoke:testnet` (mints plot/commander/weapon NFT + upgrade note,
  fail-closed off mainnet, no DB writes), `db:push`.
- Deploy: Fly app `frontiernext` (fly.toml, ord) + Cloudflare Pages preview on PRs; `.replit`
  autoscale config also present. `railway.toml` / `vercel.json` exist in-app — **parked/legacy**.

## 9. Doc landscape — active vs parked vs obsolete

- **Authoritative, current**: `docs/HANDOFF.md` (baton) · `docs/SESSION_PROTOCOL.md` ·
  `docs/MAINNET_READINESS_FLOW.md` · `artifacts/frontier-al/docs/NEXT_LEVEL_PLAYBOOK.md`
  (game-unit backlog) · `ALGORAND_TOOLING_2026.md` · `docs/audit/*` (36 reports across both
  levels) · `ENV_VARS.md` / `DEPLOYMENT_ENV_CHECKLIST.md` · GAME_MANUAL / ECONOMICS / TOKENOMICS.
- **Planned-not-built** (label them mentally as blueprints): `AUTOMATION_FACTORY_ARCHITECTURE.md`,
  `AGENT_CHAIN_OF_AUTHORITY.md`, `FACTORY_REGISTRY.md`, `KESTRA_EXPANSION_PLAN.md`,
  `FRONTIER_AGENT_DASHBOARD_SPEC.md` (this suite's spec), `V2_ROADMAP.md`.
- **Stale/obsolete**: `artifacts/frontier-al/ROADMAP.md` ("March 2026", "500+ parcels" — superseded
  by the playbook + `FRONTIER_MASTER_ROADMAP.md`) · `docs/PROJECT MEMORY.md` (2026-06-07 ASCENDANCY
  layer + its 12 ASCENDANCY LUT docs — parallel planning layer, superseded) · root `replit.md`
  (unedited template) · root `night-reports/` (one 2026-06-10 batch, historical).

## 10. Current risks (concise)

1. The two SEV1 chain defects (§6) — mainnet-blocking; fixes are owner-gated funds-path work.
2. Docs-vs-reality gap: planned-agent blueprints can be mistaken for live systems (§4 note).
3. `fly.toml` dev flags must be stripped before any mainnet config exists.
4. Single admin key = mint + treasury + custodian — must split before mainnet.
5. ~140 dead remote branches await GitHub-side pruning (needs delete-scoped token);
   `wip/atomic-purchase` retained OFF-LIMITS.
6. Kestra deployment state unknown — monitoring may be dark without anyone noticing.
7. Client extractions + recent UI units not browser-verified on-device (no display in sandbox).
