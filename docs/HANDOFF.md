# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> Detailed history lives in git + [`artifacts/frontier-al/session-notes/`](../artifacts/frontier-al/session-notes/).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

### ✅ Definition of done — EVERY session ends in this state (owner directive 2026-07-07)
A session is NOT finished until all of these hold — check them, don't assume:
1. **`main` is green** — CI passed on the actual head commit of `origin/main` (not a stale or
   `[skip ci]` run). If your merge broke main, fixing it IS your session, whatever else you planned.
2. **The loop is closed** — this chat's unit is committed → pushed → PR'd → baton rewritten.
   No half-open state: no unpushed commits, no PR-less pushed branch, no baton describing work
   that isn't on GitHub.
3. **Local == GitHub (the website is the truth the owner sees).** The container is ephemeral —
   anything not pushed is lost. Verify mechanically before ending:
   `git status` clean · `git fetch origin && git log origin/<branch>..HEAD` empty (nothing
   local-only) · every open PR's head on GitHub matches what you tested locally.
4. **You have the tools — use them.** `/closeout` or `/end-session` runs this checklist;
   `/pr-gate` gives the mechanical go/no-go; CI status comes from the GitHub MCP tools
   (`pull_request_read` get_check_runs / `actions_*`) — never claim green without reading it.
   If a push or PR call fails, retry with backoff; do not end the session with work only local.

## Current baton — 🟡 AWAITING_AUDIT: PR #213 (`fix/mobile-white-screen`) open, CI green, not yet audited

