# 2026-07-06 — art assets, gate audio, AI plot terminal, panel redesign, Heroku deploy

Eight units this push, all merged on green (#184–#191). Owner supplied real art assets
mid-session (4 faction emblems, 4 badge medallions, 1 landing hero) generated from prompts
requested earlier in the same push.

## Shipped

- **#184 — real faction emblems, badge medallions, landing hero art.** Wired the owner's
  9 delivered images into `FactionSelectGate` (replacing Lucide icons), `ArmoryPanel` badge
  chips, and `landing.tsx` hero background (masked fade, opacity 0.7).
- **#185 — menu design system.** Owner: menus "look boxy," fonts not centered, spacing
  inconsistent. Design-audit pass produced `docs/design/MENU_DESIGN_RULES.md` (4/8/12/16/24/32
  spacing scale, radius tiers, typography rules) and applied the tokens across Armory,
  University, Leaderboard, Commander, WorldIntel, TradeStation panels. Orbitron adopted as
  `--font-display` (owner picked it from the mockup via AskUserQuestion — the mockup's
  chamfered look itself was an unreproducible AI-image effect, not a real font).
- **#186 — faction-gate ambient hum + hover beep + card lift.** WebAudio synthesis, no
  assets: low dual-sine ambient hum (gesture-gated per autoplay policy), per-card hover beep
  (short sine sweep), CSS card-lift-and-snap-back on hover. `factionGateSound.ts`, untested by
  design (matches existing `battleSoundPlayer.ts` precedent).
- **#187 — plot-select Tactical AI Terminal.** Owner: static title card on plot-select was
  "boring," wanted an AI command-terminal readout, offered their Anthropic key, asked for the
  cheap model. Cloned the existing `advisor.ts` pattern (plain fetch, no SDK,
  `claude-haiku-4-5-20251001` default, deterministic heuristic fallback on any failure) into
  `plotTerminal.ts` + a new rate-limited `GET /api/plots/:plotId/terminal-brief` (ownership
  resolved server-side via session, never trusts client player id) + a typewriter-effect
  `PlotTerminalReadout.tsx`. 5 new server tests.
- **#188 — duplicate Claim/Attack card fix.** `CommandCenterPanel` rendered
  `SelectedParcelActions` twice; the second block's condition was a strict subset of the
  first's. Deleted the dead second block. New SSR test asserts the claim button renders
  exactly once (verified failing before / passing after via git stash).
- **#189 + #191 — Heroku deploy (owner testing a second host in parallel; Fly.io stays
  primary, must not break).** Heroku rejected the deploy twice: first "Node version not
  specified" → added `engines.node` + `packageManager` + `heroku.yml` (container-stack path
  reusing the existing Fly Dockerfile). Second push rejected the range `">=22 <23"` as a
  "dangerous semver range" (bare `>`/`<` operators) → #191 switched it to the plain `"22.x"`
  form Heroku's own docs recommend. Both fields are inert for Fly (Docker build reads its own
  base image, never `package.json` engines).
- **#190 — plot-select panel redesign.** Owner: the land card "doesn't fit," can't move it,
  "should be at least a 9.5/10." Made `SelectedPlotPanel` draggable (`framer-motion`
  `useDragControls`, header-scoped drag) with a pop-out minimize → 52px biome-colored chip →
  restore. `AnimatePresence` deliberately has no `mode="wait"` (that hid the chip during the
  minimize transition in first pass — caught and fixed before merge).

## Also this push (no code change)

- Survey answered the owner's `/agents` ask for an on-chain "watchdog" — `server/veritas/`
  already does exactly this (built, tested), it's just never run continuously anywhere.
  Candidate: run it on Lightning AI + a Discord webhook. Not started.
- Owner flagged an Armory "tactical map/radar" want — needs a scoping conversation (Google
  Maps API cost/ToS vs. a radar overlay built from existing game data). Not started.
- Two owner phone screenshots claiming "hidden card behind this" were the **chat client**
  layering inline tool-result images behind message text, not a game bug — explained, no
  code change; committing to fewer raw inline screenshots going forward.

## Honest gaps / owner action items

- **Heroku: untested whether #191 actually gets a build through** — owner needs to
  `git pull origin main && git push heroku main` (or `heroku stack:set container` first) and
  report back.
- `ANTHROPIC_API_KEY` needs to be set on Fly (`fly secrets set ANTHROPIC_API_KEY=...`) for the
  plot terminal's LLM path to activate — falls back to the deterministic heuristic brief until
  then. Optional `ELEVENLABS_API_KEY` + `COMM_TERMINAL_VOICE_ID` for a future voice pass.
- Gate audio (#186) and the panel drag/minimize (#190) are visually verified in-sandbox via
  headless screenshots, not on a real owner device — same standing caveat as prior units.
- `MENU_DESIGN_RULES.md` follow-ups still open: `slate-*` palette migration in Armory/
  University, a few remaining sub-10px captions in CommanderPanel/WorldIntelPanel.

## Verification

CI green on every merge commit through `main@7391a40` (run #523). No open PRs. Local branches
for all eight merged units deleted; remote merged-branch refs left alone.
