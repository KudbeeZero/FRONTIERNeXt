# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> Detailed history lives in git + [`artifacts/frontier-al/session-notes/`](../artifacts/frontier-al/session-notes/).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton — 🟡 AWAITING_AUDIT · branch `claude/faction-select-entry` · PR #__ · 1 open PR

This chat shipped the **faction-select entry gate + optional play-to-waitlist** ("just let me get
in": pick a faction, drop into the game fund-free, optionally leave wallet/email for early access).
(Prior units **#151** dev login + **#152** AI faction comms were verified green + **merged** this chat.)
**Next chat: `/handoff-audit` this PR first.**

- **What this chat did (for the auditor):**
  - **`shared/waitlist.ts`** (+spec, 12 tests) — pure validation/normalize (known faction + ≥1 valid
    contact) + cosmetic commit→tier ladder. Shared so client + server validate identically.
  - **Client:** `lib/factions.ts` (metadata + localStorage choice) + `FactionSelectGate.tsx`, mounted as a
    **page-level overlay** in `game.tsx` — **does NOT touch the globe/combat canvas**. Shows once. (`factions.spec.ts`, 4 tests.)
  - **Server:** `POST /api/waitlist/join` (shared validate + **hard `algosdk.isValidAddress`**, rate-limited
    `WAITLIST_RATE_LIMIT`); `waitlistStore.ts` → Upstash Redis (`redisRecordWaitlist`) w/ in-memory fallback
    (`waitlistStore.spec.ts`, 2 tests). **NO funds/ASA/transfer code.**
- **Verify gate (branch head):** typecheck ✓ · server **400**/14-skip ✓ (+12) · client **182** ✓ (+4) · build ✓.
- **Merged this chat:** **#151** `VITE_DEV_AUTOLOGIN` (zero-click dev login) · **#152** AI faction voice (taunts in live feed).
- **Honest flag:** logic + tests + build only — **NOT browser-verified on-device**. The waitlist **reward payout**
  is intentionally **NOT built** — that's the gated on-chain unit (needs `/mainnet-gate` + `algo-auditor`).
- **Deploy:** Fly **`frontiernext`** (`frontiernext.fly.dev`) + Cloudflare **`frontierprotocol.app`** LIVE.
- **Branch cleanup:** triaged all **140** non-`main` branches (73 merged + 67 unmerged) → all
  dead/superseded, **nothing valuable un-landed**; only **`wip/atomic-purchase` retained (OFF-LIMITS)**.
  ⚠️ **Programmatic deletion is blocked in the web env** (GitHub **403** on `git push --delete`; no
  MCP ref-delete tool) — prune from the GitHub UI or a delete-scoped token. Full prune list:
  [`artifacts/frontier-al/docs/audit/2026-06-25-branch-cleanup.md`](../artifacts/frontier-al/docs/audit/2026-06-25-branch-cleanup.md).

### Recently shipped (merged + verified)
- **#152** AI faction communication — the 4 factions taunt in the live feed — merged this chat.
- **#151** zero-click TestNet dev auto-login (`VITE_DEV_AUTOLOGIN`) — merged this chat.
- **#149/#150** clean-launch baseline + branch-cleanup triage (prev chat).
- **#146** Aether prologue polish — warmer Web Speech fallback + Mars "under us" landing (vendored `/story/` rebuilt).
- **#147** weapons-combat **Unit 1** — offensive **Weapon Strike** (client wired to `/api/weapons/fire`; server unchanged).
- **#148** baton reconcile + post-merge verification.

### ➡️ NEXT UNITS — "AI Battle Test" public-playtest mode (owner vision; one PR each)
Frictionless public playtest that doubles as marketing/onboarding. **Shipped so far this session:**
talking AIs (#152) · zero-click entry (#151) · faction-select gate + play-to-waitlist (PR #__ this chat).
**Remaining:**
1. **Guided solo-vs-AI objective HUD** — after faction-select, flag the rival AI faction as the opponent and
   show an objective ("knock out NEXUS-7 outposts"). Glue over the **existing** battle pipeline
   (`/api/weapons/fire-weapon` → `weapon_engagement` ws; AI parcels already targetable).
2. **Cinematic intro polish** — the dead `MissionLoadingScreen.tsx` 6s counter has **no importer**; build a real
   prologue via the **existing** cinematic layer (`cameraDirector.ts` / `cinematicBus.ts` / `GlobeCinematicCamera.tsx`)
   and surface it on entry (e.g. behind/around the faction gate).
3. **Waitlist reward payout** (GATED, LAST) — convert engagement `tier` (already computed, see `shared/waitlist.ts`)
   into an on-chain ASCEND/NFT grant. **Touches funds/ASA → requires `/mainnet-gate` PASS + `algo-auditor`; TestNet only.**
   The capture + tier ladder are done; only the payout is pending.
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