**Earlier this session, all merged on green:** #207 (roadmap/baton rewrite — audited CONCERNS,
corrected, merged; [audit](./audits/docs-roadmap-full-scope-audit.md)), #208 (M1-1,
`grantWelcomeBonus` double-enqueue funds fix — merged directly by the owner), #209 (M1-2,
`placeBet` lost-update fix — independently audited PASS;
[audit](./audits/claude-handoff-audit-f5w0qn.md)). Session notes:
[#208](../artifacts/frontier-al/session-notes/2026-07-07-fix-welcome-bonus-double-enqueue.md) ·
[#209](../artifacts/frontier-al/session-notes/2026-07-07-fix-placebet-atomicity.md).

**#210 (M1-3, wallet-popup vectors P1+P3) merged** as `d9f5ff6` — **audited CONCERNS → fixed →
PASS.** Independent auditor found the P1 (single-provider hoist) and P3 (purge-gate narrowing)
fixes solid, well-tested, and correctly scoped, but surfaced an undisclosed gap: the new
module-level auto-auth guard cleared only on the explicit `disconnect()` button, not on the
broader "reset auth state" effect that fires whenever the wallet address drops for **any**
reason — a wallet-SDK hiccup that self-resumes the same address mid-session could leave a
player silently unauthenticated to the game server forever, with no recovery short of a manual
disconnect. Owner delegated the fix decision; corrected by also clearing that memory in the
broader reset effect, plus a new regression test. Re-verified: tsc clean, client 298/298,
server 446/24 skipped (unchanged), build green. Full audit trail:
[docs/audits/pr-210-audit.md](./audits/pr-210-audit.md). Session note:
[2026-07-07-fix-wallet-popup-vectors-p1-p3.md](../artifacts/frontier-al/session-notes/2026-07-07-fix-wallet-popup-vectors-p1-p3.md).
CI + Fly deploy both confirmed green on `d9f5ff6`.

**Working branch reset to a clean `origin/main` (`d9f5ff6`) at that point — no uncommitted
changes, no open PR.** (Since then, this same session continued straight into the weapons
plan + unit 1 — see below.)

**#211 (weapons unit 1, `feat/armory-loadout-polish`) merged** as `0ced366` — **audited
PASS, no CONCERNS.** Independent auditor reproduced every claimed test number exactly
(tsc clean, server 449/24 skipped, coverage 94.54% lines, client 303 passed, clean build),
verified the loadout-gate ordering/semantics line-by-line, confirmed the `BottomNav.tsx`
deletion was safe via a full-repo grep (not just the claimed touched files), and confirmed
no funds/ASA/chain/cinematics files were touched. Only note: the PR body's file list omitted
two pure-docs files that were actually in the commit range (cosmetic, not a functional gap).
Full audit trail: [docs/audits/pr-211-audit.md](./audits/pr-211-audit.md). Session note:
[2026-07-07-armory-loadout-polish.md](../artifacts/frontier-al/session-notes/2026-07-07-armory-loadout-polish.md).
CI + Fly deploy both confirmed green on `0ced366`.

**Working branch reset to a clean `origin/main` (`0ced366`) — no uncommitted changes, no
open PR.**

**New finding this session (from an owner ask for an image/art asset list — a research pass,
no PR, no code changed):** two NFT `image` fields already in production code point at paths
that don't exist on disk — `client/public/images/weapons/`
(8 weapon-category icons, referenced by the weapon-NFT mint route) and
`client/public/faction/images/` (4 faction SVGs, referenced by the faction metadata route).
Both are live 404s today, not hypothetical. Faction emblem PNGs already exist in
`attached_assets/` unused for this purpose — the weapon-category icons don't exist anywhere
yet. Good candidate for a small, low-risk next unit (or folded into weapons plan unit 7,
`feat/weapon-nft-claim`, since it touches the same NFT-metadata surface).

**#212 (`fix/dev-session-ws-gate`) merged** as `12c92d6` — **audited PASS, no CONCERNS.**
Independent auditor verified the `devIdentityAuthVersion` fix line-by-line, confirmed the
real wallet's `authenticate()` path is byte-for-byte untouched, and reproduced every test
number exactly (tsc clean, server 449/24 skipped, client 305 passed, clean build). Full
audit trail: [docs/audits/pr-212-audit.md](./audits/pr-212-audit.md). CI + Fly deploy both
confirmed green on `12c92d6`. Working branch reset to a clean `origin/main` at that point.

**That same session, the owner also asked for a "polish" pass**: a real image of the battle
system + honest answers on whether things work, Redis, and cinematics. Two background
agents did a live headless health-check + a Redis/cinematics code audit. Findings (all
documented, one required the code fix that became PR #212 above):
- **Real bug found + fixed**: dev/test sessions never bumped `WalletContext`'s
  `authVersion`, which gates `useGameSocket`'s live-WS connect (`!authTrigger` blocks it
  forever at its initial `0`). Confirmed live: a dev-session weapon fire resolved correctly
  server-side but its missile/impact visuals never rendered, because the WS never opened
  (base game state has a 30s REST-poll fallback so the globe itself still looked fine —
  only live weapon/battle events were silently dropped). Real wallet-authenticated players
  were never affected (their `authenticate()` call already bumps `authVersion` normally).
  Fixed with a small pure helper (`devIdentityAuthVersion`) forcing a truthy trigger for the
  dev identity, +2 new tests. Session note:
  [2026-07-07-dev-session-ws-gate-fix.md](../artifacts/frontier-al/session-notes/2026-07-07-dev-session-ws-gate-fix.md).
- **Domain "not loading" report — no evidence of a real outage found.** DNS, TLS certs,
  full-page loads (including deep routes like `frontierprotocol.app/game`), CORS, and asset
  delivery all checked out clean on both domains. Likely explanation for anyone checking
  with `curl`/a script/an uptime monitor rather than a real browser tab: `server/index.ts`
  serves a bare 23-byte placeholder for `GET /` whenever the request's `Accept` header
  doesn't include `text/html` — flagged in
  [`docs/LOGIN_AUTH_FLOW_MAP.md`](../artifacts/frontier-al/docs/LOGIN_AUTH_FLOW_MAP.md#open-questions--things-that-look-off).
  Owner's actual browser symptom (if it recurs) is still not captured — get that detail if
  this comes up again, since everything checkable from outside is green.
- **Redis**: real-time game-state push is plain in-process WebSocket, **no Redis in that
  path at all**. Redis is a separate, optional layer (auth nonces, rate-limit counters,
  event/replay persistence) — not configured in production (`fly.toml` has no
  `UPSTASH_REDIS_REST_URL`/`TOKEN`), safely falls back to in-memory, harmless today since
  Fly runs a single instance. Would need to be set before ever scaling to >1 machine.
- **Globe cinematics**: confirmed still accurate against current code — solid procedural
  baseline (ballistic arc, particle trail, distinct intercept-vs-impact flash) but fully
  disconnected from the shared `cinematicBus` (no camera reaction, no HUD callout, no
  incoming-fire telegraph). Highest-value remaining gap = plan unit 8
  (`feat/missile-cinematic-integration`), still not started.
- **Replay**: a real battle-replay *log* works (`GET /api/battle/replay/:battleId`, text
  breakdown, Redis-cached). Weapon fire itself has **zero cooldown** — fired the same
  weapon 3x back-to-back with no rejection, confirming gap G-E. W1 (damage never settles
  onto plot state) reconfirmed still real by reading current code, not just trusting the
  plan doc.
- Screenshots from the live headless run (globe + War Room mid-battle) sent to the owner
  directly; not committed to the repo (throwaway verification artifacts).

Verified green: tsc clean, client 305/305 (+2 new), server 449/24 skipped (unchanged, no
server files touched), build clean.

**New unit this session, awaiting audit: `fix/mobile-white-screen`.** Owner came back with
the concrete symptom: production throws a complete blank white page specifically on mobile
browsers (desktop fine). Root cause found and fixed — real, not hypothetical:
`client/src/lib/walletManager.ts` constructed `new WalletManager({...})` **at module
scope**, so it ran the instant the module was imported, before React ever mounted. Each
wallet connector's constructor (Pera's WalletConnect setup, Lute's extension-detection)
touches `window`/`indexedDB` immediately — already flagged in a prior session's own test
comments (`route-loop.spec.tsx`: "the wallet SDK + walletManager touch `window`/IndexedDB
at import"). Some mobile browsers/webviews restrict or throw on these APIs. A throw at
module-load time happens *before* `createRoot(...).render()` runs, so no React error
boundary could ever catch it — permanent blank white screen, only trace a `console.error`
invisible on a phone with no DevTools. There was also no root-level `<ErrorBoundary>` at
all (`main.tsx` rendered `<App/>` directly), and the one `ErrorBoundary` that did exist
(deep inside `GameLayout`) only logged to console, never showing the actual error.

Fixed in layers: (1) `walletManager.ts` now exports a factory (`createWalletManager()`)
instead of constructing eagerly; (2) `App.tsx` calls it inside a `useMemo` during React's
render phase, so a failure is now a catchable render error, not a fatal module-load crash;
(3) `main.tsx` wraps the root render in `<ErrorBoundary>` for the first time; (4)
`ErrorBoundary.tsx` now captures and displays the real `error.message` on screen (not just
"Something went wrong"); (5) `client/index.html` gained a defense-in-depth diagnostic
script — deliberately conservative ES5-style JS, the very first thing in `<head>` — that
only shows an overlay if `#root` is still empty ~6s after load (never interrupting a
working game), catching what a React boundary structurally cannot (pre-mount throws,
resource-load failures); (6) `vite.config.ts` gained an explicit `build.target: "es2020"`
as a documented compatibility floor. Session note:
[2026-07-07-mobile-white-screen-fix.md](../artifacts/frontier-al/session-notes/2026-07-07-mobile-white-screen-fix.md).

**Honest gap**: not reproduced on an actual mobile device — the diagnosis is strong and
independently corroborated by a prior session's own test comments, but unconfirmed against
the owner's specific device/browser. What IS certain: the failure mode changed from
"silent, permanent, unrecoverable blank page" to "a visible error with a real message and a
working Reload button," true regardless of whether this exact root cause is the owner's
exact trigger. Verified green: tsc clean, client 311/311 (+6 new), server 449/24 skipped
(unchanged, no server files touched), build clean (spot-checked the diagnostic script
survives the build unmangled).

**PR #213 open, CI confirmed green** (both "Typecheck & server tests" and "Cloudflare
Pages" `completed`/`success` on head `9ea4f24`) — **not yet independently audited.** Owner
asked to close out the session here to conserve credit rather than spend another subagent
call on `/handoff-audit` right now. **Next session: run `/handoff-audit` on PR #213 first**
(gate on PASS/CONCERNS/FAIL per protocol) before starting any new unit. Local branch is
fully pushed, nothing uncommitted.

### 🔴 NEW OWNER DIRECTIVE (2026-07-07, supersedes M1-4 as next-up)

**Owner asked for a full weapons-system pass:** map out and fix the ENTIRE weapons system —
organize it so it looks great on mobile AND desktop, polish missile flight/animation, and make
plot/sub-parcel attack-targeting selection clear — all tied into the existing game logic and
the Algorand chain layer (weapon NFT mint/custody, wherever that's actually relevant — this
game's "smart contract" surface is ASA mint/config-note transactions, not on-chain game logic;
confirm that framing holds before assuming more chain work is needed than W5 already covers).

**Status:** the read-only research pass is done and written up as
[`docs/WEAPONS_SYSTEM_UX_PLAN.md`](../artifacts/frontier-al/docs/WEAPONS_SYSTEM_UX_PLAN.md) — an
architecture map, gap list (G-A…G-O), and a 10-unit phased plan table, each unit sized to fit
the one-PR-at-a-time flow. This directive takes priority over M1-4 (pin ASCEND ASA) — M1-4
through M1-6 and the rest of Phase 25 are not dropped, just deferred behind this.

**Unit 1 of 10 executed this session: `feat/armory-loadout-polish`** (plan unit 5 =
M2-3/W2+U1+U2+U3 — picked first per the plan's own note that it's the least
design-dependent, highest value-per-risk). Real bug fixed, not cosmetic: `PlayerWeaponProfile
.loadout` was persisted (`setLoadout`) but never consulted anywhere — a player could equip a
loadout in the UI and the server would still fire any owned weapon regardless. Fixed
server-side (`server/weapons/service.ts` `fireWeapon()` now rejects an owned-but-unequipped
weapon once loadout is non-empty) and client-side (`weaponStrike.ts`'s `eligibleStrikes()`
takes the same gate, so the Strike panel never offers what the server would reject). Design
call made under explicit owner delegation ("you're the developer... I trust you"): **empty
loadout = unrestricted** (every existing profile has `loadout: []` — the strict reading would
silently disarm every player who's never opened the equip UI). Also fixed two small Armory
bugs (U2/U3): "FR"→"ASCEND" label, hidden upgrade cost + missing max-tier state. Deleted dead
`BottomNav.tsx` (component never rendered, superseded by `HudShell`) after relocating its
still-live `NavTab` type export into `client/src/lib/panelNav.ts` (4 import sites updated).
Session note:
[2026-07-07-armory-loadout-polish.md](../artifacts/frontier-al/session-notes/2026-07-07-armory-loadout-polish.md).

**Merged as #211 (see above) — audited PASS.** `check`/`test:server`/`coverage:server`/`test`/
`build` all reproduced green independently by the auditor, not just claimed. **Honest gap
(still true):** no headless visual/browser verification this unit — it's a pure logic gate +
label/cost text change, no new layout to screenshot.

**Next session:** pick the next weapons-plan unit. Units 3 (cooldown enforcement) and 5 (this
one, done) were flagged as the least design-dependent — 3 is a good next pick, self-contained,
no design call needed. Units 1→2 (damage settlement → combat convergence) should land before
8's telegraph piece is meaningful; 4 (defense-deploy UI) and 7 (NFT claim) are independent and
can run any time. Also consider the broken-image-path fix noted above (small, low-risk,
touches the same NFT-metadata surface as unit 7). 9 of 10 weapons-plan units remain.

### ➡️ THE QUEUE — 3-month buildout (Phase 25 of the master roadmap is the authoritative copy)

Execute in order, one unit per chat. Every claim has file:line evidence in the roadmap phase
cited. Funds lanes take full gates (`/security-pass`, TestNet click-test, owner approval);
no fix without a failing-first test.

**Month 1 — funds safety + wallet truth**
1. **M1-1 — DONE, merged #208** `fix/welcome-bonus-double-enqueue` — see baton summary above
   for full detail.
2. **M1-2 — DONE, merged #209** `fix/placebet-atomicity` — see baton summary above for full
   detail.
3. **M1-3 — DONE, AWAITING_AUDIT** `fix/wallet-single-provider` — P1+P3 fixed, see baton
   summary above for full detail. P2 (landing↔game cross-origin second connect) remains an ADR
   + owner decision, not code — still not started.
4. **M1-4 (NEXT UP, read)** `fix/pin-ascend-asa` — pin ASCEND ASA via `ASCEND_ASA_ID` env + startup
   assert; today it's name-lookup only (`services/chain/asa.ts:117,128`) with no env-pinned
   ID — `755818217` appears only as free-text in source/docs (`shared/university/curriculum.ts`
   + several markdown docs), never as a config value. Update `ENV_VARS.md` + deployment checklist.
5. **M1-5 (funds)** `feat/mint-retry-delivery` — no atomic delivery/rollback: paid purchase
   whose background mint fails = ALGO consumed, no NFT, no refund, manual recovery
   (`routes.ts:2091-2098`); `attemptDelivery` one-shot (`routes.ts:2084`). Build mint-retry
   worker + refund-or-retry policy + surface custody/claim state in HUD. Full gates.
6. **M1-6** `chore/db-indexes-ratelimit` — indexes (migration 0013:
   `players.address`/`player_faction_id`), extend strict action rate-limiter to
   `/api/trade|markets|weapons|sub-parcels|factions`, middleware-binding coverage test.

**Month 2 — combat convergence + on-chain completeness**
7. **M2-1 (write)** `feat/weapon-damage-settlement` — W1, the biggest gameplay gap: weapon
   fire never damages plots; damage computed (`server/weapons/engagementStore.ts:156`) but
   never settled, `"impacted"` never set, no tick (roadmap Phase 8). 🚫 resolution math.
8. **M2-2 (write)** `feat/combat-convergence` — W3+W4: settled damage feeds plot state;
   badges credit on impact only (`service.ts:202-206`).
9. **M2-3 — DONE, merged #211** `feat/armory-loadout-polish` — W2 loadout wiring (was
   persisted but never consulted, `service.ts:103` vs `:155`) now enforced server- and
   client-side; "FR"→"ASCEND" fixed, upgrade price + max-tier state surfaced; dead
   `BottomNav.tsx` deleted. Responsive rail-grid squeeze deferred to plan unit 6
   (`feat/armory-responsive-layout`, container-query root cause, needs a design call) — not
   part of this unit. `/university` WalletProvider wrapper NOT touched this unit —
   **caveat (still open):** `university.tsx`'s own doc-comment says the missing wallet
   wrapper is deliberate (no wallet needed there, no chain/funds touched); confirm an actual
   failure mode exists before adding it.
10. **M2-4 (write)** `feat/subparcel-onchain-arc69` — ADR + impl: sub-parcels/upgrades are
    DB-only today; upgrade "anchor" is a detached admin self-transfer note (`upgrades.ts:28`)
    not tied to the plot ASA, and likely broken under algosdk v3 (Address-vs-string,
    `chain-services-audit.md`). Record via ARC-69 config notes on the parent plot ASA
    (roadmap Phase 26 has the full approach + rejected alternatives).
11. **M2-5 (write)** `feat/weapon-nft-claim` — W5: weapon-NFT mint completion, custody+claim
    parity with land NFTs (503 without `PUBLIC_BASE_URL`, `routes.ts:2644`).
12. **M2-6** `fix/ui-consistency-pass` — **audit correction:** the real clock-drift risk is
    `WarRoomPanel.tsx:29,154` using `Date.now()` against server-relative timestamps —
    `BattlesPanel.tsx` already correctly uses `serverNow()` (its lone `Date.now()` at line 194
    is an unrelated local-freshness check, leave it). Fix `WarRoomPanel` → `serverNow()`, link
    `/admin` in nav, `index.html` inline loading state.

**Month 3 — AAA security posture + launch path**
13. **M3-1** `docs/security-pass-ascend-claims` — `/security-pass` over the post-fix surface.
14. **M3-2** `test/browser-smoke-pack` — `/test-matrix` refresh + Playwright smokes.
15. **M3-3 (write)** `feat/nft-metadata-immutability` — ARC-19 + IPFS pinning (metadata/images
    are mutable + centrally hosted, `routes.ts:929`); mainnet ASA role ADR (admin keeps
    `manager`/`reserve` on mainnet, `land.ts:57-60`).
16. **M3-4** `chore/central-flag-module` — `shared/flags.ts` + CI guard that dev flags never
    coexist with mainnet (the `VITE_DEV_MODE`/`DEV_LOGIN_ENABLED` fly.toml exit path).
17. **M3-5** `docs/ui-master-design` — design-language consolidation + menus audit.
18. **M3-6** `docs/mainnet-gate-dryrun` — `/mainnet-gate` dry run; expected-FAIL list = final
    punch list; MVP definition signed.

Also still live (slot in where capacity allows): Mission Control v1 + kill switches
([`FRONTIER_FIRST_10_PRS.md`](./FRONTIER_FIRST_10_PRS.md)), `smoke:testnet` live run (needs
owner-funded wallet — also settles the `upgrades.ts` algosdk-v3 question), onboarding quest
chain, `?dashboard=1` flagship-dashboard vision, veritas watchdog deployment.

### Owner action items outstanding
- Fund session wallet `JD7CFMNMX4PO2HSJNRYBXUWR3W7YYLC5M3GMK4MEOCEWHZLAU2IKT7IKZA` (2–5 TestNet
  ALGO) for `smoke:testnet`.
- Decide P2: keep landing+game on separate origins (accept the second wallet connect) or unify
  origin / add session handoff (M1-3 writes the ADR options).
- Smoke tests still unconfirmed: tab-switching post-#178 on phone+desktop; gate audio +
  draggable plot panel on a real device.
- Decide the orphaned `artifacts/api-server` + `lib/*` island; prune ~140 dead remote branches.

### Open risks / honest flags
- The 2026-07-07 audit findings are **read-only exploration, not yet fix-verified**; each queued
  unit must re-confirm its file:line claims before coding (lines drift).
- Client changes still not browser-verified on-device — owner smoke-test on preview; sandbox has
  headless visual testing (`docs/HEADLESS_VISUAL_TESTING.md`).
- Pre-deploy reminders: migrations `0000`–`0012` applied; `VITE_TEST_GLOBE` reads `false`; keep
  `SESSION_SECRET` stable across deploys.
- **Do NOT unify `mem.ts`/`db.ts` game methods** — combat/economy divergence risk.
- Standing mainnet-gate item: `VITE_DEV_MODE` + `DEV_LOGIN_ENABLED` ship `'true'` in prod
  fly.toml — deliberate for TestNet; M3-4 is the exit path.
- **New backlog (2026-07-07, not queue-jumping M1-2):** owner asked about
  `ammaarreshi/Generals-Mac-iOS-iPad` (native C&C Generals iOS/macOS port) for reusable ideas.
  Nothing ports directly (different stack), but two real gaps found by grep, recorded in the
  master roadmap's backlog paragraph: **(G1)** no drag-box/long-press touch-select vocabulary on
  the globe (only single tap); **(G2)** zero `webglcontextlost`/`visibilitychange` handling
  anywhere in the client — the three.js globe likely goes black/frozen after a mobile tab
  backgrounds and never recovers (unconfirmed, owner should smoke-test). Both slot in "where
  capacity allows," same as the rest of the backlog — not started, not next-up.

### 🛑 HARD RULES / off-limits (absolute)
- No funds/ASA/transfer code toward mainnet without **`/mainnet-gate` PASS + `algo-auditor` pass**.
- **Don't merge `wip/atomic-purchase`**; nothing in `ops/kestra/` may point at mainnet.
- Don't reintroduce mock/demo data into plot/HUD surfaces (they are live, server-driven).
- Don't change globe/combat/canvas behavior outside a scoped, audited unit.
- **Standing owner directive:** proceed without asking when approval is a foregone conclusion;
  still one-PR-at-a-time and HARD RULES remain absolute.
