# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton
- **Branch:** `claude/game-feature-scan-bnk4ie` (off `main` @ `8dc7a72`, after #61).
  **One open PR — AWAITING AUDIT.**
- **Audit status:** `AWAITING_AUDIT` — the loot-box open-flow PR (below) needs the
  next chat's `/handoff-audit` before merge. Do NOT start a new unit until it lands.
- **➡️ THIS PR — Loot Box Open Flow + Mining Award (code).** Finishes the inert
  Phase-2 loot/rare-mineral economy: pure deterministic roll
  (`server/engine/lootbox/open.ts`), `awardLootBox`/`openLootBox` storage (db + mem,
  double-open safe, vault-capped), `POST /api/actions/open-loot-box`,
  `migrations/0010_loot_box_inventory.sql` (backfills the table + 4 vault columns that
  had no numbered migration), the `mine_action` award trigger (3%→common — the ONLY
  trigger wired), and InventoryPanel Open UI. Also fixed a hydration bug
  (`game-rules.ts` hard-coded `lootBoxes: []`). **Green:** check ✓, test:server **279**
  (+13), test **57**, build ✓. Note:
  `session-notes/2026-06-18-loot-box-open-flow.md`. Deferred: `battle_victory` /
  `orbital_impact` triggers (gated combat/orbital paths); loot-box→NFT minting (funds).
- **Merge note:** `main` advanced to `8dc7a72` (#61 CI coverage gate, now MERGED — see
  Recent merges). This branch was merged up to that tip; the only collision was this
  baton's `## Current baton` section (docs-only — no code/schema/test overlap). The
  audit chat should re-run `check` / `test:server` (now incl. the coverage gate) /
  `test` / `build` post-integration. #61's gate `include` set does NOT cover
  `server/engine/lootbox/open.ts`, so no coverage-gate risk from this PR.
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
  - **#61** — **CI coverage gate (deterministic game-math core ≥ 80%)** (tooling/CI/docs).
    **MERGED** `8dc7a72` (commit `2505917`). Adds `@vitest/coverage-v8@4.1.6`, a v8 coverage
    block in `vitest.server.config.ts` scoped to the game-math core (`shared/weapons/**`,
    `shared/university/**`, `shared/economy-config.ts`, `shared/weapon-economy.ts`,
    `server/engine/{battle,markets}/resolve.ts`) at lines/stmts/funcs 80, branches 70; the
    `coverage:server` script; a CI step; `docs/COVERAGE_GATE.md`. **HONEST FLAG:** gate covers
    the game-math core ONLY (whole server/shared ~22% via `coverage:server:full`, informational —
    NOT a global-80% claim; client not gated). No game/chain behavior change.
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

## NEXT chat — candidate units (pick ONE; one unit, one PR)
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
