# Audit: PR #210 — fix(client): close residual wallet-popup vectors P1 + P3

## Verdict: CONCERNS

## PR / branch / commit
- PR #210, branch `claude/handoff-audit-f5w0qn`, head `4cabcecda17ce06381290eda0b97dd0d653e215d`
- Base: `main` @ `008b615289d461b64b8899a1854b936d527eb0b6`
- CI on head: "Typecheck & server tests" ✅ success, "Cloudflare Pages" ✅ success

## Method
Independent auditor subagent fetched the full PR diff + file list via GitHub MCP tools, read
`App.tsx` and `WalletContext.tsx` in full on the actual branch, traced every mutation/effect
touching the new module-level guard line-by-line, read all 3 new test files, and independently
re-ran `check`/`test`/`test:server` rather than trusting the PR body's numbers.

## Scope
✅ **Verified exactly.** 10 files changed, matching the claimed scope: `App.tsx`,
`WalletContext.tsx`, 3 existing test files with updated mocks (`gamelayout-entry.spec.tsx`,
`gamelayout-connected-shell.spec.tsx`, `route-loop.spec.tsx`), 3 new pure-function test files,
the session note, `docs/HANDOFF.md`. No server/schema/route file touched.

## Claims vs. evidence

| Claim | Verdict | Evidence |
|---|---|---|
| One shared `<WalletProvider>` wraps every route except `/university`/`/admin` | ✅ verified | `App.tsx:62` (single instance), `App.tsx:43-50` (university/admin in outer Switch, ahead of the shared-provider catch-all) |
| `shouldAutoAuthenticateForPath` derives `autoAuth` reactively from the path | ✅ verified | `WalletContext.tsx:244-246` (`pathname === "/game"`), wired via `useLocation()` at `App.tsx:32` |
| Module-level guard genuinely survives a remount (not trapped in a closure) | ✅ verified | `autoAuthedAddressesThisLoad` (`WalletContext.tsx:220`) declared outside `WalletProvider` (function starts line 313) |
| `markAutoAuthed` fires only on auth success | ✅ verified | `WalletContext.tsx:404`, inside the try block after `setIsAuthenticated(true)`; not called in the catch block |
| `clearAutoAuthedAddresses()` fires on explicit disconnect | ✅ verified | `WalletContext.tsx:551`, inside `disconnect()` |
| First legitimate auto-auth (e.g. `/` → `/game` first time) still fires | ✅ verified by trace | Effect at `WalletContext.tsx:436-450`: `authAttemptedFor.current` is null and `hasAutoAuthed()` is false the first time this load, so `authenticate()` still fires exactly once |
| University/admin routing unchanged (regression guard) | ✅ verified | `route-loop.spec.tsx:127-130` renders the real `App` via SSR and confirms both resolve to non-404 output |
| P3: purge-gate wired into the pre-connect purge only, post-failure purge unchanged | ✅ verified | `shouldPurgeBeforeConnect` used at `WalletContext.tsx:496`; the post-failure catch-block purge at `WalletContext.tsx:515` is unconditional, unchanged |
| New tests exercise the real exported functions, not mocked-away logic | ✅ verified | All 3 new spec files import directly from `@/contexts/WalletContext` |
| Quantitative claims (tsc clean, client 297, server 446/24 skipped) | ✅ verified | Independently reproduced exactly |
| Honest-gap framing (device-unverified wallet-connect flow) is accurate, not over-claiming | ✅ verified | PR body's "real-browser verification" language correctly scoped to "zero hook/context crash errors," explicitly states the dedup flow itself is unverified |

## ⚠️ New finding (not disclosed in the PR)

**Module-level auto-auth guard can permanently suppress a legitimate re-auth after a mid-session
wallet disconnect/reconnect that doesn't go through the app's own `disconnect()` button.**

- The "Reset auth state on disconnect" effect (`WalletContext.tsx:453-459`) fires whenever
  `activeAddress` becomes falsy for **any** reason — not just an explicit user disconnect — and
  resets `authAttemptedFor.current = null` + `isAuthenticated = false`, but does **not** call
  `clearAutoAuthedAddresses()` (only the explicit `disconnect()` at line 551 does that).
- If the underlying wallet SDK ever drops and later restores the **same** `activeAddress`
  within one page load without the user clicking the app's "Disconnect" button (e.g. the user
  revokes/reconnects site access from inside the Pera app, a WalletConnect session hiccups and
  self-resumes), the auto-auth effect (`WalletContext.tsx:436-450`) sees
  `authAttemptedFor.current === null` (reset) but `hasAutoAuthed(activeAddress) === true` (never
  cleared) and will skip calling `authenticate()` — **permanently, until the user manually
  clicks Disconnect.**
- **Impact:** `authVersion` never bumps, so `GameLayout.tsx`'s `useGameSocket(wallet.authVersion,
  …)` never reconnects with a fresh session token — the player is left silently unauthenticated
  to the server with no visible re-auth affordance (no manual retry UI exists outside
  `WalletContext.tsx` itself).
- **Why this is new:** pre-PR, this same reconnect would have correctly re-triggered
  `authenticate()` — no module-level gate existed to block it. The defense-in-depth mechanism
  correctly closes the P1 remount-storm vector, but opens this narrower, different
  auth-staleness regression not covered by the PR's disclosed honest gap (which is scoped only
  to P3's SDK-timing race).
- **Verdict on this finding:** PLAUSIBLE — logically unambiguous from the code as written; full
  confirmation would require live wallet SDK behavior (does `@txnlab/use-wallet-react` ever
  null-then-restore the same `activeAddress` without the app's `disconnect()` running?), which
  matches the PR's own acknowledged sandbox limits.

## Scope creep
None found.

## Untested assertions
None beyond the finding above — the PR's own hedged claims all check out as accurately scoped.

## Security
No funds/ASA/mainnet code touched (client-side wallet UX only). The new finding is an
availability/staleness concern (player silently loses live game-socket auth), not a funds or
auth-bypass issue — the player is *under*-authenticated, never over-privileged.

## What could NOT be verified
Real Pera/Lute/mobile-QR wallet connect/disconnect/reconnect behavior, and specifically whether
`@txnlab/use-wallet-react` can transiently null-and-restore the same `activeAddress` mid-session
outside a full page load — exactly the premise of the new finding, requiring live SDK behavior
this sandbox cannot exercise.

## Recommendation
Not a reintroduction of the original P1 popup storm, and every stated test/count checks out —
but the module-level guard should be adjusted so a mid-session address drop (not just explicit
disconnect) also clears that address's auto-auth memory, closing the silent-staleness gap before
merge, or the gap should be explicitly accepted as a known risk with a follow-up unit tracked.
