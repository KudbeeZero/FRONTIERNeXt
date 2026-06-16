# ASCENDANCY — Project Memory / State Layer

### The living working memory · update after every session

> Sits between SKILL.md (the rules) and the LUTs (the plans). This is the *current state*:
> what’s done, what’s in flight, what was decided. Read after SKILL, before any LUT.
> **Last updated: 2026-06-07**

-----

## HOW THIS FILE WORKS

Three-layer context system:

```
SKILL.md          → the RULES (stable, rarely changes)        "how to work here"
PROJECT_MEMORY.md → the STATE (this file, updated each session) "where we are right now"
docs/*_LUT.md     → the PLANS (detailed, referenced as needed)  "how to build X"
```

An agent loads SKILL first (rules), then this file (current state), and only opens the
specific LUT for the task at hand. This means **no session re-derives what’s already known
or already done** — the single biggest source of wasted tokens.

**Maintenance rule:** at the end of any working session, update §3 (Done), §4 (In Flight),
and §5 (Decisions) below. Keep it short — this is a state snapshot, not a history book. The
detailed history lives in `session-notes/`.

-----

## 1. ONE-LINE STATUS

> Frontend live on Cloudflare. Backend NOT yet on Railway (globe can’t load until it is).
> Four LUT blockers + production hardening already merged to main. Next critical action:
> Railway deploy. Biggest pre-mainnet gap: wallet signature auth.

-----

## 2. THE DEPLOYMENT TRUTH

|Layer      |State         |URL / Note                                   |
|-----------|--------------|---------------------------------------------|
|Frontend   |✅ LIVE        |frontierprotocol.app (Cloudflare Pages)      |
|Backend    |⛔ NOT DEPLOYED|Railway — config ready, not yet deployed     |
|Globe      |⛔ BLANK       |Needs backend; will load once Railway is up  |
|Database   |✅ EXISTS      |Neon Postgres (credential needs rotation)    |
|Redis      |✅ EXISTS      |Upstash                                      |
|Chain      |✅ TESTNET     |Algorand testnet; mainnet not yet            |
|Worker host|⬜ NOT STARTED |api-server artifact scaffolded, not activated|

**Cloudflare settings (confirmed working):** root `artifacts/frontier-al`, build
`npx vite build`, output `dist/public`, 5 VITE_ vars set.

**Railway settings (ready, not applied):** root `artifacts/frontier-al`, railway.toml
correct, env block prepared. Server binds `0.0.0.0:$PORT`.

-----

## 3. DONE — DO NOT REBUILD

### Merged to main (commit ba7fc46, 2026-06-07)

- ✅ routes.ts corruption fixed (stray comment removed)
- ✅ Battle engine wire-up Pass A + B (`resolveBattle` / `resolveBattleFromPowers`)
- ✅ AI_ENABLED guard aligned (opt-in at scheduler + both storage runAITurn)
- ✅ $ASCEND display rebrand (FRNTR → ASCEND, display layer only)
- ✅ data_centre yield bug fixed
- ✅ Production hardening: action rate limiting, PUBLIC_BASE_URL env-only, mainnet-gated
  testnet routes, 1mb body caps, prod log-leak fix, WS connection caps, CI workflow
- ✅ Test coverage: battle engine, tuning, rng, economy, biome

### Built earlier, confirmed present

- ✅ Sub-parcel archetype/building/marketplace — FULL backend, routes live, no UI yet
- ✅ Prediction markets — FULL stack (storage + routes + 427-line UI)
- ✅ Seasons — FULL backend (start/settle/history), no HUD yet
- ✅ Treasury ledger — wired into 3 panels
- ✅ Wallet integration — use-wallet v4, all current except Pera (1.4.2 → needs 1.5.2)
- ✅ Idempotency tables + retry transfer queue
- ✅ Deterministic Fibonacci sphere (client/server parity)

-----

## 4. IN FLIGHT / NEXT (the working queue)

Ordered. When you finish one, move it to §3 and update the date.

|Pri|Task                        |Branch              |LUT ref             |Blocker?        |
|---|----------------------------|--------------------|--------------------|----------------|
|1  |Railway backend deploy      |(infra)             |RAILWAY_DEPLOY_GUIDE|Unblocks globe  |
|2  |Rotate Neon + SESSION_SECRET|(infra)             |SECURITY §7         |Pre-mainnet     |
|3  |Pera wallet 1.4.2 → 1.5.2   |chore/wallet-update |MASTER P1           |No              |
|4  |Split routes.ts by domain   |feat/routes-refactor|MASTER A2           |Makes auth safer|
|5  |Wallet signature auth       |feat/wallet-auth    |SECURITY §1         |**MAINNET GATE**|
|6  |Session identity refactor   |feat/auth-refactor  |SECURITY §1         |**MAINNET GATE**|
|7  |Sub-parcel UI               |feat/subparcel-ui   |DORMANT 1.1         |Highest ROI     |
|8  |Globe color fix + lighting  |feat/globe-visual   |GLOBE passes 1-3    |No              |
|9  |gameConfig.ts tunables      |feat/game-config    |DORMANT + MASTER A3 |Anti-reset      |

