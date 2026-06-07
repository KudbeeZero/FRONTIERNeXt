# ASCENDANCY — Security, Hardening & Backend Integrity LUT

### Auth model · API surface · Middleware · Webhooks · Debugging · Pre-mainnet

> Full security scan of FRONTIERNeXt backend · June 2026
> Priority order per your system role: Security > Economic Integrity > Performance > Scale > UX > Dev Speed

-----

## EXECUTIVE SUMMARY — THE ONE FINDING THAT MATTERS MOST

> **The backend trusts `playerId` in the request body. There is no cryptographic proof
> that the caller actually controls the wallet they claim to be.**

This is the single most important security issue in the codebase. Everything else is
secondary. I’ll cover it first, in full, then the complete hardening surface.

The good news: the architecture is otherwise solid. Rate limiting, CORS, admin-key
guards, input validation (zod, 27 uses), body-size caps, and the AI guard are all
present after the recent hardening pass. The auth model is the gap.

-----

## 1. THE AUTH MODEL — CRITICAL

### How it works today

Every player action (`/api/actions/*`, sub-parcel ops, trades, bets) calls
`assertPlayerOwnership(req, res)`, which does this:

```typescript
async function assertPlayerOwnership(req, res, bodyPlayerId?) {
  const targetId = bodyPlayerId ?? req.body?.playerId;
  if (!targetId) { res.status(401)...; return null; }
  const player = await storage.getPlayer(targetId);
  if (!player)   { res.status(404)...; return null; }
  if (player.isAI) { res.status(403)...; return null; }
  return targetId;          // ← trusts the ID as proof of identity
}
```

**The flaw:** it verifies the player *exists* and *isn’t an AI*, but never verifies the
*caller is that player.* Anyone who knows or guesses a `playerId` can act as that player —
mine their resources, move their troops, spend their $ASCEND, sell their land.

Similarly, `connect-wallet` binds an address to a playerId with **no signature**:

```typescript
const { playerId, address } = req.body;
// validates address format only — never proves the caller owns the private key
await storage.updatePlayerAddress(playerId, address);
```

An attacker could bind *their* address to *your* playerId, or claim a welcome bonus
repeatedly across fabricated IDs.

### Why this matters for an on-chain game

Your whole value proposition is verifiable ownership. But the *game actions* that move
on-chain value (claiming $ASCEND, transferring land NFTs, trading) are gated only by an
unauthenticated string. The chain is secure; the API in front of it is not.

### The fix — wallet signature authentication

This is the standard Web3 auth pattern. Implement it before mainnet, full stop.

**Flow:**

```
1. Client requests a nonce:        GET  /api/auth/nonce?address=ALGO_ADDR
   Server returns a random nonce, stores it (Redis, short TTL) keyed to address.

2. Client signs the nonce with their wallet (Pera/Lute/Defly):
   signature = wallet.signBytes(nonce)

3. Client sends signature:          POST /api/auth/verify
   { address, signature, nonce }

4. Server verifies with algosdk:
   const valid = algosdk.verifyBytes(nonceBytes, signature, address);
   If valid → issue a session (express-session, already installed) bound to
   the verified address + playerId. Delete the nonce.

5. All subsequent actions read identity from req.session, NOT req.body.playerId.
```

**Implementation skeleton:**

```typescript
import algosdk from "algosdk";

// Step 1
app.get("/api/auth/nonce", async (req, res) => {
  const { address } = req.query;
  if (!algosdk.isValidAddress(address as string)) {
    return res.status(400).json({ error: "Invalid address" });
  }
  const nonce = `ascendancy-auth-${randomUUID()}-${Date.now()}`;
  await redis.set(`nonce:${address}`, nonce, { ex: 300 });  // 5-min TTL
  res.json({ nonce });
});

// Step 4
app.post("/api/auth/verify", async (req, res) => {
  const { address, signature, nonce } = req.body;
  const stored = await redis.get(`nonce:${address}`);
  if (!stored || stored !== nonce) {
    return res.status(401).json({ error: "Invalid or expired nonce" });
  }
  const nonceBytes = new TextEncoder().encode(nonce);
  const sigBytes = Uint8Array.from(Buffer.from(signature, "base64"));
  const valid = algosdk.verifyBytes(nonceBytes, sigBytes, address);
  if (!valid) {
    return res.status(401).json({ error: "Signature verification failed" });
  }
  await redis.del(`nonce:${address}`);
  const player = await storage.getOrCreatePlayerByAddress(address);
  req.session.playerId = player.id;       // ← session-bound identity
  req.session.address = address;
  res.json({ success: true, playerId: player.id });
});
```

