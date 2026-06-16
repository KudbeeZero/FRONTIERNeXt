# FRONTIER — Change Log & Status

## Session: fix-commander-mint-delivery-J7kDI
**Date:** 2026-03-18
**Branch:** `claude/fix-commander-mint-delivery-J7kDI`

---

## What Was Done

### Commander Mint Delivery — Ghost Mint Fix

**Problem:** Commander mint transaction completed successfully but no NFT appeared in the user's wallet. UI showed nothing. No claim button. Users left in broken state.

**Root Causes Found (3 bugs):**

1. **API missing `exists` + `status` fields** — `GET /api/nft/commander/:commanderId` returned raw DB fields but `CommanderNftStatus` checked `data?.exists` which was always `undefined` → component always returned null → NFT UI never rendered.
2. **No `status` derivation** — Even if `exists` was present, the API never sent `status: "minted"/"delivered"` so claim button logic was dead.
3. **No polling / no query invalidation** — After mint, no query invalidation was triggered. With `staleTime: 30s` + `retry: false`, a cached 404 sat for 30 seconds and never refreshed.

**Fixes Applied:**

- `server/routes.ts` — NFT status endpoint now returns `exists: true` + derived `status` field; also checks idempotency table to surface `"minting"` while async is in-flight
- `client/src/components/game/CommanderPanel.tsx` — `CommanderNftStatus` polls every 8s while minting/not found; new "Minting…" spinner badge for in-flight state
- `client/src/components/game/GameLayout.tsx` — Invalidates NFT query on mint `onSuccess` so polling starts immediately

**Flow (fixed):**
```
Click mint → Toast → CommanderNftStatus shows "Minting…" (polls 8s)
→ ASA confirmed on-chain → "ASA {id}" badge + Claim button appears
→ User opts-in + claims → NFT delivered to wallet → green "NFT" badge
```

**Files Changed:**
- `server/routes.ts`
- `client/src/components/game/CommanderPanel.tsx`
- `client/src/components/game/GameLayout.tsx`

---

## Session: terraforming-state-sync-fmFyy
**Date:** 2026-03-17
**Branch:** `claude/terraforming-state-sync-fmFyy`

---

## What Was Done

### Terraforming State Sync — Same Land Identity Architecture

**Purpose:** Implement terraforming so the same land NFT (ASA) keeps its identity after a terraform operation. No burn/remint required. Metadata updates dynamically because the `/nft/metadata/:plotId` endpoint already reads from DB at request time — changing DB state automatically changes what the endpoint returns.

**Strategy Chosen:** Update same land asset / backend-canonical state. The metadata URL baked into the ASA at mint time always points to the live endpoint, which now returns terraform fields. No ASA replacement.

**Files Changed:**

- `migrations/0002_terraform_state.sql` _(new)_ — Adds 6 terraform tracking columns to `parcels` table
- `server/db-schema.ts` — Added `terraformStatus`, `terraformedAt`, `terraformLevel`, `terraformType`, `metadataVersion`, `visualStateRevision` columns to `parcels` table Drizzle schema
- `shared/schema.ts` — Added same 6 fields to `LandParcel` interface
- `server/storage/game-rules.ts` — `rowToParcel` now maps all 6 new terraform fields
- `server/storage/db.ts` — `terraformParcel` now sets all tracking fields on every terraform action; derives `terraformStatus` from hazard/stability levels; bumps `metadataVersion` and `visualStateRevision` correctly
- `server/routes.ts` — `/nft/metadata/:plotId` now fetches and returns all terraform fields in ARC-3 `properties`; `Cache-Control` reduced from 24h to 1h so wallets pick up changes; description includes terraform level when active
- `client/src/terraforming.ts` — `TerraformState` extended with all 6 tracking fields; `applyTerraform` now updates them on every action
- `client/src/components/game/LandSheet.tsx` — Land panel shows terraform status badge (Lvl N, Terraformed/Degraded), last action type, date, hazard%, stability%; post-terraform confirmation banner shows before→after biome transition

**Terraform NFT Strategy:**
- Same ASA identity retained after every terraform action
- Metadata URL unchanged — content updates automatically from DB
- `metadataVersion` in metadata JSON increments on every change so indexers can detect updates
- `visualStateRevision` increments only on biome/visual changes for efficient render gating
- Burn/remint explicitly rejected — not needed with dynamic metadata endpoint

**Limitations:**
- On-chain ARC-3 metadata is not immutably tied to current biome (by design — URL is stable, content is live)
- Wallets that aggressively cache metadata may show stale biome for up to 1 hour (Cache-Control TTL)
- ARC-69 (note-field metadata) would allow zero-latency on-chain updates but is not implemented; left as future upgrade path

---

## Session: centralize-frntr-emissions-E4ZDk
**Date:** 2026-03-17
**Branch:** `claude/centralize-frntr-emissions-E4ZDk`

