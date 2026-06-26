# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> Detailed history lives in git + [`artifacts/frontier-al/session-notes/`](../artifacts/frontier-al/session-notes/).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton — 🟡 AWAITING_AUDIT · branch `claude/intro-cinematic` · PR #157 · 1 open PR

Running a `/loop` building the AI Battle Test, testing after each. This PR (#157) is the **cinematic intro
replacing the launch counter**. **Next chat: `/handoff-audit` this PR first.**

- **What this PR (#157) did (for the auditor):**
  - **`lib/introCinematic.ts`** (+spec, 3 tests) — pure `introPhaseAt`/`introProgress` timeline + seen-once.
  - **`IntroCinematic.tsx`** — rAF-driven overlay (ignition → orbital push-in → "AI BATTLE TEST" title),
    skippable, plays once; **`game.tsx`** mounts it above the faction gate. **No funds/canvas/combat touched.**
  - Default style — **owner should retune to taste**.
- **Verify gate (branch head):** typecheck ✓ · server **411** ✓ · client **187** ✓ (+3) · build ✓.
- **Merged this session (verified green):** **#151** dev login · **#152** AI voice · **#153** faction gate +
  waitlist · **#154** mission briefing · **#155** objective HUD · **#156** persist faction to DB.
- **Honest flag:** all 5 units are logic + tests + build — **NOT browser-verified on-device** (eyeball HUD overlap).
  The waitlist **reward payout** is intentionally **NOT built** — gated on-chain unit (`/mainnet-gate` + `algo-auditor`).
- **Deploy:** Fly **`frontiernext`** (`frontiernext.fly.dev`) + Cloudflare **`frontierprotocol.app`** LIVE.
- **Branch cleanup:** triaged all **140** non-`main` branches (73 merged + 67 unmerged) → all
  dead/superseded, **nothing valuable un-landed**; only **`wip/atomic-purchase` retained (OFF-LIMITS)**.
  ⚠️ **Programmatic deletion is blocked in the web env** (GitHub **403** on `git push --delete`; no
  MCP ref-delete tool) — prune from the GitHub UI or a delete-scoped token. Full prune list:
  [`artifacts/frontier-al/docs/audit/2026-06-25-branch-cleanup.md`](../artifacts/frontier-al/docs/audit/2026-06-25-branch-cleanup.md).

### Recently shipped (merged + verified)
- **#154** AI Battle Test rival + mission briefing on faction pick — merged this chat.
- **#153** faction-select entry gate + optional play-to-waitlist capture — merged this chat.
- **#152** AI faction communication — the 4 factions taunt in the live feed — merged this chat.
- **#151** zero-click TestNet dev auto-login (`VITE_DEV_AUTOLOGIN`) — merged this chat.
- **#149/#150** clean-launch baseline + branch-cleanup triage (prev chat).
- **#146** Aether prologue polish — warmer Web Speech fallback + Mars "under us" landing (vendored `/story/` rebuilt).
- **#147** weapons-combat **Unit 1** — offensive **Weapon Strike** (client wired to `/api/weapons/fire`; server unchanged).
- **#148** baton reconcile + post-merge verification.

### ➡️ NEXT UNITS — "AI Battle Test" public-playtest mode (owner vision; one PR each)
Frictionless public playtest that doubles as marketing/onboarding. **Shipped this session (all merged + verified):** zero-click entry (#151) · talking AIs (#152) · faction-select
gate + play-to-waitlist (#153) · rival + mission briefing (#154) · live objective HUD (#155, this PR).
**Remaining (need owner input or a gate):**
1. **Cinematic intro** (VISUAL — get owner taste first) — build a real prologue via the **existing** cinematic
   layer (`cameraDirector.ts` / `cinematicBus.ts` / `GlobeCinematicCamera.tsx`); the old `MissionLoadingScreen.tsx`
   6s counter is dead (no importer). Surface on entry around the faction gate.
2. **Live lose-detection for the objective HUD** — feed real player territory to `evaluateObjective`'s `playerNow`
   (currently a safe constant `1`, so the "lost" branch is tested but not live-driven). Small follow-up.
3. **Waitlist reward payout** (🛑 GATED, LAST) — convert engagement `tier` (already computed, `shared/waitlist.ts`)
   into an on-chain ASCEND/NFT grant. **Touches funds/ASA → requires `/mainnet-gate` PASS + `algo-auditor`; TestNet
   only.** Capture + tier ladder are done; only the payout is pending — **do NOT build without the gate.**
- **Also queued (pre-existing):** Weapons Unit 2 (defensive DEPLOY UI), Weapons Unit 3 (engagement cinematic
  off `weapon_engagement` ws), Aether real VO Ch.2–5 (needs `ELEVENLABS_API_KEY`).
- **Housekeeping (owner / when a delete path exists):** prune the 140 stale branches per the audit doc above.

### Open risks / honest flags
- **#147 Strike** + **#146 prologue** are **NOT browser-verified on-device** (logic/tests + CI only) — owner
  smoke-test: fire a weapon on the live site; replay the prologue (voice + Mars landing).
- A fired weapon currently only toasts — no globe animation until Unit 3.
- Pre-deploy reminders: migrations `0000`–`0011` applied; `VITE_TEST_GLOBE` reads `false`; keep
  `SESSION_SECRET` stable across deploys.

### 🛑 HARD RULES / off-limits (absolute)
- No funds/ASA/transfer code toward mainnet without **`/mainnet-gate` PASS + `algo-auditor` pass**.
- **Don't merge `wip/atomic-purchase`**; nothing in `ops/kestra/` may point at mainnet.
- Don't reintroduce mock/demo data into plot/HUD surfaces (they are live, server-driven).
- Don't change globe/combat/canvas behavior outside a scoped, audited unit.
- **Standing owner directive (granted this chat):** proceed without asking when approval is a foregone
  conclusion (build → merge → closeout); still one-PR-at-a-time and HARD RULES remain absolute.