**The biggest single win available right now:** Sub-parcel UI (task 7) — the entire backend
is already built, so one day of frontend unlocks the deepest gameplay layer.

**The thing that must happen before mainnet:** tasks 5+6 (wallet auth). No real value goes
live on body-trust identity.

-----

## 5. DECISIONS LOG (settled — don’t relitigate)

These were decided. Don’t re-debate them in future sessions.

- **Token name = $ASCEND** (not $TIER, not $FRNTR). Final.
- **Contracts in Algorand TypeScript**, not Python — stay single-language with the stack.
- **IDE = Antigravity** (Google’s Gemini IDE) — fine, Python optional, not required.
- **Workers framework:** LangGraph (stateful workflows) + Claude Agent SDK (CIPHER auditor)
  - CrewAI (multi-worker). Python is acceptable for workers. NOT Mastra (TS-only, unneeded).
- **HILDA video stack:** ElevenLabs (voice clone) + HeyGen (avatar) + Kling (b-roll) +
  Shotstack (assembly) + YouTube API. NOT Render Network (wrong tool — API latency, not GPU,
  is the bottleneck). inference.sh is a viable unified alternative.
- **Two Railway services:** game backend (`frontier-al`) + worker host (`api-server`),
  sharing `lib/db`. Workers never block gameplay; worker secrets never on game server.
- **Architecture is NOT migrating/rebuilding** — additive changes only, forever.
- **Battle engine biome defense:** engine `BIOME_DEFENSE_MOD` is canonical (mountain 1.4 /
  water 0.5 / swamp 1.1 / volcanic 1.3); it superseded the old `schema.biomeBonuses` for
  those 4 biomes. Confirmed intentional — matches documented design.

-----

## 6. ACTIVE GOTCHAS (live traps to remember)

- **Globe color bug:** `currentPlayerId` is null at first paint → own parcels show as enemy.
  Fix = add `currentPlayerId` to `plotVisualFingerprint` deps. (Not yet applied.)
- **Admin guard dev-hole:** `if (!ADMIN_KEY) return true` opens all admin routes incl.
  `/api/game/reset`. Must fail-closed in production. (Not yet applied.)
- **VITE vars bake at build:** changing `VITE_API_URL`/`VITE_WS_URL` requires a Cloudflare
  redeploy — setting them does nothing until rebuild.
- **Cloudflare double-nest trap:** never set both root dir AND full output path — causes
  `artifacts/frontier-al/artifacts/frontier-al/dist/public`.
- **mockup-sandbox** has a React 18/19 type mismatch — keep it OUT of prod builds entirely.
- **Neon credential** was exposed in chat — rotate before mainnet.
- **routes.ts** is a 3000-line monolith — split before the auth refactor to reduce risk.

-----

## 7. THE NUMBERS (quick reference)

- Parcels: **21,000** (PLOT_COUNT) · polar exclusion ±75° latitude
- Sub-parcels: 3×3 = **9 per macro-plot** · MAX_SUB_TILES = 4,500 (500 plots)
- Routes: **84** in routes.ts
- Globe radius: 2 · golden angle: π(3−√5)
- Factions: 4 (NEXUS-7, KRONOS, VANGUARD, SPECTRE)
- Battle seed: `hashSeed(battleId, startTs)` — deterministic
- Welcome bonus: 500 tokens (one per verified address — enforce after auth)
- Build verify: `pnpm run check` (tsc) + `pnpm run test:server`

-----

## 8. THE DOCUMENT INDEX (what to open for what)

|Need                                 |Open                  |
|-------------------------------------|----------------------|
|How to work here (rules)             |SKILL.md              |
|Where we are now                     |THIS FILE             |
|Deploy backend                       |RAILWAY_DEPLOY_GUIDE  |
|Globe / parcels / sub-parcel design  |GLOBE_ENGINEERING_LUT |
|What’s built and dormant             |DORMANT_SYSTEMS_LUT   |
|Auth / security / hardening          |SECURITY_HARDENING_LUT|
|Branching / folders / wallets        |MASTER_INTEGRATION_LUT|
|Chat / weather / contests / narration|LIVING_WORLD_LUT      |
|Video worker (HILDA)                 |HILDA_v2_Pipeline     |
|Original roadmap / Jarvis            |ASCENDANCY_LUT        |

-----

## 9. SESSION HANDOFF TEMPLATE

Copy this at the end of a session to update the memory cleanly:

```
SESSION [date]:
- Completed: [tasks → move to §3]
- In flight: [update §4 queue]
- Decided: [new settled decisions → §5]
- New gotchas: [→ §6]
- Next session should start with: [task]
```

Keep the detailed narrative in `session-notes/[date].md`; keep THIS file a tight snapshot.

-----

*Project Memory / State Layer · Ascendancy · update every session · frontierprotocol.app*
*SKILL = rules. THIS = state. LUTs = plans. Load in that order; never re-derive what’s here.*