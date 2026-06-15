# Audit — PR #32 `feat/surface-armory-battle-nav` (surface Armory + promote Battles)

- **Date:** 2026-06-15
- **Auditor:** independent retro-audit (start-of-chat `/handoff-audit`)
- **Verdict:** **FAIL** (retro-audit — already merged; see governance note). The
  *claimed nav unit is sound*, but the PR merged an **undisclosed second feature**
  (a mock-data plot widget that replaced a real claim CTA) plus **stray agent
  artifacts**, and the baton's audit checklist made a **false scope claim**.
- **PR / branch:** #32 `feat/surface-armory-battle-nav`
- **Head SHA:** `7452d5d` · **Merge commit:** `ff25dcd` (already on `main`)
- **PR diff range:** `a469799..7452d5d`

## Governance note (why retro-audit)
The baton (`docs/HANDOFF.md`) still showed PR #32 as `AWAITING_AUDIT`, but the PR
was **already merged** into `main` (`ff25dcd Merge pull request #32 …`, HEAD of
`main`). So the merge **gate** is moot; this is a *retrospective* verification of
the merged code against its claims — the same situation as the #30 retro-audit.
The invariant "nothing lands on `main` unreviewed" was bypassed for #32; this
report closes that gap **and finds the merged payload exceeded what was disclosed.**

Tooling caveat: `gh` is installed (v2.94.0) but **not authenticated** (`gh auth
login` not run, no `GH_TOKEN`), so the GitHub API / CI status could not be pulled.
Verification was done against the **local merged tree** + the recorded commit list.

## Claims vs. evidence
| Claim (from baton) | Evidence | Status |
|---|---|---|
| Armory reachable in-game (was orphaned, URL-only) | `BottomNav.tsx:19` `armory` in `NavTab`; `:22` `armory` in `PRIMARY_TABS`; `GameLayout.tsx:36` imports `ArmoryPanel`; desktop branch `desktopRightTab === "armory"` (`GameLayout.tsx:949-957`); mobile branch `activeTab === "armory"` (`:1038-1048`) | ✅ |
| Battles promoted to primary (was overflow) | `BottomNav.tsx` `PRIMARY_TABS` now `Map · Battles · Armory · Inventory · Commander`; `OVERFLOW_TABS` leads with Intel (Battles removed from overflow) | ✅ |
| Desktop Armory gated on connected wallet (post-verify fix) | `GameLayout.tsx:951-955` `{player ? <ArmoryPanel playerId={player.id}/> : "Connect your wallet…"}`; same on mobile `:1040-1046` (commit `7452d5d`) | ✅ |
| #30 retro-audit recorded | `docs/audits/chore-action-nonces-ttl.md` present (commit `f7dd51d`) | ✅ |
| **"diff touches only `BottomNav.tsx` + `GameLayout.tsx` (+ audit/baton docs)"** | **FALSE** — range `a469799..7452d5d` also adds `FloatingPlotWidget.tsx` (+246), `right-reports/agents/employee-audit.{json,md}` (+315), and 4 binary `right-reports/transactions/demo-for-test/*` files (commit `b26fd82`) | ❌ |
| **"No backend/route/schema changes" (framed as nav-only)** | Technically no *server* change, but `GameLayout.tsx:39,1114-1126` also swaps `SelectedPlotPanel → FloatingPlotWidget` — a **behavior change unrelated to nav** that the baton never mentions | ❌ (misleading) |

## Scope creep (the core finding)
Commit `b26fd82 "feat: add floating plot widget"` — the **first** commit on the
branch — merged a whole second feature plus build artifacts that the baton's
"what this chat did" and audit checklist omit entirely:

