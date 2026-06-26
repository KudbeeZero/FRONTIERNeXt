# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> Detailed history lives in git + [`artifacts/frontier-al/session-notes/`](../artifacts/frontier-al/session-notes/).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton — 🟡 AWAITING_AUDIT · branch `claude/ai-battle-objective` · PR #154 · 1 open PR

This chat built out the **"AI Battle Test" onboarding** end-to-end (4 units). This PR (#154) adds the
**rival + mission briefing** on faction-select. **Next chat: `/handoff-audit` this PR first.**

- **What this PR (#154) did (for the auditor):**
  - **`shared/battleObjective.ts`** (+spec, 9 tests) — pure symmetric rivalry map (NEXUS-7↔KRONOS,
    VANGUARD↔SPECTRE), `missionBriefing()`, and `evaluateObjective()` win/lost/active progress math
    (defensive vs bad inputs). No funds/I/O.
  - **`FactionSelectGate.tsx`** — shows "⚔ Mission · X vs Y — dismantle their outposts" on select.
  - **No canvas/combat/funds touched.**
- **Verify gate (branch head):** typecheck ✓ · server **409**/14-skip ✓ (+9) · client **182** ✓ · build ✓.
- **Merged this chat (verified green):** **#151** zero-click dev login · **#152** AI faction voice (live-feed taunts) ·
  **#153** faction-select gate + play-to-waitlist capture.
- **Honest flag:** logic + tests + build only — **NOT browser-verified on-device**. The waitlist **reward payout**
  is intentionally **NOT built** — that's the gated on-chain unit (needs `/mainnet-gate` + `algo-auditor`).
- **Deploy:** Fly **`frontiernext`** (`frontiernext.fly.dev`) + Cloudflare **`frontierprotocol.app`** LIVE.
- **Branch cleanup:** triaged all **140** non-`main` branches (73 merged + 67 unmerged) → all
  dead/superseded, **nothing valuable un-landed**; only **`wip/atomic-purchase` retained (OFF-LIMITS)**.
  ⚠️ **Programmatic deletion is blocked in the web env** (GitHub **403** on `git push --delete`; no
  MCP ref-delete tool) — prune from the GitHub UI or a delete-scoped token. Full prune list:
  [`artifacts/frontier-al/docs/audit/2026-06-25-branch-cleanup.md`](../artifacts/frontier-al/docs/audit/2026-06-25-branch-cleanup.md).

### Recently shipped (merged + verified)
- **#153** faction-select entry gate + optional play-to-waitlist capture — merged this chat.
- **#152** AI faction communication — the 4 factions taunt in the live feed — merged this chat.
- **#151** zero-click TestNet dev auto-login (`VITE_DEV_AUTOLOGIN`) — merged this chat.
- **#149/#150** clean-launch baseline + branch-cleanup triage (prev chat).
- **#146** Aether prologue polish — warmer Web Speech fallback + Mars "under us" landing (vendored `/story/` rebuilt).
- **#147** weapons-combat **Unit 1** — offensive **Weapon Strike** (client wired to `/api/weapons/fire`; server unchanged).
- **#148** baton reconcile + post-merge verification.

### ➡️ NEXT UNITS — "AI Battle Test" public-playtest mode (owner vision; one PR each)
Frictionless public playtest that doubles as marketing/onboarding. **Shipped so far this session:** zero-click entry (#151) · talking AIs (#152) · faction-select gate +
play-to-waitlist (#153) · rival + mission briefing (#154, this PR). **Remaining:**
1. **Live objective HUD** — feed `evaluateObjective()` (built + tested in `shared/battleObjective.ts`) live rival
   outpost counts → an in-game progress readout + win/lose. Needs a faction-standings data source on the client.
2. **Cinematic intro** (VISUAL — get owner taste) — build a real prologue via the **existing** cinematic layer
   (`cameraDirector.ts` / `cinematicBus.ts` / `GlobeCinematicCamera.tsx`); the old `MissionLoadingScreen.tsx` 6s
   counter is dead (no importer). Surface on entry around the faction gate.
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
