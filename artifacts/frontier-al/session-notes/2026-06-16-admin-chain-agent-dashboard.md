# 2026-06-16 — feat/admin-chain-agent-dashboard

## What shipped (one unit, additive)
The first implementation unit from the #49 purchase-monitor audit (§14 baton):
a durable on-chain purchase audit trail + admin dashboard charts. **No mainnet,
no behavior change to the purchase itself, no unrelated UI.**

### Data layer (additive only)
- `migrations/0009_chain_events.sql` — two new tables, staged (not run at boot):
  - `chain_events` — append-only lifecycle log (id, event, status, tx_id, player_id,
    item_type, item_id, network, amount, metadata_json, created_at) + 2 indexes.
  - `purchase_intents` — one row per attempt carrying current state (+ state/created indexes).
- `server/db-schema.ts` — Drizzle defs for both, matching the `redeemed_payments` /
  `action_nonces` style (text/varchar PKs, `bigint(mode:"number")` ms timestamps).

### Recorder + aggregation
- `server/services/chain/chainEventLog.ts` — **pure** logic (no DB import → unit-testable
  without Postgres): `buildTransitionRows`, `summarizePurchaseFunnel`, `summarizeChainHealth`,
  `PURCHASE_STATE_ORDER`, `newIntentId`, `currentNetwork`.
- `server/services/chain/chainEventStore.ts` — DB I/O: `recordPurchaseTransition`
  (fire-and-forget, **never throws**, no-ops without a DB), `queryRecentChainEvents`,
  `queryPurchaseIntents`. Re-exports the pure surface.

### Wiring (pure instrumentation — never gates a purchase)
- `server/routes.ts` `POST /api/actions/purchase` — `void recordPurchaseTransition(...)` at the
  existing transition points: submitting → confirmed (or failed on verify) → duplicate_detected
  (replay 409) → inventory_syncing (ownership committed) → complete / failed (mint+delivery
  `.then`/`.catch`). One `purchaseIntentId` per attempt threaded through the closure.
- Two admin-gated reads (`requireAdminKey`): `GET /api/admin/chain-events` (recent events +
  health rollup) and `GET /api/admin/purchase-metrics` (funnel counts).

### Dashboard
- `client/src/pages/admin.tsx` — new "Chain & Purchase Analytics" section: Chain Health cards,
  Purchase Funnel bar chart (recharts via existing `ui/chart.tsx`), Recent Chain Events table
  (`ui/table.tsx`). Reuses the existing Panel/KV/`q<T>` patterns; handles empty + failed-fetch.
- `client/src/App.tsx` — `/admin` route now `React.lazy` + `Suspense` so the admin page code is
  code-split out of the main bundle (recharts itself was already bundled via EconomicsPanel /
  landing-economics, so no new bundle weight is added).

## Verification (all green this session)
- `pnpm run check` (tsc) — clean.
- `pnpm run test:server` — **252 pass** (was 244; +8 new in `chainEventLog.spec.ts`).
- `pnpm run test` (client) — **55 pass**.
- `pnpm run build` — client + server build OK; new `admin-*.js` async chunk (~13.9 kB).
  Pre-existing >500 kB main-chunk warning is unchanged (out of scope).

## Honest flags / scope
- **No client render test** for the dashboard: the client suite is SSR-only
  (`renderToStaticMarkup`, no jsdom/react-query/sessionStorage), and `admin.tsx` reads
  `sessionStorage` + uses react-query — a DOM harness is a documented follow-up (same posture
  the repo takes for HUD effect-behavior). Admin-gate is covered by existing
  `security.spec.ts` (`requireAdminKey`); the new endpoints reuse that guard.
- `purchase_intents` is created + written but the **timeout-reaper** that would set `timeout`
  is intentionally out of scope (state defined, never set yet). Likewise the commander-mint
  path is not yet instrumented (only `/api/actions/purchase`).
- Migration 0009 is **staged** (not auto-run); the recorder no-ops until it's applied, so
  deploying the build before the migration is safe.

## Next
Open PR → `/handoff-audit`. Follow-ups (separate units): commander-mint instrumentation;
timeout-reaper; purchase status-timeline UI + explorer link; DOM-based admin render tests.
