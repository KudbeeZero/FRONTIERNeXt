# 2026-07-07 — Plot NFT "Claim" button was a no-op; land NFTs never reached wallets

## Root cause

Owner reported: land purchases work and show up in-game, but no NFT with an
image ever lands in their Algorand wallet, and clicking "Claim NFT" on
pending plots does nothing.

Traced end-to-end (server confirmed healthy, admin wallet/ASA config correct,
player's live game state showed 17 real owned parcels — the purchase/game
logic itself was never broken). The actual bug:

**`client/src/components/game/GameLayout.tsx` never passed `onDeliverPlotNft`
or `isDeliveringPlotNftId` to `<CommanderPanel>`, at any of its 3 render
sites** (mobile sheet, desktop right rail, tab view). `CommanderPanel.tsx`'s
"Claim NFT" button calls `onDeliverPlotNft?.(plot.plotId, plot.assetId)` —
optional-chained, so with the prop undefined the click silently no-ops. The
server-side delivery endpoint (`POST /api/nft/deliver/:plotId`,
`server/routes.ts:1004`) was correct and untouched; the client simply never
wired a caller to it. The sibling Commander-NFT claim button worked the
whole time (`onClaimCommanderNft={handleClaimCommanderNft}` was correctly
wired) — only the land-NFT path was missing its handler entirely.

## Fix

- Added `handleDeliverPlotNft(plotId, assetId)` in `GameLayout.tsx`, mirroring
  the existing `handleClaimCommanderNft`'s opt-in → retry → deliver pattern
  (Algorand ASA transfers are pull-only — the buyer's wallet must sign an
  opt-in transaction before the admin-custody NFT can be handed over).
- Wired `onDeliverPlotNft` + `isDeliveringPlotNftId` into all 3
  `<CommanderPanel>` call sites.
- **New**: purchasing a plot (even a free/0-ALGO TestNet purchase) now
  automatically polls for the server's fire-and-forget NFT mint to finish
  (`pollAndAutoClaimPlotNft`, ~3s intervals up to 24s) and immediately runs
  the same claim flow — so every purchase still prompts a real wallet
  signature and ends with an actual NFT (with metadata/image) delivered,
  instead of silently sitting in admin custody until the player notices the
  "awaiting claim" banner on their own. Per owner directive: "if I purchase a
  plot of land, I should still have to go through the Wallet process, even
  if it's zero dollars."
- Fixed misleading copy in `CommanderPanel.tsx`'s pending-claim banner
  ("Mining and upgrades are locked until you claim your NFT") — traced and
  confirmed this lock is **not actually enforced anywhere** server-side or in
  the interactive globe/land surfaces (`GameLayout.tsx` hardcodes
  `nftInfo={null}` where a real custody check would need to flow through, so
  the copy was alarming players over a restriction that doesn't exist).
  Left as a documentation/copy-only fix — did not newly wire real enforcement
  into `GlobeHUD`/`LandSheet`, since that touches combat/globe interactive
  surfaces and is out of scope for an audited unit without dedicated testing
  (HARD RULE: don't change globe/combat behavior outside a scoped, audited
  unit).
- Visually tightened the pending-claims list in `CommanderPanel.tsx` (owner:
  "sloppy... don't look like they belong there") — compact scrollable rows
  instead of large stacked full-width cards, matching the panel's existing
  design language.
- `landing-economics.tsx`'s "Own Land" card hardcoded a **production**
  emission rate ("1 ASCEND/day base — up to 6 fully upgraded") while the live
  deployment runs `economyMode: "testing"` (confirmed via
  `GET /api/economics` on `frontiernext.fly.dev` → `emissionRatePerDay: 50`).
  Now reads the live rate from the page's existing `/api/economics` query
  instead of a stale hardcoded number, with a note when running in testing
  mode.

## Investigation credit

A background research agent traced all four reported symptoms (NFT claim
flow, mining/upgrade lock copy, commander battle-bonus wiring, ASCEND
accrual vs. documented rate) with file:line precision before any code was
touched. Commander battle-bonus wiring was found to have **no structural
bug** — `commanderBonus` flows correctly from the player's selected active
commander into `resolveBattle()` with no custody dependency — so no fix was
made there; if the player is still unable to attack, the next step is
capturing the exact error response from a live attack attempt, not another
speculative code change.

## Scope check

Client-only changes (2 components + 1 landing page). No server code, no
funds/ASA transfer logic touched — the delivery endpoint itself was already
correct. No mainnet-adjacent code. TestNet only, `freePurchases: true`
confirmed live.

## Verified green

- `pnpm run check` (tsc) — clean
- `pnpm run test` (client) — 326 passed, unchanged (no client test coverage
  exists for this interaction class — the sibling `handleClaimCommanderNft`
  handler this mirrors also has no direct test in this repo; the harness has
  no jsdom/interaction-testing setup for these deep game panels, only
  SSR/pure-function tests)
- `pnpm run test:server` — 449 passed, 24 skipped (unchanged, no server files
  touched)
- `pnpm run build` — clean production build

**Not test-backed** — this is a prop-wiring fix + new orchestration logic
verified by direct code trace and confirmed against live production data
(the reporting player's 17-owned-parcels account with the exact matching
"awaiting claim" bug pattern), not by an automated test exercising the
click→deliver path. Needs live verification on the player's next plot
purchase.
