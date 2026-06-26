# Session note — 2026-06-26 · AI Battle Test onboarding (5 units)

## Goal
Owner started from the Algorand funding docs ("can't get TestNet funds — can't we
set up a dev wallet + auto-login?") then expanded into a vision: make the test
environment a **fun, live "AI Battle Test"** that doubles as marketing/onboarding —
strategic + communicating AIs, a fund-free solo account that fights them, a
faction-gated entry, and an optional play-to-waitlist with rewards in the real game.

## Shipped this session (5 units, each its own PR, all merged green)
1. **#151** — zero-click TestNet dev login (`VITE_DEV_AUTOLOGIN`). Triple-gated
   (`VITE_DEV_MODE` + `VITE_DEV_AUTOLOGIN` build flags + server `DEV_LOGIN_ENABLED`
   403), fail-closed, non-spendable sentinel player. Solves "develop without funds".
2. **#152** — AI faction **communication**. `server/engine/narrative/factionVoice.ts`
   (pure, deterministic, distinct personas) wired into 5 AI-turn emission sites →
   the 4 factions taunt in the live event feed. Cosmetic-only; no combat change.
3. **#153** — **faction-select entry gate** + optional **play-to-waitlist**.
   `shared/waitlist.ts` (validation + commit→tier ladder), `FactionSelectGate.tsx`
   (page-level overlay), `POST /api/waitlist/join` (Redis store + in-memory
   fallback, rate-limited, hard `algosdk.isValidAddress`). No funds.
4. **#154** — **rival + mission briefing**. `shared/battleObjective.ts` (`rivalOf`,
   `missionBriefing`, `evaluateObjective`) shown on faction pick.
5. **#155** — **live objective HUD**. `rivalStanding()` + `ObjectiveHud.tsx`
   (fixed, `pointer-events:none`) polling `GET /api/factions` for live rival
   outpost counts → progress bar, win at zero.
6. **#156** — **persist faction to the player record (DB)**. `nextFactionSync()`
   pure decision + gate calls existing `POST /api/factions/:name/join` (best-effort).
7. **#157** — **cinematic intro** replacing the launch counter. Pure
   `introPhaseAt`/`introProgress` timeline + `IntroCinematic.tsx` (rAF overlay:
   ignition → orbital push-in → "AI BATTLE TEST" title), skippable, once.

### Loop wind-down
Units 6–7 were built under a `/loop` (owner: "build in a loop, tested after each").
The loop was wound down after #157 because only **gated** (reward payout) and
**taste** (cinematic refinement) work remains — neither should be auto-built.
End-state `main` @ `c731caf`: **server 411 / client 187 / build green.**

## Test/verify
Each unit ran the full gate green before merge: `check` (tsc) · `test:server` ·
`test` (client) · `build`. End state: **server 411 / client 182** + build. All new
logic is unit-pinned (faction voice determinism, waitlist validation/tier, rivalry
+ objective math, standings helper).

## Honest flags
- **NOT browser-verified on-device** — logic + tests + build + CI only. Eyeball:
  AI taunts in the feed (`AI_ENABLED=true`); faction gate flow; HUD overlap.
- The objective HUD's **lose-detection** uses a safe constant `playerNow=1` (the
  "lost" branch is tested but not live-driven yet).

## Process note
Owner set a session `/goal` for the full vision + a standing "build→merge→closeout"
directive. To deliver (not just plan) under the one-PR-at-a-time rule, each unit's
PR was verified green and merged before starting the next. Self-merges were made
under the standing directive; HARD RULES kept absolute throughout.

## Remaining (need owner input or a gate — NOT auto-built)
- **Cinematic intro** — visual/taste; reuse the existing cinematic layer. Get owner
  direction first. (Old `MissionLoadingScreen.tsx` 6s counter is dead/no importer.)
- **Objective live lose-detection** — feed real player territory to `playerNow`.
- **🛑 Waitlist reward payout** — on-chain ASCEND/NFT for tiers. **GATED**: needs
  `/mainnet-gate` PASS + `algo-auditor`. Capture + tier ladder done; payout pending.
