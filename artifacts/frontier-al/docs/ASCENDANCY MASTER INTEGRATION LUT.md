# ASCENDANCY — Master Integration & Branching LUT

### The plan that ties everything together · Branch strategy · Folder architecture · Wallet hardening

> Synthesizes all prior LUTs into one execution plan · June 2026
> Engineering principle: separate concerns, branch cleanly, ship incrementally, never reset

-----

## HOW TO USE THIS DOCUMENT

This is the **master plan.** The prior LUTs (Globe, Dormant Systems, Security, HILDA,
Jarvis) are the *what*. This is the *how* — the branch structure, folder architecture,
and execution order that turns all of it into shipped code without chaos.

Read order: this doc → execute branch by branch → each branch references its detailed LUT.

-----

## PART 1 — WALLET INTEGRATION AUDIT & HARDENING

### Current state: modern and mostly current ✅

Your wallet architecture is **already done the right way.** You use `@txnlab/use-wallet`
v4 — the official unified wallet abstraction for Algorand. This is the correct choice; it
means you don’t hand-instantiate each wallet SDK, you configure them declaratively and
use-wallet handles connection, signing, and session across all of them.

```typescript
// client/src/lib/walletManager.ts — current
export const walletManager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.DEFLY, WalletId.KIBISIS, WalletId.LUTE],
  defaultNetwork: network,   // mainnet/testnet from VITE_ALGORAND_NETWORK
});
```

### Version audit (checked against npm live)

|Package                    |Installed|Latest   |Status      |
|---------------------------|---------|---------|------------|
|`@txnlab/use-wallet`       |4.6.0    |4.6.0    |✅ Current   |
|`@txnlab/use-wallet-react` |4.6.0    |4.6.0    |✅ Current   |
|`@blockshake/defly-connect`|1.2.1    |1.2.1    |✅ Current   |
|`lute-connect`             |1.7.0    |1.7.0    |✅ Current   |
|`algosdk`                  |3.5.2    |3.5.2    |✅ Current   |
|`@perawallet/connect`      |**1.4.2**|**1.5.2**|⚠️ **Behind**|

### The one update needed: Pera Connect

Your `package.json` specifies `@perawallet/connect: ^1.4.2`. The caret *should* allow
1.5.2, but your lockfile may be pinned. Update it:

```bash
cd artifacts/frontier-al
pnpm update @perawallet/connect@latest
pnpm run check    # verify tsc still passes
```

Note: the supply-chain `minimumReleaseAge: 1440` setting in your workspace means a package
must be 1 day old before install — 1.5.2 is well past that, so it’ll install fine.

### Wallet security checklist

Your wallets connect client-side and sign client-side — the private keys never touch your
server, which is correct. But the security gap from the Security LUT applies directly here:

- [ ] **Signature auth (from Security LUT §1).** use-wallet can sign arbitrary bytes —
  this is exactly what you need for the nonce-signing auth flow. The wallets are
  already capable; the backend just needs to verify.
- [ ] **Network consistency.** `walletManager` reads `VITE_ALGORAND_NETWORK`. Confirm this
  matches the server’s `ALGORAND_NETWORK` — a mismatch means the wallet signs for one
  network while the server expects another. Add a startup check that compares them.
- [ ] **Transaction review.** When a wallet signs a transaction, confirm the client shows
  the user what they’re signing (amount, recipient, asset). Never sign opaque bytes
  without display except for the auth nonce.
- [ ] **Disconnect hygiene.** On logout, clear the use-wallet session AND the server
  session (once §1 lands) so a shared device doesn’t leak access.

### Kibisis note

You include `WalletId.KIBISIS`. Confirm it’s still actively maintained and that you want
it — it’s a browser-extension wallet. If you’re not actively supporting it, dropping it
narrows your security surface. Keep Pera + Defly + Lute as the core three (all current).

-----

## PART 2 — THE FOLDER ARCHITECTURE

### The principle: separate by concern, not by type

Right now everything lives in `artifacts/frontier-al`. As you add HILDA, Jarvis, and the
auth layer, the monorepo should separate **the game** from **the workers** from **the
shared libraries.** Here’s the target structure.

### Target monorepo layout

