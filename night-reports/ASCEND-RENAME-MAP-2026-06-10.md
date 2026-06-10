# ASCEND RENAME MAP — FRNTR / FRONTIER (token) → ASCEND

> **STATUS: EXECUTED 2026-06-10.** The full code rename is done and verified
> (tsc clean · 194 server tests · 31 client tests · build green), 53 files.
> Decisions applied: full code rename; **SQL columns kept** (Drizzle fields
> renamed, column-name strings pinned — NO data migration); **on-chain prefix
> now `ASCEND:`** with the parser dual-accepting legacy `FRNTR:`; **auth prefix
> `FRONTIER-AUTH:v1:`, `frontier_*` localStorage keys, and `/api/actions/...`
> route paths KEPT** (infra/contract). Pending: ASCEND-branded ASA re-mint
> before mainnet (testnet ASA #755818217 keeps its on-chain name).
>
> **Data caveats (testnet, pre-mainnet — acceptable):** the trade-resource
> literal and `claim_frontier` event/action value were renamed to `ascend` /
> `claim_ascend` in code; any pre-existing open trade-order rows or logged
> events carrying the old string values are stale (no behavior keys off them).
> The original inventory below is retained for reference.


**Prepared:** 2026-06-10 · 10 read-only scanner agents across the whole repo (716 tracked files).
**Status of the rename: PARTIAL / IN-PROGRESS.** The user-facing UI display layer was
already flipped to "ASCEND"; the structural layer underneath is still FRNTR/Frontier.
This document is the complete inventory + the decisions that gate a safe finish.

> THE CRITICAL DISTINCTION: `FRONTIER`/`Frontier`/`frontier` is BOTH the **currency
> token** (→ ASCEND) AND the **game/project name** (FRONTIERNeXt, frontier-al, "Frontier"
> the world/server/lore — these STAY). Every find-replace must respect this. A blind
> global replace WILL corrupt the game name.

---

## HEADLINE FINDINGS

1. **It's half-done.** Client display strings mostly already say "ASCEND" ("ASCEND
   Balance", "ASCEND Burned", "Facilities (ASCEND)", "500 ASCEND welcome bonus", trade
   label `RESOURCE_LABELS["frontier"]="ASCEND"`). But the variables/fields BEHIND those
   strings are still `player.frontier`, `frntrBalanceMicro`, `frontierPerDay`, etc.
2. **Live inconsistency to reconcile:** `server/services/chain/asa.ts` already mints the
   ASA with `name:"Ascend"`, `unitName:"ASCEND"` — but `server/routes.ts` (~lines 554-555)
   still returns `unitName:"FRNTR"`, `assetName:"FRONTIER"` in the blockchain-status
   response. Source of truth disagrees with itself.
3. **This is an all-or-nothing CROSS-TIER rename for the code layer.** `player.frontier`
   flows DB column → drizzle field → server → API JSON → client read. You cannot rename it
   in one tier without the others or the build/runtime breaks. The only independently-safe
   slices are docs, comments, and pure display strings.
4. **README already declares the intent** (line ~149: "$ASCEND is the public ticker"), and
   `session-notes/2026-06-07-ascendancy-lut-blockers.md` documents "FRNTR rebrand FRONTIER
   token → ASCEND" — so this is a sanctioned, started initiative.

---

## RENAME CONVENTION (apply consistently)

| From | To |
|---|---|
| `FRNTR` (ticker) | `ASCEND` |
| `FRONTIER` (token, all-caps) | `ASCEND` |
| `Frontier` (token, in camelCase ids) | `Ascend` (e.g. `claimFrontier`→`claimAscend`, `totalFrontierBurned`→`totalAscendBurned`) |
| `frontier` (token, lowercase) | `ascend` (the `frontier` balance field, `frntr` params) |
| `fromMicroFRNTR`/`toMicroFRNTR` | `fromMicroASCEND`/`toMicroASCEND` |
| `microFRNTR` (docs) | `microASCEND` |
| SQL cols `frntr_balance_micro`, `frontier`, `total_frontier_burned`, … | `ascend_balance_micro`, `ascend`, `total_ascend_burned`, … |

