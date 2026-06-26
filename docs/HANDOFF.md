# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> Detailed history lives in git + [`artifacts/frontier-al/session-notes/`](../artifacts/frontier-al/session-notes/).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton — 🟡 AWAITING_AUDIT · branch `claude/session-closeout` · PR #__ · 1 open PR

**AI Battle Test onboarding — built end-to-end this session (7 units, #151–#157, all merged green).** This
PR is the **session closeout** (baton + session note only — no code). A `/loop` drove the build, testing
after each unit; it was wound down because only gated/taste work remains. **Next chat: `/handoff-audit` this PR.**

- **The 7 merged units (all: typecheck + server + client + build green at merge):**
  - **#151** zero-click TestNet dev login (`VITE_DEV_AUTOLOGIN`, triple-gated, fail-closed).
  - **#152** AI faction **communication** — `factionVoice.ts` taunts wired into 5 AI-turn sites.
  - **#153** **faction-select gate** + optional **play-to-waitlist** (`/api/waitlist/join`, Redis store).
  - **#154** rival + **mission briefing** (`battleObjective.ts`).
  - **#155** **live objective HUD** (`ObjectiveHud.tsx` polling `/api/factions`).
  - **#156** **persist faction to DB** (gate → `/api/factions/:name/join`).
  - **#157** **cinematic intro** replacing the launch counter (`IntroCinematic.tsx`).
- **End-state gate (`main` @ `c731caf`):** server **411**/14-skip · client **187** · build — all green.
- **🛑 NOT built (on purpose):** the waitlist **reward payout** (on-chain ASCEND/NFT for tiers) — funds/ASA,
  **gated**: needs `/mainnet-gate` PASS + `algo-auditor`. Capture + tier ladder are done; payout pending.
- **Honest flag:** all 7 units are logic + tests + build — **NOT browser-verified on-device** (owner smoke-test:
  intro → faction pick → mission HUD on the live game; cinematic pacing is a default to retune).
- **Deploy:** Fly **`frontiernext`** (`frontiernext.fly.dev`) + Cloudflare **`frontierprotocol.app`** LIVE.
- **Branch cleanup:** triaged all **140** non-`main` branches (73 merged + 67 unmerged) → all
  dead/superseded, **nothing valuable un-landed**; only **`wip/atomic-purchase` retained (OFF-LIMITS)**.
  ⚠️ **Programmatic deletion is blocked in the web env** (GitHub **403** on `git push --delete`; no
  MCP ref-delete tool) — prune from the GitHub UI or a delete-scoped token. Full prune list:
  [`artifacts/frontier-al/docs/audit/2026-06-25-branch-cleanup.md`](../artifacts/frontier-al/docs/audit/2026-06-25-branch-cleanup.md).

### Recently shipped (merged + verified)
- **#157** cinematic intro replacing the launch counter — merged this session.
- **#156** persist faction alignment to the player record (DB) — merged this session.
- **#155** live AI Battle Test objective HUD — merged this session.
- **#154** AI Battle Test rival + mission briefing on faction pick — merged this session.
- **#153** faction-select entry gate + optional play-to-waitlist capture — merged this chat.
- **#152** AI faction communication — the 4 factions taunt in the live feed — merged this chat.
- **#151** zero-click TestNet dev auto-login (`VITE_DEV_AUTOLOGIN`) — merged this chat.
- **#149/#150** clean-launch baseline + branch-cleanup triage (prev chat).
- **#146** Aether prologue polish — warmer Web Speech fallback + Mars "under us" landing (vendored `/story/` rebuilt).
- **#147** weapons-combat **Unit 1** — offensive **Weapon Strike** (client wired to `/api/weapons/fire`; server unchanged).
- **#148** baton reconcile + post-merge verification.

### ➡️ NEXT UNITS — "AI Battle Test" (build complete; remaining needs owner input or a gate)
**Shipped this session (all merged + verified):** zero-click entry (#151) · talking AIs (#152) · faction
gate + play-to-waitlist (#153) · mission briefing (#154) · live objective HUD (#155) · faction→DB (#156) ·
cinematic intro (#157). **Remaining:**
1. **Cinematic taste pass** — #157 is a default (rAF orbital push-in + title). Retune pacing/copy/visuals,
   or swap to the in-game cinematic layer (`cameraDirector.ts` / `cinematicBus.ts`) for a globe fly-in.
2. **Objective HUD live lose-detection** — feed real player territory to `evaluateObjective`'s `playerNow`
   (currently safe constant `1`; the "lost" branch is tested but not live-driven). Small follow-up.
3. **Waitlist reward payout** (🛑 GATED, LAST) — convert engagement `tier` (computed in `shared/waitlist.ts`)
   into an on-chain ASCEND/NFT grant. **Funds/ASA → requires `/mainnet-gate` PASS + `algo-auditor`; TestNet
   only.** Capture + tier ladder done; **do NOT build the payout without the gate.**
- **Also queued (pre-existing):** Weapons Unit 2 (defensive DEPLOY UI), Weapons Unit 3 (engagement cinematic
  off `weapon_engagement` ws), Aether real VO Ch.2–5 (needs `ELEVENLABS_API_KEY`).
- **Housekeeping (owner / when a delete path exists):** prune the 140 stale branches per the audit doc above.
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