```
FRONTIERNeXt/
├── artifacts/
│   ├── frontier-al/              # THE GAME (existing — keep lean)
│   │   ├── client/               # React + R3F frontend
│   │   │   └── src/
│   │   │       ├── components/
│   │   │       │   └── game/
│   │   │       │       ├── globe/         # globe rendering
│   │   │       │       └── subparcel/     # NEW — archetype/building UI
│   │   │       ├── contexts/              # WalletContext etc
│   │   │       ├── hooks/
│   │   │       └── lib/
│   │   │           ├── globe/             # globe constants/utils
│   │   │           └── auth/              # NEW — wallet signature auth client
│   │   ├── server/               # Express game backend
│   │   │   ├── routes/           # REFACTOR — split routes.ts by domain
│   │   │   │   ├── actions.ts
│   │   │   │   ├── auth.ts                # NEW — nonce/verify
│   │   │   │   ├── subparcels.ts
│   │   │   │   ├── markets.ts
│   │   │   │   ├── trade.ts
│   │   │   │   ├── admin.ts
│   │   │   │   └── nft.ts
│   │   │   ├── engine/           # battle engine (pure, untouched)
│   │   │   ├── storage/          # DB layer
│   │   │   ├── services/chain/   # Algorand integration
│   │   │   ├── middleware/       # NEW — auth, rate-limit, audit
│   │   │   └── config/           # NEW — gameConfig.ts (tunables)
│   │   └── shared/               # shared types/schema
│   │
│   ├── api-server/               # WORKER HOST (existing scaffold — activate)
│   │   └── src/
│   │       ├── workers/
│   │       │   ├── hilda/        # video production worker
│   │       │   ├── cipher/       # TS auditor agent
│   │       │   ├── atlas/        # analytics worker
│   │       │   └── nexus/        # social worker
│   │       ├── hub/              # Jarvis mission orchestration
│   │       └── routes/           # worker API (missions, status)
│   │
│   └── mockup-sandbox/           # UI PROTOTYPING (existing — dev only)
│
├── lib/                          # SHARED LIBRARIES (existing)
│   ├── db/                       # Drizzle schema + client
│   ├── api-spec/                 # shared API contracts
│   └── integrations/             # NEW — wallet config, chain helpers shared
│
├── scripts/                      # build/deploy scripts
├── docs/                         # NEW — all the LUTs live here
│   ├── ASCENDANCY_LUT.md
│   ├── ASCENDANCY_GLOBE_ENGINEERING_LUT.md
│   ├── ASCENDANCY_DORMANT_SYSTEMS_LUT.md
│   ├── ASCENDANCY_SECURITY_HARDENING_LUT.md
│   └── ASCENDANCY_MASTER_INTEGRATION_LUT.md  (this file)
└── .github/workflows/ci.yml      # CI (existing)
```

### Why this separation

|Concern       |Home                    |Why separate                                                                |
|--------------|------------------------|----------------------------------------------------------------------------|
|The game      |`frontier-al`           |Player-facing, must stay lean + fast                                        |
|Workers/agents|`api-server`            |Run independently, different scaling, can crash without taking the game down|
|Shared types  |`lib/db`, `lib/api-spec`|One source of truth for both                                                |
|Prototyping   |`mockup-sandbox`        |Never ships to prod                                                         |
|Docs          |`docs/`                 |Claude Code reads these for context                                         |

This directly serves your goal: *“keep things separate, run my services separately.”* The
game server and the worker host deploy as **two separate Railway services**, sharing the
`lib/` packages. HILDA crashing never affects gameplay.

### The routes.ts refactor (important)

`server/routes.ts` is one ~3000-line file with 84 routes. Split it by domain into
`server/routes/*.ts`, each exporting a router mounted in `index.ts`. This is **additive
and mechanical** — move handlers into domain files, no logic changes. It makes the auth
refactor (Security LUT §1) far safer because you touch `actions.ts`, not a monolith.

-----

## PART 3 — THE BRANCH STRATEGY

### Branching model: trunk-based with short-lived feature branches

You work solo with AI agents, so keep it simple and disciplined:

```
main                    ← always deployable, protected, CI-gated
  │
  ├── feat/wallet-auth          (Security LUT §1 — the mainnet blocker)
  ├── feat/routes-refactor      (split routes.ts by domain)
  ├── feat/subparcel-ui         (Dormant LUT 1.1 — highest ROI)
  ├── feat/globe-visual         (Globe LUT passes 1-3)
  ├── feat/game-config          (centralize tunables now)
  ├── feat/seasons-hud          (Dormant LUT 1.3)
  ├── chore/wallet-update       (Pera 1.4.2 → 1.5.2)
  ├── feat/api-server-workers   (activate worker host)
  ├── feat/hilda-pipeline       (HILDA v2)
  └── feat/jarvis-hub           (mission dashboard)
```

