# Recovery Parked-Branches Decision — FRONTIERNeXt

- **Date:** 2026-07-09
- **Agent:** recovery/closeout (session `agent_b141af03-069d-40da-a04c-9db133dab97a`)
- **Repo head:** `64c22a8` (main) — #233 "collapse relay into /ship" — CI green, Deploy green.
- **Prior audit:** `docs/audits/recovery-perplexity-state.md` (branch `ae8dfa71`) — PARTIALLY CLEAN. This doc classifies the two parked branches and recommends a next lane.

## Verdict
- **Recovery clean:** main green at `64c22a8`, working tree clean (== main), no open PRs, no TS7/lockfile changes, no active handoff conflict.
- **Two parked branches need an owner decision** (one safe-UI candidate, one auth+econ-config change). Neither merged by this agent.

## Branch 1 — `origin/fix/z-index-hardening`
- **Commit:** `cd2b9e0` (3 ahead of main: `38afa21`, `1e690dc`, `cd2b9e0`)
- **Files changed (4):** `CommTerminal.tsx`, `hud/hud.css`, `client/src/lib/uiLayers.ts`, `docs/HANDOFF.md`
- **Summary:** UI-only z-index stacking hardening. Adds `ZClass` entries (`globe/parcels/hud/panels/sidebar/toast`) and bumps the hud-drawer track/drawer from `z-49`→`z-55`; CommTerminal now uses `ZClass.toast` (`z-[60]`).
- **Risks:** Low. Pure CSS + class-string change. No logic, no behavior, no imports of protected modules.
- **Stale HANDOFF.md:** YES — its 32-line HANDOFF.md edit rewrites the baton to claim "PR #228 open", conflicting with current #233 baton. **Exclude it.**
- **Safe cherry-pick plan (if owner/next-lane proceeds):**
  - Branch off clean `origin/main`: `chore/recovery-z-index-hardening-review`
  - Apply ONLY: `artifacts/frontier-al/client/src/components/game/CommTerminal.tsx`, `.../hud/hud.css`, `.../client/src/lib/uiLayers.ts`
  - Do NOT apply `docs/HANDOFF.md` from this branch.
  - Verify: `frontier-al run check` + `test` (client). Note: no automated z-index test exists; visual regress is untested.
- **Protected paths:** none touched (UI only).
- **Tests required:** client `check` + `test`; manual visual pass on CommTerminal + hud-drawer.
- **Recommendation:** safe cherry-pick candidate (source files only; exclude HANDOFF.md).

## Branch 2 — `origin/session/agent_88081ed3-…` (auth cleanup)
- **Commit:** `197fcbe` — "refactor(auth): remove dev/test session and quick-auth logic" — 17 files, +6 / −523.
- **Files changed (17):** CommanderPanel, FactionSelectGate, GameLayout, LandSheet, NftClaimNotification, globe/GlobeHUD, contexts/WalletContext.tsx, lib/devSession.ts, pages/landing.tsx, 4 client tests, server/devLogin.spec.ts, server/devLogin.ts, server/routes.ts, **fly.toml**.
- **Summary:** Removes the dev quick-auth path entirely (`POST /api/dev/quick-auth` in routes.ts, `server/devLogin.ts`, client `devSession.ts`, `WalletContext` dev branch, `FactionSelectGate`, `landing.tsx`) **and deletes 5 associated test specs**.
- **Deleted tests:** `devAutoLogin.spec.ts`, `devIdentityPrecedence.spec.ts`, `disconnectClearsDevSession.spec.ts`, `effectiveInCustody.spec.ts`, `server/devLogin.spec.ts`.
- **Behavior impact:** Auth/wallet entry path changes — removes no-wallet dev sign-in. **Also removes `fly.toml` env lines:**
  - `DEV_LOGIN_ENABLED = 'true'` — a **standing mainnet-gate item** (HANDOFF.md:39) shipped deliberately for TestNet; M3-4 is the documented exit path.
  - `FREE_PURCHASES = 'true'` — the TestNet **free-purchase toggle**; removing it makes TestNet plot/commander purchases charge ALGO/ASCEND. This is a **funds/economy-adjacent config change** (gated by `computeFreePurchases`, force-disabled on mainnet).
- **Risks:** High for a recovery agent — unverified behavior change + deleted tests + removal of economy/funds-gating TestNet config that the HARD RULES say not to touch without owner sign-off.
- **Protected paths:** touches `fly.toml` FREE_PURCHASES (economy/funds-gate) and DEV_LOGIN_ENABLED (auth/mainnet-gate standing item). No `server/services/chain/`, no ASA/transfer code.
- **Tests required before considering:** `frontier-al run check` + `test:server` + `test` all green; owner review of `fly.toml` config deltas; replacement/regression plan for the 5 deleted dev-session tests.
- **Recommendation:** owner decision required (park — do NOT merge in recovery). Re-verify only after explicit owner approval; treat the `fly.toml` econ/env removals as a separate, gated decision from the auth-code cleanup.

## Protected path check
- **funds / ASA / on-chain:** Branch 1 none. Branch 2 removes `fly.toml` `FREE_PURCHASES` (econ gate) — must be owner-reviewed; not merged here. ✅ untouched by this agent.
- **game / globe / combat:** Branch 1 none. Branch 2 only drops a 3-line dev-session import in GlobeHUD — no sim/combat behavior. ✅
- **TypeScript:** unchanged (5.9.3 root / 5.6.3 frontier-al). No TS7/lockfile change. ✅
- **wip/atomic-purchase:** not present, not touched. ✅

## Recommended next lane
Pick exactly one:
1. **Open small PR for z-index hardening only, excluding stale HANDOFF.md** ← recommended low-risk cleanup.
2. Park both branches and start TS7 prep later.
3. Run full auth branch verification only after owner approval.
4. No action.

This agent recommends **(1)** as a standalone safe PR and **(3)** as a gated, owner-approved follow-up for the auth branch. TS7 migration is explicitly NOT started.

## NOT verified
- Whether the auth branch builds/tests green (tests deleted, behavior changed) — unverified; parked.
- Whether z-index changes are visually correct — no automated z-index test; unverified.
- Whether either branch's claimed PR (#228) ever existed — `gh pr list` shows none open.
