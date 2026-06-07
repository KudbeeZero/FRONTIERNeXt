# ASCENDANCY — Dormant Systems & Activation LUT

### Half-built features, the agent infrastructure, and what’s ready to route

> Full filesystem scan of FRONTIERNeXt · June 2026
> Purpose: surface everything already built so nothing gets reset before production

-----

## EXECUTIVE SUMMARY

You’ve built **far more than is currently wired into the live game.** The scan found
multiple complete or near-complete systems sitting dormant — most need only a UI button
or a single route to come alive. The most important finding:

> **Your sub-parcel archetype + building system — the thing you described wanting to
> design in the last message — is ALREADY FULLY BUILT on the backend.** Routes, storage
> methods, archetype assignment, building construction, and sub-parcel combat all exist.
> It just needs the frontend UI.

Here’s the complete inventory, ranked by how close each is to shipping.

-----

## TIER 1 — FULLY BUILT, NEEDS ONLY UI (ship these first)

### 1.1 — Sub-Parcel Archetype & Building System ✅ BACKEND COMPLETE

**This is the big one.** Everything you described designing already exists server-side:

|Endpoint                             |Status |What it does                         |
|-------------------------------------|-------|-------------------------------------|
|`POST /api/sub-parcels/:id/purchase` |✅ Built|Buy an unowned sub-parcel            |
|`POST /api/sub-parcels/:id/build`    |✅ Built|Build/upgrade an improvement         |
|`POST /api/sub-parcels/:id/archetype`|✅ Built|Assign resource/trade/energy/fortress|
|`POST /api/sub-parcels/:id/attack`   |✅ Built|Sub-parcel combat                    |
|`GET /api/sub-parcels/listings`      |✅ Built|Marketplace listings                 |

Schema columns exist (`archetype`, `archetypeLevel`, `energyAlignment`, `improvements`).
Storage methods exist (9+ references in `db.ts`).

**What’s missing:** the frontend panel to drive it. No archetype picker, no building tree
UI, no sub-parcel marketplace view.

**Activation:** Build `SubParcelPanel.tsx` with archetype selection + building tree that
calls the existing endpoints. This is pure frontend — the entire backend is done.
**Effort: ~1 day. Impact: huge — unlocks the whole depth layer.**

-----

### 1.2 — Prediction Markets ✅ FULLY WIRED END-TO-END

This is **completely built** — backend AND frontend:

|Layer                                                                                               |Status|
|----------------------------------------------------------------------------------------------------|------|
|Schema (`predictionMarkets`, `marketPositions`)                                                     |✅     |
|Storage (`createMarket`, `placeBet`, `resolveMarket`, `getPlayerPositions`, `resolveExpiredMarkets`)|✅     |
|Routes (`/api/markets`, `/bet`, `/claim`, `/history`, `/player/:id`)                                |✅     |
|Frontend (`PredictionMarkets.tsx`, 427 lines, hits all real endpoints)                              |✅     |

**What’s missing:** possibly just a navigation entry point. It may already work — you
might not have a button routing to it.

**Activation:** Confirm there’s a menu item that opens `PredictionMarkets.tsx`. If yes,
this is **already live**. Verify the auto-resolution scheduler (`resolveExpiredMarkets`)
is actually called on a timer. **Effort: ~1 hour to verify/wire nav.**

-----

### 1.3 — Seasons System ✅ BACKEND COMPLETE

|Layer                                                                                 |Status                        |
|--------------------------------------------------------------------------------------|------------------------------|
|Schema (`seasons`)                                                                    |✅                             |
|Storage (`getCurrentSeason`, `startSeason`, `settleCurrentSeason`, `getSeasonHistory`)|✅                             |
|Routes                                                                                |✅ (22 references in routes.ts)|

**What’s missing:** a season HUD showing current season, time remaining, leaderboard, and
the prize pool. Season settlement may need a scheduler.

**Activation:** Build a `SeasonBanner.tsx` for the game HUD + confirm the settle scheduler
runs. **Effort: ~half day.**

-----

### 1.4 — Treasury Ledger ✅ WIRED INTO 3 PANELS

`treasuryLedger` is already referenced in `GameLayout.tsx`, `FactionPanel.tsx`, and
`EconomicsPanel.tsx`. This appears live. **Verify it’s displaying real data.**

-----

## TIER 2 — PARTIALLY BUILT, NEEDS WIRING

### 2.1 — Sub-Parcel Marketplace (listings)

Storage methods exist (9 refs), routes exist (`GET /api/sub-parcels/listings` + others),
schema `subParcelListings` exists. **What’s missing:** the buy/sell listing UI. The
backend supports a full secondary market for sub-parcels — only the storefront view is
absent.

**Activation:** Add listing/delisting buttons to `SubParcelPanel.tsx` (build it once,
covers 1.1 and 2.1 together).

