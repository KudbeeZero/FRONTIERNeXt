# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton — NO OPEN PRs · main `#141` head · deploy LIVE · tractable roadmap COMPLETE
- **Last shipped (#141, merged):** baton + PUBLIC-DOCS refresh (docs only) — player-facing docs now cover
  this session's work: root `README.md` (front-door bullet), `frontier-al/README.md` (What's New
  "Battle Theater & Fairness" + the new battle/stats/proof API endpoints), `FAQ.md` (provable-fairness +
  cinematics Q&A), `GAME_MANUAL.md` (Ch.14 "Battle Theater" + "Provable Fairness").
- **Main:** green; CI green on every merged head. Local CI-parity: `check` clean, **server 375** passed/14
  skipped, **client 168** passed, `build` ✓.
- **✅ The tractable battle-depth roadmap is DONE end-to-end** (cinematic + stats + durable history +
  provable fairness). What remains needs OWNER input, not more code:
  - **(a) Cryptographic-commitment seed scheme** — store `sha256(seed)` at battle deploy, reveal later, so
    randomness is unpredictable even to the server pre-battle. A schema + RNG design change → explicit owner
    go (the current proof uses the public `hashSeed(id, startTs)` derivation rule).
  - **(b) Device smoke-test** of the cinematic visuals/audio — NONE browser-verified; every pure mapping is
    test-pinned. See `artifacts/frontier-al/docs/BATTLE_CINEMATICS_SMOKETEST.md`.
  - **(c) Apply migration 0011** (`psql -f` / `db:push`) so replays persist past Redis's 24h TTL.