**Then refactor `assertPlayerOwnership`** to read from the session:

```typescript
async function assertPlayerOwnership(req, res): Promise<string | null> {
  const sessionPlayerId = req.session?.playerId;
  if (!sessionPlayerId) {
    res.status(401).json({ error: "Not authenticated — connect wallet" });
    return null;
  }
  // optional: still confirm the player exists + isn't AI
  return sessionPlayerId;
}
```

**Migration note:** This is additive. Keep the body-`playerId` path working behind a
feature flag during transition, then flip to session-only before mainnet. The
`express-session` + `connect-pg-simple` stack is already installed — you have everything
needed.

### Rate-limit the auth endpoints separately

Nonce generation and verification need their own tight rate limit (e.g. 10/min per IP)
to prevent nonce-farming and signature brute-force.

-----

## 2. API SURFACE AUDIT — 84 ROUTES

### Route security classification

|Class                                      |Count (approx)|Current guard                       |Needs                             |
|-------------------------------------------|--------------|------------------------------------|----------------------------------|
|Public reads (`GET /api/game/*`, status)   |~25           |None (correct)                      |Rate limit only                   |
|Player actions (`/api/actions/*`)          |~20           |`assertPlayerOwnership` (body trust)|**Session auth (§1)**             |
|Sub-parcel ops                             |~9            |`assertPlayerOwnership`             |**Session auth (§1)**             |
|Trade / markets                            |~6            |`assertPlayerOwnership`             |**Session auth + economic checks**|
|Admin (`/api/admin/*`, game/reset, ai-turn)|~8            |`requireAdminKey` ✅                 |Confirm key set in prod           |
|NFT delivery                               |~4            |address validation                  |Consider admin-gating             |

### The admin guard has a dev-mode hole

```typescript
function requireAdminKey(req, res): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return true;   // ← No key configured → ALLOWS EVERYTHING
  ...
}
```

If `ADMIN_KEY` is ever unset in production, **every admin route opens** — including
`/api/game/reset`, which wipes the world. This is fine for local dev but catastrophic
in prod.

**Fix:** Make production fail-closed:

```typescript
function requireAdminKey(req, res): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    if (process.env.NODE_ENV === "production") {
      res.status(503).json({ error: "Admin not configured" });
      return false;          // ← fail CLOSED in prod
    }
    return true;             // dev only
  }
  const provided = req.headers["x-admin-key"] ?? req.query.adminKey;
  if (provided !== adminKey) { res.status(403)...; return false; }
  return true;
}
```

### Dangerous routes to double-lock

- `POST /api/game/reset` — wipes world. Admin-key + a second confirmation token, and
  hard-disable when `NODE_ENV=production` unless an explicit `ALLOW_RESET=true` is set.
- `POST /api/admin/markets/:id/resolve` — resolves prediction markets (moves money).
  Admin-key is right; add an audit-log entry on every resolution.
- `POST /api/orbital/trigger` — verify it’s admin-gated or scheduler-only, not public.

-----

## 3. ECONOMIC INTEGRITY

Per your priority order, economic exploits rank just below security. The battle engine
tests landed, but these flows need adversarial review:

### 3.1 — Welcome bonus replay

`connect-wallet` grants 500 tokens if `!welcomeBonusReceived`. With no auth, an attacker
could create many players and farm bonuses. **Session auth (§1) + one-bonus-per-verified-
address** closes this. Add a unique constraint or check on `address` for bonus grants.

