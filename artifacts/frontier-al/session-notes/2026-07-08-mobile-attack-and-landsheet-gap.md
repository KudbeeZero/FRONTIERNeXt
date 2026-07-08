# 2026-07-08 — Mobile: dead Attack button, missing AI terminal, LandSheet unreachable

Owner: "the buttons on there don't work" (land parcel title card) + "make
sure it has the integrated terminal for mobile as well" + "there's like a
whole secondary menu that doesn't exist on mobile."

## Fixes

### 1. "Attack (Coming Soon)" — permanent stub, both desktop and mobile
`SelectedPlotPanel.tsx` (desktop) and `MobilePlotSheet.tsx` (mobile) both had
a hardcoded `disabled` "Attack (Coming Soon)" button for enemy-owned plots —
never wired to anything, ever. Both now call `onOpenFullSheet` (the same
prop already used for the owned-plot "Manage Plot" button), opening the full
`LandSheet`, which already has a real, working Special Attacks section for
enemy plots (gated on having a minted Commander).

### 2. Mobile was missing the "AI terminal" tactical briefing entirely
`PlotTerminalReadout` (a live, LLM-narrated per-plot briefing with a
typewriter reveal — this is what the owner means by "the fully integrated
AI terminal") existed only in the desktop panel. Its own doc comment says it
"replaces the old static Your Territory/Hostile Territory hint blocks" —
but `MobilePlotSheet.tsx` was never updated to match and still had those old
static blocks. Replaced them with `<PlotTerminalReadout>`, same as desktop.

### 3. The big one: LandSheet (mine/upgrade/build/attack) was 100% desktop-only
`GameLayout.tsx` gated the entire full plot-management sheet behind
`!isMobile`. This is the "whole secondary menu that doesn't exist on
mobile" — mining, upgrades, building, special attacks, and the sub-parcel
grid were all completely unreachable for any mobile player, the whole time.

Checked why before touching it: `LandSheet.tsx`'s own root layout was
ALREADY responsive (`fixed bottom-0 left-0 right-0 md:left-60...` — the
exact same mobile-bottom-sheet pattern as `MobilePlotSheet.tsx`, `grid-cols-2/3`
throughout, no fixed pixel widths or hover-only interactions found). The
`!isMobile` gate looks like it was a cautious rollout restriction, not a
real technical mobile-incompatibility.

Found one real reason it would have looked broken even with the gate
removed: `LandSheet` hardcoded `z-40`. This repo has a documented z-index
registry (`client/src/lib/uiLayers.ts`) — `bottomNav: 50`, and `plotSheet: 55`
explicitly commented "must be above bottomNav". At z-40, LandSheet would
render UNDER the mobile bottom nav bar. Fixed to use `ZClass.plotSheet`
(z-[55]), matching the registry and `MobilePlotSheet`'s own convention.

Removed the `!isMobile` gate in `GameLayout.tsx` entirely.

## Follow-up in progress

Spawned a background audit for anything else missing/broken on mobile,
specifically checking for the same two failure patterns found here
(unnecessary `isMobile` gates with no real layout reason; hardcoded
z-index values below the documented `bottomNav` layer). Will land as a
separate unit once it reports back.

## Also this session: NFT metadata URL scheme + api.frontierprotocol.app status

- Fixed `PUBLIC_BASE_URL` scheme normalization (see prior session note,
  same day) — a live regression where the env var was missing `https://`,
  breaking every metadata `image`/`external_url` field.
- `api.frontierprotocol.app` is confirmed still returning Cloudflare 525
  (SSL handshake failure to origin) — a DNS/Cloudflare dashboard issue, not
  app code, that this session cannot fix. The app works fine regardless
  (falls back to `frontiernext.fly.dev`), but any on-chain metadata `url`
  pointing at `api.frontierprotocol.app` (as existing minted NFTs do) won't
  resolve for external wallets/explorers until that's fixed.
- New-ASA launch (same name, new ID): documented the existing
  `FORCE_NEW_ASA` mechanism and its real, global blast radius (orphans every
  player's current ASCEND balance from the tracked economy) — not executed;
  requires Fly secrets access this session doesn't have, and is the owner's
  call given the scope of impact.

## Scope check

Client-only for the mobile fixes (3 files). No server code, no funds/ASA
logic touched. No mainnet-adjacent code.

## Verified green

- `pnpm run check` (tsc) — clean
- `pnpm run test` (client) — 330 passed, unchanged (no test coverage exists
  for this interaction class in this repo — same caveat as every UI fix
  this session)
- `pnpm run build` — clean production build

Not test-backed for the same reason as the rest of this session's UI work —
needs live verification on mobile.
