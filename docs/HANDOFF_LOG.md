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

## Current baton — 🟡 AWAITING_AUDIT: none · next unit = M2-1 (weapon damage settlement)

### 2026-07-09 — PR #232 audited + fixed + merged: M1-6 complete; Month 1 done

**#232 (`chore/db-indexes-ratelimit`) — MERGED as `c0c5e7c`.** Audited CONCERNS → fixed → PASS.
M1-6 from Phase 25 queue. Migration 0014 adds 6 indexes (`players (lower(address))`, `players.is_ai`,
`players.player_faction_id`, `trade_orders.status/offerer_id/created_at`); `strictLimiter` (60/min,
configurable via `STRICT_RATE_LIMIT`) bound to `/api/trade|markets|weapons|sub-parcels|factions`;
`LIMIT 1000` safety cap on `queryPurchaseIntents()`. 3 new unit tests.

**Audit finding (the only blocker):** test 3 in `strictLimiter.spec.ts` built a parallel inline
`rateLimit({...})` config and tested that — it did not exercise the exported `strictLimiter`. Fixed
in follow-up commit `340ba3c`: refactored `server/security.ts` to expose a `createStrictLimiter
(options?)` factory (the exported `strictLimiter` is now `createStrictLimiter()` — same production
behavior); rewrote test 3 to use `createStrictLimiter({ limit: 2 })`, so the test exercises the
real production code path. Final audit doc: [docs/audits/pr-232-audit.md](./audits/pr-232-audit.md).

**Validation:** `pnpm run check` clean, `pnpm run test:server` 480 passed | 24 skipped, CI green on
`afe5c05` (`Typecheck & server tests` ✅ + `Cloudflare Pages` ✅).

### 2026-07-09 — Month 1 COMPLETE (M1-1 through M1-6 all merged)

| # | Unit | PR | Status |
|---|---|---|---|
| M1-1 | `fix/welcome-bonus-double-enqueue` | #208 | MERGED |
| M1-2 | `fix/placebet-atomicity` | #209 | MERGED |
| M1-3 | `fix/wallet-popup-vectors-p1-p3` | #210 | MERGED |
| M1-4 | `fix/pin-ascend-asa` | #230 | MERGED (already on main when this session started) |
| M1-5 | `feat/mint-retry-delivery` | #231 | MERGED |
| M1-6 | `chore/db-indexes-ratelimit` | #232 | MERGED (this session) |