---

## What Was Done

### ASCEND Land Emissions — Test Rate Rollout

**Purpose:** Raise land production to 50 ASCEND/day per parcel for testing/staging/mainnet-test phase, and centralize all emission config into a single file.

**⚠ Testing Economy Rate Active:** 50 ASCEND/day per parcel (base). This is NOT the live production rate.

**Files Changed:**
- `shared/economy-config.ts` _(new)_ — central emission constants; `LAND_DAILY_ASCEND_RATE_TEST=50`, `LAND_DAILY_ASCEND_RATE_PROD=1`, env-based mode switching
- `shared/schema.ts` — `calculateFrontierPerDay()` now reads base rate from `economy-config.ts`
- `server/services/chain/client.ts` — `getAdminBalance()` now returns real ASCEND ASA balance
- `server/routes.ts` — `/api/economics` includes emission config, parcel count, daily demand, projections, and payout safety warning log
- `client/src/components/game/EconomicsPanel.tsx` — Land Emission Rate section with TESTING MODE badge

**Production Switch:** Set `ECONOMY_MODE=production` env var to activate `LAND_DAILY_ASCEND_RATE_PROD`.

---

## Session: cleanup-and-docs-ZnHtp
**Date:** 2026-03-14
**Branch:** `claude/cleanup-and-docs-ZnHtp`

---

## What Was Done

### 1. Repository Artifact Cleanup

**Problem:** Several artifact files had accumulated in the root directory that were not part of the project and should not be tracked in version control.

**Files Removed:**
- `__out.txt` — Debug artifact containing a stale `git status` dump from a previous automated session. Never needed in the repo.
- `_ais*=s*false|players.findFirst|from(players)" server` — Malformed filename artifact containing a PostgreSQL `players` table definition dump. Likely produced by a failed shell command substitution in a previous automated task.
- `CODE_ANALYSIS_REPORT.txt` — 80 KB auto-generated Python-focused code analysis report produced by `code_analyzer.py`. Mostly noise from npm/node-gyp internals; not relevant to project health.
- `code_analyzer.py` — One-off Python script used to generate the above report. Not a maintained project tool; removed to reduce clutter.

### 2. README.md Deduplication & Consolidation

**Problem:** The README (965 lines) contained two merged/concatenated versions of the documentation — a newer v1.4.0 intro prepended onto an older v3.0-labelled body. This caused:
- Duplicate **Tech Stack** tables (two different tables, different detail levels)
- Duplicate **Project Structure** sections
- Duplicate **API Reference** sections (both a table format and a grouped format)
- Duplicate **Database Schema** sections (one detailed, one summary)
- Duplicate **Getting Started** / **Install & Run** blocks
- Duplicate **Plot NFT** sections
- Conflicting version branding ("v1.4.0" vs "VERSION 3.0")
- Duplicate AI Factions table (slightly different content in each copy)
- Redundant `## Recon Drones & Orbital Satellites` section immediately after a more detailed equivalent

**Changes Made:**
- Rewrote README.md as a single clean document under the **v1.4.0** version label (matching the actual latest release)
- Merged the best content from both versions — retained the detailed per-column DB schema, the full API reference table with body params, the complete feature descriptions with stat tables, and the full changelog
- Added the `server/engine/`, `server/services/chain/`, `server/wsServer.ts`, and `shared/worldEvents.ts` entries to the Project Structure tree (these files existed but were missing from all prior versions)
- Removed the "Migration Audit — Replit → Production" section (migration is complete; the section is no longer actionable)
- Consolidated the two "Plot NFT Verification" sections into one canonical "Plot NFTs (ARC-3)" section
- Removed version numbering inconsistency ("VERSION 3.0" heading) — unified on v1.4.0

---

## File Status

| File | Status | What Changed |
|------|--------|-------------|
| `README.md` | **Rewritten** | Removed ~400 lines of duplicate content; unified as clean v1.4.0 doc |
| `__out.txt` | **Deleted** | Stale git-status debug artifact |
| `_ais*=s*false\|...` | **Deleted** | Malformed filename / DB schema dump artifact |
| `CODE_ANALYSIS_REPORT.txt` | **Deleted** | Auto-generated Python analysis noise |
| `code_analyzer.py` | **Deleted** | One-off analysis script; not a project tool |
| `CHANGES.md` | **Updated** | Added this session entry |

---

## Live Status

| Layer | Status |
|-------|--------|
| **Algorand TestNet** | Live — FRONTIER ASA deployed at asset ID `755818217` on TestNet |
| **Backend API** | Live — Express server serves all endpoints; blockchain init runs on startup |
| **Frontend** | Live — React/Vite client served from same server |
| **Database** | In-memory (`MemStorage`) — persists only for server lifetime; DB schema (`db-schema.ts`) defines the Drizzle/Postgres schema for when a Postgres instance is wired in |
| **Wallet Support** | Pera Wallet + LUTE Wallet on Algorand TestNet |
| **Token Minting** | Server-side batched ASA transfers (up to 16 per atomic group) run when player claims FRONTIER |