-----

## TIER 3 — DORMANT, SCHEMA ONLY (decide before production)

### 3.1 — Loot Box System ⚠️ SCHEMA ONLY

`lootBoxInventory` table exists in the schema. **Zero storage methods, zero routes.**
This is a stub — you reserved the table but never built the logic.

**Decision needed:** Either build it (loot box purchase → reveal → rarity tiers tied to
$ASCEND burn, per your roadmap) or remove the table to keep the schema clean. Since it’s
additive and nullable, **leaving it is harmless** — but don’t let it imply a feature
that doesn’t exist.

**Recommendation:** Keep the table (it’s already migrated), build the logic in a later
phase. Flag it as “reserved, not implemented” so no one assumes it works.

-----

## TIER 4 — THE AGENT INFRASTRUCTURE (`.agents/` folder)

You were right — there’s a whole agent system. Here’s what’s actually there:

### 4.1 — `.agents/skills/` — Three Installed Agent Skills

```
.agents/skills/
  ui-ux-pro-max/      — UI/UX design system skill (huge data set)
  audit-website/      — Website auditor (SEO/perf/security, 230+ rules)
  agent-tools/        — inference.sh CLI (150+ AI apps: FLUX, Veo, Claude, etc.)
```

**What these are:** These are **Claude/agent skill definitions** — not a running server.
They’re skills an agent (Claude Code, or an agentic IDE) loads to gain capabilities:

- **`ui-ux-pro-max`** — a comprehensive design-system skill with CSV datasets for
  typography, colors, charts, icons, landing pages, and per-framework stacks (react,
  shadcn, flutter, etc.). This is a *design intelligence* skill. Useful for the globe
  visual overhaul and the Jarvis dashboard UI.
- **`audit-website`** — wraps the `squirrelscan` CLI. Audits a site for SEO, performance,
  security, accessibility across 230+ rules. **This is your “always-running auditor”
  candidate** — but for the *website*, not TypeScript. It needs the `squirrel` CLI
  installed in PATH.
- **`agent-tools`** — wraps `inference.sh`, a CLI that runs 150+ AI models (FLUX, Veo,
  Claude, image/video gen, Twitter automation). **This is directly relevant to HILDA** —
  it’s an alternative to wiring each video API separately; inference.sh could be HILDA’s
  unified backend for image/video generation.

### 4.2 — What the TypeScript auditor actually is

You mentioned “an agent that is always running and checks TypeScript.” Based on the scan,
this isn’t in `.agents/` — that folder holds the three skills above. The TypeScript
checking you’re thinking of is most likely:

- The **CI workflow** Claude Code just added (`.github/workflows/ci.yml`) which runs
  `tsc` (`npm run check`) on every push — that’s your always-on TS auditor, just
  triggered by GitHub rather than a local daemon.
- OR a local Gemini/Antigravity agent config that lives in your IDE settings, not the
  repo.

**Recommendation:** Formalize CIPHER (the TS auditor from the Jarvis LUT) as a proper
agent using the Claude Agent SDK, triggered by the CI workflow. The `.agents/skills`
become tools your Jarvis workers can load. This unifies what Gemini started with the
Jarvis architecture.

-----

## TIER 5 — THE `api-server` ARTIFACT

There’s a third workspace artifact: `artifacts/api-server`. It’s a minimal Express
scaffold (`app.ts`, `routes/health.ts`, `routes/index.ts`, a logger, a build script,
and a `.replit-artifact/artifact.toml`).

**What it is:** A separate, clean API server skeleton — likely intended as the
“services running separately” backend you mentioned wanting (Docker, separate services).
It’s a blank-slate Express app, not yet doing anything game-related.

**Decision needed:** This is the natural home for your **separated services** vision —
HILDA, Jarvis workers, the auditor — as a standalone API distinct from the game server.
Rather than cramming workers into `frontier-al`, they could live in `api-server` as a
dedicated worker/agent host.

**Recommendation:** Use `api-server` as the Jarvis + HILDA worker host. Keep `frontier-al`
as the pure game backend. This matches your “run my services separately” goal and keeps
the game server lean.

-----

## TIER 6 — THE `mockup-sandbox` ARTIFACT

`@workspace/mockup-sandbox` — a Vite + React sandbox with its own dev/build/preview
scripts. This is your **UI prototyping environment** — where you mock up components
before moving them into the real game. (It’s also the one with the React 18/19 type
mismatch from earlier — it has stale ShadCN components.)

**Recommendation:** Keep it as a scratchpad, but exclude it from the production build
pipeline (the Cloudflare/Railway builds should never touch it). It’s a dev tool.

-----

## THE VARIABLE DATABASE — IMPLEMENT NOW, NOT LATER