**Correction from prior baton:** M1-4 was already completed in PR #230 (`fix(chain): pin ASCEND
ASA via ASCEND_ASA_ID env var + startup assert`, commit `9086032`) before this session started. The
baton incorrectly listed M1-4 as "next up" — the actual next unit after M1-6 is **M2-1
(weapon damage settlement)**, the biggest remaining gameplay gap (W1: weapon fire computes damage
but never settles it onto plot state).

### ➡️ Next unit — M2-1 (`feat/weapon-damage-settlement`)

The W1 gap from [`artifacts/frontier-al/docs/WEAPONS_SYSTEM_UX_PLAN.md`](../artifacts/frontier-al/docs/WEAPONS_SYSTEM_UX_PLAN.md):
weapon fire computes damage in `server/weapons/engagementStore.ts:156` but never persists it;
`"impacted"` is never set; no tick settles damage onto the target plot. This is the largest
remaining gameplay correctness gap. Branch: `feat/weapon-damage-settlement`. Open risks: none
identified yet (needs read-through of the engagement store + plot state mutation paths before
scoping the fix). Off-limits: standard hard rules.

**M2-2 (combat convergence — W3+W4: settled damage feeds plot state; badges credit on impact
only)** is gated on M2-1 landing first. M2-3 (`feat/armory-loadout-polish`) is already MERGED
(#211). M2-4 through M2-6 + Month 3 are still queued.

### 2026-07-08 — PR #231 audited and merged

**#231 (`feat/mint-retry-delivery`) — MERGED as `bc84a17`.** Audited FAIL → fixed → PASS.
M1-5 from Phase 25 queue. Adds persistent retry queue for Plot NFT mints that fail AFTER the
buyer's ALGO payment has been claimed and land ownership committed. Without this, a failed mint
left the buyer with land, no NFT, no refund, and no automated recovery. Added `plot_mint_retry_queue`
table (migration 0013) to track failed mints with retry attempts and refund escalation.
Implemented `mintRetryQueue.ts` worker service with enqueue/drain/start functions following
`transferQueue.ts` pattern (Postgres + setInterval, no Redis/BullMQ). Added `refund.ts` primitive
for admin-signed ALGO refunds to buyers. Updated `routes.ts` to enqueue failed mints in purchase
flow `.catch` block; added `POST /api/nft/retry-plot/:plotId` endpoint for manual retry; enhanced
`GET /api/nft/plot/:plotId` to check retry queue for failed/minting states. Wired
`startPlotMintRetryWorker()` at boot in `server/index.ts`. Updated `NftClaimNotification.tsx` HUD
to show failed/minting states with retry button. Added `handleRetryPlotMint` to `GameLayout.tsx`
and wired `NftClaimNotification` component. 6 new unit tests (enqueue, drain, retry, refund
escalation). All 477 server tests pass, `tsc` clean.

**Audit finding (the only blocker):** a critical dead-code bug in the initial implementation — the
`mintPlotNft` helper returned `undefined` on the "delivered" path (a `return` was missing after
`return ok` in the success branch), causing the purchase flow to always treat the mint as failed
and enqueue it for retry even on success. Fixed in `4db0f2e`. Plus: `GET /api/nft/plot/:plotId`
was returning `404` for delivered/refunded plots instead of their actual status. Fixed in
`f6fdbc2`. Final audit doc: [docs/audits/pr-231-audit.md](./audits/pr-231-audit.md).


**PR #229 merged:** `feat/wallet-connection-gate` — wallet connection gate + fresh params + singleton modal + queue reset.

**PR #228 (z-index hardening) — CLOSED.** Another session is handling the backlog items. The z-index fixes (CommTerminal z-40, hud-drawer z-49) were valid but created without coordinating with the session already working on those items.

### 2026-07-08 — PR #227 audited and merged

**#227 (`fix/economics-formatter-accuracy`) — MERGED as `69b494d`.** Audited PASS. Owner flagged "I don't think any of this information is accurate." Root cause: `fmt()` in `EconomicsPanel.tsx` and `landing-economics.tsx` had no billions tier and only 1-decimal precision at the millions scale — Treasury (~999.95M) and Total Supply (1B) both displayed as "1000.0M". Also hardcoded "0.5–1.5 ASCEND/hr" emission text didn't match actual 50/day (testing) or 1/day (production) rates. Fixed: extracted shared `fmtSupply()` to `client/src/lib/fmtSupply.ts` with billions tier + 2-decimal precision; emission text now reads live `data.emissionRatePerDay` dynamically. 11 new regression tests. Audit: [docs/audits/pr-227-audit.md](./audits/pr-227-audit.md).

**PR #228 (z-index hardening) — CLOSED.** Another session is handling the backlog items. The z-index fixes (CommTerminal z-40, hud-drawer z-49) were valid but created without coordinating with the session already working on those items.

**Remaining backlog (being handled by another session):**
- **WebGL context loss (G2):** confirmed zero handling — 0 `webglcontextlost`/`visibilitychange`/`pageshow` listeners across the entire client. 27 `useFrame` hooks + 7 DOM rAF loops at risk. Globe will freeze/go black after mobile tab backgrounds. Needs: context loss handler hook + visibility change listener + R3F invalidate. Design call needed on recovery UX.
- **CommTerminal z-40 fragility:** confirmed `CommTerminal.tsx:122` at `z-40` is below mobile bottomNav (`z-50`). Also `hud.css` `.hud-drawer` at `z-49`. ZClass registry only covers 4 of 10 layers; 12+ game components use hardcoded z-values. Needs z-index hardening pass.
- **Broken image paths (404s):** 8 weapon PNGs + 4 faction SVGs referenced by on-chain metadata routes don't exist on disk. Faction path is permanent (baked into ASA at creation). Blocked on art assets from owner.

### 2026-07-08 — Repo hygiene pass: stale branches purged, baton refreshed, main green

Owner actively played the live game throughout (TestNet wallet
`OC6LXJ5WDGKMINKPWJF7ZZRU6ARWIOVFJMCMXBVOYUGQN3O67PFEL5B74A`) and reported
real symptoms one at a time; each was traced to a root cause (often via a
background research/audit subagent) before any fix, verified on-chain where
possible (not just unit tests), then shipped. Owner gave explicit blanket
authorization mid-session to keep merging autonomously through to a clean
end-of-night state ("fill any gaps you see... make sure main is green...
I'm going to bed") — all 5 PRs below were merged by Claude directly, not
the owner, under that authorization.

**#218** `/` now loads the globe directly (landing page moved to
`/landing`) — owner directive to stop requiring a `/game` hop.

**#219** Swept remaining hardcoded `ascendancyalgo.xyz` references
(robots.txt, sitemap.xml, env-checklist doc, the one-off mint script) that
#218's meta-tag fix didn't cover.

**#220** Two units: (1) new `/ci-check` skill + CLAUDE.md convention that
"CI is green" and "it works in production" are separate claims to verify
independently — from this session's own `/insights` friction report. (2)
**Root cause found for "purchased land never shows up as an NFT in my
wallet"**: `GameLayout.tsx` never passed `onDeliverPlotNft` to
`CommanderPanel` at any of its 3 render sites — the "Claim NFT" button was a
complete no-op, silently, the whole time. Server delivery endpoint was
already correct. Also: purchasing now auto-triggers the claim flow (real
wallet signature required even for free TestNet purchases, per owner
directive), fixed a misleading "mining locked" claim-banner that wasn't
actually enforced anywhere, and `landing-economics.tsx` now reads the live
ASCEND emission rate instead of a stale hardcoded production number.

**#221** Large unit, grew through live testing: (1) **Batch NFT claim** —
"Claim All (N)" groups multiple ASA opt-ins into one atomic transaction,
one wallet approval instead of N. (2) **Wallet-sign concurrency lock** — a
promise-chain mutex at the shared signer chokepoint so concurrent signing
requests queue instead of hitting the wallet SDK's raw "another request
already in progress" error; **plus a 120s timeout** added after the owner
live-hit a stuck/abandoned WalletConnect request (same nonce reappearing
repeatedly) — without the timeout a hung request would wedge the queue
forever. (3) Fixed a stale query-key (`nft-plot-notification` vs the real
`nft-plot`) that left claimed plots stuck in the "awaiting claim" list. (4)
**Live regression found and fixed**: `PUBLIC_BASE_URL` was resolving
without an `https://` scheme, breaking every NFT/faction/weapon metadata
`image`/`external_url` field — normalized once at `assertChainConfig()`
(server bootstrap). (5) Mobile parity: dead "Attack (Coming Soon)" stub
wired to the real Special Attacks flow, missing AI-terminal readout
(`PlotTerminalReadout`) added to mobile, and **the entire `LandSheet`
plot-management sheet (mine/upgrade/build/attack) was found to be
`!isMobile`-gated** — completely unreachable on mobile despite its own
layout already being responsive. Gate removed; a hardcoded `z-40` that
would've sat under the mobile nav bar (documented registry: `bottomNav=50`)
fixed to `ZClass.plotSheet`. **Verified live on-chain**, not just tests: two
previously-stuck plots (#8257 asset `764909648`, #4558 asset `764909649`)
confirmed delivered via `testnet-idx.algonode.cloud` transaction lookups.

**#222** A background mobile-parity audit (spawned after #221) found the
mobile LandSheet fix was *still* unreachable: `SelectedPlotPanel` itself
(the wrapper that delegates to `MobilePlotSheet`) was separately gated
`!isMobile` at a different call site, with a stale comment about routing
mobile through the globe's `ParcelHUD` popup instead — but `ParcelHUD`'s
"Develop" button was a literal no-op, never built. **Mobile had zero
working plot-action surface of any kind until this PR.** Gate removed.
Also fixed, from an owner screenshot: the "Claim ASCEND" button (real,
working, showing an actual accrued amount) was visually buried under the
`ObjectiveHud` "Mission" banner — a `position:fixed` overlay independent of
`TopBar`'s real layout, `top:10` sat directly on top of TopBar's content.
Moved to `top:64` to clear it.

Session notes (chronological):
[root-route](../artifacts/frontier-al/session-notes/2026-07-07-root-route-loads-game-directly.md) ·
[production-url-fix](../artifacts/frontier-al/session-notes/2026-07-07-production-url-fix-and-routing-merge.md) ·
[nft-delivery-never-wired](../artifacts/frontier-al/session-notes/2026-07-07-plot-nft-delivery-never-wired.md) ·
[ascend-satellites-lootbox-armory](../artifacts/frontier-al/session-notes/2026-07-07-ascend-satellites-lootbox-armory.md) ·
[batch-claim-wallet-lock](../artifacts/frontier-al/session-notes/2026-07-07-batch-nft-claim-and-wallet-sign-lock.md) ·
[metadata-scheme-bug](../artifacts/frontier-al/session-notes/2026-07-08-nft-metadata-scheme-bug-and-new-asa-plan.md) ·
[mobile-attack-landsheet-gap](../artifacts/frontier-al/session-notes/2026-07-08-mobile-attack-and-landsheet-gap.md) ·
[mobile-plot-panel-gate-hud-overlap](../artifacts/frontier-al/session-notes/2026-07-08-mobile-plot-panel-gate-and-hud-overlap.md).

Verified green throughout: `pnpm run check` clean at every step;
`pnpm run test:server` grew 449→458 (9 new tests: `computeLiveAscendAccrued`
regression coverage, `assertChainConfig` scheme normalization);
`pnpm run test` (client) grew 325→330 (4 new: wallet-sign lock coverage in
`algorand.spec.ts`, including the timeout case via fake timers);
`pnpm run build` clean at every step. CI + Cloudflare Pages deploy confirmed
green on every merge commit through `5cd6ee5`.

### 🔴 URGENT owner action required — admin/treasury wallet is nearly out of spendable ALGO

Live-diagnosed the night's final symptom ("I'm not able to claim NFTs,
they're getting stuck"): **not a code bug.** Checked the admin wallet
(`ZK55X7SGIGMLGORVNJHHPTYZMZOGSQNVROBHX7N27X6ZEQRHAZ2UPKOXQU`) directly on
TestNet: 88.05 ALGO total balance, but 88.0495 ALGO locked as minimum
balance (795 created assets + 801 opted-in assets) — **0.0006 ALGO
spendable.** The admin account can no longer cover even a 0.001 ALGO
transaction fee, let alone the 0.1 ALGO minimum-balance cost of minting a
new land NFT. Confirmed by cross-checking the owner's own account: 24 of
their 31 owned parcels have **no NFT record at all** in `plot_nfts` (mint
never completed), while the 7 that do have a record are all correctly
delivered — the claim/delivery code path works fine; new *mints* have been
silently failing for a while.

**Action needed (cannot be done from this session — no wallet access):**
send TestNet ALGO to the admin address via
[the official TestNet dispenser](https://bank.testnet.algorand.network/).
Send a meaningful amount (50-100+ ALGO) given the ~0.1 ALGO cost per new
plot NFT, or this will recur soon. No code change needed once funded — the
existing mint pipeline should just start working again.

### Other owner decisions outstanding (not code, found this session)
- **`api.frontierprotocol.app` still returns Cloudflare 525** (SSL
  handshake failure to origin) — confirmed still broken as of this session,
  same issue found 2026-07-07. DNS/Cloudflare dashboard config, not app
  code. The app works fine regardless (client falls back to
  `frontiernext.fly.dev`), but any on-chain metadata `url` pointing at
  `api.frontierprotocol.app` (existing minted plot NFTs do) won't resolve
  for external wallets/explorers until this is fixed.
- **ASCEND ASA (`764083761`) has a dead metadata URL** baked in permanently
  at creation (an old Replit dev URL) — ASA `url` fields generally can't be
  edited post-creation. Owner asked about launching a new ASCEND token
  (same name, new ID) to fix this; the mechanism exists
  (`FORCE_NEW_ASA`/`getOrCreateAscendAsa` in `server/services/chain/asa.ts`)
  and would automatically pick up the correct URL now that the
  `PUBLIC_BASE_URL` scheme bug is fixed — but requires Fly secrets access
  this session doesn't have, and **orphans every player's current ASCEND
  balance** from the tracked economy. Owner's call, not a drive-by fix.
- **Mobile attack-target browsing parity** — desktop's `WarRoomPanel` has a
  full "attackable parcels" browser (its own query, biome filter, per-target
  Attack button); mobile's `BattlesPanel` is watch-only. Not a hard blocker
  (attack is reachable via globe-tap → Commander tab), but real feature
  work for next session — needs live mobile visual verification before
  merging, which wasn't available overnight.
- Low priority: `CommTerminal.tsx:122` hardcodes `z-40` (below the
  documented `bottomNav` z-50 layer) but is currently saved by a hand-tuned
  offset — same shape of fragility as the LandSheet z-index bug already
  fixed, worth hardening to `ZClass` at some point.
- Economics panel numbers: owner flagged "I don't think any of this
  information is accurate" — the 50 ASCEND/day testing rate shown IS
  correct (confirmed live). The Treasury tile showing the same "1000.0M" as
  Total Supply despite real circulating+burned amounts is very likely just
  decimal-rounding at the millions-display scale, not a data bug — not
  investigated further, worth a look at the formatter's precision if it
  keeps reading as confusing.

---

**#216 (`fix/session-mismatch-recovery`) merged** as `bc874d6` — self-audited PASS
(diff scope + tests re-verified directly, no independent subagent given the small,
low-risk, additive diff — per explicit owner token-conservation request this session).
Owner reported `403: Forbidden — session does not own this player` hard-stalling
mutating actions (e.g. acquiring territory), no recovery. Root cause: two independent
player-identity paths can drift — server trusts the auth-token-derived `playerId`
(`routeOwnership.ts` `evaluateOwnership`), client's `useCurrentPlayer()` resolves by
matching wallet address against **cached** `/api/game/state` data, entirely independent
of the session. After a wallet reconnect/switch or a stale cache, these disagree →
correct 403 → previously zero client recovery (raw error toast only). Fix: server tags
that 403 with `code: "SESSION_MISMATCH"` (`routeOwnership.ts` + both call sites in
`routes.ts`); client's single request chokepoint (`queryClient.ts`'s `throwIfResNotOk`)
detects the code, clears the stale token, toasts, and hard-reloads for a clean re-auth
handshake — same "recovery escape hatch, not a rearchitecture" shape as the popup-storm
fix. Audit: [docs/audits/pr-216-audit.md](./audits/pr-216-audit.md). Session note:
[2026-07-07-session-mismatch-403-recovery.md](../artifacts/frontier-al/session-notes/2026-07-07-session-mismatch-403-recovery.md).
**Honest gap:** not reproduced against a live drift scenario — verified via the real
`evaluateOwnership` function + a mocked-fetch client test, not an end-to-end browser repro.

**#217 (`fix/wallet-connect-error-visible`) merged** as `7affea6` — CI green, merged
directly by the owner. While live-testing #216's preview, the owner hit a real wallet
connect failure and could only see a red "Try Again" button — the actual error string
(`useWallet().error`) was rendered ONLY as a `title` hover-tooltip, invisible on touch
devices and easy to miss on desktop, so there was no way to relay what actually failed.
Fixed in `client/src/components/game/WalletConnect.tsx`: the error branch now renders
that text as visible page content, and also surfaces the existing "Trouble connecting?
Reset wallet connection" escape hatch (a connect failure can itself be a stuck stale
session). Session note:
[2026-07-07-wallet-connect-error-visible.md](../artifacts/frontier-al/session-notes/2026-07-07-wallet-connect-error-visible.md).
Verified green: tsc clean, client 325/325 (+2 new), server 449/24 skipped (unchanged),
build clean. **Next step for the owner:** retry connecting on the live preview — the
actual failure reason will now be visible on-screen; relay that text back if it's still
blocked, since that's the concrete next diagnosis this unblocks.

