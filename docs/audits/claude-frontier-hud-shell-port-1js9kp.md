# Audit — PR #34 `feat(hud): port v11 HUD shell (dock + drawer + glass panels)`

- **Verdict:** **PASS with notes** (retrospective). The merged code is sound and
  in-scope; the auditor's standalone verdict was **CONCERNS**, but its one
  substantive concern (tsc "check 0" not reproducible) is **resolved by CI
  evidence the auditor could not access** — see §Tests. Two minor accuracy/
  over-claim notes remain. **Already merged before this audit ran** — see
  §Process deviation.
- **PR / branch:** #34 `claude/frontier-hud-shell-port-1js9kp`
- **Head SHA:** `d7c5039` · **Feature commit:** `5959ada` · **Base:** `5222678`
- **Merge commit:** `e1eee78` (already on `main`)
- **Audit date:** 2026-06-15 · **Auditor:** independent subagent (refute-not-confirm)
  + start-of-chat `/handoff-audit`.

---

## Process deviation (recorded honestly, not softened)

PR #34 was **merged at 2026-06-15 15:01:29 UTC** (merged by `KudbeeZero`, merge
commit `e1eee78`) — **before** this formal `/handoff-audit` completed (this chat
started 15:02:04 UTC, ~35s after the merge). The baton still showed
`AWAITING_AUDIT`. This **bypassed the invariant "nothing lands on `main`
unreviewed."** The merge gate is therefore moot; this report is a **retrospective
verification** of the merged code against its claims, the same posture as the #30
and #32 retro-audits. It closes the gap — and, unlike #32, finds **no undisclosed
payload**: the merged diff matches what was claimed.

---

## What was delivered

A HUD-scoped presentational layer ported from the v11 prototype, wired into
`GameLayout` around the live globe — new primitives under
`artifacts/frontier-al/client/src/components/game/hud/`: `hud.css`, `GlassPanel`,
`CornerBracket`, `Dock`, `Drawer`, `HudShell`. `HudShell` stands in for
`BottomNav` behind the same `{activeTab,onTabChange,battleCount}` API, preserving
the `bottom-nav` / `nav-tab-*` testids. Wire-in is a one-line `<BottomNav>` →
`<HudShell>` swap in `GameLayout.tsx` plus a stylesheet import in `main.tsx`.
+6 SSR specs in `hud-shell.spec.tsx`.

---

## Claims vs. evidence

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Theme not re-skinned; all rules under `.hud-root`; `index.css` unchanged; `--hud-` props stay in `hud/` | ⚠️ partial | `index.css` **unchanged** (empty diff); `--hud-` props do **not** leak (`git grep --hud-` outside `hud/` is empty). BUT not every rule is literally a `.hud-root` descendant: `hud.css:8` is an app-wide Google-Fonts `@import`, and `.hud-glass`/`.hud-cnr`/`.hud-dock`/`.hud-drawer` (hud.css:44,74,91,126) are top-level **`hud-`-prefixed** global selectors. Collision risk ~nil due to prefixing, but the wording "every rule scoped under `.hud-root`" is **overstated**. |
| 2 | Drop-in for `BottomNav`; emits `bottom-nav` + `nav-tab-*`; connected-shell spec green | ✅ verified | `GameLayout.tsx` swaps `<BottomNav…>` → `<HudShell activeTab onTabChange battleCount>`; `Dock.tsx:79` emits `data-testid="bottom-nav"`, `nav-tab-*` at `Dock.tsx:98` + `HudShell.tsx:90`; `gamelayout-connected-shell.spec.tsx:139/149/156` asserts `bottom-nav` and passes. |
| 3 | No combat/FX/drag; no canvas/`AudioContext`/global pointer listeners; only refs + 1 `ResizeObserver` | ✅ verified | Grep of `hud/` for canvas/AudioContext/addEventListener/window./document./pointer → only CSS `pointer-events:none` + doc comments. One `ResizeObserver` (`Dock.tsx:56`); `typeof window !== "undefined"` (`Dock.tsx:22`) is an SSR guard, not a listener. No `<canvas>`, no audio, no global handlers. |
| 4 | Diff touches only `hud/**`, `GameLayout`, `main.tsx`, the test (+docs); no server/globe/route/ASA/secret | ✅ verified | Non-doc/non-hud source files in diff: exactly `GameLayout.tsx`, `main.tsx`, `hud-shell.spec.tsx`. `git diff` of `server/**` and `globe/**` is empty. `main.tsx` adds one CSS import. |
| 5 | `--hud-dock-h:64px`; dock `.hud-mobile-only` (hidden ≥768px); desktop rails unchanged | ✅ verified | `hud.css:27` `--hud-dock-h: 64px`; `HudShell.tsx:79` root is `hud-root hud-mobile-only`; media query ≥768px hides dock/handle/drawer (`hud.css:142-147`). No desktop-rail files touched. |
| 6 | Suites green: `check` 0 · `test:server` 244/244 · `test` 55/55 · `build` 0 | ⚠️ partial→✅ via CI | `test:server` **244/244**, `test` **55/55**, `build` **exit 0** — all reproduced locally. `check` (tsc) **fails locally (598 errors)** — but this is a **sandbox dependency-resolution artifact**, not PR-authored (see §Tests). **CI "Typecheck & server tests" = success on head `d7c5039`** (verified via GitHub API this chat) → the tsc-green claim is **CI-backed**. |
| 7 | Honesty: SSR-only; indicator/handle/drawer transitions/on-screen NOT runtime-verified | ✅ verified | `hud-shell.spec.tsx:1-12` + Dock/Drawer doc comments explicitly state effect-driven behavior is not exercised and is a documented follow-up. No jsdom/DOM harness. Honest. |

