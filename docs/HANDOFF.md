# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `feat/plot-attack-ux-cleanup` (pushed).
- **PR:** [#33](https://github.com/KudbeeZero/FRONTIERNeXt/pull/33) — opened
  against `main`. (`gh` itself is unauthenticated on this host; the PR was opened
  via the stored `git` credential.)
- **Audit status:** `AWAITING_AUDIT`
- **Prior relay correction:** PR [#32](https://github.com/KudbeeZero/FRONTIERNeXt/pull/32)
  (`feat/surface-armory-battle-nav`) had **already merged** to `main` (`ff25dcd`)
  with the baton left `AWAITING_AUDIT`. **Retro-audited FAIL this chat**
  (`docs/audits/feat-surface-armory-battle-nav.md`): the Armory+Battles nav
  feature is sound, but the PR also smuggled in an **undisclosed mock-data plot
  widget** (`FloatingPlotWidget`, which replaced the real claim CTA with fabricated
  stats) **plus stray `right-reports/` artifacts**, under a baton that claimed
  "nav + docs only." This chat's unit of work **remediates** that regression.
- **Local gate (this chat, branch HEAD):** `check` (tsc) **0**. ⚠️ `test:server`,
  `test`, `build` **could NOT run on this Windows host** — `pnpm-workspace.yaml`
  prunes native deps to linux-x64 (`Cannot find module '@rollup/rollup-win32-x64-msvc'`).
  **CI must confirm the suites.** See [[frontier-al-local-dev-windows]].

## What this chat did (for the auditor)
Two parts — the start-of-chat audit, then the unit of work:
1. **Retro-audited merged PR #32** → **FAIL** (`docs/audits/feat-surface-armory-battle-nav.md`).
2. **Plot/attack UX cleanup (steps 1, 2, 4 of the user's brief) + audit remediation.**
   - **Step 1 — retired the global `AttackModal`.** Deleted `AttackModal.tsx`.
     The three Attack triggers (`PlanetGlobe`, `CommandCenterPanel`, `LandSheet`)
     now call `GameLayout.handleRequestAttack` → routes to the Commander panel,
     prefills the target, opens the Battlefront. The on-chain attack handler
     `handleAttackConfirm → attackMutation` is **unchanged**.
   - **Step 2 — simplified the Commander Battlefront** (`CommanderPanel.tsx`):
     Extra Iron/Fuel/Crystal moved behind an **"Advanced" toggle (hidden by
     default)**; single combat-warning line above Confirm; `openBattlefrontSignal`
     opens it on attack-intent. Troops stays visible; tx wiring unchanged.
   - **Step 4 — replaced the mock `FloatingPlotWidget` with the real
     `SelectedPlotPanel`** (restores the live claim CTA — **fixes the #32
     regression**); the desktop card now **portals to `<body>`** (own stacking
     context) and `DEFAULT_DESKTOP_POSITION` is clamped **clear of the right rail**
     (`right: calc(18rem + 16px)`). Deleted `FloatingPlotWidget.tsx`.
   - **Remediation:** removed the stray `right-reports/` artifacts from `main`.
   - **Verified:** tsc 0; **4-lens adversarial diff review PASS** (tx-integrity,
     acceptance, correctness, scope). **No runtime / vitest / build / browser
     verification** (host limit above). **No dedicated automated test** (the change
     is presentational).
   - **Deferred (not done this chat):** **step 3** (duplicate plot feed — no
     code-level bug found; the feeds dedupe by id; needs the running app to
     pinpoint) and **steps 5–6** (capsule nav — the prototype
     `frontiernext-capsule-nav.html` is **not in the repo**, and it needs a runtime
     to build/verify animations).

## Audit checklist (for the next /handoff-audit)
| Claim | How to verify |
|---|---|
| No standalone DEPLOY ATTACK modal anywhere | `AttackModal.tsx` deleted; `git grep AttackModal -- '*.tsx'` → only comments; no `<AttackModal>`/`attackModalOpen` in `GameLayout.tsx` |
| Attack reachable only via Commander | `GameLayout.handleRequestAttack` (no mutation) is wired to all 3 triggers; `handleAttackConfirm → attackMutation` only via `CommanderPanel.onAttack` (GameLayout ~998/1072) |
| On-chain tx logic intact | `handleAttackConfirm` `attackMutation.mutate({…})` params unchanged; `handlePurchase → purchaseMutation` unchanged; `CommanderPanel.handleLaunchPlotAttack → onAttack` |
| Extra Iron/Fuel collapsed by default | `CommanderPanel` `showAdvanced` init `false`; the 3 sliders live inside `{showAdvanced && …}` |
| Plot card real + clamped + own stacking | `SelectedPlotPanel` `createPortal(…, document.body)`; `plotPanelPosition.ts` `right: calc(18rem + 16px)`; no mock/demo values |
| #32 regression remediated | `FloatingPlotWidget.tsx` deleted; `SelectedPlotPanel` `onClaim={handlePurchase}` restores the claim CTA |
| Stray artifacts removed | `right-reports/` deleted |
| Local gate (honesty) | **tsc 0 only**; `test:server`/`test`/`build` NOT run on this Windows host (linux-x64 native deps pruned) — **CI must confirm**; no dedicated UI test |
| #32 retro-audit recorded | `docs/audits/feat-surface-armory-battle-nav.md` |

## NEXT chat
- **Recommended next unit:** `feat/capsule-nav-drawers` (**steps 5–6**) — replace
  the desktop right tab rail with the **top-center capsule nav** + dismissible
  slide-in drawers (remember last width). **Blocked on:** the prototype
  `frontiernext-capsule-nav.html` (**not in the repo — ask the user for it**) and a
  runtime to verify the open/close + staggered-reveal animations.
- **Also queued (one unit each):**
  - **Step 3 — duplicate plot feed:** needs the **running app** to identify which
    feed renders a plot 2–3× (`ActivityFeed` + `WarRoomPanel` already dedupe by
    `id`; **no code-level bug found this chat**). Likely two feeds mounted at once,
    or one plot legitimately spanning multiple sections.
  - (Carried) `feat/rate-limit-actions`; `chore/registerRoutes-testable` (HTTP
    route-mount test); extend idempotency to `/api/sub-parcels/:id/build`
    (`LandSheet.tsx`); algod-first finality in `verifyAlgoPayment` (**funds →
    `algo-auditor` + `/security-pass`**).
- **Open risks:**
  - ⚠️ This unit is **NOT runtime-verified** (tsc + adversarial diff review only;
    vitest/build can't run on this Windows host). **CI must confirm the suites**
    before merge. No dedicated automated test for the UI.
  - ⚠️ An **unclaimed** plot's Attack button now routes to the Commander
    Battlefront (which only does enemy attacks) — **preexisting** trigger behavior
    (the button showed for unclaimed before too); minor UX confusion, not a
    regression.
  - ⚠️ Capsule nav deferred → desktop right rail still has **7 cramped tabs**;
    standalone `/battles` + `/armory` routes still exist as duplicates.
  - ⚠️ Step 3 (duplicate feed) **unresolved** — no code-level cause found.
  - (Carried) replay protection lasts the TTL (≥10 min); no rate limit on
    `/api/actions/*`; no HTTP route-mount test; migrations `0005`–`0008` before
    deploy; `verifyAlgoPayment` finality is indexer-only; confirm `VITE_TEST_GLOBE`
    reads `false` before any deploy.
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/` may
  point at mainnet; no funds/ASA/transfer code to mainnet without `/mainnet-gate`
  **and** `algo-auditor`. **Do not reintroduce mock/demo data into plot surfaces.**
