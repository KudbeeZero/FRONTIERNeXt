# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> Detailed history lives in git + [`artifacts/frontier-al/session-notes/`](../artifacts/frontier-al/session-notes/).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton — 🟡 AWAITING_AUDIT · branch `claude/ai-faction-comms` · PR #__ · 1 open PR

This chat shipped **AI Battle Test — Unit 1: faction communication.** The 4 AI factions now
**speak in character** in the live event feed during real turns. (Prior unit **#151** zero-click
dev login was verified green + **merged** this chat to unblock.) **Next chat: `/handoff-audit` this PR first.**

- **What this chat did (for the auditor):**
  - New **pure** `server/engine/narrative/factionVoice.ts` — deterministic in-character one-liners
    (`seed % n`), distinct personas for NEXUS-7 / KRONOS / VANGUARD / SPECTRE; unknown faction → null (fail-safe).
  - Wired `withFactionVoice()` into **5** `ai-engine.ts` emission sites (expand×2, assault×2, reconquest, raid).
    **Cosmetic only** — appends a quoted taunt to the event `description`; **no combat/economy/turn behavior changed**.
  - `factionVoice.spec.ts` — **8** tests (determinism, total-over-seeds, distinct voices, fail-safe).
  - **No funds/ASA/transfer code touched.**
- **Verify gate (branch head):** typecheck ✓ · server **388**/14-skip ✓ (380 + **8** new) · client **178** ✓ · build ✓.
- **#151 (merged):** `VITE_DEV_AUTOLOGIN` — zero-click fund-free dev login; triple-gated, fail-closed, tested.
- **Honest flag:** logic + tests + build only — **NOT browser-verified on-device** (watch the event feed during an
  AI turn with `AI_ENABLED=true`). Taunts surface wherever the event `description` is shown.
- **Deploy:** Fly **`frontiernext`** (`frontiernext.fly.dev`) + Cloudflare **`frontierprotocol.app`** LIVE.
- **Branch cleanup:** triaged all **140** non-`main` branches (73 merged + 67 unmerged) → all
  dead/superseded, **nothing valuable un-landed**; only **`wip/atomic-purchase` retained (OFF-LIMITS)**.
  ⚠️ **Programmatic deletion is blocked in the web env** (GitHub **403** on `git push --delete`; no
  MCP ref-delete tool) — prune from the GitHub UI or a delete-scoped token. Full prune list:
  [`artifacts/frontier-al/docs/audit/2026-06-25-branch-cleanup.md`](../artifacts/frontier-al/docs/audit/2026-06-25-branch-cleanup.md).

### Recently shipped (merged + verified)
- **#151** zero-click TestNet dev auto-login (`VITE_DEV_AUTOLOGIN`) — merged this chat.
- **#149/#150** clean-launch baseline + branch-cleanup triage (prev chat).
- **#146** Aether prologue polish — warmer Web Speech fallback + Mars "under us" landing (vendored `/story/` rebuilt).
- **#147** weapons-combat **Unit 1** — offensive **Weapon Strike** (client wired to `/api/weapons/fire`; server unchanged).
- **#148** baton reconcile + post-merge verification.

### ➡️ NEXT UNITS — "AI Battle Test" public-playtest mode (owner vision; one PR each)
Frictionless public playtest that doubles as marketing/onboarding: strategic+talking AIs → solo
account vs AI → early-signup reward → cinematic intro. Full scope map: `scratchpad/ai-battle-test-roadmap.md`
(session-local) — **next chat should re-derive it from the systems below if scratch is gone.**
1. **AI Battle Test — Unit 2: guided solo-vs-AI entry.** Zero-click login (#151) drops the tester in, flags an
   AI faction as the opponent, objective HUD ("knock out NEXUS-7 outposts"). Mostly onboarding glue over the
   **existing** battle pipeline (`/api/weapons/fire-weapon` → `weapon_engagement` ws; AI parcels already targetable).
2. **Cinematic intro** — replace the hardcoded **6s** `MissionLoadingScreen.tsx` counter with a real prologue via
   the **existing** cinematic layer (`cameraDirector.ts` / `cinematicBus.ts` / `GlobeCinematicCamera.tsx`).
3. **Early-access email/waitlist capture** — signup (landing + post-battle CTA) → rate-limited server route →
   store/validate email. **No chain** — safe lead capture.
4. **Playtest reward airdrop** (GATED, LAST) — grant ASCEND/NFT to signups. **Touches funds/ASA → requires
   `/mainnet-gate` PASS + `algo-auditor`; TestNet only.**
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
