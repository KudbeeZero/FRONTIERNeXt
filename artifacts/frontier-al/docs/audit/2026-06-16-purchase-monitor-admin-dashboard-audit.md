# FRONTIER On-Chain Purchase Monitor + Admin Dashboard Audit

> Read-only audit + implementation plan. No code changed, no PR opened, no live
> transactions placed. Produced by a 5-squad fan-out (cartographer, TS/wallet,
> backend/storage, player-UI/dashboard, testing/security). All claims carry
> file:line evidence; unverifiable items are marked **not verified**.
> Date: 2026-06-16 · Branch: `claude/frontier-purchase-monitor-audit-opb6vm`

---

## 1. Current Repo State

- **Branch:** `claude/frontier-purchase-monitor-audit-opb6vm` (clean working tree).
- **Git status:** no uncommitted changes at audit start.
- **Package scripts** (`artifacts/frontier-al/package.json`): `check` (tsc), `test`
  (vitest client), `test:server` (vitest server config), `dev`/`dev:server`/`dev:client`,
  `build` (`script/build.ts`), `start`, `db:push` (drizzle-kit), `sim`, `veritas`.
- **Test/typecheck run this audit (verified, exit 0):**
  - `pnpm --filter @workspace/frontier-al run check` → **PASS**, tsc clean, 0 errors.
  - `pnpm --filter @workspace/frontier-al run test:server` → **PASS, 244/244** (30 files, 9.18s).
  - `pnpm --filter @workspace/frontier-al run test` → **PASS, 55/55** (9 files, 4.10s).

## 2. Canonical Vocabulary

The repo's canonical term for the purchasable land unit is **`parcel`** (the full
object) keyed by a numeric **`plot` / `plotId`** (1–21,000). There is **no "plate",
"sector", or generic "item"** vocabulary.

| Concept | Canonical name | Evidence |
|---|---|---|
| DB table for land | `parcels` | `server/db-schema.ts:197` |
| Type | `LandParcel` | `shared/schema.ts:195` |
| Purchase request | `purchaseActionSchema` → `{ playerId, parcelId, algoPaymentTxId? }` | `shared/schema.ts:507-511` |
| Numeric id | `plotId` (1–21,000) | `server/db-schema.ts` parcels.`plot_id` |
| UUID id | `parcelId` | game-state actions |
| Subdivision | `sub-parcel` (9 per plot, ASCEND-priced) | `shared/schema.ts:814`, `sub_parcels` table |
| Token | `ASCEND` (ASA, discovered by creator+name, not hardcoded) | `server/services/chain/asa.ts:117-163` |

**Other purchasable on-chain items:** Commander avatar NFTs (`POST /api/actions/mint-avatar`,
`routes.ts:2052`) and sub-parcels (ASCEND, `routes.ts:3286`). No vocabulary rename is
warranted — the repo is internally consistent.

## 3. Existing Purchase / Chain Code Found

**Client**
- `client/src/components/game/WalletConnect.tsx` — Pera/Defly/Kibisis/Lute connect widget.
- `client/src/contexts/WalletContext.tsx:97-241` — wallet state, signer registration, cancel detection (`:51-65`).
- `client/src/lib/walletManager.ts:1-10` — `@txnlab/use-wallet` config.
- `client/src/lib/algorand.ts` — txn builders (`createPurchaseWithAlgoTransaction:180`), opt-in (`:287-330`), confirmation (`waitForConfirmation` `:104,181`).
- `client/src/hooks/useBlockchainActions.ts:343-392` — `signPurchaseAction()`.
- Buy surfaces: `SelectedPlotPanel.tsx:206-269`, `MobilePlotSheet.tsx:213,268`, `LandSheet.tsx:1045-1051`; orchestrated by `GameLayout.tsx:366-401` `handlePurchase()`.

**Server**
- `server/routes.ts:1765` — `POST /api/actions/purchase` (zod → `verifyAlgoPayment` → replay guard → `storage.purchaseLand` → fire-and-forget mint/deliver).
- `server/services/chain/{client,land,commander,asa,transferQueue,treasury,types}.ts` — algod/indexer config, NFT mint/transfer, ALGO payment verify, ASCEND transfer queue.
- `server/security.ts:169-191,210` — `createPaymentReplayGuard` (DB `redeemed_payments`).
- `server/idempotencyGuard.ts` — action nonce guard (used by build/upgrade/claim, **not** by purchase).
- `shared/schema.ts:507` — `purchaseActionSchema`.

**Tests:** `server/services/chain/commander.spec.ts` (verifyAlgoPayment decision table), `land.spec.ts`, `eligibility.spec.ts`, `server/security.spec.ts`, `server/idempotencyGuard.spec.ts`. No client purchase-flow specs.