- **🆕 VERITAS provable-fairness for BATTLES (PRs #139–#140):**
  - **#139** pure `verifyBattleProof` (re-uses the REAL resolver, no drift) + public `GET /api/battle/:id/proof`
    (re-derives seed → confirms recorded randFactor + outcome; +6 tests).
  - **#140** veritas CLI `battle` flow — sources a resolved battle from `/api/battles/history`, fetches the
    proof, and independently re-derives + cross-checks the hash. Registered in `flows/index.ts`.
- **🆕 PHASE-2 BATTLE-DEPTH batch (PRs #134–#138)** — on top of the complete cinematic system, the battle
  layer now has real stats + durable history + UI surfacing, all server-side test-backed where it counts:
  - **#134** `computeCommanderStats` + `GET /api/players/:id/commander-stats` (pure aggregator, +tests).
  - **#135** `topCommanders` + bounded `getRecentResolvedBattles` + `GET /api/commanders/leaderboard` (top-killers).
  - **#136** battle replay → **Postgres persistence** (migration **0011** `battle_replays`; fire-and-forget
    on a non-tx connection so it can't break resolution; Redis→Postgres read fallback; gated DB spec).
    ⚠️ **Apply migration 0011** (`psql -f` / `db:push`) for replays to persist; build is safe before that.
  - **#137** commander combat record in **CommanderPanel** (pure `formatCommanderRecord` + thin component).
  - **#138** global **Top Commanders** board in **LeaderboardPanel** (`shortCommanderId` + self-hiding component).
- **Cinematic system (PRs #122–#132) — COMPLETE:** engine → modal → globe → randFactor → callout → faction
  colour → incoming telegraph → reduced-motion → camera (#131) → sound (#132).
- *(veritas BATTLE verification — now DONE in #139–#140; see above. Remaining veritas work = the
  cryptographic-commitment scheme, item (a), which needs owner go.)*
- **🆕 Shipped this chat — the BATTLE SEQUENCE SYSTEM (PRs #122–#132; #121 aether dock alongside):**
  a battle is now one *connected* cinematic — a pure, deterministic **10-beat** timeline
  (`shared/battle-sequence.ts`: muster → lock → launch → transit → brace → impact → clash → swing →
  resolve → aftermath) that the **watch modal**, the **globe**, and a **HUD callout** all drive off ONE
  clock. Built out across 8 PRs:
  - **#122** engine + watch-modal playback + on-globe cinematic (arc/impact/ring/capture); the modal's
    fabricated mock feed now runs only for *live* battles.
  - **#123** real `randFactor` to the globe via a new `battle:resolved` client bus → data-driven swing beat.
  - **#124** HUD callout ticker (the verbal telegraphy) on a shared cinematic bus.
  - **#125** faction-identity colour on the capture burst/arc.
  - **#127** pre-resolution "incoming attack" telegraph (reticle builds on the defender plot pre-impact).
  - **#128** battle-cinematics toggle + OS reduced-motion respect (static fallbacks).
  - **#126** closeout/session note; **#129** owner smoke-test guide
    (`artifacts/frontier-al/docs/BATTLE_CINEMATICS_SMOKETEST.md`).
  - **+~70 tests** (engine determinism/gapless-10-beat/swing-flip; adapter; playback; faction colour;
    incoming-telegraph; cinematics gate). All **pure logic** test-pinned.
  - ⚠️ **R3F globe layers + DOM HUD/modal are NOT browser/GPU-verified here — this is the one gate left.**
    Owner smoke-test per the guide above (open a resolved battle in the modal; watch one resolve on the
    globe). No funds/chain/schema change; the only server-touching item (#123) just *consumes* a message
    the server already broadcast. Session note: `…/session-notes/2026-06-24-battle-sequence-engine.md`.
  - ✅ **Camera-follow (#131) + sound cues (#132) now DONE** — the planned cinematic queue is complete.
  - ➡️ **The real remaining gate is OWNER VERIFICATION**, not more code: smoke-test on the preview per
    `artifacts/frontier-al/docs/BATTLE_CINEMATICS_SMOKETEST.md` (enable Cinematic Camera + Battle Sound in
    globe settings to see/hear those two). Report any beat that looks/sounds off → it maps to one module.
    Genuinely-open future ideas (only if wanted): server-side replay persistence; commander-specific cues.
- **🛑 OWNER DIRECTIVE:** this chat the owner explicitly authorised the build+merge `/loop` (merging
  directly). The **default remains owner-reviews/merges**; do not self-merge in future chats without a
  fresh explicit go.

### Prior baton — main `bad11d4` (#101 globe v2 rebuild) — SUPERSEDED
- Was green at **`bad11d4`**; CI-parity: `check` clean, server **336**/11-skip, client **107**.
- **Shipped + merged THIS chat:** **#101** — `globe/v2/` rebuilt from the recovered `REBUILD_NOTES`:
  ONE world-space sun (`sunModelV2`) → real terminator, driving `PlanetSurfaceV2` / `PlotTilesV2`
  (21k instanced, GPU terminator) / `AtmosphereV2` (blue rim) / `SunV2` / `PlanetGlobeV2` (+ layer
  debug panel); `planetDataV2` data layer; standalone `globe-rebuild-preview.html` harness; 9
  lighting-core tests. Plus `/code-review` fixes: surface **ACES + sRGB** encoding, **linear-space**
  tile night-dim, `SUN_GLSL` wired into both shaders (no terminator drift).
  - ⚠️ **v2 is NOT wired into the live app** (old `PlanetGlobe` is still the default) and the **GLSL is
    typecheck/build-verified but NOT GPU-verified** — owner smoke-tests `/globe-rebuild-preview.html`
    (live on the Cloudflare branch preview) before v2 can replace the old globe.
- **Prior session (live-ops / deploy + globe + wallet firefighting):** #85–#93 (details below). App **2.0.0**.

### ⚙️ DEPLOY STATE — LIVE (not a blocker anymore)
- **Backend:** Fly app **`frontiernext`** (`frontiernext.fly.dev`) is **up + seeded** — `/health`,
  `/api/blockchain/status`, `/api/game/state` all **200** (world auto-seeded: 21k plots + 4 factions).
  Fly secrets set: `DATABASE_URL`, `SESSION_SECRET`, `PUBLIC_BASE_URL`, `ALGORAND_ADMIN_*`, `CLIENT_ORIGIN`.
  DB schema applied via the **#86 DB-Push** workflow (needs repo secret `DATABASE_URL`).
- **Frontend:** Cloudflare Pages **`frontieralgo`** → `frontierprotocol.app`. Its Vite env
  **`VITE_API_URL` + `VITE_WS_URL` = `https://frontiernext.fly.dev`** (points the browser straight at
  Fly — we abandoned routing through `api.frontierprotocol.app` because that custom host needs a Fly
  TLS cert and kept 530/525-ing). `CLIENT_ORIGIN` on Fly lists the frontier origins so CORS passes.
- ⚠️ **OPS — keep `SESSION_SECRET` STABLE across deploys.** Rotating it invalidates all live session
  tokens (WS `1008` → forces every user to re-sign). #90 self-heals (clear+re-auth) but don't churn it.
- ⚠️ The `*.pages.dev` **preview** builds have NO backend env → "CONNECTION ERROR." Use the real site.
- ⚠️ `growverse-api.fly.dev` is a **different** app (GROWv2) — never point FRONTIER at it.

### 🌐 GLOBE / WALLET STATE (cosmetic + auth, all merged)
- **Globe:** moon/station/asteroid + atmosphere glow **removed**; background **black**; planet
  brightness ×1.4→**×2.6** (terrain is UNLIT — that multiplier *is* the brightness; lights/"sun" do
  nothing); biome-colored tiles (original look); **PLOT #N hover popup** kept; the two plot cards
  (`SelectedPlotPanel` + `LandSheet`) **hidden on mobile** (desktop unchanged).
- **Globe v2 (NEW, #101, parallel — NOT live):** `globe/v2/` is a clean re-lit stack (real terminator,
  no magenta corona, no double-darkening). It is **not** wired in — the live globe is still the UNLIT
  ×2.6 old stack above. v2 fixes are the proper answer to "planet looks dark," pending owner GPU check.
- **Wallet picker = Pera + Lute** (`walletManager.ts`; dropped Defly + Kibisis). **Lute = desktop
  browser EXTENSION** ("not available in Safari") → desktop/owner's funded wallet. **Pera = mobile**
  (needs the Pera app installed on the phone). #90 fixed the WS auth-reject death-loop.
- ⚠️ **Unverified by the agent (no browser/GPU here):** the live globe brightness and the mobile
  wallet connect are owner-verified only. Owner reported the planet still looked dark and the picker
  opened many tabs (4-wallet deep-link storm); narrowing to Pera+Lute + ×2.6 is the latest attempt.
  **If Pera still spawns tabs on mobile → investigate the connect loop (deep-link/auto-auth), not the
  wallet list.**

### 🔑 TESTNET WALLETS (TESTNET ONLY — rotate before mainnet; never committed)
Admin + 4 faction (NEXUS-7/KRONOS/VANGUARD/SPECTRE) testnet accounts generated this session, handed to
the owner in chat → Fly secrets only. **Code still uses single-admin custody** until the gated wiring unit.

### ➡️ NEXT UNITS (queued; one PR each, OWNER MERGES)
0. **Globe v2 wire-in (only after owner GPU-confirms the preview):** mount `PlanetGlobeV2` in
   `GameLayout` behind a flag (default OFF → old globe), add a `mock` opt-in guard to `planetDataV2`
   so a live mount can't silently render fake biomes, then port the old-globe overlays (HUD, battle
   arcs, live events, observer/replay) onto the v2 stack. Cosmetic/UI; no funds/chain code.
1. **Animated plot menu** off the PLOT #N popup — tap a plot → zoom-to-plot animation → card with
   working **buy/upgrade** buttons. (Cosmetic/UI; the popup is the entry point already in place.)
2. **Entry overhaul (GATED — economy):** remove the wallet wall (`GameLayout.tsx:765`) + welcome
   message → login → **accept ASCEND ASA**, AND **kill the 500-ASCEND welcome bonus**
   (`maybeGrantWelcomeBonus` `routes.ts:395` + the `:1255` path). Funds/economy → `/security-pass`.
3. **Hybrid login (design-doc first):** API/account login → then link an Algorand wallet. Custody-
   adjacent → extend the faction-economy custody design before any code.
4. **Faction-wallet custody wiring (GATED):** 4 faction mnemonics → per-faction custody/settlement.
   `/security-pass` + `/mainnet-gate` + `algo-auditor`, testnet-first.
5. Carryover: **SD-A1** (`data_centre` `yieldMultiplier` into mining); Phase-2 leftovers (battle-stats
   client wire-up, commander stats/leaderboard, veritas, replay-log Postgres persistence).

### Prior baton — #80 (living-map telemetry boxes) — MERGED `e7da9e1`
- `GlobeLiveEvents` R3F layer + pure `liveEventDisplay` (+7 tests): live `battle_resolved`/`land_claimed`
  pop `<Html>` boxes on the globe. `/code-review` clean + `/security-pass` PASS + `/pr-gate` GO. CI green.

### Prior baton — ONE OPEN PR (Phase-2 PR2: player battle-stats aggregator + endpoint, AWAITING_AUDIT)
- **Main:** green at **`3ce61cd`** (Merge #76; replay log). Branch **`phase/02-battle-stats`** carries
  Phase-2 PR2 (#77). **Do NOT auto-merge** — owner merges.
- **NOTE:** owner said to continue through the next Phase-2 features (`V2_ROADMAP.md:37` "stats +
  commander performance tracking"). Existing surfaces cover totals (`/api/game/leaderboard`,
  `/api/battles/history`, player `attacksWon/Lost` + commander `totalKills`); **the gap** = no per-player
  derived battle-stats aggregator/endpoint.
- **What this unit did (for the auditor):**
  - `server/storage/battle-stats.ts` (NEW) — pure `computePlayerBattleStats(battles, playerId)` (mirrors
    `computeLeaderboard`): `attacks{total,wins,losses,winRate}`, `defenses{total,held,lost,holdRate}`,
    `currentStreak{kind,count}`, `totals{troops,iron,fuel}`, `biggestVictory|null`, `recent[]` (≤10).
    Integer percents, divide-by-zero guarded. Only already-public data (powers/counts/battleId — battleId
    already in `/api/battles/history`); no addresses/player/parcel UUIDs. +9 tests (`battle-stats.spec.ts`).
  - Storage `getPlayerBattles(playerId)` — `interface.ts` + `db.ts` (resolved + attacker|defender; added
    `or` to drizzle import; reuses `attackerIdx`/`defenderIdx`) + `mem.ts`.
  - `GET /api/players/:id/battle-stats` in `routes.ts` (mirrors `/api/battles/history`:
    `withDbRetry` → `getPlayerBattles` → `computePlayerBattleStats`). Public read.
  - **Read-only + additive. No schema/migration/client/canvas/funds/resolution-math change.**
  - Verified: `check` ✓ · `test:server` **318/11-skip** (+9 `battle-stats.spec.ts`) · client `test`
    **76** · `build` ✓. Manual (server+PG, not run here): `GET /api/players/<id>/battle-stats` → shape;
    no-battles → zeroed.
  - **Gates (owner-requested):** `/code-review` + `/security-pass` (→ `docs/audit/`; public read, no
    address/secret leak) + `/pr-gate`. Owner merges.

### Prior baton — #76 (Phase-2 PR1: deterministic battle replay log) — MERGED `3ce61cd`
- Replaced the main resolver's coarse 3-line replay log with a pure `buildReplayLog`
  (`server/engine/battle/replayLog.ts`): composition + terrain/fortifications + engine resolution log
  (spread) + aftermath; wired into the Redis replay record in `storage/db.ts`. No schema/client/canvas/
  funds/math change (`BattleWatchModal` already renders `replay.log`). `/code-review` (no findings) +
  `/security-pass` (PASS, no findings — no address/UUID leak, test-pinned;
  `docs/audit/2026-06-20-phase2-replay-log-security-pass.md`) + `/pr-gate` (GO). CI green on head.

### Prior baton — #75 (Phase-1 PR5: resolver cadence env-config + 5s default) — MERGED `604c74d`
- Battle auto-resolver `15000` → `BATTLE_RESOLVE_INTERVAL_MS` (default 5000, floor 1000) via new pure
  `server/util/intervals.ts` `clampIntervalMs` (floor + 24h ceiling + finite guard); retrofit PR4's
  `BATTLE_TICK_INTERVAL_MS` to the same helper. `/code-review` (no findings) + `/security-pass` (PASS,
  1 upper-bound fail-open fixed+tested — `docs/audit/2026-06-20-phase1-resolver-cadence-security-pass.md`)
  + `/pr-gate` (GO). CI green on head. **Phase 1 (battle clock) COMPLETE.**

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

### ➡️ NEXT — Phase 2 (battle depth) IN PROGRESS
Phase 1 (battle clock) COMPLETE (#71–#75). Phase 2: PR1 replay log MERGED (#76); PR2 player
battle-stats aggregator + endpoint is this open PR. **Remaining Phase-2 units (one PR each, after this
merges):** (a) **client wire-up** — consume `/api/players/:id/battle-stats` in a combat-record surface
+ surface commander `totalKills` in `CommanderPanel`; (b) commander stats/leaderboard
(`computeCommanderStats` + top-killers); (c) veritas battle-verification flow (scaffolded, market flow
done); (d) persist the replay log to Postgres for >24h history (schema → own audited unit). Optional
carry-over: route the AI(20s)/orbital(5min) cadences through `clampIntervalMs`.
See `docs/V2_ROADMAP.md` for phases 2–10 + gates.

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
