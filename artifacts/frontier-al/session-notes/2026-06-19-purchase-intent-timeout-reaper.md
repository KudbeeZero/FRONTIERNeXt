# 2026-06-19 — Purchase-intent timeout reaper (first live functional reaper)

## Unit
Owner-approved Option A from the #52 dashboard follow-ups: a **server-only, off-chain**
reaper that flips abandoned `purchase_intents` (pending past a TTL) to `timeout`, so the
admin funnel reflects reality. Audited first (read-only); no stop-trigger hit (no schema /
migration / chain). Built the smallest safe change, wired live, conservatively defaulted.

## Audit (pre-code, evidence-backed)
- `timeout` state was **defined but never set** in production (`chainEventLog.ts:17`; grep
  confirmed zero `recordPurchaseTransition(... state:"timeout" ...)` callers).
- `purchase_intents` is a **server-only telemetry/audit** record (Postgres, migration 0009),
  written fire-and-forget *after* payment/ownership/mint. Flipping a stale intent touches
  **no** payment/wallet/Algorand/NFT/ASCEND/settlement. The duplicate guard keys off
  `redeemed_payments`, **not** intents → stale intents block nothing.
- **No existing reaper.** `state` column already accepts `'timeout'` → **no schema/migration**.
- Pending states: `submitting`/`confirmed`/`inventory_syncing` (the latter can legitimately
  wait on a buyer NFT opt-in → TTL must be generous).

## What shipped (8 files; server + tests + env docs)
- **`server/services/chain/chainEventLog.ts`** (pure) — `identifyStaleIntents(intents, now, ttlMs)`
  (selects only PENDING rows strictly older than ttl; terminal states never selected →
  idempotent) + `resolveTimeoutMs(raw, fallbackMs)` (env parse + 1-min floor) +
  `PURCHASE_INTENT_TTL_FLOOR_MS`.
- **`server/services/chain/chainEventStore.ts`** (DB glue) — `timeoutStalePurchaseIntents({now?,ttlMs?})`:
  db-guarded, **never throws** (try/catch → returns count), reuses `recordPurchaseTransition`
  per stale row (preserves original `playerId`/`kind`/`refId`/`createdAt`; appends a
  `purchase_timeout` chain_event). Plus env-derived `PURCHASE_INTENT_TIMEOUT_MS` (**7d** default)
  and `PURCHASE_INTENT_REAP_INTERVAL_MS` (hourly).
- **`server/index.ts`** — wires an **`unref`'d** `setInterval` calling the reaper, mirroring the
  existing `ACTION_NONCE_PRUNE` precedent (best-effort; never holds the process open or throws
  on the interval).
- **`chainEventLog.spec.ts`** (+9 pure tests) — stale detection, recent/terminal protection,
  `inventory_syncing` rule, idempotency-of-selection, env override, floor.
- **`chainEventStore.db.spec.ts`** (NEW, Postgres-gated like `lootbox.db.spec.ts`) — applies
  migration 0009, proves the real flip, recent+terminal untouched, idempotency, field/createdAt
  preservation + `purchase_timeout` event. Wired into `test:server:db`.
- **`ENV_VARS.md` + `docs/DEPLOYMENT_ENV_CHECKLIST.md`** — both new env vars documented.

## TTL / interval decision
`PURCHASE_INTENT_TIMEOUT_MS` default **7 days** (conservative — protects slow NFT opt-ins),
hourly reap, **1-minute floor** (env-overridable). Per owner decision.

## Verification (all green locally)
- `check` (tsc) ✓
- `test:server` **288 pass / 11 skipped** (was 279/7 — +9 pure tests; +4 db tests skipped w/o DB)
- `test:server:db` **11 pass** against a real throwaway Postgres (7 lootbox + 4 reaper)
- client `test` **71 pass** (unaffected) · `coverage:server` **93.12%** lines PASS (reaper not in
  the gate include set) · `build` ✓

## Safety confirmation
No schema, no migration, no new dependency, no lockfile change (`package.json` diff is only the
`test:server:db` script). No wallet/token/minting/settlement/Algorand behavior. Server-only;
client untouched. The reaper is off-chain telemetry; the interval is best-effort, `unref`'d, and
cannot throw.

## Open / carried
- The #65 globe visual click-test is still owed (owner-side; unrelated — this unit doesn't touch globe).
- Remaining #52 follow-ups queued (commander-mint instrumentation); jsdom/Testing-Library harness queued.