---

## Session: organize-mining-transactions-eKu3t
**Date:** 2026-02-21
**Branch:** `claude/organize-mining-transactions-eKu3t`

---

## What Was Done

### 1. Organized & Enriched On-Chain Transaction Data

**Problem:** Transaction notes sent to the Algorand chain were minimal plain-text strings (e.g., `"FRONTIER claim: 33"`) with no structure, no versioning, and no way to parse them programmatically.

**Changes Made:**

#### `server/algorand.ts`
- `transferFrontierASA()` — note now sends structured JSON:
  ```
  ASCEND:{"game":"FRONTIER","v":1,"type":"claim","amt":33,"to":"ADDR...","ts":1234567890,"network":"testnet"}
  ```
- `sendAtomicFrontierTransfers()` (used for batch claims) — each transaction in the atomic group now includes:
  ```
  ASCEND:{"game":"FRONTIER","v":1,"type":"batch_claim","amt":33,"to":"ADDR...","batchIdx":0,"batchSize":3,"ts":...,"network":"testnet"}
  ```
- `FrontierTransferBatcher.estimatedBytes()` — size estimate updated to reflect the new larger JSON notes so batches stay within Algorand's 1 KB limit.

#### `client/src/lib/algorand.ts`
- All on-chain note prefixes changed from `FRONTIER:` → `ASCEND:` for consistency with the ASA unit name.
- `createGameActionTransaction()` — structured note:
  ```
  ASCEND:{"game":"FRONTIER","v":1,"action":"mine","plotId":42,"player":"ABCDEF12","ts":...,"network":"testnet"}
  ```
- `createPurchaseWithAlgoTransaction()` — includes `algoAmount` and abbreviated player address.
- `createClaimFrontierTransaction()` — includes token amount and player address.
- Batch action envelope (`_encodeBatch`) upgraded from minimal `FB:[...]` to:
  ```
  ASCEND:{"game":"FRONTIER","v":1,"network":"testnet","actions":[...]}
  ```
- `BatchedAction` interface gains optional `m` field for mineral yields on mine actions: `{ fe: number, fu: number, cr: number }`.
- `enqueueGameAction()` now accepts an optional `minerals` parameter to embed actual extracted amounts in the on-chain log.

---

### 2. Crystal Mining Now Fully Tracked

**Problem:** `totalCrystalMined` was missing from the player model. Only iron and fuel were tracked at the lifetime level, so there was no record of how much crystal any player had extracted from the Earth over their session.

**Changes Made:**

#### `shared/schema.ts`
- Added `totalCrystalMined: number` to the `Player` interface.
- Added `totalCrystalMined: number` to the `LeaderboardEntry` interface.

#### `server/db-schema.ts`
- Added `totalCrystalMined: real("total_crystal_mined").notNull().default(0)` column to the `players` table.

#### `server/storage.ts`
- Player initialization (human + all 4 AI factions) sets `totalCrystalMined: 0`.
- `mineResources()` now tracks: `player.totalCrystalMined += finalCrystal`.
- Mining game event description enriched:
  ```
  "Commander mined 8 iron, 4 fuel, 1 crystal from plot #42 [volcanic] (richness: 87)"
  ```
  Previously it omitted crystal and richness entirely.
- `getLeaderboard()` now includes `totalCrystalMined` in every entry.

---

### 3. Cumulative Daily ASCEND Accumulation — Top-of-Menu Banner

**Problem:** Players had no clear at-a-glance view of how much FRONTIER token they were generating per day across all their plots, or how much had built up pending a claim. The "Claim ASCEND" button gave no indication of the pending amount.

**Changes Made:**

#### `client/src/components/game/InventoryPanel.tsx`
- Added a prominent **ASCEND Generation Banner** at the very top of the Inventory panel (above wallet balances), visible as soon as you own any land.
- Banner shows two large numbers:
  - **ASCEND / Day** — total daily generation rate summed across all owned plots.
  - **Accumulated** — total ASCEND pending a claim right now (all plots summed).
- **"Mint All — X.XX ASCEND"** button replaces the old plain "Claim ASCEND" button in the banner. The button:
  - Shows the exact pending amount in the label (e.g., `Mint All — 33.47 ASCEND`).
  - Is disabled with `"No ASCEND to Mint Yet"` text when nothing has accumulated.
  - Notes inline that large claims are sent in max-size Algorand atomic batches.
