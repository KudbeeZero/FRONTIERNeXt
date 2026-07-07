# 2026-07-07 — Fix: mobile white-screen-of-death (production)

Owner reported: production build works on desktop, throws a complete blank white page
specifically on mobile browsers. This session's earlier health-check (dev-session-ws-gate
fix, PR #212) had already found no server/CDN-side outage — this is the client-side crash
that report was actually describing.

## Root cause

`client/src/lib/walletManager.ts` used to construct `new WalletManager({...})` (from
`@txnlab/use-wallet`) **at module scope** — i.e. the instant the module was imported,
before React ever mounted. `App.tsx` imported it at the top of the file, so this ran
during the very first tick of script evaluation.

Each registered wallet connector's constructor touches browser APIs immediately: Pera's
WalletConnect setup and Lute's extension-detection both reach for `window`/`indexedDB`.
This is already documented (by a prior session) in test comments —
`client/tests/route-loop.spec.tsx` explicitly mocks `walletManager` because "the wallet SDK
+ walletManager touch `window`/IndexedDB at import." Some mobile browsers/webviews
restrict or throw on these APIs (private-mode Safari has historically thrown on IndexedDB
access; some in-app/OEM Android webviews restrict it outright). When that throw happens at
**module-evaluation time**, `createRoot(...).render(<App/>)` never even runs — no React
error boundary can catch it, because React hasn't started. The result: a permanently blank
white screen, with the only trace being a `console.error` invisible on a phone with no
DevTools attached. Desktop browsers are far more uniform/up-to-date, so this reproduced as
"desktop fine, mobile broken" exactly as reported.

There was also no root-level `<ErrorBoundary>` at all — `main.tsx` rendered `<App/>`
directly. An existing `ErrorBoundary` component was only used deep inside `GameLayout`
(one subtree), and even there its fallback showed a generic "Something went wrong" with no
detail — useless for diagnosing anything on a device without a console.

## The fix

1. **`walletManager.ts`** — `new WalletManager(...)` is now behind an exported factory,
   `createWalletManager()`, not constructed at module scope.
2. **`App.tsx`** — calls `createWalletManager()` inside a `useMemo(() => ..., [])` in the
   `App` component body. This moves construction into React's render phase — a failure
   there is now a normal render error, catchable by an ancestor `<ErrorBoundary>`, instead
   of an unrecoverable module-load crash.
3. **`main.tsx`** — wraps the root render in `<ErrorBoundary>` for the first time. Any
   render-phase crash anywhere in the tree now shows a fallback instead of unmounting to
   blank.
4. **`ErrorBoundary.tsx`** — `getDerivedStateFromError` now captures `error.message` (with
   a safe `"Unknown error"` fallback for non-`Error` throws) and the default fallback UI
   displays it directly on screen, addressing "we can't see the error on a phone" — deliberately just the message, not a full stack, to stay readable and not leak internals to a
   real player.
5. **`client/index.html`** — added a small, defense-in-depth diagnostic script as the very
   first thing in `<head>` (before any other script), written in deliberately conservative
   ES5-style JS (no arrow functions/template literals/`let`/`const`) since its whole job is
   to survive on an engine broken enough to blank the page. It listens for `error`,
   `unhandledrejection`, and resource-load failures, and — only if `#root` is *still empty*
   ~6 seconds after load (never interrupting a game that's actually running) — renders a
   plain-DOM overlay listing what was captured, plus a Reload button. This is the layer
   below the React `ErrorBoundary`: it catches what a boundary structurally cannot (a throw
   before React mounts at all, or a resource that never loads).
6. **`vite.config.ts`** — added an explicit `build.target: "es2020"` as a documented,
   deliberate compatibility floor (the existing `vite-plugin-node-polyfills` config already
   covers `buffer`/`crypto`/`stream`/`events`/`util`/`process` — confirmed no polyfill gap
   there).

## Tests

- `client/tests/errorBoundary.spec.tsx` (new) — 6 cases: `getDerivedStateFromError` captures
  a real message and falls back to "Unknown error" for a non-`Error` throw; the default
  fallback renders children normally, shows the caught message, handles a null message
  defensively, and the custom-`fallback` prop still overrides it. (`renderToStaticMarkup`
  doesn't invoke error-boundary catch lifecycles for a throwing child — that's client-only —
  so these exercise the class's static/render methods directly rather than a full throw.)
- Updated 3 existing test files' `@/lib/walletManager` mocks
  (`gamelayout-connected-shell.spec.tsx`, `gamelayout-entry.spec.tsx`, `route-loop.spec.tsx`)
  for the new `createWalletManager` export shape.

## Verified green

- `pnpm run check` (tsc) — clean
- `pnpm run test` (client) — 311 passed (was 305; +6 new)
- `pnpm run test:server` — 449 passed, 24 skipped (unchanged — no server files touched)
- `pnpm run build` — clean production build; spot-checked `dist/public/index.html` to
  confirm the diagnostic script survives the build unmangled

## Honest gaps

- **Not reproduced on an actual mobile device or a real mobile browser engine.** The
  root-cause diagnosis (wallet-connector construction touching `window`/`indexedDB` at
  module-load time) is strong — independently corroborated by a prior session's own test
  comments — but this fix has not been confirmed to eliminate a live repro on a phone,
  because no live repro was available to test against (only the owner's report of the
  symptom). What IS certain and tested: the failure mode changed from
  "silent, permanent, unrecoverable blank page" to "a visible error banner with a real
  message and a working Reload button" (or, as a last resort, the plain-DOM overlay) — this
  is true even if the specific root cause guessed above isn't the exact trigger on the
  owner's device.
- Did not implement a "read-only spectator mode" fallback (offered as an option in the
  owner's own troubleshooting notes) — that would mean the rest of `WalletContext.tsx`
  gracefully operating with zero wallet SDK, which is a materially larger, riskier change.
  Converting the crash from fatal-and-invisible to visible-and-recoverable was judged the
  correct, safely-scoped first step; full degraded-mode play is a reasonable follow-up if
  the owner still sees failures after this lands.
- Did not attempt code-splitting/dynamic-import of the ~3.8MB main JS chunk (also raised in
  the owner's notes) — real, but a separate, larger perf-focused refactor with its own risk
  profile; flagged as a follow-up, not attempted here to keep this fix minimal and auditable.
- Session/state hydration across an app backgrounding (e.g. switching to a wallet app to
  sign) was also raised — already handled by existing code
  (`walletStatus: "restoring"` + `WALLET_SESSION_HINT_KEY` in `WalletContext.tsx`, confirmed
  earlier this session), not a new gap.
