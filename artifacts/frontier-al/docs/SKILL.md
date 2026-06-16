-----

## name: ascendancy-engineering
description: >
Master engineering context for the Ascendancy game (repo: FRONTIERNeXt, app package
@workspace/frontier-al). Load this skill at the start of ANY work on this codebase —
globe rendering, battle engine, sub-parcels, Algorand integration, wallets, deployment,
workers, or new features. It encodes the architecture, the hard rules, the file map, the
verification workflow, and the conventions that keep changes safe and token-efficient.
Triggers: Ascendancy, FRONTIER, frontier-al, frontierprotocol, $ASCEND, the globe, the
battle engine, sub-parcels, Pera/Lute/Defly wallets, Railway/Cloudflare deploy.
license: Proprietary — Ascendancy/FRONTIER

# Ascendancy — Master Engineering Skill

This file is the single source of truth for working on Ascendancy. Read it fully before
making changes. Following it makes work faster, safer, and dramatically more token-
efficient: you should not need to re-scan the whole repo to act correctly.

-----

## 1. WHAT THIS PROJECT IS

Ascendancy (codebase name FRONTIER / FRONTIERNeXt) is a real-time multiplayer MMO strategy
game on the Algorand blockchain. 21,000 on-chain land parcels, sub-parcel ownership with an
archetype/building system, a deterministic battle engine, four AI factions (NEXUS-7,
KRONOS, VANGUARD, SPECTRE), biome-aware resources, WebSocket multiplayer, a trade
station/order book, prediction markets, seasons, and a token economy centered on **$ASCEND**
(renamed from the legacy ASCEND).

Live frontend: `frontierprotocol.app` (Cloudflare Pages). Backend deploys to Railway.

-----

## 2. THE STACK (do not change it)

**Backend:** Express 5 · TypeScript (ESNext) · Drizzle ORM · PostgreSQL (Neon) ·
express-session · connect-pg-simple · Passport · algosdk v3 · Upstash Redis · ws

**Frontend:** React 18 · Vite · React Three Fiber · Drei · Pixi.js · TanStack Query ·
Radix/ShadCN (New York) · Tailwind

**Wallets:** `@txnlab/use-wallet` v4 (unified abstraction) — Pera, Defly, Lute, Kibisis

**Chain tooling:** AlgoKit (typed client generation); Algorand TypeScript for contracts

**Monorepo:** pnpm workspace. App is `artifacts/frontier-al` (`@workspace/frontier-al`).
Other artifacts: `api-server` (worker host scaffold), `mockup-sandbox` (UI prototyping,
dev-only — never ship it). Shared code in `lib/db`, `lib/api-spec`.

-----

## 3. THE HARD RULES (violating these breaks the project)

1. **NEVER migrate or rebuild the architecture.** Only targeted, additive changes within
   the existing Express/Drizzle/PostgreSQL/React-Three-Fiber stack. No framework swaps.
1. **Audit before advising or editing.** Read the actual file. The codebase is routinely
   more advanced than conversation context suggests — features are often already built.
1. **Single best method only.** Decide the best approach, implement it, don’t offer
   alternatives after committing.
1. **Additive-only changes.** Never touch the battle engine internals, AI faction logic,
   globe rendering core, or DB transaction structure unless the task explicitly targets it.
   Every agent prompt needs an explicit **DO NOT TOUCH** list.
1. **Battle engine is pure — feed it inputs, never edit its constants.** Building/weather/
   commander effects flow into `BattleInput`. `server/engine/battle/tuning.ts` is canonical
   and untouchable unless the task IS rebalancing.
1. **Positions are computed, never stored.** The 21k parcel positions come from a
   deterministic Fibonacci sphere that MUST match between `client/src/lib/globe/globeUtils.ts`
   and `server/sphereUtils.ts`. Never persist positions. Never break that parity.
1. **Migration-free where possible.** New schema columns must be additive, nullable, with a
   sensible default. Never a destructive migration. Flag any unavoidable migration explicitly.
1. **Minimize DB reliance, maximize determinism.** Visual state and derivable values are
   computed client-side or from seeds. The DB stores only mutable world truth (ownership,
   improvements, active battles).
1. **$ASCEND is the token.** New work uses $ASCEND. Legacy `ASCEND` / `FRONTIER token`
   strings are display-layer only — DB column names, tx-note prefixes (`ASCEND:`), and code
   identifiers (`frontierAsaId`, etc.) are preserved as-is.
1. **AI_ENABLED guard is opt-in (`=== "true"`)** at BOTH the route scheduler AND inside
   the storage-layer `runAITurn` methods. Never let AI run because a guard was only at the
   route level.
1. **Security: never trust `playerId` from the body as proof of identity** once wallet
   signature auth lands. Identity comes from the verified session. (See §8.)
1. **PUBLIC_BASE_URL is env-only** — never fall back to `req.get("host")`. It bakes into
   NFT metadata permanently at mint.

-----

## 4. THE FILE MAP (where things live)

