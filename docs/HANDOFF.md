# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton
- **Branch:** `claude/project-next-steps-seoay7` (off `main` @ `e3a916c`). **ONE open
  PR — #64** (`AWAITING_AUDIT`): a **test-only** Postgres integration test for the
  loot-box DbStorage SQL path. Audit it next chat with `/handoff-audit` (PASS → merge +
  start the next unit: **Globe pick-index + parity**, per the owner's direction).
- **What this chat did (for the auditor):** Retired the #60-audit open risk
  *"DbStorage SQL path is NOT test-covered."* Added `server/storage/lootbox.db.spec.ts`
  — real `node-postgres` + real Postgres, applies `migrations/0010` over a minimal
  `players` stub, and covers award / inventory cap / open+vault-credit / serial **and
  concurrent** double-open (real `FOR UPDATE` + `rowCount` guard) / `LEAST` vault clamp /
  ownership `not_found`. Added a `test:server:db` script + a CI `postgres:16` service and
  a dedicated step so it runs in CI; `test:server` stays DATABASE_URL-free so MemStorage
  tests are unchanged. **No production code change, no new dependency, no lockfile change.**
  Verified locally: `check` ✓ · `test:server` **279 pass / 7 skipped** · `test:server:db`
  (local PG16) **7 pass** · `coverage:server` **93.12% PASS (unchanged — db.ts is outside
  the gate include set)** · client `test` **57** · `build` ✓.
  - **Why a real Postgres, not PGlite:** the drizzle pglite driver does not populate
    `rowCount`, which the double-open guard depends on — pglite would make the first open
    wrongly return `already_opened`. The block is `skipIf(!DATABASE_URL)` + dynamic
    `import("./db.js")` so the no-DB suite skips without touching db.ts's module load.
  - **Auditor focus:** confirm the **CI integration step itself is green** on the head
    commit (that's where the 7 tests run; `test:server` shows them skipped); confirm scope
    is test-only/additive.

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

## Repo state (verified this chat, HEAD `ca240d9`)
- `pnpm --filter @workspace/frontier-al run check` (tsc) → **green**; `test:server` →
  **252/252 pass** (was 244; +8 from #52 `chainEventLog.spec.ts`); `test` (client) →
  **55/55 pass**.
- `pnpm run typecheck` (root) → green (mockup-sandbox excluded).
- three.js is **code-split**; `/admin` is now lazy-loaded (its own `admin-*.js` chunk).

## NEXT chat — after #64 is audited & merged
- **Globe pick-index + parity** (owner-directed next unit): `perf/globe-pick-index` — replace
  the O(n) `nearestPlot` scan (`GlobeParcels.tsx:100`) with a spatial index behind the **same
  signature**; land `client/src/lib/globe/globeProjection.ts` (`SCOPE_BRIEF` §6 seam); **add
  the missing client≡server Fibonacci parity test** (§4.1/§7).

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
- **Globe:** `perf/globe-pick-index` — replace the O(n) `nearestPlot` scan
  (`GlobeParcels.tsx:100–109`) with a spatial index behind the **same signature**; land
  `client/src/lib/globe/globeProjection.ts` (the brief's §6 `worldToScreen`/`surfaceHit` seam);
  **add the missing client≡server Fibonacci parity test** (`SCOPE_BRIEF.md` §4.1/§7).
  Alt: `feat/globe-mission-layer` (additive overlay; nullable schema).
- **Story mode:** reconcile `apps/aether-journey/src/data/dialogue.ts` to the Ch.1 script +
  assign `voiceId` to the remaining 14 VO lines; voice-regen CI workflow (needs repo secrets).
- **frontier-al (carried):** `feat/hud-desktop-nav`; v11 glass info panels on real data;
  `feat/rate-limit-actions`; idempotency for `/api/sub-parcels/:id/build`; algod-first finality
  in `verifyAlgoPayment` (**funds → `algo-auditor` + `/security-pass`**).

## Open risks / honest flags
- ✅ **(#60 loot-box) DbStorage SQL path now test-backed** — PR **#64** (`AWAITING_AUDIT`)
  adds `server/storage/lootbox.db.spec.ts` (real `node-postgres` + Postgres, applies
  `migrations/0010`) covering the `FOR UPDATE` lock, conditional-`UPDATE`-on-`rowCount`
  double-open guard (serial + concurrent), `LEAST(...)` cap, and in-tx cap count. Runs in CI
  via a `postgres:16` service. **Pending audit confirmation that the CI integration step is
  green** before this risk is fully closed.
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