### 3.2 — Trade/market double-spend & race conditions

`POST /api/trade/orders/:id/fill` and `/markets/:id/bet` move value. Verify:

- Filling an order is atomic (DB transaction, row lock) so two fills can’t both succeed.
- Bets can’t exceed balance via concurrent requests (the rate limiter helps but isn’t a
  substitute for a balance check inside a transaction).

> **UPDATE 2026-06-07 (money-path follow-up pass):** `placeBet` and `claimWinnings`
> are now wrapped in `this.db.transaction` with **atomic compare-and-set** writes
> (conditional `frontier >= amount` debit; guarded `claimed=false … RETURNING`
> claim) — not just a transaction wrapper, since Postgres READ COMMITTED alone
> won't stop a lost update. This closes the concurrent-overdraft bet race **and** a
> previously-unflagged double-claim/double-payout race in `claimWinnings`. See
> `docs/audit/2026-06-07-money-path-and-epi-followup.md`.

### 3.3 — Resource mining / claim cadence

`/api/actions/mine` and `/api/actions/claim-frontier` accrue value over time. Confirm the
server computes elapsed time from a **server-stored timestamp**, never a client-supplied
one, so players can’t fast-forward accrual.

### 3.4 — Attack economics

Confirm pillage caps (`PILLAGE_RATE * stored`) are enforced server-side and that a player
can’t attack the same target in a tight loop to drain it faster than intended (concurrent
attack cap — your roadmap’s Commander gate addresses this).

-----

## 4. MIDDLEWARE STACK REVIEW

Current stack (in order, from `server/index.ts`):

```
1. helmet-style headers (line 64)        ✅ security headers
2. express.urlencoded (limit 1mb)        ✅ body cap
3. express.json (limit 1mb)              ✅ body cap
4. CORS handler (line 80)                ✅ CLIENT_ORIGIN allowlist
5. request context/logger (line 104)     ✅ no body echo in prod
6. actionsLimiter on /api/actions (142)  ✅ rate limit
7. main request logger (155)             ✅
8. error handler (242)                   ✅ centralized
```

This is a solid stack. Gaps to close:

### 4.1 — Helmet

Confirm line 64 is actually `helmet()` (it’s installed). It should set CSP, HSTS,
X-Frame-Options, etc. If it’s a hand-rolled header block, switch to `helmet()` for
completeness, with a CSP that allows your Algorand node + Cloudflare origins.

### 4.2 — Global rate limit

The limiter only covers `/api/actions`. Add a looser global limiter (e.g. 300/min/IP) on
all `/api` so read endpoints can’t be hammered to exhaust the DB/Neon compute.

### 4.3 — Auth-endpoint rate limit

Per §1, a tight limiter on `/api/auth/*`.

### 4.4 — Request ID + structured logging

Add a request-id middleware (uuid per request) and move from `console.*` to a structured
logger (pino) with levels. This is the foundation for real debugging in production
(§6). Your `api-server` artifact already has a `lib/logger.ts` — reuse that pattern.

### 4.5 — trust proxy

Confirm `app.set("trust proxy", 1)` is set (the hardening pass mentioned it for the rate
limiter). Required behind Railway/Cloudflare so the limiter sees real client IPs, not the
proxy’s.

-----

## 5. WEBHOOKS & EXTERNAL INTEGRATIONS

### Current state: no webhooks exist

The scan found **zero webhook endpoints.** That’s fine today, but you’ll need them for:

|Integration             |Webhook need                |Security pattern              |
|------------------------|----------------------------|------------------------------|
|HILDA → YouTube         |Upload status callbacks     |HMAC signature verification   |
|Payment (if fiat onramp)|Stripe-style payment events |Stripe signature header verify|
|Algorand indexer        |On-chain event notifications|IP allowlist + nonce          |
|Jarvis workers          |Mission completion callbacks|Internal shared-secret header |

### The webhook security rule (when you add them)

**Never trust a webhook payload without verifying its origin.** Every webhook endpoint
must:

