# ASCENDANCY — Full Production LUT

### Living Unified Tracker · Version 1.0 · June 2026

> Scope: Production deployment, HILDA AI Content Worker, Jarvis Work Hub, branch expansion, release pipeline

-----

## TABLE OF CONTENTS

1. [Current State Snapshot](#1-current-state-snapshot)
1. [Immediate Blockers — Ship These First](#2-immediate-blockers)
1. [HILDA — AI Content & Tutorial Worker](#3-hilda)
1. [Jarvis Work Hub — AI Worker Dashboard](#4-jarvis-work-hub)
1. [Branch Expansion Roadmap](#5-branch-expansion-roadmap)
1. [Release Pipeline](#6-release-pipeline)
1. [YouTube & SEO Architecture](#7-youtube--seo-architecture)
1. [Token Economy — $ASCEND Migration](#8-ascend-token-migration)
1. [Security & Pre-Mainnet Checklist](#9-security--pre-mainnet-checklist)
1. [Testing Strategy](#10-testing-strategy)

-----

## 1. CURRENT STATE SNAPSHOT

|Layer         |Status         |Notes                                     |
|--------------|---------------|------------------------------------------|
|Frontend      |✅ LIVE         |Cloudflare Pages · frontierprotocol.app   |
|Backend       |⚠️ NOT DEPLOYED |Railway configured, env ready             |
|Globe         |⛔ BROKEN       |Needs backend API to load parcel data     |
|WebSocket     |⛔ OFFLINE      |Needs Railway deploy                      |
|Battle Engine |✅ BUILT        |`resolveBattle()` not wired to DB storage |
|AI Factions   |✅ BUILT        |Guard bug confirmed fixed                 |
|Trade Station |✅ BUILT        |Atomic order book live                    |
|Commander NFTs|✅ BUILT        |Mint + deliver flow complete              |
|Land NFTs     |✅ BUILT        |Plot #1 golden ASA minted testnet         |
|$ASCEND Token |⚠️ RENAME NEEDED|Currently FRNTR — pre-mainnet, clean swap |
|Mainnet       |⛔ NOT READY    |Blocked on Railway + battle engine wire-up|

-----

## 2. IMMEDIATE BLOCKERS

Priority order. Do not skip steps.

### BLOCKER 1 — Deploy Railway Backend

**What:** Deploy Express server to Railway so the globe loads.
**Steps:**

1. Set root directory: `artifacts/frontier-al`
1. Paste env block (from session — all variables confirmed)
1. Deploy → get Railway public URL
1. Update `PUBLIC_BASE_URL` to `https://frontierprotocol.app`
1. Update Cloudflare env vars: `VITE_API_URL` + `VITE_WS_URL` → Railway URL
1. Trigger Cloudflare redeploy
1. Verify: globe loads, parcels visible, WebSocket connects

**Verification:**

```bash
curl https://YOUR-RAILWAY-URL/api/game/slim-state
curl https://YOUR-RAILWAY-URL/api/blockchain/status
```

-----

### BLOCKER 2 — Fix routes.ts Corruption

**File:** `artifacts/frontier-al/server/routes.ts` lines 219–222
**What:** Stale AI instruction comment committed as code. Causes server build failure.
**Fix:** Delete these exact lines:

```
line 195:  app.get("/api/blockchain/status", ...
line 218:  app.get("/api/economics", ...
           ← PASTE THE NEW ROUTE HERE
line 348:  app.get("/api/blockchain/opt-in-check/:address", ...
```

**Verify:** `tsc --noEmit` passes with 0 errors.

-----

### BLOCKER 3 — Battle Engine Wire-Up (Pass A)

**What:** `resolveBattle()` exists in `server/engine/battle/resolve.ts` but `deployAttack` and `resolveBattles` in `server/storage/db.ts` have duplicate inline battle math that never calls it.
**Steps:**

1. In `db.ts` → `deployAttack`: replace inline power calc with `resolveBattle()` call
1. In `db.ts` → `resolveBattles`: same replacement
1. Pass `BattleInput` struct with correct fields from DB row
1. DO NOT touch `tuning.ts` constants
1. Verify: `POST /api/actions/attack` returns battle result with log entries

-----

### BLOCKER 4 — CORS for Production

**File:** `artifacts/frontier-al/server/index.ts`
**What:** `CLIENT_ORIGIN` must be set to `https://frontierprotocol.app` on Railway.
**Verify:** No CORS errors in browser console when frontend hits backend.

-----

### BLOCKER 5 — $ASCEND Token Rename

**What:** Rename FRNTR → ASCEND everywhere before mainnet mint.
**Files to update:**

- All `FRNTR` / `FRONTIER token` string references in client UI
- `unitName` in ASA mint params (`server/services/chain/asa.ts`)
- Token display in `EconomicsPanel.tsx`, `InventoryPanel.tsx`, `TradeStation.tsx`
- Any hardcoded “FRONTIER” in game event strings

**Do NOT touch:** Game constants, battle tuning, DB schema column names (use display layer only).

-----

## 3. HILDA — AI CONTENT & TUTORIAL WORKER

### What is HILDA?

**H**igh-fidelity **I**ntelligent **L**earning & **D**elivery **A**gent

HILDA is an autonomous AI worker that:

1. Reads live game state from the Ascendancy API
1. Generates tutorial scripts optimized for YouTube
1. Produces structured video content briefs
1. Manages upload metadata, SEO titles, descriptions, tags
1. Schedules posts and tracks performance

-----

### HILDA Architecture

```
┌─────────────────────────────────────────────────┐
│                  HILDA CORE                      │
│                                                  │
│  ┌──────────────┐    ┌──────────────────────┐   │
│  │ Game Scanner │───▶│  Content Planner     │   │
│  │ (API reader) │    │  (topic prioritizer) │   │
│  └──────────────┘    └──────────────────────┘   │
│          │                      │                │
│  ┌───────▼──────┐    ┌─────────▼────────────┐   │
│  │ Script Gen   │    │  SEO Optimizer       │   │
│  │ (Claude API) │    │  (titles/tags/desc)  │   │
│  └──────────────┘    └──────────────────────┘   │
│          │                      │                │
│  ┌───────▼──────────────────────▼────────────┐  │
│  │           Video Brief Package             │  │
│  │  (script + b-roll notes + CTA + metadata) │  │
│  └───────────────────────────────────────────┘  │
│                        │                         │
│              ┌─────────▼──────────┐             │
│              │  YouTube Publisher │             │
│              │  (via YouTube API) │             │
│              └────────────────────┘             │
└─────────────────────────────────────────────────┘
```

-----

### HILDA Content Priority Matrix

Based on actual game systems (scanned from codebase):

|Priority|Topic                          |Hook                                      |Game System                 |
|--------|-------------------------------|------------------------------------------|----------------------------|
|1       |How to buy your first land plot|“Own a piece of the planet on-chain”      |`POST /api/actions/purchase`|
|2       |Battle system explained        |“Troops + Iron + Fuel = victory”          |`resolveBattle()` engine    |
|3       |Biome strategy guide           |“Why mountains are worth 40% more defense”|`BIOME_DEFENSE_MOD` tuning  |
|4       |Commander NFTs                 |“Your Commander is your edge”             |Commander tier system       |
|5       |AI Factions explained          |“NEXUS-7 vs VANGUARD — which to join?”    |`AI_FACTION_PRESETS`        |
|6       |$ASCEND token economy          |“How to earn and spend ASCEND”            |Trade Station + economics   |
|7       |Orbital events                 |“Satellite warfare changes everything”    |Orbital event system        |
|8       |Trade Station deep dive        |“The atomic order book”                   |`tradeOrders` table         |
|9       |Sub-parcels                    |“Subdivide your land for passive income”  |`subParcels` schema         |
|10      |Season mechanics               |“Win the season, win the treasury”        |Season manager              |

-----

### HILDA Script Template (per video)

```markdown
## VIDEO: [TITLE]
**Target length:** 8–12 minutes (optimal YouTube retention)
**Hook (0:00–0:15):** [One sentence that stops the scroll]
**Problem (0:15–0:45):** What the viewer doesn't understand yet
**Solution walkthrough (0:45–7:00):** Step-by-step with screen capture notes
**Advanced tip (7:00–8:30):** One thing 90% of players miss
**CTA (8:30–end):** Subscribe + join Discord + buy first plot

## B-ROLL NOTES
- Globe rotation showing biome colors
- Battle resolution animation
- Wallet connect flow
- Token balance updating

## SEO PACKAGE
Title: [Primary keyword] — [Secondary hook] | Ascendancy Web3 Strategy
Description: [150-word block — see SEO section]
Tags: [30-tag block — see SEO section]
Thumbnail: [Concept description]
```

-----

### HILDA Implementation — Replit Agent Prompt

**Pass: HILDA-INIT**

```
Create file: artifacts/frontier-al/workers/hilda/index.ts

Context: HILDA is an AI content worker for the Ascendancy game. It calls 
the Anthropic Claude API to generate YouTube tutorial scripts and SEO 
metadata based on live game state.

EDITS:

1. CREATE artifacts/frontier-al/workers/hilda/index.ts
   - HildaWorker class with methods:
     - scanGameState(): fetches /api/game/slim-state and /api/factions
     - generateScript(topic: HildaTopic): calls Claude API with game context
     - generateSeoPackage(script: string): returns title, description, tags
     - exportBrief(topic: HildaTopic): returns full VideoBreif object
   - HildaTopic enum: LAND_PURCHASE | BATTLE_SYSTEM | BIOME_GUIDE | 
     COMMANDER_NFT | FACTIONS | TOKEN_ECONOMY | ORBITAL | TRADE | 
     SUB_PARCELS | SEASON
   - VideoBreif interface: { topic, script, brollNotes, cta, seo: SeoPackage }
   - SeoPackage interface: { title, description, tags: string[], 
     thumbnailConcept, publishTime }

2. CREATE artifacts/frontier-al/workers/hilda/prompts.ts
   - SYSTEM_PROMPT: positions Claude as a gaming content creator who 
     understands blockchain strategy games
   - topicPrompts: Record<HildaTopic, string> — one detailed prompt per topic
     that injects real game constants (biome defense mods, battle tuning, etc.)

3. CREATE artifacts/frontier-al/workers/hilda/seo.ts
   - generateTitle(topic, hook): YouTube-optimized title under 60 chars
   - generateDescription(script): 150-word SEO description with timestamps
   - generateTags(): returns 30 tags mixing broad + niche + blockchain terms

DO NOT TOUCH: Any existing server files, routes, storage, or game engine.

VERIFY: tsc --noEmit passes. Worker exports HildaWorker class correctly.
```

-----

### HILDA YouTube SEO Architecture

**Title Formula:**

```
[Power word] + [Game mechanic] + [Outcome] | Ascendancy [year]
```

**Examples:**

- `How to WIN Every Battle in Ascendancy (Biome Strategy Guide) 2026`
- `I Bought Land on the Blockchain — Ascendancy Web3 Game Tutorial`
- `$ASCEND Token Explained — Earn Crypto Playing Strategy Games`
- `AI Factions Are DESTROYING Players — Here's How to Fight Back`
- `Commander NFTs Give You UNFAIR Advantages | Ascendancy Guide`

**Description Template (150 words):**

```
[Hook sentence matching title energy]

In this video, I'll show you [exact thing covered] in Ascendancy — 
the real-time multiplayer strategy game built on the Algorand blockchain.

TIMESTAMPS:
0:00 — Intro
0:45 — [Section 1]
2:30 — [Section 2]
5:00 — [Advanced tip]
8:30 — How to get started

🎮 Play Ascendancy: https://frontierprotocol.app
💬 Discord: [link]
🐦 Twitter: [link]
📖 Docs: [link]

#Ascendancy #Web3Gaming #AlgorandNFT #BlockchainGame #NFTGame 
#CryptoGaming #PlayToEarn #StrategyGame #AlgorandBlockchain #GameFi
```

**30-Tag Master List (rotate per video):**

```
ascendancy game, web3 strategy game, algorand nft game, blockchain strategy,
play to earn 2026, nft land game, algorand gaming, crypto strategy game,
frontier protocol, ascend token, gamefi 2026, nft battle game,
algorand blockchain game, web3 mmo, crypto mmo, blockchain land nft,
algorand nft tutorial, how to play ascendancy, ascendancy tutorial,
web3 gaming guide, nft strategy game, algorand gaming 2026,
blockchain game tutorial, ascend crypto, play to earn algorand,
nft game 2026, web3 game guide, algorand defi game,
strategy game crypto, blockchain battle game
```

-----

## 4. JARVIS WORK HUB

### What is Jarvis?

A personal AI operations dashboard where you assign autonomous workers to tasks, monitor their progress, review outputs, and publish results. Think of it as a mission control for your AI workforce.

-----

### Jarvis Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    JARVIS DASHBOARD                       │
│                  frontierprotocol.app/hub                 │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   WORKERS   │  │   MISSIONS  │  │    OUTPUTS      │  │
│  │             │  │             │  │                 │  │
│  │ 🤖 HILDA   │  │ In Progress │  │ Review Queue    │  │
│  │ Content     │  │ Queued      │  │ Approved        │  │
│  │             │  │ Completed   │  │ Published       │  │
│  │ 🤖 ATLAS   │  │ Failed      │  │                 │  │
│  │ Analytics   │  │             │  │                 │  │
│  │             │  │             │  │                 │  │
│  │ 🤖 NEXUS   │  │             │  │                 │  │
│  │ Social      │  │             │  │                 │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │                 MISSION CREATOR                     │  │
│  │  Worker: [HILDA ▼]  Topic: [Battle Guide ▼]        │  │
│  │  Priority: [HIGH]   Schedule: [Now / Later]        │  │
│  │                          [DEPLOY MISSION]           │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

-----

### Worker Registry

|Worker    |Role                     |Status       |Trigger           |
|----------|-------------------------|-------------|------------------|
|**HILDA** |YouTube content + SEO    |Build Phase 1|Manual / Scheduled|
|**ATLAS** |Game analytics + reports |Build Phase 2|Cron: daily       |
|**NEXUS** |Twitter/Discord posts    |Build Phase 2|On game events    |
|**ORACLE**|Price monitoring + alerts|Build Phase 3|On-chain triggers |
|**CIPHER**|Security audit scans     |Build Phase 3|On deploy         |

-----

### Jarvis Data Model

```typescript
// Mission — a unit of work assigned to a worker
interface Mission {
  id: string;
  workerId: 'hilda' | 'atlas' | 'nexus' | 'oracle' | 'cipher';
  type: string;           // worker-specific task type
  payload: Record<string, unknown>;
  status: 'queued' | 'running' | 'review' | 'approved' | 'published' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  output?: MissionOutput;
  error?: string;
}

// Output — what a worker returns
interface MissionOutput {
  type: 'video_brief' | 'report' | 'post' | 'alert' | 'audit';
  data: unknown;
  previewUrl?: string;
  publishUrl?: string;
}

// Worker definition
interface WorkerDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  missionTypes: string[];
  capabilities: string[];
  status: 'active' | 'idle' | 'error';
}
```

-----

### Jarvis Backend Routes

Add to `server/routes.ts`:

```
GET  /api/hub/workers              — list all workers + status
GET  /api/hub/missions             — list missions (filterable by status/worker)
POST /api/hub/missions             — create new mission
GET  /api/hub/missions/:id         — get mission + output
POST /api/hub/missions/:id/approve — approve output for publish
POST /api/hub/missions/:id/publish — trigger publish (YouTube / Twitter / etc)
DELETE /api/hub/missions/:id       — cancel queued mission
GET  /api/hub/missions/:id/stream  — SSE stream for live worker progress
```

-----

### Jarvis Frontend — React Component Structure

```
client/src/components/hub/
  JarvisDashboard.tsx      — main layout
  WorkerCard.tsx           — worker status + quick-deploy button
  MissionList.tsx          — filterable mission table
  MissionCreator.tsx       — form to deploy new mission
  OutputViewer.tsx         — review/approve/publish output
  WorkerStatusBadge.tsx    — live status indicator
  MissionTimeline.tsx      — progress tracker with SSE updates
```

-----

### Jarvis Implementation Plan (Phases)

**Phase 1 — Core Hub (2 weeks)**

- Mission CRUD backend routes
- Worker registry (HILDA only)
- Basic dashboard UI
- HILDA script generation flow end-to-end

**Phase 2 — Output Pipeline (1 week)**

- Review queue UI
- YouTube Data API integration for publish
- Output versioning (re-run, edit, re-approve)

**Phase 3 — Multi-Worker (2 weeks)**

- ATLAS analytics worker
- NEXUS social worker
- Worker health monitoring
- Cron scheduling

**Phase 4 — Autonomy (ongoing)**

- Workers trigger other workers
- Performance feedback loop (view counts → retrain prompts)
- Budget tracking per worker

-----

## 5. BRANCH EXPANSION ROADMAP

### Branch: `feature/battle-engine-wiring` — IMMEDIATE

- Wire `resolveBattle()` into `db.ts` `deployAttack` and `resolveBattles`
- Add `source_parcel_id` migration (Prompt A from backlog)
- Launch From parcel selection UI

### Branch: `feature/ascend-token-rename` — IMMEDIATE

- Rename FRNTR → ASCEND in all display layers
- Mint new testnet ASA with ticker ASCEND
- Update economics panel

### Branch: `feature/hilda-worker` — WEEK 1

- HILDA worker implementation
- YouTube SEO package generator
- Content brief export

### Branch: `feature/jarvis-hub` — WEEK 2

- Mission model + routes
- Dashboard UI
- HILDA integration

### Branch: `feature/base-info-panel-upgrade` — WEEK 1

- Prompt C from backlog: BaseInfoPanel UI overhaul
- Fix `data_centre` yield bug (`newYieldMult += 0.05 * level`)

### Branch: `feature/battle-watch-modal` — WEEK 2

- Prompt B from backlog: contextual BattleWatchModal event feed
- Parcel improvements + biome display

### Branch: `feature/commander-gate` — WEEK 3

- Commander-required gate for attacks
- Concurrent attack cap by Commander tier
- `COMMANDER_INFO` tier validation

### Branch: `feature/mainnet-economics` — MONTH 2

- Tiered land pricing: Standard / Premium / Legendary
- Commander NFT tier pricing
- Five-bucket revenue split implementation
- Pre-mainnet economic simulation

### Branch: `feature/ai-faction-onchain` — MONTH 2

- AI faction on-chain addresses funded
- Faction treasury contract
- Phase 1 season rollout

### Branch: `feature/prediction-markets` — MONTH 3

- `predictionMarkets` + `marketPositions` schema already exists
- Wire up frontend `PredictionMarkets.tsx`
- Battle outcome markets

### Branch: `feature/lootbox` — MONTH 3

- `lootBoxInventory` schema exists
- Loot box purchase + reveal flow
- Rarity tiers tied to $ASCEND spend

-----

## 6. RELEASE PIPELINE

### Release v0.1 — BACKEND LIVE (this week)

- [ ] Railway deployed
- [ ] Globe loads with parcel data
- [ ] WebSocket connects
- [ ] routes.ts corruption fixed
- [ ] CORS configured

### Release v0.2 — BATTLE ENGINE (next week)

- [ ] `resolveBattle()` wired to storage
- [ ] Battle watch modal live
- [ ] Attack source parcel selection
- [ ] BaseInfoPanel upgraded

### Release v0.3 — $ASCEND REBRAND (week 3)

- [ ] Token renamed everywhere
- [ ] New testnet ASA minted
- [ ] Economics panel updated
- [ ] Marketing assets updated

### Release v0.4 — HILDA + HUB (week 4)

- [ ] HILDA worker running
- [ ] First 3 tutorial videos published
- [ ] Jarvis dashboard v1 live
- [ ] Mission queue working

### Release v0.5 — COMMANDER GATE (month 2)

- [ ] Commander required for attacks
- [ ] Concurrent cap enforced
- [ ] Commander marketplace hints

### Release v1.0 — MAINNET (month 3)

- [ ] All blockers resolved
- [ ] Neon Launch plan upgraded
- [ ] Mainnet ASA minted
- [ ] Economics model finalized
- [ ] Security audit passed
- [ ] 10 HILDA videos live
- [ ] Community size: target 500 wallets

-----

## 7. YOUTUBE & SEO ARCHITECTURE

### Channel Strategy

- **Channel name:** Ascendancy Game
- **Upload cadence:** 2x per week (HILDA generates, human approves)
- **Content mix:** 60% tutorials · 30% strategy · 10% lore/world-building
- **Shorts strategy:** 60-second clips from long-form, auto-generated by HILDA

### AI Search Optimization (2026 context)

With AI overviews dominant in search, optimize for:

- **Direct answer format:** first 30 seconds answers the exact question
- **Structured data:** chapters/timestamps in every video
- **Entity building:** consistent mention of “Ascendancy”, “frontierprotocol.app”, “$ASCEND”, “Algorand strategy game”
- **E-E-A-T signals:** show actual gameplay, real transactions, real wallet

### Thumbnail Formula

```
[Bright character/asset] + [Bold number or claim] + [Contrast text]
Example: Globe image + "21,000 PLOTS" + "OWN THE PLANET"
```

-----

## 8. $ASCEND TOKEN MIGRATION

### Pre-Mainnet Steps (testnet — zero cost, zero risk)

1. Rename all display strings FRNTR → ASCEND
1. Update ASA mint params: `assetName: "Ascend"`, `unitName: "ASCEND"`
1. Mint fresh testnet ASA, record new ID
1. Update any hardcoded testnet ASA IDs in env
1. Verify economics panel shows ASCEND

### Mainnet Mint Checklist

- [ ] `ALGORAND_NETWORK=mainnet` confirmed
- [ ] `PUBLIC_BASE_URL=https://frontierprotocol.app` confirmed
- [ ] `FORCE_NEW_FRONTIER_ASA=true` → restart → immediately set back to `false`
- [ ] Record mainnet ASA ID permanently
- [ ] Never re-mint (ASA fields immutable)

-----

## 9. SECURITY & PRE-MAINNET CHECKLIST

### Critical (block mainnet)

- [ ] Rotate `SESSION_SECRET` from testnet value
- [ ] Rotate `DATABASE_URL` (Neon credential exposed in chat — rotate NOW)
- [ ] `ADMIN_KEY` set to strong random string on Railway
- [ ] AI faction guard at storage layer (both `MemStorage.runAITurn` and `DbStorage.runAITurn` need internal `AI_ENABLED` checks)
- [ ] Network startup assertion: prevent testnet code hitting mainnet
- [ ] `PUBLIC_BASE_URL` always from env var, never `req.get("host")` fallback

### Important (fix before v1.0)

- [ ] Rate limiting on all `/api/actions/*` routes
- [ ] Sybil resistance: wallet address validation before purchase
- [ ] Economic exploit scan: can a player drain treasury via repeated attack?
- [ ] Concurrent attack race condition audit
- [ ] Neon free tier → Launch plan upgrade (background schedulers exceed free compute)

-----

## 10. TESTING STRATEGY

### Unit Tests (Vitest — already configured)

```
artifacts/frontier-al/
  tests/
    battle/resolve.test.ts     — deterministic output for identical seeds
    battle/tuning.test.ts      — balance validation simulations
    game-rules/biome.test.ts   — biome assignment coverage
    game-rules/econ.test.ts    — MICRO conversion round-trips
    hilda/seo.test.ts          — title length, tag count validation
```

### Integration Tests

- `POST /api/actions/attack` → returns BattleResult with log
- `POST /api/actions/purchase` → parcel ownership changes in DB
- WebSocket: connect → receive game state → receive battle event
- HILDA: generate script → validate structure → SEO package valid

### Pre-Deploy Smoke Tests

```bash
# Run these before every Railway deploy
curl $RAILWAY_URL/api/game/slim-state     # 200, parcels array
curl $RAILWAY_URL/api/blockchain/status   # 200, network: testnet
curl $RAILWAY_URL/api/factions            # 200, 4 factions
```

### Battle Balance Simulation

Before mainnet, run 10,000 simulated battles across all biome combinations and verify:

- Win rates by biome match `BIOME_DEFENSE_MOD` expectations
- Pillage amounts stay within `PILLAGE_RATE * stored_resources`
- No degenerate outcomes (0% or 100% win rates for any configuration)

-----

## APPENDIX — HILDA SKILL FILE

Save as: `artifacts/frontier-al/workers/hilda/HILDA.md`

```markdown
# HILDA — High-fidelity Intelligent Learning & Delivery Agent
Version: 1.0

## PURPOSE
Generate YouTube tutorial content for the Ascendancy blockchain strategy game.
All output is optimized for the YouTube algorithm and AI search engines (2026).

## GAME CONTEXT
- 21,000 on-chain land parcels as Algorand ASAs
- 8 biomes with defense modifiers (mountain=1.4x, water=0.5x)
- 4 AI factions: NEXUS-7 (expansionist), KRONOS (defensive), 
  VANGUARD (raider), SPECTRE (economic)
- Battle engine: troops + iron + fuel vs base defense + biome + improvements
- Commander NFTs: sentinel/phantom/reaper tiers
- $ASCEND token: earn via mining, spend on upgrades/attacks/land
- Trade Station: atomic on-chain order book

## OUTPUT FORMAT
Every script must include:
1. Hook (0-15s): stops the scroll
2. Problem statement (15-45s): what viewer doesn't know
3. Solution walkthrough (45s-7m): step by step
4. Advanced insight (7-8.5m): one thing 90% miss
5. CTA (8.5m+): subscribe + play + join community

## SEO RULES
- Title: under 60 characters, primary keyword first
- Description: 150 words, timestamps, links, hashtags
- Tags: 30 tags, mix of broad + niche + blockchain terms
- Thumbnail concept: bold claim + visual proof

## CONSTRAINTS
- Never invent game mechanics — only use confirmed game data
- Always link to frontierprotocol.app
- Always include blockchain/Algorand context for non-crypto viewers
- Tone: enthusiastic but not hype — educational first
```

-----

*LUT generated from live codebase scan · frontierprotocol.app · June 2026*
*Update this document after each release milestone*