```
artifacts/frontier-al/
  client/src/
    components/game/
      globe/
        GlobeParcels.tsx     ← InstancedMesh of 21k tiles (THE core renderer)
        GlobeTerrain.tsx     ← planet sphere
        GlobeAtmosphere.tsx  ← glow shell
        GlobeEvents.tsx      ← battle arcs, mining pulses
        GlobeHUD.tsx         ← 2D overlay
      PredictionMarkets.tsx  ← fully wired markets UI
      TradeStation.tsx       ← order book UI
      EconomicsPanel.tsx     ← token economics
      LandSheet.tsx          ← parcel detail/actions
    contexts/WalletContext.tsx  ← use-wallet provider
    hooks/useBlockchainActions.ts ← the action API calls
    lib/
      globe/globeConstants.ts  ← ALL colors, sizes, radii, speeds
      globe/globeUtils.ts      ← fibonacci sphere, lat/lng→vec3, getPlotColor
      walletManager.ts         ← use-wallet config (Pera/Defly/Lute/Kibisis)
      algorand.ts              ← chain client
  server/
    index.ts                 ← middleware stack, CORS, boot, listen 0.0.0.0:PORT
    routes.ts                ← 84 routes (CANDIDATE FOR DOMAIN SPLIT)
    wsServer.ts              ← WebSocket broadcast backbone
    engine/battle/
      resolve.ts             ← resolveBattle() + resolveBattleFromPowers() (PURE)
      tuning.ts              ← balance constants (UNTOUCHABLE)
      random.ts              ← deterministic RNG (hashSeed)
      types.ts               ← BattleInput etc
    storage/
      db.ts                  ← DbStorage class — all game state methods
      seeder.ts              ← one-time 21k parcel seed, 500-row batches
      game-rules.ts          ← rule constants
      ai-engine.ts           ← AI faction turn logic
    services/chain/
      asa.ts                 ← ASA mint/transfer (admin-signed)
      commander.ts           ← commander NFT logic
      factions.ts            ← faction data
      battleNotes.ts         ← structured tx notes
    sphereUtils.ts           ← server-side fibonacci (MUST match client)
    db-schema.ts             ← Drizzle schema (all tables)
  railway.toml               ← Railway deploy config (already correct)
```

-----

## 5. WHAT’S ALREADY BUILT (don’t rebuild — just wire/verify)

The backend is far ahead of the live deployment. Confirmed built:

- **Sub-parcel archetype + building system** — FULL backend. Routes:
  `/api/sub-parcels/:id/{purchase,build,archetype,attack}`, listings marketplace. Schema
  columns (`archetype`, `archetypeLevel`, `energyAlignment`, `improvements`) exist. **Needs
  frontend UI only.**
- **Prediction markets** — FULL stack (storage + routes + 427-line UI). May just need a nav
  entry + verify the resolution scheduler runs.
- **Seasons** — FULL backend (start/settle/history). Needs a HUD.
- **Treasury ledger** — wired into 3 panels.
- **Battle engine** — built, wired through `resolveBattle()` (Pass A/B done).
- **WebSocket backbone** — broadcast loop, chain-health, payload monitoring.
- **Idempotency tables** — `mintIdempotency`, `commanderMintIdempotency`.
- **Retry transfer queue** — `pendingFrontierTransfers` + worker.
- **Production hardening** — rate limiting on actions, CORS allowlist, body caps, helmet-
  style headers, mainnet-gated testnet routes, WS connection caps, CI workflow.

Dormant (schema only, not built): **loot boxes** (`lootBoxInventory` table, no logic).

-----

## 6. THE KNOWN GAPS (the real work)

1. **Wallet signature auth is missing** — biggest issue. Body-trust identity. (§8)
1. **Sub-parcel UI** — backend done, no frontend.
1. **Globe is dark + color bug** — `currentPlayerId` null at first paint makes own parcels
   render as enemy; fix is adding `currentPlayerId` to `plotVisualFingerprint` deps.
1. **routes.ts is a 3000-line monolith** — should split into `server/routes/*.ts`.
1. **No social layer** — no chat/announcements/notifications (WS backbone exists for it).
1. **Backend not yet deployed to Railway** — frontend live, globe can’t load without it.

-----

## 7. THE UPDATE ORDER (data flows down)

When state shape changes, update in this order so nothing breaks downstream:

```
1. db-schema.ts (+ shared schema)   — additive nullable columns
2. server/storage/db.ts             — storage methods
3. server/routes/*.ts               — API endpoints
4. shared types                     — client/server agreement
5. client/src/hooks/                — API calls + query invalidation
6. client query/state               — TanStack keys
7. client/src/lib/globe/constants   — visual constants (if visual)
8. client/src/components/game/globe — rendering
9. UI panels                        — buttons/menus
```

**The visual-vs-state rule:** if a change only affects how something *looks* (colors,
lighting, fog, weather render) it’s client-only — start at step 7, never touch 1–6. If it
changes *what is true about the world* (ownership, buildings, scans, trades) it’s full-stack
— start at step 1.

-----

## 8. SECURITY MODEL (the mainnet gate)

