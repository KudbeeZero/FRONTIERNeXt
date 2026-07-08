# 2026-07-08 — Mobile plot panel unreachable, Claim ASCEND button hidden behind HUD

Background audit (spawned to check "what other features are missing from
mobile" after the LandSheet fix) found the two earlier fixes this session
were still unreachable. Owner independently hit the second bug live and sent
a screenshot.

## Fix 1 — SelectedPlotPanel itself was still `!isMobile`-gated (CRITICAL)

`GameLayout.tsx:1565` gated the entire `<SelectedPlotPanel>` (which
internally delegates to `MobilePlotSheet` on mobile) behind `!isMobile`,
with a comment explaining the original intent: mobile was supposed to use
the globe's in-canvas `ParcelHUD` popup as its plot-action entry point
instead. But `ParcelHUD`'s "Develop" button is a literal no-op
(`onBuild={() => {}}`) — that alternate path was never finished. Net effect:
mobile had **no working plot-action surface of any kind**, and this
session's earlier fixes (LandSheet reachable, `PlotTerminalReadout` on
mobile, real Attack button) were dead code — nothing could ever open them.

Removed the `!isMobile` gate. `SelectedPlotPanel` already has its own
internal `useIsMobile()` switch to render `MobilePlotSheet` vs. the desktop
floating card, so this one change makes every fix from the prior two
sessions today actually reachable on mobile for the first time.

## Fix 2 — Claim ASCEND button hidden behind the Mission HUD banner

Owner screenshot: the TopBar's "Claim N ASCEND" button (working — showing a
real `7548` from the accrual fix earlier today) was visually obscured,
overlapping with the `ObjectiveHud` "Mission" banner at the top of the
screen. Looked like "there's no button to claim."

Root cause: `ObjectiveHud.tsx` is a `position: fixed, top: 10, zIndex: 60`
overlay, completely independent of `TopBar`'s actual layout (`sticky
top-0`, normal document flow). At `top: 10`, it renders directly over
whatever TopBar has at that same screen position — confirmed live by the
screenshot. Moved to `top: 64` (clears TopBar's real height; matches this
codebase's existing 64px convention already used for the mobile bottom
dock's height, `hud.css`'s `--hud-dock-h`).

## Also flagged, real economics-panel numbers

Owner: "I don't think any of this information is accurate." Checked against
the live `/api/economics` this session already verified: the "50 ASCEND/day"
testing rate shown is correct (matches `emissionRatePerDay: 50` live). The
Treasury tile showing the same "1000.0M" as Total Supply despite ~1007
tokens circulating+burned is very likely just decimal-rounding at the
millions-display scale (a ~0.0001% difference rounds to the same "M" figure
with 1 decimal place shown), not a data bug — not fixed this pass, flagged
for a follow-up look at the formatter's precision if it keeps reading as
confusing.

## Not done this pass — next scoped unit

**Mobile attack-target browsing parity** (audit finding #2, rated HIGH not
CRITICAL — attack is still reachable via globe-tap → Commander tab today,
so this isn't a hard blocker): desktop's `WarRoomPanel` has a full
"attackable parcels" browser (its own `/api/parcels/attackable` query, biome
filter, per-target Attack button) that mobile's `BattlesPanel` doesn't have
at all — mobile's version is battle-log/watch-only. Porting this is real UI
feature work (a new list section, not a boolean/offset fix like the two
above), and this session has no live user available to visually confirm it
looks/works right on an actual mobile viewport before merging. Left
documented rather than rushed.

Also low-priority from the same audit: `CommTerminal.tsx:122` hardcodes
`z-40` (below `bottomNav`'s z-50) but is currently saved by a hand-tuned
`bottom-20` offset — same shape of fragility as the LandSheet bug, not
currently broken, worth hardening to `ZClass` at some point.

## Scope check

Client-only (2 files, both small: one boolean condition, one CSS offset
value). No server code touched. No mainnet-adjacent code.

## Verified green

- `pnpm run check` (tsc) — clean
- `pnpm run test` (client) — 330 passed, unchanged
- `pnpm run build` — clean production build

Not test-backed (same UI-interaction-class caveat as the rest of this
session's mobile work — no jsdom harness for these deep game panels in this
repo). Both changes are small and mechanical (a condition, a number) rather
than new logic, which limits the risk of shipping without a live check, but
this still needs visual confirmation on an actual mobile device next
session.