1. Verify an HMAC signature (provider signs the payload with a shared secret).
1. Check a timestamp to reject replays (reject if older than ~5 min).
1. Be idempotent (the same event delivered twice must not double-process — you already
   have `mintIdempotency` and `commanderMintIdempotency` tables; follow that pattern).

```typescript
// Webhook verification skeleton
app.post("/api/webhooks/:provider", express.raw({ type: "*/*" }), (req, res) => {
  const sig = req.headers["x-signature"];
  const expected = crypto.createHmac("sha256", process.env.WEBHOOK_SECRET!)
    .update(req.body).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.status(401).end();
  }
  // check timestamp, check idempotency key, then process
});
```

> Note: webhooks need the **raw body**, so they must be registered BEFORE the global
> `express.json()` parser, or use a per-route raw parser as shown.

### The pending-transfer queue is your internal event backbone

You already have `pendingFrontierTransfers` + an `enqueueFrontierTransfer` worker with
retries. This is a good pattern — extend it into a general **job queue** for HILDA/Jarvis
rather than inventing webhooks where an internal queue suffices.

-----

## 6. DEBUGGING & OBSERVABILITY

You can’t debug production with `console.log`. Here’s the observability layer to add.

### 6.1 — Structured logging (pino)

Replace `console.*` with leveled, JSON-structured logs. Each log carries the request id,
playerId (when authed), route, and duration. Railway captures stdout — structured JSON
makes it searchable.

### 6.2 — Error tracking

The `@datadog/browser-rum` packages are already installed (frontend). Add backend error
tracking — either Datadog APM or Sentry — so server exceptions surface with stack traces
and request context, not just a 500.

### 6.3 — Health & readiness endpoints

You have `/api/blockchain/status`. Add:

- `GET /api/health` — liveness (process up). Returns 200 always if the server runs.
- `GET /api/ready` — readiness (DB reachable, Redis reachable, Algorand reachable).
  Railway can use this to gate traffic. Returns 503 if any dependency is down.

```typescript
app.get("/api/ready", async (_req, res) => {
  const checks = await Promise.allSettled([
    db.execute(sql`SELECT 1`),
    redis.ping(),
    getAdminBalance(),
  ]);
  const ok = checks.every(c => c.status === "fulfilled");
  res.status(ok ? 200 : 503).json({
    db:    checks[0].status,
    redis: checks[1].status,
    algod: checks[2].status,
  });
});
```

### 6.4 — Audit log for sensitive actions

Create an append-only audit trail (you have `treasuryLedger` + `gameEvents` — extend the
pattern) for: admin actions, market resolutions, NFT transfers, large $ASCEND movements,
season settlements. When something goes wrong economically, this is how you reconstruct
what happened.

### 6.5 — The TypeScript auditor (CIPHER) as a debugging gate

Formalize the always-on TS check: the CI workflow runs `tsc` on every push. Extend it to
also run the vitest suites + a lint pass. Make these **required status checks** on the
main branch so nothing merges that breaks the build or tests.

-----

## 7. PRE-MAINNET SECURITY CHECKLIST

> **STATUS — 2026-06-07:** The code-level blockers below were closed across the
> five-pass API access-control audit (`docs/audit/2026-06-07-api-access-control-audit.md`)
> and the money-path follow-up pass (`docs/audit/2026-06-07-money-path-and-epi-followup.md`).
> Boxes checked `[x]` are done in code; unchecked items are **operator/infra tasks**
> (rotate secrets, wire probes/logging, upgrade Neon, enforce CI) that must still be
> completed on the deployment host before mainnet.

### Block mainnet until ALL of these are true:

**Authentication**

- [x] Wallet signature auth implemented (§1) — audit pass 2
- [x] Actions read identity from session, not body — audit pass 2 (global ownership guard)
- [x] Auth endpoints rate-limited separately — audit pass 5 (`authLimiter`)
- [x] Welcome bonus is one-per-verified-address — audit pass 4 (`welcomeBonusReceived` + Sybil gate)

**Authorization**

