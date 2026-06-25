# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).
> Detailed history lives in git + [`artifacts/frontier-al/session-notes/`](../artifacts/frontier-al/session-notes/).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- The next unit **does not start** until the current PR is audited **and** merged/closed.

## Current baton — 🟡 AWAITING_AUDIT · branch `claude/testnet-wallet-auto-login-cl8cz9` · PR #151 · 1 open PR

This chat added **zero-click TestNet dev auto-login** so the game can be developed
without TestNet funds. **Next chat: `/handoff-audit` this PR before anything else.**

- **What this chat did (for the auditor):** new client flag `VITE_DEV_AUTOLOGIN` — when it
  **and** `VITE_DEV_MODE` are both `"true"`, the landing page runs the **existing**
  `DEV_LOGIN_ENABLED`-gated `/api/dev/quick-auth` on load and enters the game as the
  non-spendable sentinel test player (no wallet, no funds, no button click).
  - Gate is a **pure fail-closed fn** `shouldDevAutoLogin()` (both flags + single-fire),
    unit-pinned in `client/tests/devAutoLogin.spec.ts` (mirrors `isDevLoginEnabled`).
  - Reuses the existing dev quick-auth route — **no funds/ASA/transfer code touched**;
    triple-gated (two build flags + server's `DEV_LOGIN_ENABLED` 403). Docs: `ENV_VARS.md` + `.env.example`.
- **Verify gate (this chat, branch head `982775f`):** typecheck ✓ · server **380**/14-skip ✓ ·
  client **178** ✓ (174 + **4** new) · build ✓.
- **PRs:** **1 open (this one)** — audit + merge before starting the next unit.
- **Honest flag:** logic + tests + build only — **NOT browser-verified on-device**. And it does
  **NOT** solve real on-chain TestNet funding (sentinel can't hold ALGO); for real on-chain
  testing the path is AlgoKit **LocalNet** (pre-funded) or the dispenser — separate unit.
- **Deploy:** Fly **`frontiernext`** (`frontiernext.fly.dev`) + Cloudflare **`frontierprotocol.app`** LIVE.
- **Branch cleanup:** triaged all **140** non-`main` branches (73 merged + 67 unmerged) → all
  dead/superseded, **nothing valuable un-landed**; only **`wip/atomic-purchase` retained (OFF-LIMITS)**.
  ⚠️ **Programmatic deletion is blocked in the web env** (GitHub **403** on `git push --delete`; no
  MCP ref-delete tool) — prune from the GitHub UI or a delete-scoped token. Full prune list:
  [`artifacts/frontier-al/docs/audit/2026-06-25-branch-cleanup.md`](../artifacts/frontier-al/docs/audit/2026-06-25-branch-cleanup.md).

### Recently shipped (merged + verified)
- **#149/#150** clean-launch baseline + branch-cleanup triage (prev chat).
- **#146** Aether prologue polish — warmer Web Speech fallback + Mars "under us" landing (vendored `/story/` rebuilt).
- **#147** weapons-combat **Unit 1** — offensive **Weapon Strike** (client wired to `/api/weapons/fire`; server unchanged).
- **#148** baton reconcile + post-merge verification.

### ➡️ NEXT UNITS (queued; one PR each)
1. **Weapons Unit 2 — defensive DEPLOY UI** (`/api/weapons/deploy-defense`): "Deploy Defense" control on
   owned parcels (defensive specs only; route is fog-of-war, not broadcast). Branch `claude/weapons-defense-ui`.
   Route + engine already exist — mirror Unit 1's hook+panel pattern.
2. **Weapons Unit 3 — engagement cinematic:** consume the `weapon_engagement` ws broadcast → globe strike
   arc/impact + HUD callout (reuse the battle-cinematic layer). Today a fired shot only toasts.
3. **Aether real VO for Ch.2–5** — generate ElevenLabs voice (needs `ELEVENLABS_API_KEY`) to replace the
   improved-but-synthetic Web Speech fallback.
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
