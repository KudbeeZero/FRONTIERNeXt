# Audit — PR #52 `feat/admin-chain-agent-dashboard`

**Verdict:** `CONCERNS` — non-blocking honesty/disclosure nits only; all substantive
claims verified, tests green. **Retrospective** audit: PR #52 was merged by the repo
owner (`ca240d9`, 2026-06-16 20:35 UTC) *before* this audit ran, so the verdict gates
nothing — it is a post-hoc record.

**PR / branch / commit:** PR #52 · branch `feat/admin-chain-agent-dashboard` ·
base `c03dfff` → head `272656d` · merged to `main` at `ca240d9`. CI on the head was
green ("Typecheck & server tests": success; Cloudflare Pages: success).

**Scope:** first build unit from the #49 purchase-monitor audit — a durable
purchase audit trail (`chain_events` + `purchase_intents`) + admin dashboard charts.
Additive; testnet/devnet only; no funds/ASA/mainnet behavior.

## Claims vs. evidence

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | 9 files, +678/−2, additive; stated file list; nothing out of scope | ⚠️ partial | `+678/−2` and the 8 code files confirmed. The **9th file is an undisclosed** `session-notes/2026-06-16-admin-chain-agent-dashboard.md` (+61) — in-scope by repo convention but not listed in the PR body. No globe/combat/canvas/funds/ASA/network-switch code touched. |
| 2 | `recordPurchaseTransition` fire-and-forget, never throws, no-ops without DB; `void …`; no control-flow change | ⚠️ partial | `chainEventStore.ts:728-750` is `async` + try/catch (only `console.warn`s) → cannot throw into the purchase path. All call sites use `void recordPurchaseTransition(...)` and alter no return/branch logic. **But** the "no-ops without a DB" guard is effectively dead code: `server/db.ts` throws at import without `DATABASE_URL` and `db` is never falsy — the server cannot boot DB-less. Safety holds via the try/catch; the "no-DB no-op" framing is misleading. |
| 3 | `chainEventLog.ts` pure (no DB import); +8 tests over the 3 functions | ✅ verified | No db/drizzle import in the file. Spec = **8 passed**: `buildTransitionRows` (4), `summarizePurchaseFunnel` (2), `summarizeChainHealth` (2). |
| 4 | New tables match `redeemed_payments`/`action_nonces` style; migration 0009 additive (CREATE only) | ✅ verified | `migrations/0009_chain_events.sql` is CREATE TABLE + CREATE INDEX only — no ALTER/DROP. Drizzle defs `db-schema.ts:195-231` use the same `text`/`varchar` PK + `bigint(mode:"number")` ms-timestamp style as `actionNonces`. |
| 5 | Both new admin endpoints gated by `requireAdminKey` | ✅ verified | `routes.ts:327` and `:346` each open `if (!requireAdminKey(req, res)) return;`. `security.ts:55-77` writes 403/503 and returns false on failure — the bail is real. |
| 6 | No new mutating route needing `MUTATION_PATH_RE` | ✅ verified | Both new routes are `GET` (reads). `MUTATION_PATH_RE` (`routes.ts:499`) only matches POST/DELETE/PUT — no update needed, no gap. |
| 7 | `/admin` now `React.lazy` + `Suspense`; route tree intact | ✅ verified | `App.tsx:17` `lazy(() => import("@/pages/admin"))`; `:26-28` `<Suspense>` inside the existing `/admin` route. tsc clean. recharts already bundled via `EconomicsPanel.tsx`/`landing-economics.tsx` (supports "no new bundle weight"). |

## Tests (this machine, HEAD `ca240d9`)

```
pnpm install --frozen-lockfile   # clean, lockfile up to date
pnpm --filter @workspace/frontier-al run check         # tsc — clean
pnpm --filter @workspace/frontier-al run test:server   # 252 passed (31 files)  [244 + 8]
pnpm --filter @workspace/frontier-al run test          # 55 passed (9 files)
```
Matches the PR's claimed counts exactly.

## Scope creep
- One **undisclosed** file: `session-notes/2026-06-16-admin-chain-agent-dashboard.md` (+61) — a session note (in-scope by convention), so a disclosure gap, not behavioral creep.
- No globe/combat/canvas/economy/funds/ASA/network-config code. The only "mainnet" tokens are a UI warning badge string and a schema comment — not network-switching logic.

## Untested assertions
- **`admin.tsx` has no render test** — accurately disclosed (client suite is SSR-only; admin.tsx uses `sessionStorage` + react-query). The security-relevant admin gate is covered server-side (`security.spec.ts`), reused by the new endpoints.
- **`recordPurchaseTransition` DB I/O path is not integration-tested** — only the pure builders are. The "never breaks the purchase" contract is asserted by code reading, not by a test injecting a throwing `db`. Acceptable for append-only instrumentation.

## Security
- **None blocking.** Append-only, admin-gated, read-only-exposed logging; not funds-moving. Both reads require `requireAdminKey`; `chain-events` clamps its limit (`clampLimit(…,50,200)`, re-clamped to 200 in `queryRecentChainEvents`). No secrets logged (txids/ids/states only). `metadataJson` is server-constructed, not raw user input. Purchase path cannot be broken by the recorder.
- **Minor honesty nit (not a vuln):** the "no-ops without a DB" guard never executes; the safety claim is true via try/catch, but the stated mechanism is inaccurate.

## What I could NOT verify
- Actual Postgres writes/reads (`queryRecentChainEvents`/`queryPurchaseIntents`/upsert) — no live DB.
- That migration 0009 applies cleanly on real Postgres and matches the Drizzle defs byte-for-byte (read-compared only; consistent).
- Browser rendering of the new dashboard panels / recharts code-split chunk.
- On-chain behavior — N/A (no funds, no chain calls).

## Follow-ups (optional, non-gating)
- Commander-mint instrumentation (only `/api/actions/purchase` is wired).
- The `purchase_intents.timeout` reaper (state defined, never set).
- A DOM-based admin render test.
- Reword/remove the "no-ops without a DB" framing to reflect the real try/catch safety.