**KEEP (game/project name, NOT the token):** `FRONTIERNeXt`, `frontier-al`,
`@workspace/frontier-al`, "Frontier server running", Redis namespaces (`frontier:*`,
`frontier:world_events`), "the frontier" lore, NFT branding ("FRONTIER Plot/Commander/
Weapon NFT", "Frontier Plot #N" ASA names), page titles/logos ("⬡ FRONTIER",
"FRONTIER · ARMORY", "FRONTIER TESTNET"). `FORCE_NEW_FRONTIER_ASA` env var = game ASA, keep.

---

## INVENTORY BY TIER (agent-reported file:line; confirm during execution)

### 1. SHARED — source of truth, rename FIRST (everything imports this)
`shared/schema.ts`: constants `FRONTIER_TOTAL_SUPPLY`, `WELCOME_BONUS_FRONTIER`,
`DRONE_MINT_COST_FRONTIER`, `SATELLITE_DEPLOY_COST_FRONTIER`; Player field `frontier`;
LandParcel `frontierAccumulated`/`frontierPerDay`; GameState `frontierTotalSupply`/
`frontierCirculating`; FACILITY_INFO `costFrontier`/`frontierPerDay`; SPECIAL_ATTACK_INFO
`costFrontier` (×5); SeasonLeaderboard `rewardFrontier`; `calculateFrontierPerDay()`.
**SERIALIZED LITERALS (cross-tier):** `TradeResource` union member `"frontier"`;
`z.enum([...,"frontier"])` (×2); GameEvent type `"claim_frontier"`.
`shared/economy-config.ts`: `LAND_DAILY_FRNTR_RATE(_TEST/_PROD/_ACTIVE)`,
`COMMANDER_MINT_FRNTR_*`, `DRONE_COST_FRNTR_*`, `SATELLITE_COST_FRNTR_*`,
`SPECIAL_ATTACK_COSTS_*`, `FacilityCostConfig.frntr`, `TESTING_ECONOMY_SUMMARY.primaryCurrency:"FRNTR"`.
`shared/weapon-economy.ts` + `shared/weapons/types.ts`: `costFrntr` field +
`fireCostFrntr`/`unlockCostFrntr`/`deployCostFrntr`/`upgradeCostFrntr`; `costFrntr:N` in
**every weapon spec** (artillery ×12, missiles ×12).

### 2. DB SCHEMA + MIGRATIONS — persistence (needs a migration; see DECISIONS)
`server/db-schema.ts` columns (camelCase field / snake_case col):
`frntrBalanceMicro`/`frntr_balance_micro`, `frntrReadyMicro`, `frntrClaimedMicro`,
`frontier`/`frontier` (players balance), `totalFrontierEarned`, `totalFrontierBurned`,
`frontierAccumulated`, `lastFrontierClaimTs`, `frontierPerDay`, `purchasePriceFrontier`,
`askPriceFrontier`, table `pendingFrontierTransfers`/`pending_frontier_transfers` (+ its
status index).
Migrations `0000`, `0003` contain these columns/table. **Do NOT edit applied migrations**
— they're historical. Author a NEW migration (0006) with `ALTER TABLE … RENAME COLUMN`
(+ table/index rename). The drizzle `meta/0000_snapshot.json` regenerates from schema.