- Added a **Lifetime Mineral Extraction** row beneath wallet balances showing `totalIronMined`, `totalFuelMined`, and `totalCrystalMined` from the player's lifetime stats.
- The collect-minerals button label is now more explicit: `Collect Minerals — +8Fe +4Fu +1Cr` (abbreviated units).
- Removed the old bottom-of-header "Earning X ASCEND/day" text line — that info now lives in the banner.

---

### 4. ResourceHUD Daily Rate Indicator

**Problem:** The top-of-screen resource bar showed the player's current ASCEND wallet balance but gave no indication of how fast it was growing.

**Changes Made:**

#### `client/src/components/game/ResourceHUD.tsx`
- Added `frontierDailyRate?: number` and `frontierPending?: number` props.
- Below the ASCEND balance on desktop (sm+ breakpoint), a small sub-label now shows:
  ```
  ▲ 33.0/day  (12.5 pending)
  ```
- The pending amount shows in yellow when non-zero.

#### `client/src/components/game/GameLayout.tsx`
- Computes `frontierDailyRate` and `frontierPending` from `gameState.parcels` filtered to the current player's owned plots and passes them to `<ResourceHUD />`.
- Mine action callback updated: `queueMineAction` is now called **after** the server confirms the mining result, so the actual mineral yields `{ iron, fuel, crystal }` are included in the on-chain batch note rather than zeros.
- Mining toast description now shows the specific yields: `"+8 Iron, +4 Fuel, +1 Crystal"`.

---

## File Status

| File | Status | What Changed |
|------|--------|-------------|
| `shared/schema.ts` | **Updated** | Added `totalCrystalMined` to `Player` + `LeaderboardEntry` interfaces |
| `server/db-schema.ts` | **Updated** | Added `total_crystal_mined` column to `players` table |
| `server/storage.ts` | **Updated** | Crystal tracking in `mineResources()`, enriched event descriptions, leaderboard entry includes crystal |
| `server/algorand.ts` | **Updated** | Structured JSON notes for all FRONTIER ASA transfers; consistent `ASCEND:` prefix |
| `client/src/lib/algorand.ts` | **Updated** | Structured `ASCEND:` prefix on all on-chain notes; `BatchedAction` gains mineral field `m`; `enqueueGameAction` accepts minerals param |
| `client/src/hooks/useBlockchainActions.ts` | **Updated** | `queueMineAction` accepts optional `{ iron, fuel, crystal }` mineral yields |
| `client/src/components/game/InventoryPanel.tsx` | **Updated** | ASCEND Generation Banner, Mint All button, lifetime mineral stats panel |
| `client/src/components/game/ResourceHUD.tsx` | **Updated** | Daily rate + pending indicator below ASCEND balance |
| `client/src/components/game/GameLayout.tsx` | **Updated** | Passes daily rate + pending to `ResourceHUD`; mine yields logged post-confirmation |

---

## Live Status

| Layer | Status |
|-------|--------|
| **Algorand TestNet** | Live — FRONTIER ASA deployed at asset ID `755818217` on TestNet |
| **Backend API** | Live — Express server serves all endpoints; blockchain init runs on startup |
| **Frontend** | Live — React/Vite client served from same server |
| **Database** | In-memory (`MemStorage`) — persists only for server lifetime; DB schema (`db-schema.ts`) defines the Drizzle/Postgres schema for when a Postgres instance is wired in |
| **Wallet Support** | Pera Wallet + LUTE Wallet on Algorand TestNet |
| **Token Minting** | Server-side batched ASA transfers (up to 16 per atomic group) run when player claims FRONTIER |

> **Note on `totalCrystalMined` DB column:** The Drizzle schema has been updated to include the new column. If a live Postgres database is in use, run a migration (`ALTER TABLE players ADD COLUMN total_crystal_mined REAL NOT NULL DEFAULT 0`) or re-run the schema push (`drizzle-kit push`) to apply it. The in-memory `MemStorage` used in development picks it up automatically.

---

## On-Chain Transaction Note Format (v1)

All transactions sent to Algorand now use the prefix `ASCEND:` followed by a JSON payload. This makes them:
- Searchable in block explorers by note prefix
- Parseable by any indexer or analytics tool
- Versioned via the `"v":1` field for forward compatibility

### Mine Action Batch (client → chain)
```json
{
  "game": "FRONTIER",
  "v": 1,
  "network": "testnet",
  "actions": [
    { "a": "mine", "p": 42, "t": 1740000000000, "m": { "fe": 8, "fu": 4, "cr": 1 } },
    { "a": "build", "p": 42, "t": 1740000005000, "x": { "improvementType": "turret" } }
  ]
}
```

### ASCEND Claim (server → chain)
```json
{
  "game": "FRONTIER",
  "v": 1,
  "type": "batch_claim",
  "amt": 33.47,
  "to": "ABCDEFGHIJ...",
  "batchIdx": 0,
  "batchSize": 1,
  "ts": 1740000000000,
  "network": "testnet"
}
```
