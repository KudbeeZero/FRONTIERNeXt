# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## ⚖️ Working agreement — LOCKED IN (every agent follows this)
**Serial PR flow — one unit, one PR, audited, then the next:**
**Finish → Open PR → Audit → Close/Merge → (only then) Next unit.**
- **ONE PR open at a time.** Never open a second PR while one is unaudited/open.
- One agent takes a unit **end-to-end** and opens the PR; that PR goes through audit.
- The next unit **does not start** until the current PR's audit PASSes **and** it is
  merged/closed.
- ❌ **Retired:** the old "push straight to `main` / merge with no PR" style.

**Orchestration (REC-004 — now LIVE):**
- ✅ `docs/AGENT_ORCHESTRATION_LEDGER.md` (**REC-004**) **now exists** and is a
  **PROTECTED surface** — it was recreated this chat (it had never been committed
  to any tracked ref). It is authoritative for: **Employee vs Sub-Agent rules**,
  the **mandatory 5-field Work Order format**, the **pre-work checklist**, the
  **Studio Agent Registry** (claim-before-you-touch), and the **protected-surface
  declaration**.
- The **pre-work checklist is mandatory**, and you must **claim the surface(s) you
  will touch in the ledger's Studio Agent Registry BEFORE starting** work.
- Hand work off using the **5-field Work Order** format (Objective · Surface(s) &
  Claim · Constraints · Acceptance · Verification & Handoff).