### 3. SERVER — logic + API contract
`server/storage/db.ts` (~117 refs) & `mem.ts` (~84): `claimFrontier`, `spendFrontier`,
`restoreFrontier`, `accumulatedFrontier`, `updateFrontierAccumulation`, all balance
math, `frntrBalanceMicro` updates, `fromMicroFRNTR`/`toMicroFRNTR`, `frontierCirculating`,
and **user-visible error strings** "Insufficient FRONTIER…" (×12+ each file).
`server/storage/game-rules.ts`: the `toMicroFRNTR`/`fromMicroFRNTR` helpers (rename here
first — imported everywhere) + row converters.
`server/storage/interface.ts`: `claimFrontier`/`restoreFrontier`/`spendFrontier` sigs.
`server/storage/seeder.ts`: column defaults.
`server/services/chain/asa.ts`: `getFrontierAsaId`/`setFrontierAsaId`/
`getOrCreateFrontierAsa`/`clawbackFrontierAsa`/`batchedTransferFrontierAsa`,
`FrontierTransferBatcher`, `FRONTIER_ASA_DECIMALS`/`FRONTIER_ASA_TOTAL_SUPPLY`,
**on-chain note prefix `FRNTR:`** (see DECISIONS). ASA metadata already "Ascend"/"ASCEND".
`server/services/chain/transferQueue.ts`: `enqueue/drain/startFrontierTransfer*`, table ref.
`server/services/chain/treasury.ts`: `fromMicroFRNTR`, `AUTO_SETTLE_THRESHOLD_FRNTR`,
`totalFrntr`/`unsettledFrntr`.
`server/services/chain/battleNotes.ts`: **on-chain note prefix `FRNTR:`** (build+parse).
`server/routes.ts`: imports of all the above; `claimFrontierActionSchema`;
**API RESPONSE CONTRACT** — `adminFrontierBalance`, `frontierAsaId`, `unitName:"FRNTR"`,
`assetName:"FRONTIER"`, `currency:"FRNTR"`, `frntrCost`/`frntrRequired`/`frntrAvailable`,
`emissionRate*`; **auth challenge** `FRONTIER-AUTH:v1:` (see DECISIONS); enqueue
`reason:"claim_frontier"`.
`server/stateScope.ts`: redaction fields `frontier`/`frontierAccumulated`/`frontierPerDay`.
`server/weapons/service.ts`: `spendFrontier`, `*CostFrntr`, response `fireCost`/`unlockCost`.
`server/veritas/`: `frontierAsaId`, `$FRNTR` strings, `VERITAS_FRONTIER_ASA_ID` env.
`server/engine/season/manager.ts`: `rewardFrontier`.
KEEP in server: auth prefix/cookie/Redis namespaces, "Frontier server", subsystem
comments (those are game-name) — see KEEP list.

### 4. CLIENT — UI display mostly DONE, identifiers NOT
`client/src/lib/algorand.ts`: `createClaimFrontierTransaction`, `FRONTIER_ASSETS`,
`unitName:"FRNTR"`, **note prefix `FRNTR:`**, `game:"FRONTIER"` payload, `frntrCost`,
`action:"claim_frontier"`, `frontierAsaId`.
`client/src/hooks/useBlockchainActions.ts`: `createClaimFrontierTransaction`,
`claim_frontier`, `frontierAsaId`, `signOptInToFrontier`/`isOptedInToFrontier`,
opt-in cache key `frontier_optin_*`.
`client/src/components/game/*`: `player.frontier`, `frontierPerDay`,
`frontierAccumulated`, `lastFrontierClaimTs`, `totalFrontierEarned/Burned`,
`mintCostFrontier`, `costFrontier`, `askPriceFrontier`, `purchasePriceFrontier`,
`useClaimFrontier`, `frntrCost`, `DRONE_MINT_COST_FRONTIER`,
`SATELLITE_DEPLOY_COST_FRONTIER`, TradeStation `"frontier"` resource key.
Display strings still showing currency-FRONTIER (rename): PredictionMarkets "$FRNTR…",
CommanderPanel "Mint a Commander (50+ FRONTIER)".
`client/tests/terraform-storage-smoke.spec.ts`: `player.frontier`, "Insufficient FRONTIER".
KEEP: game titles/logos, "the frontier" lore, NFT-relay labels.
AMBIGUOUS (decide): localStorage keys `frontier_wallet_*`, `frontier_session_token`,
`frontier_tutorial_completed`, `frontier-theme` — renaming logs users out / resets state.