---

## Tests (actual)

| Suite | Local (this sandbox) | CI on head `d7c5039` |
|-------|----------------------|----------------------|
| `check` (tsc) | ❌ 598 errors, exit 1 (base `5222678` also fails: 255) | ✅ **success** (GitHub: "Typecheck & server tests") |
| `test:server` (vitest) | ✅ 244/244, 30 files, exit 0 | ✅ (same CI job) |
| `test` (client, vitest) | ✅ 55/55, 9 files, exit 0 | ✅ |
| `build` | ✅ exit 0 | — (Cloudflare Pages preview ran separately) |

**The tsc caveat (resolved).** The local `tsc` failure is environmental, not a
defect from PR #34:
- Errors are dominated by two **global** breakages affecting the whole client:
  (a) a lucide-react / `@types/react@18.3.28` `bigint`-in-`ReactNode` mismatch
  (`ui/sheet.tsx`, `ui/toast.tsx`, `pages/admin.tsx`), and (b) react-three-fiber
  JSX intrinsics (`ambientLight`, …) not registered — these even surface bogus
  errors on `Dock.tsx:104`, which contains no `<ambientLight>`.
- **The base commit `5222678` already fails tsc (255 errors)** — the suite was
  red in this environment *before* the PR, so "check 0" was never reproducible
  here regardless of #34.
- **CI runs the identical `pnpm --filter @workspace/frontier-al run check`** and
  reports **success on `d7c5039`** (the actual head). CI's dependency tree
  resolves where this sandbox's does not. CI is the protocol's definition of
  "green," and CI is green on head. The auditor subagent could not see this (no
  `gh`/network); this chat confirmed it via the GitHub API.

---

## Scope creep

**None.** The source diff is tightly confined (claim 4 holds in full). The only
extra files are docs (`docs/HANDOFF.md` baton + two audit notes). Unlike #32, no
undisclosed feature and no stray agent artifacts rode along.

---

## Untested assertions

- All **runtime/visual** behavior — sliding indicator, file-cabinet flip,
  collapse handle, drawer open/close, reduced-motion gating, mobile bottom-sheet,
  on-device appearance — is **NOT** verified. Tests are SSR
  (`renderToStaticMarkup`) markup/testid assertions only. **The PR discloses this
  honestly** (claim 7); recorded as an open risk, not a false claim.

---

## Security

**Surface ~nil, confirmed.** Presentational component: no funds/auth/ASA/route/
mutation/secret code touched; no network, no storage, no listeners. The one
external side effect is the **Google Fonts `@import`** in `hud.css` (a third-party
font-CDN request) — cosmetic, low-risk, but a **new external dependency**; in
offline/CSP environments it falls back to `system-ui`/monospace.

---

## What I could NOT verify

- **All runtime/visual HUD behavior** (no DOM/browser harness) — SSR only.
- **`check`/tsc reproduced locally** — fails on both base and head in this
  sandbox; "green" rests on **CI**, which is confirmed success on head.

---

## Gate outcome

Verdict **PASS with notes** (retrospective; PR already merged, so no merge action
to take). The merged code is in-scope, secure, and test-backed where it claims to
be; CI is green on head. Carry forward:

1. **Process:** the merge-before-audit deviation must not recur — the new
   serial-PR working agreement (finish → PR → audit → merge → next) and the
   recreated orchestration ledger (REC-004) exist to prevent exactly this.
2. **Accuracy note (claim 1):** future baton/PR wording should say "`hud-`-
   prefixed, HUD-scoped" rather than "every rule under `.hud-root`."
3. **Open risk:** HUD shell remains runtime/visually unverified (SSR only) +
   Google-Fonts `@import` external dependency.