## 4. Existing Admin Dashboard / Archive Findings

- **Active admin dashboard EXISTS:** route `/admin` (`client/src/App.tsx:77-79`) →
  `client/src/pages/admin.tsx` (218 lines, "Ascendancy Ops"). ADMIN_KEY-gated
  (`x-admin-key` header). Panels: System Status, Economy, AI Factions, Live Battles,
  Route Metrics, Controls — **all text/KV cards, zero charts** (`admin.tsx:41-60,144-213`).
- **Chart library ALREADY INSTALLED:** `recharts ^2.15.2` (`package.json:97`), with an
  unused shadcn wrapper `client/src/components/ui/chart.tsx` ready to use. **No new
  dependency needed.**
- **UI primitives available:** `ui/card.tsx`, `ui/table.tsx`, `ui/tabs.tsx`, `ui/badge.tsx`,
  `ui/chart.tsx`, `ui/dialog.tsx`.
- **Archive / legacy: NONE.** `find` for `*archive*`/`*legacy*`/`*old*` dirs under the
  repo returned only `node_modules`. This is a greenfield dashboard — **nothing to
  restore; nothing to duplicate.**

## 5. What Already Works

| Capability | Status | Evidence |
|---|---|---|
| Wallet connect (4 wallets) | ✅ live | `WalletContext.tsx:97-241` |
| ALGO payment verification (indexer, server-side) | ✅ live, tested | `commander.ts:206-272`, `commander.spec.ts` |
| Server-authoritative price | ✅ | `routes.ts:1793` reads `purchasePriceAlgo`, not client input |
| Payment replay guard (atomic, fail-closed) | ✅ live, tested | `security.ts:210`, `routes.ts:1811-1822`, `security.spec.ts` |
| Mint idempotency (`mint:{playerId}:{plotId}`) | ✅ live | `routes.ts:1863` |
| In-game ownership write (pre-chain, refunds claim on failure) | ✅ live | `routes.ts:1827-1831` |
| Plot/Commander NFT mint + custody-then-deliver | ✅ live, tested | `land.ts`, `land.spec.ts` |
| ASCEND transfer queue + background worker (30s) | ✅ live | `transferQueue.ts:177-192`, started `index.ts:258` |
| Admin auth (constant-time, fail-closed in prod) | ✅ live, tested | `security.ts:55-77` |
| Admin dashboard (ops monitoring) | ✅ live | `admin.tsx`, endpoints `routes.ts:3630-3771` |
| Typecheck + 299 unit tests | ✅ green | this audit |

## 6. What Is Broken or Missing

**Purchase flow gaps**
- Client purchase UI is a **single `isPending` spinner + toasts** — no status timeline
  (`SelectedPlotPanel.tsx:254-258`, `useBlockchainActions.ts:39`). None of the 11 target
  states are surfaced distinctly.
- **No clickable explorer link** after a land purchase (only a truncated txid toast,
  `useBlockchainActions.ts:376`). An explorer-link pattern exists to reuse in
  `NftClaimNotification.tsx:200`.
- Payment → mint is **not atomic and not user-signed-as-group** (`algorand.ts:169-185`
  pays; server mints fire-and-forget `routes.ts:1900-1942`). (Atomic swap overlaps the
  **off-limits** `wip/atomic-purchase` branch — flagged, do not implement here.)

**Monitor gaps**
- **No chain monitor for the purchase/NFT lifecycle.** The only background drain is the
  ASCEND `transferQueue` worker (`transferQueue.ts:177`). A crashed fire-and-forget mint
  is **not re-driven** — recovery is manual (`/api/nft/deliver/:plotId`,
  `/api/nft/retry-commander/:id`). The code self-flags this: `[CRITICAL] NFT delivery
  failed after payment` (`routes.ts:1929-1931`).
- The state set (`idle`…`duplicate_detected`) exists nowhere server-side.

**Storage gaps**
- **No `algo_payment_tx_id` column on `parcels`** — the payment→plot link is **console-log
  only** (`routes.ts:1834`). Real risk: *tx confirmed + ALGO paid, NFT not delivered*
  with no durable audit row.
- **Audit tables absent** (verified in `db-schema.ts` + migrations 0000–0008):
  `chain_events`, `purchase_intents`, `agent_reports`, `admin_metrics_snapshots`.

**Dashboard gaps**
- No charts (recharts installed but unused). No purchase funnel, transaction-status,
  agent-report, severity, or test-health views. No recent-events table.

**Security gaps**
- **None found that are RISK-level.** All trust-boundary checks pass (see §12). Two
  lower-severity TS/correctness items: client **hardcoded treasury fallback**
  (`algorand.ts:241`) and literal `network:"testnet"` in 5 note payloads (`algorand.ts:127…457`).

