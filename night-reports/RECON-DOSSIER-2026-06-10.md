# RECON DOSSIER — for the next Bomb Squad shift

**Prepared:** 2026-06-10 (post-defusal recon, no code changed)
**Method:** 5 parallel read-only recon agents across the surfaces tonight's three
cuts did NOT touch, then **every CRITICAL/HIGH claim re-verified by hand against
current code** before it was written here. Subagent reports are noisy — several of
their top findings were wrong, and those are listed under REFUTED so you don't
chase them. Everything below cites current file:line.

**Branch state:** tonight's fixes (NFT-delivery gate, payment replay guard,
resolveBattles claims) are committed on `claude/bomb-squad-shift-86t0dt` / PR #12.
This dossier assumes those are in.

---

## THE ONE BIG THROUGH-LINE

Tonight's resolveBattles fix was one instance of a pattern that **recurs across the
entire economic-writer surface**: non-atomic read-modify-write (check balance/status,
then mutate, with the check outside the lock/transaction or the status-flip not
conditional on the read). The same conditional-`WHERE … RETURNING` / row-lock cut I
applied to `purchaseLand`/`resolveBattles` is the fix for all of TARGET PACKAGE A.
Treat A as one device with five wires, not five devices.

---

## TARGET PACKAGE A — economic-writer concurrency (HIGH, money-adjacent)

All FRONTIER balances here can settle on-chain, so these are money paths. **All
verified by direct read** (db.ts line numbers current).

| Site | file:line | Defect | Verified |
|---|---|---|---|
| `claimWinnings` | `storage/db.ts:3030` | No transaction at all; reads unclaimed winning positions, then marks `claimed=true` with a NON-conditional `WHERE id=…`, then credits. Two concurrent claims both read `claimed=false` → **double payout**. | ✅ read 3030–3101 |
| `placeBet` | `storage/db.ts:2968` | No transaction; read balance → deduct → bump pool → insert position as separate statements. Concurrent bets debit off one stale balance read → overspend / pool drift. | ✅ read 2968–3028 |
| `purchaseSubParcel` | `storage/db.ts:2162` | Balance check at line ~2180 is OUTSIDE the transaction that doesn't open until ~2262. Classic TOCTOU: two concurrent buys both pass the check. | ✅ read 2162–2191 + tx boundary |
| `fillTradeOrder` | `storage/db.ts:2026` | IS inside a transaction, BUT the order is read with a plain `SELECT` (no `FOR UPDATE`) and the `status='filled'` flip at ~2093 is NOT conditional on `status='open'`. Under postgres READ COMMITTED two fills can interleave → double-fill / resource duplication. | ✅ read 2026–2095 |
| buy-listing | `storage/db.ts` buySubParcelListing | Same family (FRONTIER transfer + ownership flip); apply the same claim pattern. | ⚠️ inferred from family — confirm |

**Cut for the whole package:** conditional claim writes — `UPDATE … SET status=… WHERE
id=? AND status='open' RETURNING` (zero rows ⇒ lost the race ⇒ abort), pull the balance
check inside the transaction, and add `claimed=true WHERE claimed=false` guards. Exactly
tonight's pattern. Tripwire first against MemStorage like `battle-concurrency.spec.ts`.

> Note: postgres conditional-WHERE semantics aren't exercised by CI (no DB in the test
> env, no new deps allowed). Same testability caveat as tonight's resolveBattles cut — a
> real-PG integration test is the standing daytime work order.

---

## TARGET PACKAGE B — missing fail-closed boot guards (HIGH, launch-day)

Three security-critical env vars silently degrade instead of refusing to boot. The
project already established the correct pattern (`requireAdminKey` fails closed in prod);
these three didn't get it. One coherent cut: a startup assertion block in `server/index.ts`.

