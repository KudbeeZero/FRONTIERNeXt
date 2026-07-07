# Audit: PR #213 — fix(client): mobile white-screen-of-death — wallet-manager crash + no root error boundary

## Verdict: **PASS**

## PR / branch / commit
- PR #213, branch `claude/handoff-audit-f5w0qn`, head `bd70b4ad608cfc5eccb62eaf79739c3c1758d3cb`
  (a docs-only baton commit on top of the actual fix commit `9ea4f24fdb21020957569afd4a7337ed1c4f8a58`
  — the branch gained exactly one extra commit since the PR was opened, as anticipated).
- Base: `main` @ `12c92d618ae608dd1f1c228ec1d613738087d28c` — confirmed this is `origin/main`'s
  actual tip and matches the PR API's stated base sha exactly.
- PR is currently **open, marked draft**, `mergeable_state: clean`. Not yet merged.
- CI on head commit `bd70b4a`: both checks **success** — "Typecheck & server tests"
  (run `28859077691`, job `85592845160`) and "Cloudflare Pages" (`85593029162`). Both
  `completed`/`success`, and both timestamped against this exact head sha (10:22–10:23 UTC,
  matching the commit's own timestamp) — a live run, not stale or `[skip ci]`.

## Method
Pulled PR metadata, commit list, and check-runs live via the GitHub API rather than trusting
the PR body. Diffed the full range `git diff 12c92d6..bd70b4a` (12 files, +402/-34, matches the
PR API's `additions`/`deletions`/`changed_files` exactly). Read every changed source file's diff
in full (`walletManager.ts`, `App.tsx`, `main.tsx`, `ErrorBoundary.tsx`, `vite.config.ts`,
`index.html`, the 3 updated test-mock files, and the new `errorBoundary.spec.tsx`). Grepped the
whole client tree for pre-existing `ErrorBoundary` usages to confirm the root-level one is
genuinely new. Built a clean `git worktree` at the exact head commit (`bd70b4a`), ran
`pnpm install --frozen-lockfile`, then independently reproduced `check`, `test`, `test:server`,
and `build` — including inspecting the actual built `dist/public/index.html` output, not just
the source — rather than trusting the PR's reported numbers.

## Scope
Full PR range (`12c92d6..bd70b4a`, 2 commits):
- `9ea4f24` (the unit): `client/index.html` (+77), `client/src/App.tsx` (+8/-2),
  `client/src/components/ErrorBoundary.tsx` (+25/-2), `client/src/lib/walletManager.ts`
  (+30/-13), `client/src/main.tsx` (+10/-1), `client/tests/errorBoundary.spec.tsx` (+73 new),
  `client/tests/gamelayout-connected-shell.spec.tsx` (+1/-1), `client/tests/gamelayout-entry.spec.tsx`
  (+2/-2), `client/tests/route-loop.spec.tsx` (+8/-5), a new session note
  (`session-notes/2026-07-07-mobile-white-screen-fix.md`, +106), `vite.config.ts` (+5),
  `docs/HANDOFF.md` (baton update, part of this commit's diff).
- `bd70b4a` (docs-only): `docs/HANDOFF.md` (+8/-1) — baton note that CI is green and the
  audit is deferred to the next session. No code.

This matches the PR body's stated scope exactly, file for file. `git diff --name-only
12c92d6..bd70b4a` grepped for `server/|kestra|GlobeBattleSequence|battle-sequence|/chain/|redis`
returns **no matches** — no server files, no funds/ASA/chain files, no `ops/kestra/*`, no
hard-gated cinematics files touched anywhere in the range.

## Claims vs. evidence

| Claim | Verdict | Evidence |
|---|---|---|
| `walletManager.ts` no longer constructs `new WalletManager(...)` at module scope; behind an exported `createWalletManager()` factory | ✅ verified | Diff: the top-level `export const walletManager = new WalletManager({...})` is replaced by `export function createWalletManager(): WalletManager { return new WalletManager({...}); }` — construction only happens when the function is called, not at import |
| `App.tsx` calls `createWalletManager()` inside `useMemo(() => ..., [])` in the `App` function body | ✅ verified | `App.tsx:33`: `const walletManager = useMemo(() => createWalletManager(), []);` — inside the `App` function, called during render, not at module scope |
| `main.tsx` wraps `<App />` in `<ErrorBoundary>` at the root, and this is genuinely new | ✅ verified | Diff shows `createRoot(...).render(<App />)` → `createRoot(...).render(<ErrorBoundary><App /></ErrorBoundary>)`. Grepped all of `client/src` for pre-existing `ErrorBoundary` usage outside this PR's diff: the only prior usage was `GameLayout.tsx:1435-1456`, wrapping one interior subtree — not the root. No root-level boundary existed before this PR |
| `ErrorBoundary.tsx`'s `getDerivedStateFromError` now captures `error.message` (fallback `"Unknown error"` for non-`Error` throw), fallback UI renders it | ✅ verified | `static getDerivedStateFromError(error: Error) { return { hasError: true, message: error?.message \|\| "Unknown error" }; }`; render method adds a new `<div>` block rendering `this.state.message` when non-null. New test file exercises both branches directly (`getDerivedStateFromError(new Error("wallet connector unavailable"))` → message captured; `getDerivedStateFromError("just a string" as unknown as Error)` → `"Unknown error"`), and asserts the rendered HTML contains the message |
| `client/index.html` has a new inline `<script>` as the first thing in `<head>`, before the viewport meta, listening for `error`/`unhandledrejection`, only rendering an overlay if `#root` has no child after ~6s | ✅ verified | Diff shows the script inserted immediately after `<meta charset="UTF-8" />` and immediately before `<meta name="viewport" ...>` — first thing in `<head>` besides charset. Script registers a capturing `error` listener (handles both script errors and resource-load failures via `e.target.src`/`.href`) and an `unhandledrejection` listener, then `window.setTimeout(..., 6000)` checks `root.firstChild`; if truthy, returns immediately and does nothing. Read the logic directly (not from the PR description) — confirmed it is inert on a normally-loading app: the guard is a single `if (root && root.firstChild) return;` at the very top of the timeout callback |
| `vite.config.ts` has `build.target: "es2020"` added | ✅ verified | Diff adds `target: "es2020",` inside the `build:` block, with an explanatory comment |
| 3 test files updated to `createWalletManager: () => ({})` instead of `walletManager: {}` | ✅ verified | `gamelayout-connected-shell.spec.tsx`, `gamelayout-entry.spec.tsx`, `route-loop.spec.tsx` — all three `vi.mock("@/lib/walletManager", ...)` calls updated to export the factory shape matching the new real export name |
| `tsc` clean | ✅ verified | Reproduced in a clean worktree at `bd70b4a`: `pnpm --filter @workspace/frontier-al run check` — no output, exit clean |
| client `test` — 311 passed (was 305, +6 new) | ✅ verified | Reproduced exactly: "Test Files 54 passed (54)", "Tests 311 passed (311)". `errorBoundary.spec.tsx` contains exactly 6 `it(...)` blocks (2 in the `getDerivedStateFromError` describe, 4 in `render`), accounting for the +6 |
| `test:server` — 449 passed / 24 skipped, unchanged | ✅ verified | Reproduced exactly: "Test Files 55 passed \| 7 skipped (62)", "Tests 449 passed \| 24 skipped (473)" — identical to the PR #212 audit baseline, consistent with zero server files touched |
| `build` clean; diagnostic script survives in `dist/public/index.html` unmangled | ✅ verified | `pnpm --filter @workspace/frontier-al run build` completed (client 47.65s, server 341ms); `dist/public/index.html` contains the literal string `"FRONTIER failed to load"` and the `6000` timeout value, script still positioned before the viewport meta. Only pre-existing, unrelated warnings (chunk-size advice, PostCSS `from`-option notice, `lottie-web`'s `eval` notice) — none touch this PR's files |
| No server/funds/ASA/kestra/cinematics files touched | ✅ verified | `git diff --name-only 12c92d6..bd70b4a` is exactly the 12 files listed above (all under `client/`, `vite.config.ts`, `docs/`, `session-notes/`); targeted grep for guarded path patterns returns nothing |
| CI green on the PR's actual current head commit | ✅ verified | Both GitHub Actions checks (`Typecheck & server tests`, `Cloudflare Pages`) report `completed`/`success` against `bd70b4a` specifically, timestamped consistently with that commit |

## Scope creep
None. Every file in the 2-commit range is accounted for and matches the PR body's stated scope
precisely, including the trailing docs-only baton commit. No undisclosed changes to any server,
chain, or cinematics file.

## Judgment call: is the `useMemo` construction move behaviorally safe on the normal path?
Read `App.tsx` in full. `App` is a single top-level function component with no `key` prop and no
conditional-mount wrapper anywhere in its own body or in `main.tsx`'s render call — `main.tsx`
renders `<ErrorBoundary><App /></ErrorBoundary>` exactly once, unconditionally. `App` internally
uses `useLocation()` (from `wouter`) which re-renders `App` on navigation but does not remount it
— `walletManager = useMemo(() => createWalletManager(), [])` therefore constructs exactly once
for the component's mounted lifetime, and the same object reference is passed to
`<UseWalletProvider manager={walletManager}>` on every re-render, matching React's guarantee for
an empty dependency array under normal (non-`StrictMode`-double-invoke, non-memory-pressure-purge)
operation. This is consistent with — and actually fixes — a related issue flagged in the code's
own comments: the file also notes a *prior* audit finding (P1) that a per-route `WalletProvider`
(a different provider, `@/contexts/WalletContext`, not the SDK's `WalletManager`) used to remount
on navigation; this PR's diff does not touch that logic and the `WalletManager` itself sits above
that per-route provider, unaffected by it.

One caveat worth flagging as an **observation, not a blocker**: React's own documentation reserves
the right for a future release to purge `useMemo` caches under memory pressure and re-run the
factory, which would reconstruct `walletManager` mid-session with a new object identity. This is
not current React 18/19 behavior and does not affect this PR's correctness today, but if it were
to matter (a page that stays open for a very long session), the memoization is a performance
optimization rather than a semantic guarantee by React's own contract. Not a reason to withhold
approval — noting only for future awareness.

## Observation on the 6-second diagnostic-overlay delay
Read the script's logic directly rather than reasoning about it abstractly. The gate is a single
`if (root && root.firstChild) return;` check inside a `setTimeout(..., 6000)` callback — it only
ever *adds* a DOM node; it never blocks, delays, or otherwise interferes with the app's own
render path, so it cannot cause a false negative (failing to show when it should) beyond simply
not firing until 6s have elapsed, and it cannot break a successfully-loading app (the guard exits
immediately once `#root` has a child). The only way it could ever fire *falsely* — showing the
overlay over an app that did eventually load — is if the app takes **longer than 6 seconds** to
render its first DOM node into `#root`. The production build's main bundle is 3,815.56 kB
uncompressed / 1,064.18 kB gzipped (independently confirmed via this audit's own build run,
matching the PR's "~3.8MB" claim almost exactly). On a fast connection/device 6s is generous, but
on a genuinely slow mobile connection (e.g. throttled 3G, ~400-700kbps effective, or a
low-power/low-RAM Android device parsing/executing a >1MB gzipped JS payload) 6 seconds of
combined network + parse + first-render time is plausible to exceed, especially before any
code-splitting of that bundle happens (the PR itself defers code-splitting as a separate,
disclosed follow-up). **Flagging as an observation, not a blocker**: the overlay's own copy
("No error details were captured. Please reload...") is relatively low-harm even if it fires on a
slow-but-eventually-successful load — worst case a user reloads a page that would have finished
loading shortly after — but a slightly larger margin (e.g. 8-10s) or a mechanism that also cancels
if the app renders after the overlay appears would be more robust for genuinely slow connections.
The script does not currently un-render the overlay if `#root` gains a child after the 6s mark
(no `MutationObserver` or later re-check) — worth a future follow-up, not a defect in this fix.

## Untested assertions
- **Not reproduced on an actual mobile device or real mobile browser engine** — this is honestly
  disclosed in the PR body itself. The root-cause diagnosis (module-scope `WalletManager`
  construction touching `window`/`indexedDB` synchronously, corroborated by a prior session's own
  test comments in `route-loop.spec.tsx` predating this PR) is well-supported by static evidence,
  but this audit did not independently confirm the fix eliminates a live repro on a phone, since
  none was available to test against. What is independently confirmed and test-backed: the
  documented *mechanism* (module-scope → render-phase construction, root error boundary, message
  display) is real and behaves as claimed in unit tests and a full production build.
- The 6-second overlay delay's real-world adequacy against slow mobile network conditions (see
  observation above) was reasoned about from the built bundle size, not measured against an actual
  throttled-network load — no headless/Lighthouse-throttled run was performed as part of this
  audit.

## Security
- No server files, no auth/session-issuance code, no funds/ASA/chain code touched.
- The `ErrorBoundary` fallback intentionally displays only `error.message`, not a stack trace —
  confirmed by reading the render method; this avoids leaking internal file paths/line numbers to
  an end user, consistent with the PR's stated intent.
- The `index.html` diagnostic script only reads `error`/`unhandledrejection` event data already
  visible to any script on the page (nothing privileged) and only ever writes plain `textContent`
  (not `innerHTML`) into DOM nodes it creates itself — reviewed the script for injection risk;
  every dynamic string (`e.message`, `e.target.src`, `reason.message`) is assigned via
  `.textContent`, never concatenated into an `innerHTML` string, so there is no XSS vector even if
  an attacker could influence a thrown error's message text.
- No new capability, endpoint, or data flow is introduced; this is purely a client-side
  crash-visibility improvement.

## What could NOT be verified
- Live mobile-device repro of the original bug and confirmation the fix eliminates it (disclosed
  gap in the PR itself; not independently closed by this audit).
- Real-world adequacy of the 6-second overlay delay under actual throttled mobile network
  conditions — reasoned about from static bundle-size evidence only, not measured.

## Recommendation
**PASS.** All claimed file-level changes are verified byte-for-byte against the diff at the PR's
actual current head (`bd70b4a`, which is one docs-only commit ahead of the fix commit `9ea4f24` —
confirmed via the GitHub API rather than assumed). `tsc`, client tests (311, +6 exactly matching
the new file), server tests (449/24, byte-identical to the pre-PR baseline), and a full production
build were all independently reproduced in a clean worktree at the exact head commit, including
confirming the diagnostic script survives Vite's HTML processing unmangled in the actual
`dist/public/index.html` output. Scope is exactly as described — 12 files, all client-side/docs,
zero server/funds/ASA/kestra/cinematics files touched. The `useMemo`-based construction move is
behaviorally safe on the normal path (no remount vector found in `App.tsx`/`main.tsx`). CI is
green on the actual head commit via a live run, not stale. Two non-blocking observations are
raised for follow-up: the React `useMemo`-cache-purge caveat (theoretical, not current behavior)
and the 6-second overlay delay's margin against slow mobile connections given the ~3.8MB main
bundle (real but low-harm even if it occasionally fires early). Safe to merge.
