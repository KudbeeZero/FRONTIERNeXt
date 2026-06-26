# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> Detailed history lives in git + [`artifacts/frontier-al/session-notes/`](../artifacts/frontier-al/session-notes/).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton — ✅ CLEAN · no open PRs · `main` @ `8a1f492`

**Last session fixed the no-wallet playtest entry (PRs #159–#162, all merged):**
- **#159** NFT claim/mint nags suppressed for dev player (`effectiveInCustody()`).
- **#160** Faction gate calls `/api/dev/quick-auth` in `DEV_MODE` on "Align & Enter".
- **#161** `VITE_DEV_AUTOLOGIN=true` added to `fly.toml` (zero-click landing auto-login).
- **#162** **Wallet gate bypass + Cloudflare routing** — `gameUrl.ts` routes non-Fly hosts to
  `https://frontiernext.fly.dev/game` at runtime (no dashboard config needed); `GameLayout`
  redirects to `/` in `DEV_MODE` when no dev session is active (triggers landing auto-login).

**End state:** server **411**/14-skip · client **189** · build ✓ · Fly auto-deploy triggered · Cloudflare Pages updated.

**User journey confirmed working:**
1. `frontierprotocol.app` → "Enter Game" → `frontiernext.fly.dev/game` → faction pick → game ✓
2. `frontiernext.fly.dev` landing → auto-login → `/game` → game ✓
3. Direct `frontiernext.fly.dev/game` (cleared session) → `/` → auto-login → game ✓

> Prior: **AI Battle Test onboarding built end-to-end (7 units #151–#157, all merged green)**.

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
