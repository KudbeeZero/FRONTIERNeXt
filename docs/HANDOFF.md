# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton — ONE OPEN PR (Phase-1 PR5: resolver cadence env-config + 5s default, AWAITING_AUDIT)
- **Main:** green at **`a0bf661`** (Merge #74; `battle_tick`). Branch
  **`phase/01-resolver-cadence`** carries Phase-1 PR5. **ONE open PR** (`AWAITING_AUDIT`). **Do NOT
  auto-merge** — owner merges.
- **NOTE (owner decision):** the battle auto-resolver polled on a hardcoded `15000`ms, so a battle
  resolved up to 15s after 0:00 (the last felt lag — countdown UI + PR4 `battle_tick` already crisp).
  Owner chose (AskUserQuestion) to make it env-tunable **and tighten the default to 5s**.
- **What this unit did (for the auditor):**
  - `server/util/intervals.ts` (NEW) — pure `clampIntervalMs(raw, def, floor)`: floor + 24h ceiling +
    finite guard (unset/NaN/"0"/Infinity→def; sub-floor→floor; >24h→ceiling). +9 tests
    (`server/util/intervals.spec.ts`).
  - `routes.ts` — battle auto-resolver `}, 15000)` → `BATTLE_RESOLVE_INTERVAL_MS =
    clampIntervalMs(process.env.BATTLE_RESOLVE_INTERVAL_MS, 5000, 1000)` (default **5000**, floor
    **1000**). Retrofit PR4's `BATTLE_TICK_INTERVAL_MS` inline `Math.max(250,…)` to the same helper
    (DRY; default 1000/floor 250 unchanged).
  - Env `BATTLE_RESOLVE_INTERVAL_MS` documented in `ENV_VARS.md` + `DEPLOYMENT_ENV_CHECKLIST.md`
    (flagged player-felt). **No** combat-resolution-math/globe-canvas/schema/funds/deps. Resolver is
    idempotent + concurrency-guarded; tests call `resolveBattles()` directly so cadence change moves
    no test/CI timing.
  - Verified: `check` ✓ · `test:server` **300/11-skip** (+9 `intervals.spec.ts`) · client `test`
    **76** · `build` ✓. Manual: unset→5000; `=2000`→2000; `=100`→floored 1000.
  - **Gates (owner-requested):** `/code-review` → no findings; `/security-pass` → **PASS, 1 finding
    fixed+tested** (clamp had no upper bound → `Infinity`/`>TIMEOUT_MAX` → Node 1ms hot loop; added
    finite-guard + 24h ceiling; `docs/audit/2026-06-20-phase1-resolver-cadence-security-pass.md`);
    `/pr-gate` after CI green. Owner merges.

### Prior baton — #74 (Phase-1 PR4: server `battle_tick` broadcast) — MERGED `a0bf661`
- Gated server `battle_tick` broadcast: `storage.getActiveBattles()` + `wsServer.wsClientCount()` +
  a `routes.ts` interval that returns early when no clients/active battles, else broadcasts the
  active-battle set; client `useBattleTick()` drops elapsed-and-no-longer-active battles. Env
  `BATTLE_TICK_INTERVAL_MS` (1000/floor 250). Through `/code-review` + `/security-pass` + `/pr-gate`. CI green.

### Prior baton — #73 (Phase-1 PR3: CommanderPanel cooldown/lock drift) — MERGED `e88cdc6`
- All 9 `Date.now()` in `CommanderPanel.tsx` → `serverNow()` (satellite/drone/lock/cooldown timers).
  Through `/code-review` + `/security-pass` + `/pr-gate` (all PASS). CI green.

### Prior baton — #72 (Phase-1 PR2: GameLayout cooldown badges) — MERGED `111dbf0`
- Morale + attack-cooldown HUD badges in `GameLayout.tsx` now use `serverNow()` (drift). 1 file. CI green.

### Prior baton — #71 (Phase-1 PR1: server clock / time-sync) — MERGED `78b0991`
- **AUDIT CORRECTION carried:** the audits wrongly claimed the battle auto-resolver wasn't wired —
  `resolveBattles()` already runs every 15s (`routes.ts:2895`). PR1 instead fixed the real drift:
  a server time source (`serverClock.ts` + WS `time_sync` + `GET /api/time`) so the `BattlesPanel`
  countdown uses `serverNow()`. +5 pure tests. CI green.

### ⚖️ OWNER RULE (LOCKED) — ONE ACTIVE PR AT A TIME
**One active PR → one audit → one baton → one owner decision → then the next PR.** No stacked /
parallel / chained PRs unless the owner explicitly approves. The **owner merges**; discovered units
get **queued here**, not opened. **The 10 `phase/0X-…` branches exist as markers — a phase's PR
opens only after the prior phase merges.**

### ➡️ NEXT — Phase 1 battle-clock is COMPLETE (after PR5 merges)
Phase-1 battle-clock units all shipped: server clock (#71), HUD badges (#72), CommanderPanel drift
(#73), `battle_tick` (#74), resolver cadence (PR5). Resolver cadence is now env-tunable + 5s default;
the AI(20s)/orbital(5min) cadences remain hardcoded (env-tunable would be a trivial follow-up if wanted,
reusing `clampIntervalMs`). **Next phase: Phase 2 (`phase/02-battle-depth`)** — replay log / battle
stats. See `docs/V2_ROADMAP.md` for phases 2–10 + gates.

---

### Prior baton — #69 (faction/commander design doc) — MERGED `2d55d8a`
- Doc-only scope/design for the faction-economy + commander-progression program: current state
  (factions have identity ASAs but no wallets/treasury; admin-mnemonic custody; player↔faction
  membership already exists off-chain; commander tier = static buy-class; art mutable off-chain via
  the dynamic metadata endpoint), 5-workstream decomposition (WS-A..E, funds last + gated), PR
  sequence, 5 open owner decisions. `docs/design/faction-economy-and-commander-progression-design.md`.

### Prior baton — #68 (purchase-intent timeout reaper) — MERGED `f2a2538`
- Server-only, off-chain reaper: flips abandoned `purchase_intents` (pending past a 7d TTL, env-
  overridable, 1-min floor) to `timeout` via an `unref`'d hourly `setInterval` (ACTION_NONCE_PRUNE
  precedent). Pure `identifyStaleIntents`/`resolveTimeoutMs` + db-glue `timeoutStalePurchaseIntents`
  (never throws; preserves identity; appends `purchase_timeout`). +9 pure tests + a Postgres-gated
  `chainEventStore.db.spec.ts`. No schema/deps/chain. CI #206 green.

### Prior baton — #67 (admin SSR smoke test) — MERGED `af0e62f`
- Test-only SSR render smoke for `@/pages/admin` (existing `react-dom/server` harness; no jsdom/
  deps): proves the ADMIN_KEY entry gate renders and the gated dashboard doesn't leak pre-auth.
  CI #202 green.

### Prior baton — #66 (retro-audit #65 + baton repair) — MERGED `7eb5c32`
- Doc/audit-only: retro-audited the already-merged #65 (PASS) and repaired the stale baton.

### Prior baton — #65 (Globe pick-index + parity) — MERGED `d6f6653`
- Replaced the O(n) per-pointer-event `nearestPlot` scan with a deterministic 3D voxel-hash
  pick-index (`client/src/lib/globe/pickIndex.ts`) behind the **same signature**; selection
  resolves to the same plot (proven vs brute force). Added the load-bearing §4.1 client≡server
  Fibonacci parity test (`globe-fibonacci-parity.spec.ts`) + the equivalence/edge spec
  (`globe-pickindex.spec.ts`). 4 files under `client/` + session note. Retro-audited **PASS**
  (`docs/audits/claude-status-immediate-issues-8ltv13.md`). Deferred: the §6 `globeProjection.ts`
  screen-seam (needs a real screen-based caller — would be dead code now).

### Prior baton — #64 (loot-box DbStorage Postgres test) — MERGED `fe1c3ab`
- Retired the #60-audit risk *"DbStorage SQL path is NOT test-covered."* `lootbox.db.spec.ts`
  (real `node-postgres` + Postgres, applies `migrations/0010`) covers award / cap /
  open+vault-credit / serial **and concurrent** double-open (`FOR UPDATE` + `rowCount`) /
  `LEAST` clamp / ownership. `test:server:db` script + CI `postgres:16` service+step.
  CI integration step ran **7/7 green** (run #194); merged by owner-approved gate.

---

### Prior baton (pre-#64, retained for context)
- **Branch:** `claude/handoff-audit-jwfx7a` (off `main` @ `d5fe7d2`).
- **Audit status:** start-of-chat gate. Found the baton's `AWAITING_AUDIT`
  unit (#61, coverage gate) had been **merged by the owner before audit** (like #52) and
  #60 (loot-box) **open** as the blocker. Independently **retro-audited #61 → PASS**
  (`docs/audits/claude-ci-green-light-percentage-drvneh.md`) and **audited #60 → PASS**,
  then merged #60. A **parallel session** (`pr-60-eg7x5h`, PR #62) independently audited #60
  to the same PASS — corroboration, recorded below. Queue now clear (no open PRs but this one).
- **#61 retro-audit:** **`PASS`** (non-blocking; #61 was already merged `8dc7a72`) —
  `docs/audits/claude-ci-green-light-percentage-drvneh.md`. Independently re-derived: additive
  (tooling/CI/docs only, zero behavior change); lockfile committed + `--frozen-lockfile` clean;
  gate genuinely bites (measured **93.12%** lines, fails CI at higher thresholds run directly);
  **`include` set is honest, NOT number-gamed** (excluded modules are I/O-bound or already
  100%-covered — `random.ts`/`tuning.ts`; only `advisor.ts`'s LLM path modestly flatters).
  Reproduced `check` ✓, `coverage:server` 93.12% PASS, `test:server` 266, `test` 57. Nits
  (non-blocking): stale `~32%` comment in `vitest.server.config.ts:23` vs accurate ~22%; the
  documented negative-check repro `pnpm … -- --coverage.thresholds.lines=99` silently PASSES
  (pnpm arg-forwarding past vitest's `--`) — the gate bites only when run directly; optionally
  fold the 100%-covered `random.ts`/`tuning.ts` into the gate `include`.
- **Audit status (#60):** **`PASS` → MERGED.** The loot-box open-flow PR (#60) was
  independently audited (`docs/audits/claude-game-feature-scan-bnk4ie.md`) and merged
  `3adecc6` into `main`. The baton conflict with #61 was resolved as a union preserving
  **both** the #61 coverage-gate status (MERGED) and the #60 loot-box status.
  - **What #60 shipped:** the inert Phase-2 loot/rare-mineral economy made real — pure
    deterministic roll (`server/engine/lootbox/open.ts`), `awardLootBox`/`openLootBox`
    storage (db + mem; double-open safe; vault-capped), `POST /api/actions/open-loot-box`
    (idempotent-mutation template + ownership mw), `migrations/0010_loot_box_inventory.sql`
    (backfills the table + 4 vault columns), the `mine_action` award trigger (3%→common —
    the ONLY trigger wired), InventoryPanel Open UI, and a hydration fix
    (`game-rules.ts` no longer hard-codes `lootBoxes: []`).
  - **Audit re-ran the gates on the post-#61-merge tree (this chat):** `check` ✓ ·
    `test:server` **279** · `coverage:server` **93.12%** lines PASS · `test` **57** ·
    `build` ✓. Scope strictly additive; no chain/funds/canvas; no security defects.
    `server/engine/lootbox/**` is outside #61's coverage `include` set, so the gate is
    unaffected. **Two non-blocking CONCERNS carried forward — see Open risks.**
- **#52 retro-audit:** `CONCERNS` (non-blocking) — recorded in
  `docs/audits/feat-admin-chain-agent-dashboard.md`. #52 was merged by the owner
  *before* audit; an independent retro-audit verified every substantive claim
  (additive; pure+tested logic; admin-gated reads; fire-and-forget recorder that
  cannot break the purchase; `/admin` lazy-loaded) and reproduced **test:server 252,
  test 55, check clean**. Only nits: an undisclosed 9th session-note file, and a
  "no-ops without a DB" guard that is effectively dead code (server can't boot
  without `DATABASE_URL`; real safety is the try/catch). No security/behavioral defect.
- **➡️ NEXT AUTHORIZED UNIT (queued, pick one):** the dashboard follow-ups
  (commander-mint instrumentation; the `purchase_intents.timeout` reaper; a
  DOM-based admin render test) — or the Globe/Story-mode units below. One unit, one PR.
- **Recent merges (newest first):**
  - **#60** — **loot-box open flow + mining award trigger** (code). **MERGED** `3adecc6`.
    +730/−49, 17 files: pure roll `server/engine/lootbox/open.ts` (+13 tests),
    `awardLootBox`/`openLootBox` storage (db + mem), `POST /api/actions/open-loot-box`,
    `migrations/0010_loot_box_inventory.sql`, `mine_action` 3%→common trigger, InventoryPanel
    Open UI, hydration fix. **Audited PASS** (`docs/audits/claude-game-feature-scan-bnk4ie.md`):
    check ✓, test:server **279**, coverage:server **93.12%** PASS, test **57**, build ✓.
    Additive; no chain/funds/canvas; no security defects. Deferred: `battle_victory` (25%) /
    `orbital_impact` (50%) triggers (gated paths); loot-box→NFT minting (funds).
  - **#61** — **CI coverage gate (deterministic game-math core ≥ 80%)** (tooling/CI/docs).
    **MERGED** `8dc7a72` (commit `2505917`). Adds `@vitest/coverage-v8@4.1.6`, a v8 coverage
    block in `vitest.server.config.ts` scoped to the game-math core (`shared/weapons/**`,
    `shared/university/**`, `shared/economy-config.ts`, `shared/weapon-economy.ts`,
    `server/engine/{battle,markets}/resolve.ts`) at lines/stmts/funcs 80, branches 70; the
    `coverage:server` script; a CI step; `docs/COVERAGE_GATE.md`. **HONEST FLAG:** gate covers
    the game-math core ONLY (whole server/shared ~22% via `coverage:server:full`, informational —
    NOT a global-80% claim; client not gated). No game/chain behavior change. **Retro-audited
    PASS** (`docs/audits/claude-ci-green-light-percentage-drvneh.md`) — was merged pre-audit.
  - **#53** — **Strike System design spec v0.1 + Clerk admin layer** (doc-only). **MERGED**
    `714bdb8` (merge `032c6ff`). Added `artifacts/frontier-al/docs/design/strike-system-design.md`
    — code-grounded; corrects the draft's unverified claims. No code/schema/config; CI green;
    check ✓, test:server 244/244, test 55/55, Cloudflare deploy ✓. **Design only — the strike
    system is NOT built; every gameplay number is PROPOSED/untested.**
  - **#52** — **chain-event audit trail + purchase dashboard charts** (code). **MERGED**
    `272656d` (merge `ca240d9`). +678/−2: `migrations/0009_chain_events.sql`, `chain_events`
    + `purchase_intents` Drizzle defs, pure `chainEventLog.ts` (+8 tests), `chainEventStore.ts`
    (fire-and-forget recorder), 2 admin-gated reads, admin dashboard charts, `/admin` lazy.
    Retro-audited **CONCERNS** (see above). test:server **252**, test 55.
  - **#49** — **purchase monitor + admin dashboard AUDIT** (doc-only, single file). **MERGED**
    `6ec8bb5`. Added `artifacts/frontier-al/docs/audit/2026-06-16-purchase-monitor-admin-dashboard-audit.md`
    (14-section read-only audit + scoped baton). No code/schema/config touched; CI green;
    server 244/244, client 55/55, typecheck clean.
  - **#45** — globe **scope brief** (doc-only). **MERGED** + **retro-audited PASS**. The
    audit record lives on branch **`audit/rdpbfi-retro`** (`docs/audits/claude-multi-agent-dev-plan-rdpbfi.md`,
    pushed as a record — **no PR**, to keep the one-open-PR invariant). Added
    `artifacts/frontier-al/docs/globe/SCOPE_BRIEF.md` + a session note. Honest flag carried:
    **no client≡server Fibonacci parity test yet** (top item if globe work resumes).
  - **#38** Aether Ch.1 voice+music pipeline — **MERGED** `3a1ef2e` (⚠️ not audibly/browser
    verified). **#39** license/typecheck hygiene — **MERGED** `24e339b`. **#37/#36** Aether
    Phase-1 — **MERGED**.
- **Other origin branches (FYI):** `audit/rdpbfi-retro` (the #45 retro-audit **record**, no
  PR — leave as-is); `test/gamelayout-entry-state` (another agent's experiment — unknown);
  `wip/atomic-purchase` (**OFF-LIMITS — do not merge**).

## Repo state (verified this chat, HEAD `af0e62f` + open reaper PR)
- `pnpm --filter @workspace/frontier-al run check` (tsc) → **green**; `test:server` →
  **288 pass / 11 skipped** (with the reaper unit: +9 pure tests; +4 Postgres-gated db tests that
  skip without `DATABASE_URL`); `test:server:db` → **11 pass** against real Postgres; `test`
  (client) → **71 pass / 13 files**; `coverage:server` **93.12%** lines PASS; `build` ✓.
- three.js is **code-split**; `/admin` is lazy-loaded (its own `admin-*.js` chunk).
- Globe pick-index + parity **DONE** (#65); admin SSR smoke **DONE** (#67); only the §6
  `globeProjection.ts` screen-seam remains deferred (see NEXT, above).

## Other candidate units (pick ONE; one unit, one PR)
- **#52 dashboard follow-ups** (from the retro-audit, all additive/testnet-only): commander-mint
  instrumentation (only `/api/actions/purchase` is wired today); the `purchase_intents.timeout`
  reaper (state defined, never set); a DOM-based `admin.tsx` render test (current client suite is
  SSR-only). Reuse `chainEventStore.recordPurchaseTransition` + the existing admin-gate.
- **Strike system** is now SPEC'd (`artifacts/frontier-al/docs/design/strike-system-design.md`)
  but NOT built — a future multi-unit build (damage must route through the `db.ts` parcel writer;
  any new mutating route must join `MUTATION_PATH_RE`, `routes.ts:498-518`). All its numbers are
  PROPOSED/untested. Do not start without an explicit go.

## Queued (one unit each, after the dashboard unit)
- **Globe:** pick-index + Fibonacci parity test **DONE** (merged #65). Remaining: land
  `client/src/lib/globe/globeProjection.ts` (the brief's §6 `worldToScreen`/`surfaceHit` seam)
  **with** the combat package that consumes it (standalone now = dead code).
  Alt: `feat/globe-mission-layer` (additive overlay; nullable schema).
- **Story mode:** reconcile `apps/aether-journey/src/data/dialogue.ts` to the Ch.1 script +
  assign `voiceId` to the remaining 14 VO lines; voice-regen CI workflow (needs repo secrets).
- **frontier-al (carried):** `feat/hud-desktop-nav`; v11 glass info panels on real data;
  `feat/rate-limit-actions`; idempotency for `/api/sub-parcels/:id/build`; algod-first finality
  in `verifyAlgoPayment` (**funds → `algo-auditor` + `/security-pass`**).

## Open risks / honest flags
- ✅ **(#60 loot-box) DbStorage SQL path test-backed — RESOLVED & CLOSED (#64 MERGED `fe1c3ab`).**
  `server/storage/lootbox.db.spec.ts` (real `node-postgres` + Postgres, applies `migrations/0010`)
  covers the `FOR UPDATE` lock, conditional-`UPDATE`-on-`rowCount` double-open guard (serial +
  concurrent), `LEAST(...)` cap, and in-tx cap count. The CI "DbStorage integration tests" step
  ran **7/7 green** (run #194): migration applied cleanly on the `postgres:16` service, concurrent
  two-connection open not flaky, and `test:server` showed the block **skipped** (no `DATABASE_URL`
  leak). #64 is merged → fully closed.
- ⚠️ **(#60 loot-box) migration `0010_loot_box_inventory.sql` must be applied before any deploy**
  that uses DbStorage (staged, not run at boot). Extends the "migrations 0000–0008 must be
  applied" rule to **0010** (0009 chain_events also pending).
- ⚠️ **Aether's Journey NOT audibly/browser-verified** — typecheck/build/generator only.
  `eleven_v3` is alpha; takes are first-pass (recasting Sarah invalidates all 15 clips).
- ⚠️ **REC-004 `AGENT_ORCHESTRATION_LEDGER.md`** — flagged ABSENT on `main` in a prior baton;
  **not re-verified this chat.** Confirm before relying on it.
- ⚠️ **Duplicate baton:** a stale root `HANDOFF.md` (#37-era) still sits beside this canonical
  `docs/HANDOFF.md`. Treat **`docs/HANDOFF.md` as authoritative**; clean up the root copy in a
  later unit.
- (Purchase flow, from #49 audit) NFT delivery can desync after a confirmed payment with
  manual-only recovery (`routes.ts:1929`); payment→plot link is console-log only
  (`routes.ts:1834`); client hardcoded treasury fallback (`algorand.ts:241`); `verifyAlgoPayment`
  pins no genesis-hash. Details in the #49 audit doc §6/§12.
- (Carried, frontier-al) replay protection lasts the TTL; no rate limit on `/api/actions/*`;
  migrations `0000`–`0008` must be applied before deploy; `verifyAlgoPayment` finality is
  indexer-only; confirm `VITE_TEST_GLOBE` reads `false` before deploy.

## Off-limits
- Do not change globe/combat/canvas render behavior off-hand — only via a scoped, audited unit.
  No funds/ASA/transfer code to mainnet without `/mainnet-gate` **and** `algo-auditor`; do not
  merge `wip/atomic-purchase`; nothing in `ops/kestra/` may point at mainnet. Do not reintroduce
  mock/demo data into plot/HUD surfaces.
