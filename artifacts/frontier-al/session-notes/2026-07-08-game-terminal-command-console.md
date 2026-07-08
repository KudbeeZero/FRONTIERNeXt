# 2026-07-08 — GameTerminal: typed/clickable commands for mining + NFT claims

Owner: "when somebody purchases land it all goes inside the terminal the NFT waiting
for the NFT to get delivered all of that stuff make it look really good. People should
be able to type mine or click certain words to just input the script. this is what's
really gonna make the game next level."

## What shipped

**`client/src/lib/terminalCommands.ts`** — pure command-matching logic
(`matchTerminalCommand` for typed input, `matchCommandByLabel` for clicked
`[bracket]` tokens), case/whitespace-insensitive, disabled commands never
silently "succeed." 10 unit tests in `terminalCommands.spec.ts`.

**`client/src/components/game/GameTerminal.tsx`** — new reusable CRT-styled
terminal shell (same cyan-glow monospace language as the existing
`PlotTerminalReadout`, generalized with a `cyan`/`amber` accent). Renders
narration lines with `[bracketed]` words as clickable command tokens, plus a
`> ` command-line input at the bottom that parses typed text against the same
command list. Both paths dispatch to the exact same caller-supplied handlers —
no new game logic, purely an additional input surface over what already existed.

**Wired into two places:**
- `CommanderPanel.tsx`'s "Pending NFT Claims" block — now a terminal
  (`accent="amber"`) with `claim <plot#>` / `claim all` / bare `claim` (single-
  pending case) commands, on top of the existing per-row Claim buttons (kept,
  not replaced).
- `LandSheet.tsx` — new "Command Console" (`accent="cyan"`) above the
  mine/upgrade/terraform button row: `mine`/`m`/`extract` → `onMine`,
  `upgrade`/`u` → opens the upgrade panel, or `claim` → `onDeliverNft` when the
  plot's own NFT is in custody. Reachable on both desktop and mobile since
  `LandSheet` itself is already mobile-responsive (fixed earlier this session).

Buttons are NOT removed anywhere — this is an additional input mode
(type-or-click-the-word), not a replacement for touch-friendly buttons.

## Live-verified, not just unit-tested

Stood up the full local harness per `docs/HEADLESS_VISUAL_TESTING.md`
(throwaway Postgres, dev server, Vite, headless Chromium/SwiftShader) and
drove it with Playwright end-to-end:
- Screenshotted the "Command Console" rendering correctly in `LandSheet` —
  cyan CRT box, `[mine]`/`[upgrade]` as underlined clickable tokens, `>` input
  prompt below.
- **Clicked the `[mine]` token** → real mine action fired: "Mining Complete
  +39 Iron, +4 Fuel, +1 Crystal" toast, resource counters updated, cooldown
  started, and the terminal correctly re-rendered `[mine]` as non-clickable
  (still bracketed, no underline) once the command became disabled.
- **Typed `upgrade` into the input + Enter** → recognized, echoed `> upgrade`,
  dispatched the real handler.

Hit one harness-only issue along the way, unrelated to this feature: the
plain-JS "white-screen safety net" in `client/index.html` (a one-shot overlay
that never re-checks itself) can false-positive on a slow first Vite
transform of the `/game` route — pre-warming the route once before the timed
navigation fixed it. Documented here in case a future session hits the same
false "FRONTIER failed to load" in this specific harness.

## Not done this pass

- `CommTerminal.tsx` (the ambient lore-whisper widget) and
  `PlotTerminalReadout.tsx` (the AI tactical briefing) were deliberately left
  alone — narrow, working, read-only components; retrofitting command input
  into them would have overloaded their responsibility. `GameTerminal` is the
  new shared shell for interactive terminals instead.
- Did not attempt clickable/typed commands for `attack`/`build`/`terraform` —
  scoped this pass to the two flows the owner named (mining, NFT claiming).

## Scope check

Client-only (5 files: 2 new + 1 new spec + 2 edited). No server code, no
funds/ASA logic touched — purely wraps existing handlers in a new input UI.

## Verified green

- `pnpm run check` (tsc) — clean
- `pnpm run test` (client) — **340 passed** (was 330; +10 new
  `terminalCommands.spec.ts` tests)
- `pnpm run test:server` — 458 passed, unchanged
- `pnpm run build` — clean production build
- Live headless browser verification (see above) — both the click-token and
  typed-command paths confirmed working against the real running game, not
  just unit tests.
