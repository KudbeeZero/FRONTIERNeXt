# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## ⚖️ Working agreement — NEW, LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- One agent takes a unit **end-to-end** and opens the PR; that PR goes through audit.
- The next unit **does not start** until the current PR's audit PASSes **and** it is
  merged/closed.
- ❌ **Retired:** the old "push straight to `main` / merge with no PR" style (early
  GrowPod work). No more multiple PRs open at once — too confusing.

**Orchestration (per the user, this session):**
- `AGENT_ORCHESTRATION_LEDGER.md` (**REC-004**) is **live and a PROTECTED surface** —
  treat it as authoritative.
- The **pre-work checklist is mandatory**, and you must **claim the surface(s) you
  will touch in the ledger BEFORE starting** work.
- Hand work off using the **5-field Work Order** format.
- ⚠️ **HONEST FLAG:** I could **not locate `AGENT_ORCHESTRATION_LEDGER.md`** in this
  branch, on `origin/main`, or in any git ref this session (no `REC-004` / "Work
  Order" references are tracked). Next agent: **confirm where the ledger lives /
  restore it** before relying on it — do not assume its contents.

## Current baton
- **Branch:** `claude/frontier-hud-shell-port-1js9kp` (pushed).
- **PR:** [#34](https://github.com/KudbeeZero/FRONTIERNeXt/pull/34) — into `main`
  (ready for review, not draft). **The active item under audit.**
- **Audit status:** `AWAITING_AUDIT`
- **➡️ NEXT CHAT STARTS HERE:** run **`/handoff-audit` on PR #34** and gate it
  (PASS → merge + start the next unit; CONCERNS → ask; FAIL → don't merge). Per the
  working agreement above, **do not start `feat/hud-desktop-nav` until #34 is
  audited and merged/closed.**
- **Start-of-chat gate (done this chat):** PR [#33](https://github.com/KudbeeZero/FRONTIERNeXt/pull/33)
  (`feat/plot-attack-ux-cleanup`) independently audited **PASS** and **merged** to
  `main` (squash `5222678`) — see `docs/audits/feat-plot-attack-ux-cleanup.md`. The
  prior PR [#32](https://github.com/KudbeeZero/FRONTIERNeXt/pull/32) retro-**FAIL**
  was re-confirmed (`docs/audits/feat-surface-armory-battle-nav.md`); #33 remediates
  it. `main` is clean (no `FloatingPlotWidget` / `AttackModal` / `right-reports/`).
- **Local gate (this chat, branch HEAD, on Linux):** `check` **0**, `test:server`
  **244/244**, `test` (client) **55/55**, `build` **0**. ✅ Reproduced — not a
  Windows host this time.

## What this chat did (for the auditor)
**Unit: port the v11 HUD prototype's SHELL around the live 3D globe.** New
presentational primitives under `client/src/components/game/hud/` (all selectors
`.hud-root`-scoped, `hud-`-prefixed → the app's cyan/Rajdhani theme is untouched):
- `hud.css` — v11 mint/void tokens + Chakra Petch / JetBrains Mono fonts; dock,
  sliding indicator, drawer + track, glass panel, corner brackets, reduced-motion.
- `GlassPanel` + `CornerBracket` — frosted v11 widget surface (grip, sheen title, tags).
- `Dock` — bottom dock, locally-measured sliding indicator (refs + `ResizeObserver`,
  **no global pointer handlers**), badge, click pulse, file-cabinet collapse handle.
- `Drawer` — slide-up drawer (full-width bottom sheet on mobile) for overflow tabs.
- `HudShell` — composes Dock + Drawer behind the **exact `BottomNav` API**.
- **Wire-in:** one-line `<BottomNav>` → `<HudShell>` swap in `GameLayout.tsx`
  (+ stylesheet import in `main.tsx`). Preserves `bottom-nav` / `nav-tab-*` testids.
- **Decisions:** HUD-scoped v11 tokens (not a global re-skin); primitives **+** wired
  into GameLayout. Dock is **mobile-only** (mirrors `BottomNav`'s `md:hidden`) and
  pinned to **64px** to match existing `bottom-16`/`pb-16` offsets → no desktop/layout
  regression.
- **NOT ported (scope guardrails):** canvas/combat/FX, sound engine, combo/EMP/
  artillery, auto-combat/ticker, and the prototype's global drag/resize/snap. Globe,
  all GameLayout state, and transaction logic untouched.
- **Test:** +6 SSR specs (`client/tests/hud-shell.spec.tsx`); connected-shell
  `bottom-nav` contract still green.

## Audit checklist (for the next /handoff-audit)
| Claim | How to verify |
|---|---|
| Theme not globally re-skinned | Every HUD rule is under `.hud-root` in `hud/hud.css`; `index.css` cyan tokens unchanged; `git grep -n "\-\-hud-" client/src` stays inside `hud/` |
| Drop-in for BottomNav | `GameLayout.tsx` renders `<HudShell …>` with `{activeTab,onTabChange,battleCount}`; `HudShell` emits `data-testid="bottom-nav"` + `nav-tab-*`; connected-shell spec green |
| No combat/FX/drag ported | `hud/` has no `<canvas>`, no `AudioContext`, no `addEventListener('pointer…')` on `window`/`document`; only local refs + one `ResizeObserver` in `Dock.tsx` |
| Globe / tx logic untouched | diff touches only `hud/**`, `GameLayout.tsx` (2 lines), `main.tsx` (1 line), `tests/hud-shell.spec.tsx`; no `server/`, `globe/`, mutation, route, ASA, secret changes |
| No layout regression | dock `--hud-dock-h: 64px` (= old `h-16`); dock is `.hud-mobile-only` (hidden ≥768px); desktop rails unchanged |
| Suites green | `check` 0 · `test:server` 244/244 · `test` 55/55 · `build` 0 (CI must confirm on the head commit) |
| Honesty: not runtime-verified | tests are SSR (`renderToStaticMarkup`) → markup/testids only; sliding indicator, collapse handle, drawer transitions, and on-screen look are **NOT** booted/verified |

## NEXT chat
- **Recommended next unit:** `feat/hud-desktop-nav` — adopt the HUD `Dock` on
  **desktop** (replace the right-rail tab nav), reconciling the dock-vs-rail nav
  redundancy. Needs care: desktop rails are functional `absolute … bottom-0` panels
  — add bottom padding / reflow so nothing is occluded.
- **Also queued (one unit each):**
  - Port the v11 **glass info panels** (Tactical / Player) onto real data surfaces
    using the new `GlassPanel` (e.g. re-skin `SelectedPlotPanel`). **Do NOT** add the
    prototype's mock stats — bind real props only (the #32 FAIL lesson).
  - **Runtime/visual verification** pass for the HUD shell (needs a browser harness).
  - (Carried) `feat/capsule-nav-drawers`; **step 3** duplicate plot feed (needs the
    running app); `feat/rate-limit-actions`; `chore/registerRoutes-testable`; extend
    idempotency to `/api/sub-parcels/:id/build`; algod-first finality in
    `verifyAlgoPayment` (**funds → `algo-auditor` + `/security-pass`**).
- **Open risks:**
  - ⚠️ HUD shell is **NOT runtime/visually booted** — SSR tests only. CI confirms
    the suites; on-screen behavior/appearance is unverified.
  - ⚠️ `hud.css` pulls fonts via a Google Fonts `@import`; offline/CSP environments
    fall back to `system-ui`/monospace (acceptable, but not the v11 typeface).
  - ⚠️ Desktop nav now has both the right-rail tabs and (hidden) HUD dock — resolve
    in `feat/hud-desktop-nav`.
  - (Carried) replay protection lasts the TTL; no rate limit on `/api/actions/*`; no
    HTTP route-mount test; migrations `0005`–`0008` before deploy; `verifyAlgoPayment`
    finality is indexer-only; confirm `VITE_TEST_GLOBE` reads `false` before deploy.
- **Off-limits:** do not touch the 3D globe (`components/game/globe/**`) or combat/
  canvas code; no funds/ASA/transfer code to mainnet without `/mainnet-gate` **and**
  `algo-auditor`; do not merge `wip/atomic-purchase`; nothing in `ops/kestra/` may
  point at mainnet. **Do not reintroduce mock/demo data into plot/HUD surfaces.**