### Branch rules

1. **One concern per branch.** Never mix the auth refactor with UI work.
1. **Branch from main, merge to main.** No long-lived develop branch — you’ll get merge hell.
1. **CI must pass before merge.** `tsc` + tests green (already enforced via workflow —
   make it a *required* check in GitHub branch protection).
1. **Each branch maps to a LUT section.** The commit messages reference the LUT item.
1. **Additive only.** Every branch leaves main deployable. Nothing half-removes a system.

### Branch protection setup (do this once)

GitHub → repo → Settings → Branches → add rule for `main`:

- [ ] Require pull request before merging
- [ ] Require status checks to pass (select the CI workflow)
- [ ] Require branches up to date before merging
- [ ] Do not allow bypassing the above

-----

## PART 4 — THE EXECUTION ORDER

This is the master sequence. Each phase is a branch (or a small cluster of branches).
Ordered by dependency and risk — foundational/safety first, features second, workers last.

### PHASE A — FOUNDATION (do first, unblocks everything)

**A1 · `chore/wallet-update`** — Update Pera to 1.5.2, verify tsc. *(1 hour)*

**A2 · `feat/routes-refactor`** — Split `routes.ts` into `server/routes/*.ts` by domain.
Mechanical, additive, makes everything downstream safer. *(half day)*

**A3 · `feat/game-config`** — Create `server/config/gameConfig.ts` centralizing all
tunables (pricing, archetype costs, scan, fees). Reference it from existing code. Prevents
production resets later. *(half day)*

### PHASE B — SECURITY (the mainnet blockers)

**B1 · `feat/wallet-auth`** — Implement nonce/sign/verify flow (Security LUT §1). Add
`server/routes/auth.ts`, `server/middleware/auth.ts`, `client/src/lib/auth/`. Wallets
already sign; wire the backend verification + session. *(2 days)*

**B2 · `feat/auth-refactor`** — Refactor `assertPlayerOwnership` to read from session.
Keep body-path behind a flag during transition. *(1 day)*

**B3 · `chore/security-hardening`** — Admin guard fail-closed, global rate limit, helmet,
`/api/health` + `/api/ready`, structured logging. (Security LUT §2,4,6) *(1 day)*

> **Gate: Phases A+B complete = safe to consider mainnet.** Do not mint real value before
> this gate.

### PHASE C — ACTIVATE WHAT’S BUILT (highest ROI)

**C1 · `feat/subparcel-ui`** — Build `client/src/components/game/subparcel/` panel driving
the already-built archetype/building/marketplace endpoints. (Dormant LUT 1.1) *(1 day)*

**C2 · `feat/seasons-hud`** — Season banner + confirm scheduler. (Dormant LUT 1.3) *(half day)*

**C3 · `chore/verify-markets`** — Confirm prediction markets nav + scheduler. (Dormant LUT 1.2) *(1 hour)*

### PHASE D — GLOBE OVERHAUL (visual polish, no server)

**D1 · `feat/globe-visual`** — Color fingerprint fix, lighting rig, emissive tiles,
animated ownership border. (Globe LUT passes 1-3) *(1 day)*

**D2 · `feat/globe-customization`** — Color sliders, sub-parcel LOD rendering. (Globe LUT
passes 4-5) *(1 day)*

### PHASE E — WORKER INFRASTRUCTURE (separate service)

**E1 · `feat/api-server-workers`** — Activate `api-server` as the worker host. Set up the
`workers/` + `hub/` structure. Deploy as a second Railway service. *(1 day)*

**E2 · `feat/cipher-auditor`** — CIPHER TS auditor via Claude Agent SDK, triggered by CI.
*(1 day)*

**E3 · `feat/hilda-pipeline`** — HILDA v2 video pipeline (needs API keys). (HILDA LUT) *(3 days)*

**E4 · `feat/jarvis-hub`** — Mission dashboard. (Jarvis LUT) *(1 week)*

### PHASE F — VISIONARY (after core is solid)

**F1 · `feat/fog-of-war`** — Visibility + scan mechanic. (Globe LUT pass 8)

**F2 · `feat/observer`** — Relativistic observer mechanic. (Globe LUT pass 9)