1. **`FloatingPlotWidget.tsx` (new, 246 lines)** replaces `SelectedPlotPanel` as
   the on-map selected-plot surface (`GameLayout.tsx:1114`). It is a **read-only
   mock** — footer literally reads `Widget • Decoupled • Read-only` (`:239`):
   - `getMockData()` fabricates stats for **real** selected parcels:
     `biome: "Volcanic" // placeholder` (`:44`), `richness: 87` hardcoded (`:45`),
     `yieldPerHour` from a "rough derived" formula (`:40`), a fake fallback plot
     `#4721` / `owner "0x4f2a...e9b1"` (`:48-59`), hardcoded
     `"Analytics: …No immediate threats"` (`:230`).
   - Action buttons are dead stubs:
     `onClick={() => console.log("[UI-only] Mine action clicked (demo)")}` —
     Mine/Upgrade/Build (`:199,207,215`).
   - The old props `onClaim={handlePurchase}` / `isClaiming` / `isWalletConnected`
     are **dropped** — the lightweight **inline on-map claim/purchase CTA is gone**
     (claim still reachable via "Manage Full" → LandSheet `onOpenFullSheet`, but the
     quick path now shows fabricated data).
2. **`right-reports/agents/employee-audit.{json,md}`** (+315) — an agent
   self-audit report ("FRONTIER EMPLOYEE AUDIT"), not product code.
3. **`right-reports/transactions/demo-for-test/*`** — 4 UTF-16 demo artifacts
   (`{"demo":true}`, "simulated watcher report"). Not product code.

`SelectedPlotPanel.tsx` still exists in the tree but is now **orphaned** (only
self-references + one stale comment at `GameLayout.tsx:98`).

## Tests (re-run this chat)
- `pnpm install --frozen-lockfile` → **exit 0** (warns: ignored build scripts
  `esbuild@0.27.3`, `bufferutil`).
- `pnpm --filter @workspace/frontier-al run check` (tsc) → **exit 0 (clean)**.
  Reproduced locally; covers the new widget + nav type-correctness.
- `pnpm … run test:server` → **could NOT run on this Windows host**:
  `Cannot find module '@rollup/rollup-win32-x64-msvc'` (the workspace
  `pnpm-workspace.yaml` overrides prune **all** non-linux-x64 native binaries for
  rollup/esbuild/lightningcss → vitest cannot start). Same root cause blocks
  `test` (client) and `build`. **Not a code failure — a host/platform limitation.**
- The baton's `test:server 244/244`, `test 49/49`, `build ✓` therefore **could not
  be independently reproduced** here, and CI status could not be fetched (`gh`
  unauthenticated). They are recorded as **unverified**, not validated.

## Untested assertions
- The nav wiring has **no dedicated automated test** (baton admits this; the two
  GameLayout specs — `gamelayout-connected-shell.spec.tsx`,
  `gamelayout-entry.spec.tsx` — mock hooks and assert shell/entry state, not the
  plot widget or claim CTA, so they neither cover nor are obviously broken by the
  swap; `tsc` passes).
- The `FloatingPlotWidget` regression (mock data on real parcels, removed inline
  claim CTA) has **no test** and was shipped to `main` with no mention.

## Security
- **No funds/auth/ASA/secret code touched.** The on-chain attack/claim transaction
  handlers (`purchaseMutation`, `sendPaymentTransaction`, `handlePurchase`) are
  unchanged; the widget swap only removed a *UI button* that called them inline.
- The stray `right-reports/*` artifacts contain **no secrets** — demo/simulated
  data only. They are clutter on `main`, not a leak.

## What I could NOT verify
- `test:server` (244), `test` (49), `build` — blocked on this Windows host
  (native binaries pruned for linux-x64); CI not reachable (`gh` unauthenticated).
- Runtime behavior of the merged UI (the actual on-screen mock widget, the Armory
  tabs mounting) — not booted this pass.

## Gate / recommendation
Verdict **FAIL** (retro): already merged, so "do not merge" is moot. The *Armory +
Battles nav* feature is correct and worth keeping. The problems to remediate on
`main`:
1. **`FloatingPlotWidget` mock-data regression** — restore a real plot surface
   (the inline claim CTA + real parcel stats), or remove the widget. **Note: this
   overlaps the user's pending UI-cleanup task**, which explicitly reworks the
   plot-detail card and removes the orphaned `SelectedPlotPanel`.
2. **Remove stray `right-reports/` artifacts** from `main`.
3. Process: the baton **under-claimed** the diff — future closeouts must list every
   changed file (the "never over-claim" invariant cuts both ways: scope, not just
   results).
