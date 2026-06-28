# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> Detailed history lives in git + [`artifacts/frontier-al/session-notes/`](../artifacts/frontier-al/session-notes/).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton — ⏳ AWAITING_AUDIT · PR **#167** · branch `claude/wallet-dashboard-redesign-b78nwa` · `main` @ `b2da3b5`

**This chat (unit 2):** **real wallet wins over dev/test auto-login.** Client-only; no funds/ASA/server change. See
[`session-notes/2026-06-28-real-wallet-wins-over-dev-login.md`](../artifacts/frontier-al/session-notes/2026-06-28-real-wallet-wins-over-dev-login.md).
- **Bug (owner screenshots):** Lute connected on landing (`NRJQZM…JGTQ`, 14.866 ALGO) but in-game TopBar showed
  **DEV-TEST-COMMANDER · 0 ALGO** — the dev auto-login shadowed the real wallet.
- **Fix:** `useWallet()` dev fallback now gates on `walletStatus === "disconnected"` via new pure `shouldUseDevIdentity()`
  (not bare `!isConnected`), so it can't shadow a wallet that's **restoring** (the /game resume gap) or **connected**.
  Plus: clear the dev session (`endDevSession()`) the moment a real `activeAddress` lands. Tests:
  `client/tests/devIdentityPrecedence.spec.ts` (5). Green: tsc · client **200** · server **411**/14-skip · build OK.

**For the auditor (claims → check):** `git diff --stat main...HEAD` = `WalletContext.tsx` + 1 new test + 1 session note.
**Honest gap:** not browser-verified on-device (sandbox can't drive the Lute extension) — logic + unit tests + build only.
Owner smoke-test: connect Lute → ENTER GAME → TopBar should show the Lute address + real balance, not DEV-TEST-COMMANDER.

**Prior:** **#166 merged** (Lute connect timeout + siteName + version 2.0.1), **#165 merged** (wallet-prompt diagnosis),
**#164 merged** (`LOCAL_DEV.md`), **#163 closed** (Unreal dropped).

### ➡️ NEXT UNITS (this push, owner-confirmed plan)
1. **Branded-domain wallet prompt** — redirect `frontierprotocol.app` → `frontiernext.fly.dev` (option A, code-only,
   `DEV_MODE`-gated). Rejected option B (Cloudflare `VITE_DEV_*`): branded origin still 405s on `/api/dev/quick-auth`.
   Owner workaround meanwhile: play on `https://frontiernext.fly.dev/` directly.
2. **Desktop dashboard widget system** — custom **dnd-kit** draggable snap-grid replacing the bunched fixed rails/corners
   in `GameLayout.tsx` (foundation + store first, then migrate ~17 panels). Desktop-focused; mobile keeps current tabs.

- **The 7 merged AI Battle Test units:**
  - **#151** zero-click TestNet dev login (`VITE_DEV_AUTOLOGIN`, triple-gated, fail-closed).
  - **#152** AI faction **communication** — `factionVoice.ts` taunts wired into 5 AI-turn sites.
  - **#153** **faction-select gate** + optional **play-to-waitlist** (`/api/waitlist/join`, Redis store).
  - **#154** rival + **mission briefing** (`battleObjective.ts`).
  - **#155** **live objective HUD** (`ObjectiveHud.tsx` polling `/api/factions`).
  - **#156** **persist faction to DB** (gate → `/api/factions/:name/join`).
  - **#157** **cinematic intro** replacing the launch counter (`IntroCinematic.tsx`).
- **🛑 NOT built (on purpose):** the waitlist **reward payout** (on-chain ASCEND/NFT for tiers) — funds/ASA,
  **gated**: needs `/mainnet-gate` PASS + `algo-auditor`. Capture + tier ladder done; payout pending.
- **Honest flag:** all units are logic + tests + build — **NOT browser-verified on-device** (owner smoke-test:
  intro → faction pick → mission HUD; cinematic pacing is a default to retune).
- **Deploy:** Fly **`frontiernext`** (`frontiernext.fly.dev`) + Cloudflare **`frontierprotocol.app`** LIVE.
- **Branch cleanup:** triaged all **140** non-`main` branches → all dead/superseded, nothing valuable un-landed;
  only **`wip/atomic-purchase` retained (OFF-LIMITS)**. Prune from GitHub UI when a delete-scoped token is available.
  Full list: [`artifacts/frontier-al/docs/audit/2026-06-25-branch-cleanup.md`](../artifacts/frontier-al/docs/audit/2026-06-25-branch-cleanup.md).

### Recently shipped (merged + verified)
- **#162** wallet gate bypass + Cloudflare→Fly routing — merged this session.
- **#161** `VITE_DEV_AUTOLOGIN` on Fly — merged this session.
- **#160** faction gate no-wallet quick-auth — merged this session.
- **#159** NFT nags suppressed for dev player — merged this session.
- **#157** cinematic intro replacing the launch counter.
- **#156** persist faction alignment to DB.
- **#155** live objective HUD.
- **#154** rival + mission briefing.
- **#153** faction-select gate + play-to-waitlist.
- **#152** AI faction communication (taunts in live feed).
- **#151** zero-click TestNet dev auto-login.

### ➡️ NEXT UNITS (owner decides priority)
1. **Cinematic taste pass** — #157 is default pacing. Retune timing/copy/visuals or swap to globe fly-in.
2. **Objective HUD live lose-detection** — feed real player territory count to `evaluateObjective` (currently `1`).
3. **Weapons Unit 2** — defensive DEPLOY UI.
4. **Weapons Unit 3** — engagement cinematic off `weapon_engagement` ws.
5. **Aether real VO Ch.2–5** — needs `ELEVENLABS_API_KEY`.
6. **Waitlist reward payout** (🛑 GATED, LAST) — `/mainnet-gate` PASS + `algo-auditor` required first.
- **Housekeeping:** prune 140 stale branches per audit doc above.

### Open risks / honest flags
- **#147 Strike** + **#146 prologue** are **NOT browser-verified on-device** (logic/tests + CI only) — owner
  smoke-test: fire a weapon on the live site; replay the prologue (voice + Mars landing).
- A fired weapon currently only toasts — no globe animation until Weapons Unit 3.
- Pre-deploy reminders: migrations `0000`–`0011` applied; `VITE_TEST_GLOBE` reads `false`; keep
  `SESSION_SECRET` stable across deploys.

### 🛑 HARD RULES / off-limits (absolute)
- No funds/ASA/transfer code toward mainnet without **`/mainnet-gate` PASS + `algo-auditor` pass**.
- **Don't merge `wip/atomic-purchase`**; nothing in `ops/kestra/` may point at mainnet.
- Don't reintroduce mock/demo data into plot/HUD surfaces (they are live, server-driven).
- Don't change globe/combat/canvas behavior outside a scoped, audited unit.
- **Standing owner directive (granted this chat):** proceed without asking when approval is a foregone
  conclusion (build → merge → closeout); still one-PR-at-a-time and HARD RULES remain absolute.