| Var | file:line | Current behavior | Risk |
|---|---|---|---|
| `SESSION_SECRET` | `auth.ts:50–61` | Unset/<16 chars → `randomBytes(32)` ephemeral key, only `console.warn` in prod. | ✅ verified. Not a forgery risk (random key is secure) but sessions die every restart and can't be shared across instances → silent mass-logout, and no signal it's misconfigured. |
| `WALLET_AUTH_REQUIRED` | `auth.ts:43` | `!== "false"`; if `"false"` in prod, ALL mutation auth is bypassed (body `playerId` trusted). | ✅ verified. No boot guard forcing it true in prod. |
| `PUBLIC_BASE_URL` | `routes.ts` purchase/mint paths | Unset at mint time → NFT mint skipped, idempotency marked `failed`, user paid & cannot retry (see Package D). | ✅ verified. Should be required before any paid endpoint serves. |

**Cut:** in prod (`NODE_ENV==='production'`), throw at boot if `SESSION_SECRET` missing/short,
if `WALLET_AUTH_REQUIRED==='false'`, or if `PUBLIC_BASE_URL` unset. Mirrors the admin-key
hardening. Pure addition, low blast radius.

---

## TARGET PACKAGE C — authorization coverage gaps (CRITICAL/HIGH)

Root cause (✅ verified `routes.ts:387`): the global mutation guard regex
`MUTATION_PATH_RE = /^\/api\/(actions|trade|markets|plots|sub-parcels|factions)\b/`
does NOT cover `/api/orbital`, `/api/weapons`, `/api/nft`, or `/api/game`. Those routes
are protected only if the handler remembered its own check. Three didn't:

1. **`POST /api/orbital/trigger` + `/api/orbital/resolve/:id`** — ✅ ungated, no
   `requireAdminKey` (`routes.ts:2566`, `:2580`). Anyone can spawn/cancel orbital impact
   events. **One-line fix each.** Highest-value quick win.
2. **`POST /api/weapons/mint-nft`** — ✅ session-gated but mints/delivers to
   caller-supplied `action.receiverAddress` (`routes.ts:2286`; schema `weapons/profile.ts`
   `receiverAddress: z.string().min(1)` — not even address-validated). Same device class
   as tonight's NFT-delivery hijack. Fix: force `player.address`, or run it through the
   `evaluateNftDeliveryClaim` gate I added tonight.
3. **`POST /api/nft/retry-commander/:commanderId`** — ✅ trusts body `playerId`
   (`routes.ts:991`), not `assertPlayerOwnership`. With Package B's `WALLET_AUTH_REQUIRED`
   off this is fully open. Also no payment re-check and no retry rate-limit (fee-bleed on
   the admin wallet).

**Structural recommendation (long-term):** widen `MUTATION_PATH_RE` or move these routers
under a covered prefix, so a future endpoint can't silently ship ungated.

---

## TARGET PACKAGE D — stuck-state / no-recovery in the fire-and-forget lifecycle (HIGH)

The purchase/mint flow returns 200 "minting" before the chain work; failures past that
point have **manual-recovery-only** paths. ✅ all verified in `routes.ts` purchase/mint
handlers + `transferQueue.ts`.

- **`PUBLIC_BASE_URL` unset at mint** → idempotency row set to `failed`; the re-entry guard
  only short-circuits on `confirmed`/`pending`, so the user is wedged (a different plot
  works, but this one needs a manual DB delete). Ties to Package B.
- **Delivery fails after a successful on-chain mint** → idempotency already `confirmed`,
  NFT sits in admin custody; `/api/nft/deliver*` returns `not_in_custody`-style responses
  that read as "already delivered." Only a `[CRITICAL]` log records it. No background
  redelivery loop.
- **`pending_frontier_transfers` hits MAX_ATTEMPTS** (~20 over ~10 min) → row goes `failed`
  and the drainer only scans `pending`, so a user who opts in late never gets the transfer;
  in-game balance shows credited, on-chain shows nothing.

**Not tonight's cut** (it's net-new recovery machinery, larger than a minimal disarm), but
it's the biggest "user paid, support ticket" surface. Recommend: separate delivery-state
from mint-state, a bounded redelivery worker, and an admin `stuck-nfts` / `retry-failed`
view. Documented as a daytime work order.

---

## TARGET PACKAGE E — tokenomics & settlement (MED, mainnet-gating)

