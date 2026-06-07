# API Access-Control & EPI-Scraping Audit — 2026-06-07

**Scope:** Full-stack review of the FRONTIER (Ascendancy) API surface, focused on
preventing unauthorized access to and bulk scraping of **off-chain
game-economy intelligence** ("EPI") — e.g. which parcels hold the most
resources, who holds the largest balances, live battle state.

**Author:** Security audit pass (claude/security-audit-3hwgW).

---

## 0. Key framing — what is actually secret

A critical distinction drives this whole audit:

- **On-chain data is public by design.** The admin/treasury wallet balance, ASA
  total supply, NFT ownership, and every player's wallet balance are all
  queryable directly on the Algorand blockchain (indexer/explorer). The API
  **cannot hide these** — anyone can read them on-chain regardless of what our
  endpoints return.
- **Off-chain game state is NOT public.** Per-parcel stored resources
  (`ironStored` / `fuelStored` / `crystalStored`), in-game FRNTR balances,
  leaderboards, "richest/attackable plots", live pending battles, AI faction
  inventories, and market positions live only in our Postgres DB and are
  exposed **only** through the API.

**Therefore the EPI worth defending = the off-chain game intelligence.** The
"someone gets an API and runs a spreadsheet to see which plots have the most
tokens" threat is real and was previously wide open. That is what this pass
hardens.

---

## 1. Findings

### CRITICAL

| # | Finding | Location |
|---|---------|----------|
| C1 | **Admin auth failed OPEN.** `requireAdminKey()` returned `true` when `ADMIN_KEY` was unset. A production deploy that forgot to set the key silently exposed `/api/game/reset` (full DB wipe), season/market controls, and all admin reads to the public internet. | `server/routes.ts` (old `requireAdminKey`) |
| C2 | **Two admin endpoints had NO guard at all** — `/api/admin/battles-live` and `/api/admin/ai-activity` were fully public, leaking live attack schedules and AI faction inventories. | `server/routes.ts` |
| C3 | **Unthrottled enumeration of off-chain economic data.** Only `/api/actions/*` was rate-limited. Every read endpoint — including ID-keyed lookups (`/api/game/parcel/:id`, `/api/game/player/:id`, `/api/game/player-by-address/:address`) and the resource-sorted `/api/parcels/attackable` — could be walked at machine speed to dump the entire economy. This is the headline "spreadsheet scrape" vector. | `server/routes.ts`, `server/index.ts` |

### HIGH

| # | Finding | Location |
|---|---------|----------|
| H1 | `/api/admin/mint-status/:plotId` accepted the admin key via **query string** (captured by access logs/proxies) and also failed open when `ADMIN_KEY` was unset. | `server/routes.ts` |
| H2 | `/api/world/events` had an **unbounded** caller-supplied `limit` — `?limit=999999` dumps the entire event log in one request. | `server/routes.ts` |
| H3 | `/api/blockchain/status` broadcast the admin wallet's **live ALGO + FRNTR balances** to anonymous callers (operational treasury intelligence; unnecessary for the client). | `server/routes.ts` |
| H4 | Admin-key comparison was a plain `!==` (timing side-channel). | `server/routes.ts` |

### OUTSTANDING (NOT yet fixed — see §3)

| # | Finding | Severity |
|---|---------|----------|
| O1 | **No proof-of-wallet-ownership on writes.** `assertPlayerOwnership()` only checks that a `playerId` exists and isn't AI — it does **not** verify the caller controls that account. Anyone who learns a `playerId` (they're returned by public reads) can mine/attack/build/spend as that player. `POST /api/actions/connect-wallet` lets an attacker repoint any player to an arbitrary address with no signature. | **CRITICAL** |
| O2 | **WebSocket is unauthenticated** and broadcasts full game state to any connection. | MEDIUM |
| O3 | No Sybil resistance — `player-by-address` auto-creates a player + welcome bonus per new address. | MEDIUM |

---

## 2. Fixes applied in this pass

All centralized in a new module **`server/security.ts`** and wired into
`server/index.ts` + `server/routes.ts`.

1. **`requireAdminKey` hardened (C1, H1, H4):**
   - **Fails CLOSED in production** — missing `ADMIN_KEY` → `503`, never open.
   - **Header-only in production** (`x-admin-key`); query string accepted only
     in dev for convenience (so it never lands in prod access logs).
   - **Constant-time comparison** (`crypto.timingSafeEqual`).
   - Now imported everywhere instead of the old fail-open closure.

2. **Admin endpoints locked down (C2, H1):** `/api/admin/battles-live`,
   `/api/admin/ai-activity`, and `/api/admin/mint-status/:plotId` now all call
   `requireAdminKey`.

3. **Tiered rate limiting (C3):**
   - **`apiReadLimiter`** — coarse per-IP ceiling across the *entire* `/api`
     surface (default 1000/min, `API_RATE_LIMIT`). DoS / bulk-scrape backstop.
   - **`enumerationLimiter`** — strict per-IP cap (default 90/min,
     `ENUMERATION_RATE_LIMIT`) mounted on the nine ID/address-enumerable read
     endpoints. A real client touches these occasionally; a scraper walking the
     keyspace gets throttled to a crawl. This is the primary EPI defense.

4. **`/api/world/events` clamped (H2):** caller `limit` bounded to ≤200 via
   `clampLimit`.

5. **`/api/blockchain/status` minimized (H3):** admin live balances are no
   longer returned to anonymous callers — surfaced only to an authenticated
   admin (`x-admin-key`). The admin *address* stays (clients need it as a
   payment target; it is public on-chain anyway).

**Verification:** `tsc` clean; all 53 server tests pass; isolated runtime tests
confirm the enumeration limiter returns `429` past the threshold, the admin
gate returns `503` when the key is unset in production, and `clampLimit` bounds
correctly. Express 5 path patterns validated at runtime.

### New / changed env vars
See `ENV_VARS.md`: `API_RATE_LIMIT`, `ENUMERATION_RATE_LIMIT`, plus the
`ADMIN_KEY` behavior change (fail-closed, header-only in prod).

---

## 3. Recommended next pass — the big one (O1)

Rate limiting throttles scraping but does **not** stop a determined actor from
*acting as another player*. The deepest issue is that the server trusts a
client-supplied `playerId`/`address` with no cryptographic proof.

**Recommended design (wallet-signature session):**
1. `GET /api/auth/nonce?address=…` → server issues a short-lived random nonce.
2. Client signs the nonce with the connected wallet (Pera/Defly/LUTE) via
   `signBytes`.
3. `POST /api/auth/verify` → server verifies with `algosdk.verifyBytes`, then
   issues a signed, expiring session token (httpOnly cookie or bearer).
4. `assertPlayerOwnership` is replaced by "resolve player from the verified
   session token" — the `playerId` in the body is no longer trusted.
5. Same token gates the WebSocket upgrade (fixes O2) and scopes broadcasts.

This touches the live client wallet flow, so it should be implemented and
tested against the real LUTE/Pera connect path as a focused follow-up rather
than blindly — a broken auth gate locks every player out. Flagged here as the
#1 remaining security item.