**Testing gaps**
- **No client-side** purchase-state-machine or admin-dashboard render tests. Duplicate
  prevention is covered **server-side only**.

## 7. Proposed Data Flow (target)

```
Player selects parcel
  → [NEW] POST /api/purchase/intent      → insert purchase_intents(state=preparing) + chain_events
  → wallet signs ALGO payment            → intent.state=awaiting_wallet_signature → submitting
  → POST /api/actions/purchase (exists)  → verifyAlgoPayment (indexer) → state=confirmed
  → paymentReplayGuard.claim (exists)    → duplicate_detected on 409
  → storage.purchaseLand (exists)        → in-game ownership committed
  → [NEW] chain monitor loop             → re-drives mint/deliver; state=inventory_syncing → complete
                                           (or failed / timeout via TTL reaper)
  → every transition appends chain_events (durable audit)
  → [NEW] GET /api/admin/chain-events / purchase-metrics / agent-reports
  → /admin dashboard renders cards + recharts + tables from those endpoints
```

The **existing** `/api/actions/purchase` already covers verify→claim→own→mint. The net-new
pieces are the **durable event log**, the **lifecycle monitor/reaper**, and the **admin
read endpoints + charts**.

## 8. Admin Dashboard Plan

Extend the existing `/admin` route (`admin.tsx`) — add an **Analytics** tab using
`ui/tabs.tsx`, reuse `ui/chart.tsx` (recharts) + `ui/card.tsx` + `ui/table.tsx`. No new
route, no new dependency.

- **A. Chain health cards** — pending / confirmed / failed / timeout / duplicate-blocked
  counts, current network, last-confirmed-tx time (from `chain_events`).
- **B. Purchase funnel chart** — counts by intent state (recharts bar/funnel).
- **C. Transaction status chart** — counts by the 11 lifecycle states.
- **D. Agent report table** — agent, type, status, severity, blockers, tests, files, time.
- **E. Agent severity chart** — info/low/medium/high/critical.
- **F. Test health chart** — lint/typecheck/unit/server-test pass-fail.
- **G. Recent events table** — latest chain + agent events with link-to-details.

## 9. Exact Files to Change (smallest set)

**Backend (data + endpoints)**
- `server/db-schema.ts` — add additive tables `purchase_intents`, `chain_events`,
  `agent_reports`, `admin_metrics_snapshots` (+ optional nullable `parcels.algo_payment_tx_id`).
- `migrations/0009_chain_events_audit.sql` — new additive migration.
- `server/routes.ts` — add admin-gated `GET /api/admin/chain-events`,
  `/api/admin/purchase-metrics`, `/api/admin/agent-reports`; emit `chain_events` at the
  existing transition points (`:1796,:1811,:1827,:1901,:1924,:1936`).
- (Optional, later unit) a monitor module `server/services/chain/purchaseMonitor.ts` +
  start in `server/index.ts` for the TTL reaper / mint re-drive.

**Frontend (dashboard + purchase UX, separable units)**
- `client/src/pages/admin.tsx` — Analytics tab: cards + recharts + table.
- `client/src/components/game/{SelectedPlotPanel,MobilePlotSheet,LandSheet}.tsx`,
  `hooks/useBlockchainActions.ts`, `lib/algorand.ts` — purchase status timeline +
  explorer link (separate UI unit).

## 10. Database / API Changes Needed

Additive only, matching the `redeemed_payments`/`action_nonces` Drizzle style
(text/varchar PKs, `bigint({mode:"number"})` ms timestamps, inline `index()`):

- `purchase_intents(id, player_id, kind, ref_id, algo_payment_tx_id?, state, created_at, updated_at, last_error?)`, index `(state, created_at)`.
- `chain_events(id, intent_id?, event, tx_id?, player_id?, payload_json?, created_at)`, index `created_at`.
- `agent_reports(id, agent, report_type, status, severity, summary, findings_json?, files_touched_json?, tests_json?, created_at)`.
- `admin_metrics_snapshots(id, metric_type, metric_json, created_at)`. Purchase-funnel
  counts can be **derived from `chain_events`** rather than a separate table.

New endpoints must either live under `/api/actions/*` or **extend `MUTATION_PATH_RE`
(`routes.ts:498-518`)** to cover any new `/api/purchase/*` prefix — otherwise they bypass
the global mutation guard. Admin reads gate with `requireAdminKey`.

## 11. Tests Needed (exact)

Server: chain_events emitted on each transition; purchase-metrics endpoint aggregates
correctly; admin endpoints reject without key. Client (currently **all missing**):
wallet-not-connected disables buy; buy → preparing; rejection → user_rejected; submit
failure → failed; timeout → timeout; confirmed updates UI; inventory sync after
confirmation; duplicate purchase blocked (client surface); admin renders chain metrics;
admin renders agent reports; admin handles empty data; admin handles failed metric fetch.
Typecheck already green.