**Working branch reset to a clean `origin/main` (`7affea6`) — no uncommitted changes, no
open PR.**

**#214 (`fix/wallet-popup-storm-recovery`) merged** as `6112482` — audited PASS. Owner was
fully blocked (couldn't connect a wallet or spend test ALGO) by 8+ Pera/WalletConnect
popups firing on every page load. Root cause traced by reading the actual installed
`@txnlab/use-wallet` SDK source: `resumeSession()` only calls Pera's third-party
`reconnectSession()` (where the storm happens) if this app's own persisted key
(`@txnlab/use-wallet:v4`) has a recorded session; if the browser has accumulated stale
WalletConnect pairings, Pera resurfaces every one as its own popup. Not fixable in this
app's code (third-party SDK behavior) — shipped a recovery escape hatch instead:
`client/src/lib/walletReset.ts` clears that key + this app's own wallet keys, then
reloads; wired as a "Trouble connecting? Reset wallet connection" link in
`WalletConnect.tsx`. Audit: [docs/audits/pr-214-audit.md](./audits/pr-214-audit.md).
Session note: [2026-07-07-wallet-popup-storm-recovery.md](../artifacts/frontier-al/session-notes/2026-07-07-wallet-popup-storm-recovery.md).

**#215 merged** as `cb93409` — a second AI tool (Kilo Code, given repo access + this
repo's guardrails) did an independent second-opinion review of #214, confirmed it correct,
and added one missing test for `resetWalletConnection()` (verifies `window.location
.reload` fires) + its own audit note
(`session-notes/2026-07-07-wallet-popup-storm-audit.md`). Verified directly (not a full
subagent audit, given the tiny scope): tsc clean, the new test passes (321/321), no
server/funds/cinematics files touched.

**Honest gap (carried from #214, still open)**: the fix has not been confirmed live on
the device that originally triggered the storm — mechanism verified from SDK source, not
from a live repro (no real wallet available in this sandbox). Ask the owner to confirm the
reset link actually clears their storm next session if not already done.

**Also this session**: found and reported (not fixed — needs owner dashboard access) that
a decommissioned Railway GitHub integration was posting a stale `failure` commit status on
every `main` commit (separate from the real CI/Fly checks, both of which are green).
Railway was dropped for Fly.io + Cloudflare Pages back on 2026-07-06; the GitHub App
integration was never uninstalled. Owner needs to delete the Railway project / remove its
GitHub App access — not something fixable from this repo.

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

**#213 merged** as `efd28a4` — **audited PASS, no CONCERNS.** Independent auditor
re-verified every core claim by reading the diff directly (lazy `useMemo` construction,
the new root `ErrorBoundary`, the error-message display, the pre-React diagnostic script's
inert-on-normal-load logic), reproduced all test/build numbers exactly, and confirmed
scope stayed within the claimed 12 files. Full audit trail:
[docs/audits/pr-213-audit.md](./audits/pr-213-audit.md). CI + Fly deploy both confirmed
green on `efd28a4`.

**New unit this session, awaiting audit: `fix/wallet-popup-storm-recovery`.** Owner came
back with a second, more urgent live symptom: opening the app triggers 8+ Pera/
WalletConnect popups back-to-back on load, locking them out of the homepage. Traced the
actual mechanism by reading the installed `@txnlab/use-wallet`/`@txnlab/use-wallet-react`
SDK source directly (not guessed): `WalletProvider` calls `manager.resumeSessions()`
exactly once per mount (ref-guarded, confirmed NOT a React re-render bug in this app's own
code); Pera's `resumeSession()` only calls the third-party `PeraWalletConnect
.reconnectSession()` — where the storm actually happens — if this app's own persisted key
(`@txnlab/use-wallet:v4`) already has a recorded session. If a browser has accumulated
multiple stale WalletConnect pairings (same class of bug `shouldPurgeBeforeConnect`
already guards on the manual-connect path), Pera resurfaces every one as its own popup, on
**every page load**, with **zero signal in this app's own UI** (the SDK's resume effect is
invisible to `WalletContext`'s `error` state).

Since the storm lives inside a third-party dependency this app doesn't control, shipped a
**recovery escape hatch** rather than attempting to patch SDK internals: a new
`client/src/lib/walletReset.ts` clears use-wallet's own persisted key (confirmed sufficient
to stop `resumeSession()` from ever reaching `reconnectSession()` again) plus this app's
own wallet-identity keys, then reloads; wired as a small "Trouble connecting? Reset wallet
connection" link into `WalletConnect.tsx`'s "restoring" and not-connected states (not shown
once connected). Session note:
[2026-07-07-wallet-popup-storm-recovery.md](../artifacts/frontier-al/session-notes/2026-07-07-wallet-popup-storm-recovery.md).

**Honest gaps**: (1) `"@txnlab/use-wallet:v4"` is an internal SDK storage key, not a public
API — coupled to the installed version (4.6.0), flagged in the module's own doc comment to
re-verify on any SDK upgrade. (2) Not reproduced live — no real Pera/WalletConnect session
in this sandbox to trigger the actual storm against; the mechanism is read directly from
the SDK's own source (not assumed), but the recovery flow itself (click → clear → reload →
clean reconnect) hasn't been exercised end-to-end on a real device. Owner should confirm on
the device that was actually stuck. Verified green: tsc clean, client 320/320 (+9 new),
server 449/24 skipped (unchanged, no server files touched), build clean.

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

**Month 1 — funds safety + wallet truth** (COMPLETE)
1. **M1-1 — DONE, merged #208** `fix/welcome-bonus-double-enqueue` — see baton summary above
   for full detail.
2. **M1-2 — DONE, merged #209** `fix/placebet-atomicity` — see baton summary above for full
   detail.
3. **M1-3 — DONE, merged #210** `fix/wallet-popup-vectors-p1-p3` — P1+P3 fixed, see baton
   summary above for full detail. P2 (landing↔game cross-origin second connect) remains an ADR
   + owner decision, not code — still not started.
4. **M1-4 — DONE, merged #230** `fix/pin-ascend-asa` — `ASCEND_ASA_ID` env + startup assert
   shipped (was already on main when this session started; commit `9086032`).
5. **M1-5 — DONE, merged #231** `feat/mint-retry-delivery` — persistent retry queue for failed
   Plot NFT mints, admin-signed refund primitive, HUD surfaces failed/minting states.
6. **M1-6 — DONE, merged #232** `chore/db-indexes-ratelimit` — migration 0014 adds 6 indexes
   on `players` + `trade_orders`; `strictLimiter` (60/min, configurable via `STRICT_RATE_LIMIT`)
   bound to `/api/trade|markets|weapons|sub-parcels|factions`; `LIMIT 1000` safety cap on
   `queryPurchaseIntents()`. Test 3 was fixed in follow-up to actually exercise the production
   `createStrictLimiter` factory.

**Month 2 — combat convergence + on-chain completeness**
7. **M2-1 (NEXT UP, write)** `feat/weapon-damage-settlement` — W1, the biggest gameplay gap:
   weapon fire never damages plots; damage computed (`server/weapons/engagementStore.ts:156`)
   but never settled, `"impacted"` never set, no tick (roadmap Phase 8). 🚫 resolution math.
   **Read the engagement store + plot state mutation paths before scoping.**
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