- [x] `requireAdminKey` fails closed in production (§2) — audit pass 1
- [ ] `ADMIN_KEY` set to strong random value on Railway (operator)
- [ ] `/api/game/reset` hard-disabled in prod unless explicit flag
- [ ] Market resolution + NFT transfer write audit-log entries

**Secrets** (all operator tasks on the host — never committed)

- [ ] `DATABASE_URL` rotated (exposed earlier in chat)
- [ ] `SESSION_SECRET` rotated, strong, prod-only
- [ ] `ALGORAND_ADMIN_MNEMONIC` never logged, never in client bundle
- [ ] No secret reachable via any `VITE_*` var (those ship to the browser)

**Economic**

- [ ] Order fills atomic (transaction + row lock)
- [x] Bets/spends balance-checked inside a transaction — money-path pass (`placeBet` atomic debit; `claimWinnings` guarded claim)
- [ ] Accrual computed from server timestamps only
- [ ] Pillage + attack caps enforced server-side
- [x] AI guard active at storage layer (done ✅)

**Network / chain**

- [x] `ALGORAND_NETWORK` startup assertion (testnet code can’t hit mainnet)
- [x] `PUBLIC_BASE_URL` env-only (done ✅)
- [ ] Mainnet ASA minted once, ID recorded, never re-minted

**Infrastructure**

- [x] `trust proxy` set for real client IPs
- [x] Global rate limit on all `/api` — audit pass 1 (`apiReadLimiter`)
- [ ] `helmet()` with proper CSP
- [ ] `/api/ready` readiness probe wired to Railway
- [ ] Structured logging + error tracking live
- [ ] Neon upgraded from free tier
- [ ] CI required checks enforced on main

-----

## 8. HARDENING ROADMAP (ordered)

|# |Item                           |Priority|Effort  |Type      |
|--|-------------------------------|--------|--------|----------|
|1 |Wallet signature auth          |CRITICAL|2 days  |Full stack|
|2 |Session-based identity refactor|CRITICAL|1 day   |Backend   |
|3 |Admin guard fail-closed        |CRITICAL|1 hr    |Backend   |
|4 |Secret rotation                |CRITICAL|1 hr    |Infra     |
|5 |Economic atomicity audit       |HIGH    |1 day   |Backend   |
|6 |Global + auth rate limits      |HIGH    |2 hr    |Middleware|
|7 |Structured logging (pino)      |HIGH    |half day|Backend   |
|8 |/api/health + /api/ready       |HIGH    |2 hr    |Backend   |
|9 |Error tracking (Sentry/Datadog)|MEDIUM  |half day|Backend   |
|10|Audit log for sensitive actions|MEDIUM  |half day|Backend   |
|11|helmet() + CSP                 |MEDIUM  |2 hr    |Middleware|
|12|Webhook framework (when needed)|LATER   |1 day   |Backend   |
|13|CIPHER auditor formalized      |MEDIUM  |1 day   |DevOps    |

**Items 1–4 are the mainnet blockers.** Nothing involving real value should go live until
wallet signature auth replaces body-trust. Everything else hardens around that core.

-----

## 9. WHAT’S ALREADY GOOD (don’t redo)

Credit where due — the recent hardening pass and the original build got a lot right:

- ✅ Rate limiting on actions (express-rate-limit)
- ✅ CORS allowlist via CLIENT_ORIGIN
- ✅ Body-size caps (1mb)
- ✅ Admin-key guard exists (just needs fail-closed)
- ✅ Input validation (zod, 27 uses)
- ✅ AI guard at storage layer
- ✅ Production log-leak fixed (no body echo)
- ✅ Mainnet-gated testnet routes
- ✅ WebSocket connection caps + maxPayload
- ✅ Idempotency tables for mints
- ✅ Retry-backed transfer queue
- ✅ Centralized error handler
- ✅ CI workflow running tsc + tests

The foundation is genuinely strong. The auth model is the one architectural gap, and
it’s a well-understood, well-documented fix.

-----

*Security, Hardening & Backend Integrity LUT · Ascendancy · frontierprotocol.app*
*Fix the auth model first. Everything else hardens around it.*