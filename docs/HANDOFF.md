# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton
- **Branch:** `claude/strike-system-design-spec-jan40c` — **AWAITING_AUDIT**.
- **PR:** [#53](https://github.com/KudbeeZero/FRONTIERNeXt/pull/53) — Strike System
  design spec v0.1 + Clerk admin layer (doc-only, `artifacts/frontier-al/docs/design/strike-system-design.md`).
- **Audit status:** `AWAITING_AUDIT` — PR #53 open, CI running (doc-only; local gates were
  green: check ✓, test:server 244/244, test 55/55).
- **⚠️ TWO PRs OPEN:** PR #52 (`feat/admin-chain-agent-dashboard`) is also open and
  AWAITING_AUDIT. User confirmed PR #53 should be opened; user will handle #52. The
  one-open-PR invariant is technically broken — resolve by auditing/merging one before
  starting any new work.
- **➡️ NEXT AUTHORIZED UNIT:** Audit and merge **both** open PRs before starting anything new.
  Suggested order: audit #52 first (it is a code PR, more critical to review), then #53 (doc-only).
  Only after both are resolved may a new unit begin.
- **Recent merges (newest first):**
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

## Repo state (verified this chat)
- `pnpm --filter @workspace/frontier-al run check` (tsc) → **green**; `test:server` →
  **244/244 pass**; `test` (client) → **55/55 pass**.
- `pnpm run typecheck` (root) → green (mockup-sandbox excluded).
- three.js is **code-split** (three ~687 kB + r3f ~369 kB chunks).

## NEXT chat — `feat/admin-chain-agent-dashboard` (the authorized build unit)
- **Read first:** `artifacts/frontier-al/docs/audit/2026-06-16-purchase-monitor-admin-dashboard-audit.md`
  — **§14 is the implementation baton**; §9–§11 list the exact files/DB/tests. The buy flow
  is **real and live** (`POST /api/actions/purchase`, `routes.ts:1765`); canonical term is
  **`parcel`** (`plot`/`plotId`). Admin dashboard exists at `client/src/pages/admin.tsx`
  (ADMIN_KEY-gated, text cards only); `recharts ^2.15.2` is already installed +
  `client/src/components/ui/chart.tsx` is a ready, unused wrapper.
- **Scope (one PR, additive, testnet/devnet only — no mainnet):**
  - additive `chain_events` + `purchase_intents` migration (new `0009_*.sql`; Drizzle defs
    matching the `redeemed_payments`/`action_nonces` style; nullable-tolerant)
  - emit `chain_events` at the **existing** purchase transition points in `server/routes.ts`
    (`:1796,:1811,:1827,:1901,:1924,:1936`) — pure instrumentation, no behavior change
  - admin-gated reads `GET /api/admin/chain-events` + `/api/admin/purchase-metrics`
    (`requireAdminKey`; funnel counts derivable from `chain_events`)
  - `/admin` Analytics tab: chain-health cards + purchase-funnel/transaction-status charts
    (recharts via `ui/chart.tsx`) + recent-events table (`ui/table.tsx`) — reuse existing styling
  - tests: server (events emitted + metrics aggregate + admin-gate) and client (admin renders
    metrics / empty / failed-fetch). **No fix without a test.**
- **Explicitly OUT of scope** (separate later units / gated): purchase status-timeline UI +
  explorer link; the lifecycle reaper/monitor that re-drives stuck mints; atomic pay→mint
  (off-limits `wip/atomic-purchase`); `agent_reports`/`admin_metrics_snapshots` tables (defer
  until an agent writes them); any funds/ASA/mainnet change (needs `/mainnet-gate` PASS +
  `algo-auditor`). If a new mutating route prefix is added, extend `MUTATION_PATH_RE`
  (`routes.ts:498-518`) or it bypasses the global mutation guard.

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
