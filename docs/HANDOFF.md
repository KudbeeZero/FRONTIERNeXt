# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `feat/surface-armory-battle-nav`
- **PR:** _not yet opened_ — `gh` is not installed on this host. Open from the
  pushed branch:
  https://github.com/KudbeeZero/FRONTIERNeXt/pull/new/feat/surface-armory-battle-nav
  (base `main`). Title: `feat(ui): surface Armory + promote Battles in game navigation`.
- **Audit status:** `AWAITING_AUDIT`
- **Prior relay correction:** PR [#30](https://github.com/KudbeeZero/FRONTIERNeXt/pull/30)
  (`chore/action-nonces-ttl`, ID-004) had **already merged** to `main`
  (`a469799`) with the baton left `AWAITING_AUDIT`. **Retro-audited PASS this chat**
  (`docs/audits/chore-action-nonces-ttl.md`): all code claims verified vs the
  merged tree, tsc clean, `test:server` 244/244. The "nothing lands unreviewed"
  gap for #30 is now closed retrospectively.
- **CI gates green (run locally this chat at branch HEAD):** `check` (tsc) 0,
  `test:server` **244/244**, `test` (client) **49/49**, `build` ✓.

## What this chat did (for the auditor)
Two parts — the start-of-chat audit, then the unit of work:
1. **Retro-audited merged PR #30** (see above) → PASS.
2. **Surfaced the Armory + promoted Battles in the game nav.** The whole weapons
   system (8 `/api/weapons/*` routes + `ArmoryPanel`) was built but the `/armory`
   route had **no link anywhere** (URL-only); Battles was buried in the mobile
   "More" overflow. Now:
   - `BottomNav.tsx`: added `armory` to `NavTab`; promoted **Battles** and
     **Armory** into `PRIMARY_TABS` (mobile bar is now Map · Battles · Armory ·
     Inventory · Commander · More); moved Intel into the overflow sheet.
   - `GameLayout.tsx`: imported `ArmoryPanel`; added an **Armory** tab to the
     desktop right sidebar (`desktopRightTab`) and a render branch; added the
     mobile fullscreen Armory panel (wallet-gated with a connect prompt).
   - **No backend/route/schema changes.** Renders the existing `ArmoryPanel`
     against the live API.
   - **Verified (`/verify` → PASS):** tsc + both suites + build green;
     **runtime-driven via DOM** (booted with `VITE_TEST_GLOBE=true`): game renders
     the new tab set, Battles routes to real battle data, Inventory unaffected,
     Intel correctly demoted to the overflow sheet, desktop War/Armory tabs mount.
     **No dedicated new automated test** for the nav wiring — it is presentational.
   - **Post-verify fix:** desktop Armory with no connected wallet was rendering
     `ArmoryPanel` with an empty `playerId` → misleading "Failed to load armory";
     now gated on `player` to show the same "Connect your wallet" prompt as mobile.

## Audit checklist (for the next /handoff-audit)
| Claim | How to verify |
|---|---|
| Armory reachable in-game (was orphaned) | `GameLayout.tsx` desktop `desktopRightTab === "armory"` branch + mobile `activeTab === "armory"`; `BottomNav.tsx` `armory` in `PRIMARY_TABS` |
| Battles promoted to primary (was overflow) | `BottomNav.tsx` `PRIMARY_TABS` contains `battles`; `OVERFLOW_TABS` no longer does |
| No backend change | diff touches only `BottomNav.tsx` + `GameLayout.tsx` (+ audit/baton docs) |
| Suites green at HEAD | `check` 0, `test:server` 244/244, `test` 49/49, `build` ✓ |
| Nav wiring untested (honesty) | no new `*.spec.tsx` for the nav; relies on tsc + runtime DOM check |
| #30 retro-audit | `docs/audits/chore-action-nonces-ttl.md` |

## NEXT chat
- **Recommended next unit:** `feat/game-shell-flow-redesign` — the bigger
  "layout flows better" pass the user asked about: unify desktop/mobile nav,
  retire the duplicate standalone `/battles` + `/armory` routes (now superseded
  by in-game tabs), and remove orphaned components (`MobilePlotSheet`,
  `SelectedPlotPanel`, `MissionLoadingScreen`).
- **Other queued options (one unit each):**
  - `feat/rate-limit-actions` — per-IP/per-player limiter on `/api/actions/*`
    (idempotency is correct now; rate-limiting is the right next server layer).
  - `chore/registerRoutes-testable` — real HTTP route-mount test of 400/409/503/
    200-replay.
  - Extend idempotency guard to `/api/sub-parcels/:id/build` (`LandSheet.tsx`).
  - Port PR #10's algod-first finality into `verifyAlgoPayment`. **Funds-economic
    → `algo-auditor` + `/security-pass`.**
- **Open risks:**
  - ⚠️ Nav change has **no dedicated automated test** (suite + build + runtime DOM
    only).
  - ⚠️ Desktop right sidebar now has **7 tabs** — labels are tiny/cramped at
    `w-60`; a redesign should reconsider this.
  - ⚠️ Standalone `/battles` + `/armory` **routes still exist** as duplicates of
    the in-game tabs (deep-links; harmless but confusing).
  - ⚠️ `VITE_TEST_GLOBE` in `.env` was toggled to `true` during verification and
    **restored to `false`** — confirm it reads `false` before any deploy.
  - (Carried) Replay protection lasts the TTL (≥10 min); no rate limit on
    `/api/actions/*`; no HTTP route-mount test; migrations `0005`–`0008` must be
    applied before deploy; `verifyAlgoPayment` finality is indexer-only.
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/`
  may point at mainnet; no funds/ASA/transfer code to mainnet without
  `/mainnet-gate` **and** `algo-auditor`.
