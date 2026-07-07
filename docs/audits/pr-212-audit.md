# Audit: PR #212 — fix(client): dev/test sessions never opened the live game WebSocket

## Verdict: **PASS**

## PR / branch / commit
- PR #212, branch `claude/handoff-audit-f5w0qn`, head `62297bbfa7e548c124da72bbb274b6c6bf697c19`
- Base: `main` @ `0ced366a2cf22a5bfd21496588cf512a7c7b4c89` (confirmed this is `origin/main`'s
  actual current tip — the local `main` ref in this container is stale, 61 commits behind
  `origin/main`; using `origin/main`/`0ced366` as the true base per the PR's own base sha)
- PR is currently **open, marked draft**, `mergeable_state: clean`. Not yet merged.
- CI on head commit: both checks **success** — "Typecheck & server tests"
  (workflow run `28853604690`, job `85574625183`, workflow name `CI`, `.github/workflows/ci.yml`,
  triggered by `pull_request` on this exact head sha) and "Cloudflare Pages"
  (`85574720330`). Both `completed`/`success`. This is a live run against `62297bb`
  itself, not a stale or `[skip ci]` run.

## Method
Fetched the branch, diffed the full range `git diff 0ced366..62297bb` (5 files, +388/-15,
matches the PR API's `additions`/`deletions`/`changed_files` exactly: 388/15/5) and each of
the 3 commits individually (`d52b44b` baton rewrite, `a1393ce` new
`LOGIN_AUTH_FLOW_MAP.md`, `62297bb` the actual fix commit — 4 files, +143/-2). Read
`WalletContext.tsx` around the change in full (lines 660–730), confirmed the new
`devIdentityAuthVersion` helper's only caller, confirmed `authVersion`'s only other
mutation site (`authenticate()`, line ~406) is untouched by the diff. Read
`useGameSocket.ts`'s gate and `GameLayout.tsx`'s call site directly (not from the PR body).
Read the full test file. Independently re-ran `pnpm install --frozen-lockfile`, `check`,
`test`, `test:server`, and `build` from a clean checkout of the head commit rather than
trusting the PR's numbers. Pulled PR metadata and CI status live via the GitHub API.

## Scope
Full PR range (`0ced366..62297bb`, 3 commits):
- `d52b44b` (docs-only): `docs/HANDOFF.md` (+37/-14) — baton rewrite after #211's merge.
- `a1393ce` (docs-only): `artifacts/frontier-al/docs/LOGIN_AUTH_FLOW_MAP.md` (+209 new).
- `62297bb` (the unit): `client/src/contexts/WalletContext.tsx` (+16),
  `client/tests/devIdentityPrecedence.spec.ts` (+18/-2), a new session note
  (`artifacts/frontier-al/session-notes/2026-07-07-dev-session-ws-gate-fix.md`, +63),
  `docs/HANDOFF.md` (+44/-1 further, baton updated again with this unit).

This matches the task's described scope exactly — nothing else is in the range.
`git diff --name-only 0ced366..62297bb` grepped for `server/|kestra|GlobeBattleSequence|
battle-sequence|redis|cooldown|wsServer` returns **no matches**. No funds/ASA/chain files
(`server/services/chain/*`), no `ops/kestra/*`, no hard-gated cinematics files
(`GlobeBattleSequence.tsx`, `battle-sequence.ts`) touched anywhere in the range. The PR's
own "Findings-only" claims (Redis, globe cinematics, replay/cooldown, domain-loading
report) are backed by zero corresponding code diffs — confirmed by the same grep.

## Claims vs. evidence

| Claim | Verdict | Evidence |
|---|---|---|
| Dev-identity override object in `useWallet()` never set `authVersion`, so it stayed at the real context's initial `0` for a dev session | ✅ verified | Diff shows the override object (`WalletContext.tsx:706-724`) is a `{...context, isConnected: true, walletStatus: "connected", ..., isAuthenticated: true}` spread that, pre-fix, never mentioned `authVersion` at all — so it inherited `context.authVersion`, which starts at `useState(0)` (line 328) and is bumped only inside `authenticate()` |
| Fix adds a new pure helper `devIdentityAuthVersion(contextAuthVersion)` returning `contextAuthVersion \|\| 1`, applied as one new field in the override object | ✅ verified | `WalletContext.tsx:695-697`: `export function devIdentityAuthVersion(contextAuthVersion: number): number { return contextAuthVersion \|\| 1; }`; single new line added inside the override object, `authVersion: devIdentityAuthVersion(context.authVersion),` — no other line in `useWallet()` changed |
| `devIdentityAuthVersion(0) === 1` | ✅ verified | `0 \|\| 1` evaluates to `1` in JS (falsy short-circuit); also asserted directly by the new test |
| `devIdentityAuthVersion(3) === 3` | ✅ verified | `3 \|\| 1` evaluates to `3` (truthy short-circuit, preserves a real bumped value); also asserted directly by the new test |
| `useGameSocket`'s gate is exactly `if (!authTrigger \|\| !token) return;` | ✅ verified | `client/src/hooks/useGameSocket.ts:217`, verbatim |
| `GameLayout.tsx` passes `wallet.authVersion` as that trigger | ✅ verified | `GameLayout.tsx:84`: `useGameSocket(wallet.authVersion, wallet.onSessionRejected);` |
| The real wallet path (`authenticate()`) is completely untouched | ✅ verified | `authenticate()` (`WalletContext.tsx:394-415`) has zero diff lines against it; its `setAuthVersion((v) => v + 1)` bump (line 406) is identical pre/post-fix; the only new reference to "`authenticate()`" anywhere in the diff is inside the new doc comment, not code |
| Test file has 2 new cases for `devIdentityAuthVersion`, importing the real export | ✅ verified | `devIdentityPrecedence.spec.ts` imports `{ shouldUseDevIdentity, devIdentityAuthVersion } from "@/contexts/WalletContext"` (the real module, no mock/duplicate) and adds a `describe("devIdentityAuthVersion")` block with exactly the 2 claimed assertions |
| `tsc` clean | ✅ verified | Reproduced: `pnpm --filter @workspace/frontier-al run check` — no output, exit clean |
| client `test` — 305 passed (was 303, +2 new) | ✅ verified | Reproduced exactly: "Test Files 53 passed (53)", "Tests 305 passed (305)" |
| `test:server` — 449 passed / 24 skipped, unchanged | ✅ verified | Reproduced exactly: "Test Files 55 passed \| 7 skipped (62)", "Tests 449 passed \| 24 skipped (473)" — identical to PR #211's audited baseline, consistent with "no server files touched" |
| `build` clean | ✅ verified | `pnpm --filter @workspace/frontier-al run build` completed; client + server bundles produced; only pre-existing, unrelated warnings (chunk-size advice, PostCSS `from`-option notice, `lottie-web`'s `eval` notice) — none touch this PR's files |
| No server/funds/ASA/kestra/cinematics/Redis/cooldown files touched | ✅ verified | `git diff --name-only 0ced366..62297bb` is exactly the 5 files listed above; targeted grep for those path patterns returns nothing |
| CI green on this PR's actual head commit | ✅ verified | GitHub Actions run `28853604690` (workflow `CI`) on sha `62297bb`: `completed`/`success`; "Cloudflare Pages" check also `success` |

## Scope creep
None. Every file in the 3-commit range is accounted for and matches the PR body's stated
scope precisely (it even explicitly names both earlier docs-only commits). No undisclosed
changes to `server/wsServer.ts`, `server/services/redis.ts`, cooldown/weapon-fire logic, or
any other file related to the PR's discussed-but-not-fixed findings (Redis, cinematics,
replay, domain-loading) — those are genuinely findings-only, as claimed.

## Untested assertions
- The live headless repro (dev-session weapon fire resolving server-side but not
  rendering client-side) is **not** re-verified in this audit — it would require standing
  up the local Postgres + dev server + headless Chromium harness described in
  `artifacts/frontier-al/docs/HEADLESS_VISUAL_TESTING.md`, which this audit did not do.
  The PR itself discloses this as an honest gap ("not re-verified live in a second
  headless run"). The underlying logic claim (the `authVersion` gate) is, however, fully
  unit-tested and independently confirmed by direct code reading, so the *fix* is
  test-backed even though the *original failing scenario* wasn't re-run end-to-end
  post-fix.
- The PR's other findings (Redis not in the real-time path, globe cinematics disconnected
  from `cinematicBus`, zero weapon-fire cooldown, domain-loading false alarm) are reported
  as narrative claims with no accompanying tests or diffs — consistent with the PR's own
  framing that these are health-check findings, not shipped fixes. Not independently
  re-verified by this audit (out of scope per the task: "findings-only, no code for
  these" — only checked that no undisclosed code changes exist for them, which held).

## Security
- No server files, no auth/session-issuance code, no funds/ASA/chain code touched. The
  change only affects which value is threaded through as the client-side WebSocket
  reconnect trigger for an already-authenticated dev/test identity.
- The fix does not weaken any real-wallet security property: `authenticate()`'s real
  signature-verification and token-issuance flow is byte-for-byte unchanged, and the dev
  identity path was already gated by `shouldUseDevIdentity` (real wallet takes precedence,
  `DEV_MODE`-gated) before this change — this PR does not touch that precedence logic.
  `devIdentityAuthVersion` only affects an already-shadowed dev session's socket-open
  trigger, not authentication or authorization.
- Widening effect is intentionally narrow: it makes a dev/test session's live WebSocket
  connect (previously silently broken) actually work, matching the behavior real wallets
  already had. It does not open any new capability beyond what a dev session already had
  via REST.

## What could NOT be verified
- The live headless repro of the original bug (weapon fire not rendering in a dev
  session) and the fix's live end-to-end effect were not re-run by this audit — see
  "Untested assertions" above. This mirrors the PR's own disclosed gap.
- The three other health-check findings in the PR body (Redis usage, cinematics gap,
  replay/cooldown behavior, domain-loading investigation) were not independently
  re-investigated by this audit beyond confirming no undisclosed code changes exist for
  them — the task scoped this audit to *findings-only* verification for those items.

## Recommendation
**PASS.** The core claim is precisely and narrowly true: the dev-identity override object
previously never touched `authVersion`, permanently gating `useGameSocket`'s connect
effect closed for every dev/test session; the fix is a 2-line, fully pure, fully
unit-tested change that does not touch the real wallet path at all. Scope is exactly as
described (2 docs-only commits + 1 code+test+docs commit, no server/funds/cinematics
files touched). All 4 build/test commands were independently reproduced with numbers
matching the PR's claims exactly, and CI is green on the actual head commit. Safe to merge
after the PASS is recorded; the only residual gap (no live re-verification after the fix)
is honestly disclosed by the PR itself and is low-risk given the change's size and test
coverage.