## 12. Risks / Blockers

**Critical** — none open. (Atomic pay→mint is a known design gap but its fix is the
**off-limits `wip/atomic-purchase`** branch; do not touch.)

**High**
- NFT delivery desync after confirmed payment, no auto-retry, audit is log-only
  (`routes.ts:1929`). Mitigated in-game (ownership commits pre-chain) but a real
  player-facing "paid, no NFT" path.
- Client **hardcoded treasury fallback** `algorand.ts:241` — commander-mint ALGO could go
  to a baked-in address if the server treasury fetch fails. Should fail closed.

**Medium**
- `verifyAlgoPayment` does **not pin genesis-id/hash** (`commander.ts:222-272`) — can't by
  itself distinguish testnet vs mainnet txids; trusts configured indexer.
- Literal `network:"testnet"` in 5 on-chain note payloads (`algorand.ts:127,166,201,238,457`).
- `waitForConfirmation` has no wall-clock timeout wrapper.

**Low**
- Pervasive `any` on indexer/algod responses (deliberate v2/v3 duality) removes
  compile-time safety on the verifier.
- ASCEND `drainAscendTransfers` lacks a by-txid idempotency check before retry
  (`transferQueue.ts:137`) — low-probability double-send; **not verified** exploitable.

## 13. Final Verdict

- **Do we already have the buying flow?** **Yes** — real and live: wallet → sign ALGO
  payment → `POST /api/actions/purchase` → indexer verify → replay-guard → ownership write
  → NFT mint/deliver. Server trust boundary is well-tested (244/244).
- **Is the chain monitor already present?** **Only partially** — a background worker exists
  for ASCEND transfers; the **purchase/NFT lifecycle has no monitor** (fire-and-forget +
  manual recovery). The 11-state machine does not exist yet.
- **Is there an admin dashboard already?** **Yes** — `/admin` (`admin.tsx`), ops-monitoring,
  ADMIN_KEY-gated. Text cards only, no charts.
- **Useful dashboard code in archive?** **No archive exists.** But `recharts` is installed
  and `ui/chart.tsx` is ready — reuse those.
- **Can a player safely buy through the website right now?** **Yes for in-game ownership**
  (paid → owns the parcel, replay-protected, server-priced). **Caveat:** the on-chain NFT
  may lag or require manual delivery, and the UI gives no granular status — a confirmed
  purchase can look like a silent spinner.
- **Can an admin currently see chain/agent health?** **Partially** — system/economy/AI/
  battle/route metrics yes; **no chain-event log, no purchase funnel, no agent reports.**
- **Next smallest safe build step:** land the **durable `chain_events` + `purchase_intents`
  audit tables (additive migration 0009) and emit events at the existing transition points**,
  then surface them in the `/admin` dashboard with recharts cards/tables. No mainnet, no
  atomic-swap, no UI redesign.

## 14. Implementation Baton (scoped — smallest safe next PR)

**Branch:** `feat/admin-chain-agent-dashboard` · **One unit, additive, no mainnet.**

**In scope**
1. Additive migration `0009_chain_events_audit.sql` + Drizzle defs for `chain_events` and
   `purchase_intents` (style ref: `redeemed_payments` `db-schema.ts:87-93`). Nullable-tolerant.
2. Emit `chain_events` rows at the **existing** purchase transition points in
   `routes.ts` (`:1796,:1811,:1827,:1901,:1924,:1936`) — pure instrumentation, no behavior change.
3. Admin-gated reads `GET /api/admin/chain-events` + `GET /api/admin/purchase-metrics`
   (funnel counts derived from `chain_events`), `requireAdminKey`.
4. `/admin` Analytics tab: chain-health cards + purchase-funnel/transaction-status charts
   (recharts via `ui/chart.tsx`) + recent-events table (`ui/table.tsx`). Reuse existing styling.
5. Tests: server (events emitted + metrics aggregate + admin-gate) and client (admin renders
   metrics / empty / failed-fetch). No-fix-without-a-test.

**Explicitly OUT of scope (separate later units / gated):**
- Atomic pay→mint swap (off-limits `wip/atomic-purchase`).
- The purchase status-timeline UI + explorer link (separable client unit).
- The lifecycle reaper/monitor that re-drives stuck mints (follow-up once events land).
- Any funds/ASA/mainnet change (needs `/mainnet-gate` PASS + `algo-auditor`).
- `agent_reports` / `admin_metrics_snapshots` tables (defer until an agent actually writes them).

**Guardrails:** testnet/devnet only; no live purchases; no secret exposure; extend
`MUTATION_PATH_RE` if any new mutating prefix is added; keep the diff additive.