- **No FRNTR supply cap enforcement** — ✅ no path checks circulating FRONTIER against
  `FRONTIER_TOTAL_SUPPLY` before crediting (`grantWelcomeBonus`, `claimFrontier`, yields).
  The constant is display-only. ⚠️ I did NOT confirm the supply *number* the agent quoted
  (it contradicted itself); verify the intended supply semantics before acting. Testnet-OK,
  mainnet tokenomics concern.
- **Treasury settlement is non-atomic across DB+chain** (`services/chain/treasury.ts`) —
  on-chain send then DB `settled=true`; a crash between confirm and DB-mark re-settles next
  drain. Self-transfer (admin→admin) so no fund leak, but a duplicate audit record. Same
  non-atomic-DB+chain class as Package D. MED.
- **Listing-create validation gap** — ✅ `routes.ts:3305` reads `askPriceFrontier` raw from
  the body with only `!askPriceFrontier`, bypassing the `z.number().int().min(1).max(100000)`
  schema (`shared/schema.ts:975`). Negative/zero asks reach storage. Trace the
  buy-listing math to rate the impact; at minimum it's an integrity hole. Quick fix: parse
  through the schema in the route.

---

## LOWER PRIORITY (note for completeness)

- **Rate-limit Redis fallback is per-instance** (`rateLimitStore.ts:45`) — ✅ when Redis is
  down each node keeps its own counter, so the anti-scrape budget multiplies by node count.
  Comment claims "fail-safe" but it's fail-open-to-local. Acceptable single-instance; matters
  at horizontal scale.
- **Price oracle** (`services/priceOracle.ts`) — ✅ unauthenticated CoinGecko, 5-min stale
  window, no fetch timeout, hardcoded `$0.20` fallback. Stale/fallback price feeds
  `/api/nft/commander-price`. Low direct-theft risk, arbitrage-window risk on a price swing.
- **WS token in query param** (`wsServer.ts`) — logged by proxies; prefer cookie. MED-low.
- **Session not re-bound to DB address** post-issue (`auth.ts` verifySession is stateless) —
  only bites if a player's address is reassigned mid-session. Low.

---

## ✅ VERIFIED SAFE — do NOT spend time here (subagent false alarms, hand-checked)

- **WS broadcast IS per-viewer scoped** — `stateScope.ts:54` redacts non-owned parcels &
  other players' economics; null viewer gets everything redacted. No full-state leak.
- **Auth address case "DoS"** — REFUTED. A non-canonical/lowercase address fails
  `algosdk.isValidAddress()` at `auth.ts:204` and is correctly rejected before the
  `sender !== address` compare. Working as intended.
- **EdDSA signature malleability** — not applicable (Ed25519 non-malleable); verify path
  at `auth.ts:244` decodes pubkey from the checksummed address. Fine.
- **ECONOMY_MODE half-flip** — read once at module load (`economy-config.ts:28`); no
  per-request or mixed-state read.
- **Welcome-bonus double-claim & sybil** — `grantWelcomeBonus` is transactional with an
  early `welcomeBonusReceived` exit (`db.ts:884`); min-ALGO sybil gate fails closed.
- **`claimFrontier` double-claim / accrual drift** — transactional; accrual zeroed atomically
  with the credit (`db.ts:910`).
- **Negative bet/trade amounts** — bet & trade-order routes DO parse through `min(1)` zod
  schemas (only the *listing* route bypasses its schema — see Package E).
- Tonight's NFT-delivery gate, payment replay guard, and admin-key hardening — all hold.

---

## SUGGESTED ORDER FOR THE NEXT SHIFT (≤3 targets, protocol cap)

1. **Package C #1 (orbital gating)** — two one-line `requireAdminKey` adds; highest
   value-per-risk, trivially tripwire-able.
2. **Package A (economic-writer concurrency)** — same cut you just rehearsed on battles;
   pick the worst wire (`claimWinnings` double-payout) first, tripwire against MemStorage.
3. **Package B (boot guards)** — pure additive fail-closed block; protects the whole
   launch. Or swap in **Package C #2 (weapons receiver)** since the gate function already
   exists from tonight.

Everything else → daytime work orders (Package D recovery machinery, Package E tokenomics
cap, oracle/rate-limit hardening).