## Current baton
- **Branch:** `claude/pr34-audit-ledger-recovery-m3xpvm` (pushed).
- **PR:** **[OPEN — this chat's PR]** into `main` — recreate REC-004 ledger +
  write the retrospective audit of #34. **The active item under audit.**
- **Audit status:** `AWAITING_AUDIT`
- **➡️ NEXT CHAT STARTS HERE:** run **`/handoff-audit`** on this chat's PR and gate
  it (PASS → merge + start the next unit; CONCERNS → ask; FAIL → don't merge). Per
  the working agreement, **do not start `feat/hud-desktop-nav` until this PR is
  audited and merged/closed.**
- **Prev PR [#34](https://github.com/KudbeeZero/FRONTIERNeXt/pull/34)** (v11 HUD
  shell, `claude/frontier-hud-shell-port-1js9kp`): **MERGED** (merge `e1eee78`) and
  now **retrospectively audited → PASS with notes** — see
  `docs/audits/claude-frontier-hud-shell-port-1js9kp.md`.
  ⚠️ **Process deviation recorded:** #34 was **merged (15:01:29 UTC) before** the
  audit ran (~35s before this chat). The serial-PR agreement + REC-004 ledger exist
  to stop this recurring.

## What this chat did (for the auditor)
**Unit: retrospective audit of PR #34 + recover the REC-004 orchestration ledger.**
1. **`/handoff-audit` on #34** (already merged → retrospective). Spawned an
   independent auditor (refute-not-confirm): diff vs. every claim with `file:line`
   evidence, ran the suites. Wrote `docs/audits/claude-frontier-hud-shell-port-1js9kp.md`.
   - Verified: drop-in `BottomNav` contract (testids + connected-shell spec), no
     combat/FX/drag ported, scope confined to `hud/**` + `GameLayout` + `main.tsx`
     + test (+docs), mobile-only `64px` dock, honest SSR-only caveat.
   - `test:server` **244/244**, `test` (client) **55/55**, `build` **0** reproduced
     locally. `check` (tsc) fails **locally** (598 errors; base also fails 255 —
     pre-existing **sandbox** dep-resolution artifact, not PR-authored) → relies on
     **CI**, which is **green** ("Typecheck & server tests" success on head
     `d7c5039`, confirmed via GitHub API).
   - Notes: claim "every rule under `.hud-root`" is **overstated** (rules are
     `hud-`-prefixed global selectors + a global Google-Fonts `@import`); HUD remains
     runtime/visually unverified.
2. **Recreated `docs/AGENT_ORCHESTRATION_LEDGER.md` (REC-004)** — never committed
   before. Grounded in `SESSION_PROTOCOL` / `AGENT_CHAIN_OF_AUTHORITY` /
   `FACTORY_REGISTRY`. Contains Employee vs Sub-Agent rules, the 5-field Work Order
   format, the pre-work checklist, the Studio Agent Registry, and the
   protected-surface declaration. **Self-declared protected.**

## Audit checklist (for the next /handoff-audit)
| Claim | How to verify |
|---|---|
| REC-004 ledger exists + is protected | `docs/AGENT_ORCHESTRATION_LEDGER.md` present; header marks it `🔒 PROTECTED SURFACE`; §5 lists it as protected; contains "Employee vs Sub-Agent", "5-field Work Order", "Studio Agent Registry" |
| Ledger is docs-only, no code touched | diff is `docs/AGENT_ORCHESTRATION_LEDGER.md` + `docs/audits/claude-frontier-hud-shell-port-1js9kp.md` + `docs/HANDOFF.md` only — no `server/`, `client/`, `globe/`, route, ASA, secret changes |
| #34 audit is honest about the deviation | audit report's "Process deviation" section states #34 merged 15:01:29 UTC **before** audit; verdict is **PASS with notes** (retrospective) |
| #34 audit matches reality | claims table marks 2/3/4/5/7 ✅, 1 ⚠️ (overstated scoping), 6 ⚠️→✅ via CI; CI "Typecheck & server tests" success on `d7c5039` |
| Suites green | `test:server` 244/244 · `test` 55/55 · `build` 0; `check` via CI (local tsc is a known sandbox artifact, fails on base too) |

## NEXT chat
- **Recommended next unit (BLOCKED until this PR merges):** `feat/hud-desktop-nav`
  — adopt the HUD `Dock` on **desktop** (replace the right-rail tab nav),
  reconciling the dock-vs-rail redundancy. Desktop rails are functional
  `absolute … bottom-0` panels — add bottom padding / reflow so nothing is occluded.
  **Before starting:** run the pre-work checklist and **claim the desktop-nav /
  GameLayout surfaces in the Studio Agent Registry** (REC-004).
- **Also queued (one unit each):**
  - Port the v11 **glass info panels** (Tactical/Player) onto real data surfaces
    using `GlassPanel` (e.g. re-skin `SelectedPlotPanel`). **Bind real props only —
    no mock stats** (the #32 FAIL lesson).
  - **Runtime/visual verification** pass for the HUD shell (needs a browser harness).
  - (Carried) `feat/capsule-nav-drawers`; **step 3** duplicate plot feed (needs the
    running app); `feat/rate-limit-actions`; `chore/registerRoutes-testable`; extend
    idempotency to `/api/sub-parcels/:id/build`; algod-first finality in
    `verifyAlgoPayment` (**funds → `algo-auditor` + `/security-pass`**).
- **Open risks:**
  - ⚠️ HUD shell is **NOT runtime/visually booted** — SSR tests only.
  - ⚠️ `hud.css` pulls fonts via a Google Fonts `@import`; offline/CSP environments
    fall back to `system-ui`/monospace.
  - ⚠️ Desktop nav has both the right-rail tabs and (hidden) HUD dock — resolve in
    `feat/hud-desktop-nav`.
  - ⚠️ `check`/tsc fails in fresh sandboxes (global dep-resolution: lucide/`@types/react`
    `bigint` + r3f JSX intrinsics) on **base and head** — "green" rests on CI.
  - (Carried) replay protection lasts the TTL; no rate limit on `/api/actions/*`; no
    HTTP route-mount test; migrations `0005`–`0008` before deploy; `verifyAlgoPayment`
    finality is indexer-only; confirm `VITE_TEST_GLOBE` reads `false` before deploy.
- **Off-limits (now codified in REC-004 §5):** do not touch the 3D globe
  (`components/game/globe/**`) or combat/canvas code; no funds/ASA/transfer code to
  mainnet without `/mainnet-gate` **and** `algo-auditor`; do not merge
  `wip/atomic-purchase`; nothing in `ops/kestra/` may point at mainnet. **Do not
  reintroduce mock/demo data into plot/HUD surfaces.** Treat
  `docs/AGENT_ORCHESTRATION_LEDGER.md`, `docs/HANDOFF.md`, and `docs/audits/**` as
  protected (claim + audited change only).