The critical fix before any real value goes live:

- **Current:** `assertPlayerOwnership` trusts `req.body.playerId`. No proof the caller owns
  the wallet.
- **Required:** wallet signature auth — `GET /api/auth/nonce` → wallet signs → `POST /api/auth/verify` validates with `algosdk.verifyBytes` → session-bound identity. Then
  refactor `assertPlayerOwnership` to read `req.session.playerId`.
- **Admin guard must fail CLOSED in production** (`if (!ADMIN_KEY && NODE_ENV==="production") → 503`).
- **Secrets:** rotate `DATABASE_URL` + `SESSION_SECRET`; never log the admin mnemonic; no
  secret in any `VITE_*` var (those ship to the browser).
- **Economic integrity:** order fills + bets atomic (transaction + row lock); accrual from
  server timestamps only; pillage/attack caps server-side.

-----

## 9. DEPLOYMENT

- **Frontend → Cloudflare Pages.** Root dir `artifacts/frontier-al`, build `npx vite build`,
  output `dist/public`. Five `VITE_*` env vars: `VITE_API_URL`, `VITE_WS_URL`,
  `VITE_ALGOD_URL`, `VITE_ALGORAND_NETWORK`, `VITE_INDEXER_URL`. VITE vars bake at build —
  changing them requires a redeploy.
- **Backend → Railway.** Root dir `artifacts/frontier-al`. `railway.toml` already correct
  (Railpack, `sleepApplication=false`). Server binds `0.0.0.0:$PORT`. Do NOT set `PORT`. Do
  NOT add `VITE_*` vars here.
- **Target: two Railway services** — game backend (`frontier-al`) and worker host
  (`api-server`), sharing `lib/db`. Keeps the game lean; workers crash independently.
- **CORS:** `CLIENT_ORIGIN=https://frontierprotocol.app` (no trailing slash).

-----

## 10. THE VERIFICATION WORKFLOW (run every time)

After EVERY change:

```bash
cd artifacts/frontier-al
pnpm run check        # tsc — MUST be 0 errors before proceeding
pnpm run test:server  # when touching server logic
```

For full-stack changes, also confirm the relevant endpoint with curl and confirm DB state.
Never proceed to the next task with a broken build. Commit after each verified task with a
message referencing the LUT item.

-----

## 11. OUTPUT CONVENTIONS (for prompts and edits)

- **Prefer `str_replace` over full-file rewrites.** Read the minimum lines needed.
- **Single copy-paste-ready prompt per concern**, in one code block, structured as: named
  pass · context block · numbered edits with precise find/replace targets · explicit DO NOT
  TOUCH list · verification checklist.
- **Each branch = one concern.** Branch from main, merge to main, CI must pass.
- **Mobile-aware:** the developer sometimes works from mobile — consolidated single-block
  outputs prevent truncation.
- **Token efficiency:** this skill file exists so you don’t re-scan the repo. Trust the file
  map; open files surgically; act with the rules already loaded.

-----

## 12. THE TUNABLES PRINCIPLE (anti-reset)

All game-tunable values should live in centralized config so production never needs a
migration to rebalance:

- Battle: `server/engine/battle/tuning.ts`
- Globe visuals: `client/src/lib/globe/globeConstants.ts`
- Game rules: `server/storage/game-rules.ts`
- NEW shared tunables (pricing, archetype costs, scan, fees): `server/config/gameConfig.ts`
  (typed module — TypeScript-first, no DB reliance; designed so it CAN move to a DB-backed
  live-tuning table later without a reset).

-----

## 13. WORKER / AGENT INFRASTRUCTURE

- `api-server` artifact = the worker host. Workers: **HILDA** (video production via Claude
  - ElevenLabs + HeyGen + Kling + Shotstack + YouTube), **CIPHER** (TS auditor, Claude Agent
    SDK, CI-triggered), **ATLAS** (analytics), **NEXUS** (social). **Jarvis** = the mission
    dashboard orchestrating them.
- `.agents/skills/` holds installed skills: `ui-ux-pro-max` (design), `audit-website`
  (squirrelscan SEO/security), `agent-tools` (inference.sh — 150+ AI models, useful as a
  unified HILDA backend).
- Workers run on the SEPARATE Railway service and communicate with the game via the internal
  queue pattern — not public webhooks. Worker API keys never live on the game server.

-----

## 14. WHEN IN DOUBT

- Is it already built? Check §5 and grep the routes/storage before building.
- Does it change world truth or just looks? §7 visual-vs-state rule.
- Will it need a migration? Make it additive/nullable instead (§3 rule 7).
- Does it touch the battle engine? Feed inputs, don’t edit `tuning.ts` (§3 rule 5).
- Is identity involved? Use the session, not body `playerId` (§8).
- Did the build stay green? `pnpm run check` (§10).

Follow this skill and most work is mechanical: the architecture is sound, the patterns are
established, and the rules keep every change safe and additive.

-----

*Ascendancy Master Engineering Skill · load first, every session · frontierprotocol.app*