**F3 · `feat/lootboxes`** — Build or formally reserve. (Dormant LUT 3.1)

-----

## PART 5 — THE TWO-SERVICE DEPLOYMENT

Your “run services separately” goal, concretely:

```
┌─────────────────────────────────────────────────────────────┐
│  CLOUDFLARE PAGES                                            │
│  frontierprotocol.app — static React frontend               │
│  (artifacts/frontier-al/client → dist/public)               │
└─────────────────────────────────────────────────────────────┘
                          │ VITE_API_URL / VITE_WS_URL
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  RAILWAY SERVICE 1 — GAME BACKEND                           │
│  api.frontierprotocol.app                                   │
│  (artifacts/frontier-al/server)                             │
│  Express + WebSocket + battle engine + chain + DB/Redis     │
└─────────────────────────────────────────────────────────────┘
                          │ internal queue / shared lib/db
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  RAILWAY SERVICE 2 — WORKER HOST                            │
│  workers.frontierprotocol.app (internal)                    │
│  (artifacts/api-server)                                     │
│  HILDA · CIPHER · ATLAS · NEXUS · Jarvis hub                │
│  Separate scaling, separate crashes, separate secrets       │
└─────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
   Neon Postgres      Upstash Redis        Algorand chain
   (shared via lib/db, ownership truth on-chain)
```

**Why two Railway services, not one:**

- The game backend must stay responsive for players. A HILDA video render (~18 min) or a
  Jarvis mission must never block a battle resolution.
- Different scaling profiles — the game scales with players, workers scale with task volume.
- Different secrets — worker API keys (ElevenLabs, HeyGen, YouTube) never live on the game
  server, shrinking its attack surface.
- A worker crash can’t take down gameplay.

They share the `lib/db` package for data and communicate via the existing
`pendingFrontierTransfers`-style internal queue pattern — no public webhooks needed between
your own services.

-----

## PART 6 — THE ANTI-RESET DISCIPLINE

Restating the rule that governs all of this, because it’s your explicit priority:

1. **Every schema change is additive + nullable + defaulted.** Never destructive.
1. **Tunables live in `gameConfig.ts` now** so production rebalancing needs no migration.
1. **Positions stay computed, never stored** (already true).
1. **On-chain assets minted once** — ASA IDs recorded, never re-minted.
1. **Each branch leaves main deployable** — no half-removed systems.
1. **Workers separate from game** — activating HILDA never touches game state.

Follow these and you never reset production. New features are routes + UI on top of stable
foundations.

-----

## PART 7 — MASTER CHECKLIST

### Foundation

- [ ] Pera updated to 1.5.2
- [ ] routes.ts split by domain
- [ ] gameConfig.ts centralizes tunables
- [ ] docs/ folder holds all LUTs

### Security (mainnet gate)

- [ ] Wallet signature auth live
- [ ] Session-based identity
- [ ] Admin guard fails closed
- [ ] Secrets rotated
- [ ] Rate limits + helmet + health probes

### Activation

- [ ] Sub-parcel UI wired
- [ ] Seasons HUD
- [ ] Prediction markets confirmed live

### Globe

- [ ] Color fix + lighting + ownership border
- [ ] Customization + LOD

### Workers (separate service)

- [ ] api-server activated as worker host
- [ ] Deployed as Railway service 2
- [ ] CIPHER auditor
- [ ] HILDA pipeline
- [ ] Jarvis hub

### Infrastructure

- [ ] Branch protection on main
- [ ] CI required checks
- [ ] Two-service Railway deployment
- [ ] Subdomains: app / api / workers

-----

## PART 8 — WHAT TO HAND CLAUDE CODE FIRST

The single best starting branch is **Phase A2 (`feat/routes-refactor`)** followed
immediately by **Phase B1 (`feat/wallet-auth`)**. Reasoning:

- The routes refactor makes every subsequent change safer and is purely mechanical.
- Wallet auth is the one true mainnet blocker — the sooner it lands, the sooner everything
  else can build on a secure identity layer.

Then **Phase C1 (`feat/subparcel-ui`)** for the biggest visible gameplay win, since the
backend is already done.

Everything is sequenced, every branch maps to a detailed LUT, and nothing requires a
reset. Route it when ready — exactly as planned.

-----

*Master Integration & Branching LUT · Ascendancy · frontierprotocol.app*
*Separate concerns. Branch cleanly. Ship incrementally. Never reset.*