> Your point: *“the database of variables can be implemented now rather than later — we
> don’t want to be resetting things once it gets to production.”*

This is exactly right, and here’s the discipline. Anything that is a **tunable game
constant** should live in ONE authoritative place now, so production never requires a
schema reset to rebalance.

### Current state

- Battle tuning → `server/engine/battle/tuning.ts` (constants ✅ centralized)
- Globe visuals → `client/src/lib/globe/globeConstants.ts` (constants ✅ centralized)
- Game rules → `server/storage/game-rules.ts` (✅ centralized)
- Economy → economy config (✅ has tests)

### What to add now (pre-production)

A single **`game-config` table** (or a typed config module) holding the values you’ll
want to tune in production WITHOUT a migration:

```typescript
// Option A — typed config module (no DB, fastest, TypeScript-first)
// server/config/gameConfig.ts
export const GAME_CONFIG = {
  archetypes: ARCHETYPE_BUILDINGS,     // building costs/effects
  pricing: {
    parcelStandard: 100,
    parcelPremium: 250,
    parcelLegendary: 500,
    subParcelBase: 50,
    commanderTiers: { sentinel: 200, phantom: 500, reaper: 1200 },
  },
  scan: { baseCost: 25, baseRadius: 5, baseDuration: 3 },
  season: { defaultDays: 90 },
  fees: { tradeFeePct: 2.5, predictionDevCut: 0.25 },
} as const;

// Option B — DB-backed config (tunable live without redeploy)
// game_config table: key (text PK) | value (jsonb) | updatedAt
// Read once on boot, cache in memory, expose admin route to update
```

**Recommendation:** **Option A now** (typed module — TypeScript-first, no DB reliance,
matches your philosophy), with the structure designed so it CAN migrate to Option B
later if you need live tuning. The key is: define the *shape* now so production data
references stable keys. Adding the DB layer later is then additive, not a reset.

### The anti-reset rule

Design every new column as **additive and nullable** with a sensible default. Never
require a destructive migration in production. The archetype columns already follow this
pattern — `archetype` is nullable, `archetypeLevel` defaults to 0. Keep doing exactly
that for every new field.

-----

## ACTIVATION ROADMAP (ordered by ratio of impact to effort)

|#|System                   |State           |Effort   |Action                        |
|-|-------------------------|----------------|---------|------------------------------|
|1|Prediction Markets nav   |Fully wired     |1 hr     |Verify menu entry + scheduler |
|2|Sub-Parcel Panel UI      |Backend complete|1 day    |Build archetype/building UI   |
|3|Sub-Parcel Marketplace   |Backend complete|+half day|Add to the same panel         |
|4|Season HUD               |Backend complete|half day |Build SeasonBanner + scheduler|
|5|Treasury display         |Wired           |1 hr     |Verify real data shows        |
|6|game-config module       |New             |half day |Centralize tunables now       |
|7|api-server as worker host|Scaffold exists |1 day    |Designate for Jarvis/HILDA    |
|8|CIPHER TS auditor        |CI exists       |1 day    |Formalize via Agent SDK       |
|9|Loot boxes               |Schema only     |Later    |Build or mark reserved        |

**Items 1–5 are almost free** — the hard work is done. You could light up prediction
markets, the entire sub-parcel depth system, seasons, and treasury in **roughly 2–3 days
of frontend work**, because the backends already exist.

-----

## CRITICAL: NOTHING HERE REQUIRES A RESET

Every activation above is **additive**:

- Sub-parcel UI → consumes existing endpoints, no schema change
- Prediction markets → already complete
- Seasons → already complete
- game-config → new module, no migration
- api-server → separate artifact, doesn’t touch the game server
- Loot boxes → table already migrated, logic is additive

You can wire all of this incrementally, branch by branch, and route it when ready —
exactly as you wanted. **The world state, the schema, and the on-chain assets stay
stable through all of it.**

-----

## SUMMARY — WHAT YOU ALREADY OWN

You’re sitting on a much more complete game than the live deployment suggests:

- ✅ Full sub-parcel archetype + building + combat system (backend)
- ✅ Full prediction markets (frontend + backend)
- ✅ Full seasons system (backend)
- ✅ Treasury ledger (wired)
- ✅ Sub-parcel secondary marketplace (backend)
- ✅ Three agent skills (UI/UX, website audit, inference.sh)
- ✅ A clean separate API server scaffold for workers
- ✅ A UI mockup sandbox
- ⚠️ Loot box table (reserved, not built)

The next move isn’t building — it’s **routing what exists.** Start with the SubParcelPanel
because it unlocks the deepest gameplay layer for one day of frontend work.

-----

*Dormant Systems & Activation LUT · Ascendancy · frontierprotocol.app*
*Everything additive. Nothing resets. Route it when ready.*