### 5. DOCS — ~400 refs across 22 files (safe to edit; game-vs-token care needed)
TOKEN-heavy (highest): TOKENOMICS.md, ECONOMICS.md, GAME_MANUAL.md (59), STRATEGY_GUIDE.md
(67), session-notes/2026-03-17-frntr-emissions-test.md, …testing-economy-unlock.md,
docs/audit/chain-services-audit.md, handbook.html (29).
MIXED (game+token, careful): GLOSSARY.md ("FRONTIER / FRNTR — the game's token"),
QUICK_REFERENCE, FAQ, LORE_CODEX, TESTING_MODE, GETTING_STARTED, CHANGES, README,
DATA_RECONCILIATION, root README.md (badges), HANDOFF.md.
KEEP-heavy: ROADMAP, PRODUCTION_SETUP, MIGRATION_NOTES.
Note: ASA id `755818217` is the immutable on-chain testnet id — keep the number, only
change the surrounding "FRNTR ASA" prose.
Historical artifacts (BOMB-SQUAD/RECON/session notes describing PAST work): leave as
written; they're records, not live docs.

### 6. CLEAN (scanned, zero token refs)
`lib/` (api-zod, api-client-react, api-spec, db), `artifacts/api-server/`,
`artifacts/mockup-sandbox/`, `scripts/`, all `package.json`, tsconfig*, pnpm-workspace,
`validate-env.js` (no FRONTIER_*/FRNTR_* env vars defined). NOTE: lib/api-* is codegen
from the OpenAPI spec — if the server contract gains/renames currency fields, regenerate.

---

## DECISIONS THAT GATE A SAFE FINISH (these are breaking / hard-to-reverse)

1. **DB columns** — rename via new migration `0006` (ALTER … RENAME COLUMN; breaking,
   needs lockstep deploy) vs. keep DB column names and only rename at the code level
   (drizzle `.$type`/explicit column mapping so SQL stays `frntr_balance_micro`).
   *Recommendation: keep SQL columns, rename code-side, to avoid a prod data migration —
   OR author the migration staged-not-executed per the bomb-squad migration rule.*
2. **On-chain note prefix `FRNTR:`** (asa.ts, battleNotes.ts, client algorand.ts) — changing
   it breaks parsing of already-posted on-chain notes and must move client+server in
   lockstep. *Recommendation: keep `FRNTR:` as a stable wire tag, or bump to a versioned
   `ASCEND:`/`v2` with a parser that accepts both.*
3. **ASA identity** — testnet ASA `755818217` is already minted; its on-chain name can't be
   edited (it's now "Ascend" in source for FUTURE mints). Decide: re-mint for ASCEND
   branding pre-mainnet, or accept the existing asset.
4. **Auth signing prefix `FRONTIER-AUTH:v1:`** and **localStorage keys** — renaming these
   invalidates in-flight challenges / logs every user out. *Recommendation: KEEP (they're
   infra, not user-visible currency); or version-bump deliberately.*
5. **API contract fields** (`currency:"FRNTR"`, `frntrCost`, `frontierAsaId`,
   `claim_frontier` action/event, `TradeResource:"frontier"`) — server + client must change
   together in one release.

---

## RECOMMENDED EXECUTION ORDER (when greenlit)

1. `shared/` (schema + economy-config + weapons) — the import root.
2. `server/storage/game-rules.ts` micro-helpers, then storage/db.ts + mem.ts + interface.
3. `server/services/chain/*`, routes.ts, stateScope, weapons, veritas — in lockstep with…
4. `client/` identifiers (the display strings are mostly already ASCEND).
5. DB: staged migration per Decision 1.
6. Docs last (or in parallel — they're decoupled), respecting game-vs-token.
7. Verify each phase: `pnpm run check` (tsc catches the cross-tier breakage), `test:server`,
   `build`. tsc is your safety net — a half-rename won't compile.

Reconcile the asa.ts vs routes.ts "FRNTR/Ascend" inconsistency as part of step 3 regardless.
