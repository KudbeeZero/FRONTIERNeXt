# Audit: PR #214 — fix(client): wallet-popup-storm recovery escape hatch

## Verdict: **PASS**

## PR / branch / commit
- PR #214, branch `claude/handoff-audit-f5w0qn`, head `f940250` (single commit
  `f94025048500c346097d9370daa1a254461271a7`) — confirmed via GitHub API (`pull_request_read`
  get + get_commits), not assumed. Fetched the ref directly (`refs/pull/214/head`), which
  resolves to a genuine 40-hex-char sha (`f9402504...271a7`); the JSON's 41-char rendering in
  one API response was a formatting artifact only, cross-checked against `git rev-parse`.
- Base: `main` @ `efd28a4` — confirmed this is exactly the merge-base between the PR branch and
  `main` (`git merge-base pr-214-audit main` → `efd28a4`), and matches the PR API's stated base
  sha. `efd28a4` is itself PR #213, previously audited PASS and merged (see
  `docs/audits/pr-213-audit.md`) — consistent with `docs/HANDOFF.md`'s own account.
- PR is currently **open, marked draft**, `mergeable_state: clean`. Not yet merged. (PR #213 was
  also draft at audit time and that was not treated as a blocker in this repo's flow — noted,
  not flagged as a defect.)
- CI on head commit `f940250`: both checks **success** — "Typecheck & server tests"
  (job `85603605020`) and "Cloudflare Pages" (`85603742487`), both `completed`/`success`,
  timestamped 11:20–11:22 UTC on 2026-07-07, consistent with the commit's own timestamp
  (11:20:19 UTC) — a live run against this exact head, not stale or `[skip ci]`.

## Method
Pulled PR metadata, commit list, and check-runs live via the GitHub MCP tools rather than
trusting the PR body. Diffed the full range `git diff efd28a4..f940250` (7 files, +432/-28,
matches the PR API's `additions`/`deletions`/`changed_files` exactly). Read every changed file's
diff in full. Independently traced the PR's central technical claim by reading the **installed**
SDK source directly — `node_modules/.pnpm/@txnlab+use-wallet@4.6.0*/.../dist/index.cjs` and
`@txnlab+use-wallet-react@4.6.0*/.../dist/index.cjs` — line by line, not from the PR's excerpts.
Built a clean `git worktree` at the exact head commit, ran `pnpm install --frozen-lockfile`, then
independently reproduced `check`, `test`, `test:server`, and `build`.

## Scope
`git diff --stat efd28a4..f940250`:
- `artifacts/frontier-al/client/src/lib/walletReset.ts` (new, +70)
- `artifacts/frontier-al/client/src/components/game/WalletConnect.tsx` (+/-, 65 changed lines)
- `artifacts/frontier-al/client/src/contexts/WalletContext.tsx` (+12/-)
- `artifacts/frontier-al/client/tests/walletReset.spec.ts` (new, +92)
- `artifacts/frontier-al/client/tests/walletConnectResetLink.spec.tsx` (new, +62)
- `artifacts/frontier-al/session-notes/2026-07-07-wallet-popup-storm-recovery.md` (new, +112)
- `docs/HANDOFF.md` (+47/-)

This matches the PR body's stated scope exactly, file for file. Grepped the diff for
`server/|ops/kestra|GlobeBattleSequence|battle-sequence|chain/|economy-config|weapon-economy` —
**no matches**. No server files, no funds/ASA/chain code, no `ops/kestra/*`, no hard-gated
cinematics files touched anywhere in the range.

## Claims vs. evidence

| Claim | Verdict | Evidence |
|---|---|---|
| `LOCAL_STORAGE_KEY = "@txnlab/use-wallet:v4"` is the exact persisted-state key | ✅ verified | `dist/index.cjs:5825`: `var LOCAL_STORAGE_KEY = "@txnlab/use-wallet:v4";`. Traced forward: `loadPersistedState()` (manager) reads `StorageAdapter.getItem(LOCAL_STORAGE_KEY)` and hydrates `this.store.state.wallets` from it; `savePersistedState()` writes the same key. Clearing it empties `state.wallets` for every wallet id on next load |
| Pera's `resumeSession()` has an early `if (!walletState) return` guard before calling `client.reconnectSession()`, and `walletState` comes from `this.store.state.wallets[this.id]` | ✅ verified | Located the actual `PeraWallet` class (`var PeraWallet = class extends BaseWallet` at line 8575, `initializeClient()` imports `@perawallet/connect`'s `PeraWalletConnect` — confirmed this is the real Pera implementation, not a lookalike). Its `resumeSession` (line ~8657): `const walletState = state.wallets[this.id]; ... if (!walletState) { ...; return; } ... const accounts = await client.reconnectSession();` — exactly as claimed. One caveat found independently, not mentioned in the PR (see "Untested assertions" below) |
| Clearing `@txnlab/use-wallet:v4` is genuinely sufficient to stop `resumeSession()` reaching `reconnectSession()` | ✅ verified | Since `state.wallets` is populated solely from `loadPersistedState()`/`LOCAL_STORAGE_KEY` at manager construction, an empty/absent key means `state.wallets[this.id]` is `undefined` for every wallet, so the early-return guard fires for all of them on the next mount |
| `WalletProvider`'s `useEffect` guards `resumeSessions()` behind a `resumedRef`, firing at most once per mount — NOT a React re-render bug in this app's own code | ✅ verified | `use-wallet-react/dist/index.cjs:49-54`: `const resumedRef = React.useRef(false); React.useEffect(() => { if (!resumedRef.current) { manager.resumeSessions(); resumedRef.current = true; } }, [manager]);` — matches verbatim |
| `resumeSessions()` runs every wallet's `resumeSession()` in parallel (session note's `Promise.all` claim) | ✅ verified | `WalletManager.resumeSessions()` (`dist/index.cjs:9819`): `const promises = this.wallets.map((wallet) => wallet?.resumeSession()); await Promise.all(promises);` |
| `WALLET_RESET_STORAGE_KEYS` = use-wallet's key + this app's `WALLET_TYPE_KEY`/`WALLET_ADDRESS_KEY`/`WALLET_SESSION_HINT_KEY`, imported (not duplicated as raw strings) | ✅ verified | `walletReset.ts:1`: `import { WALLET_SESSION_HINT_KEY, WALLET_TYPE_KEY, WALLET_ADDRESS_KEY } from "@/contexts/WalletContext";`; array literal uses the three imported constants + one raw SDK-key string (unavoidable — it's an external, undocumented key, honestly flagged as such in the doc comment) |
| `clearWalletStorage()` accepts an optional storage param (default `window.localStorage`), loops every key with try/catch (best-effort), also calls `clearAuthToken()` | ✅ verified | Signature: `clearWalletStorage(storage: RemovableStorage \| undefined = defaultStorage())`; `for (const key of WALLET_RESET_STORAGE_KEYS) { try { storage?.removeItem(key); } catch { /* best-effort */ } } clearAuthToken();`. `clearAuthToken()` confirmed to remove `"frontier_session_token"` (`authToken.ts:5,23`) |
| `resetWalletConnection()` clears storage then hard-reloads | ✅ verified | `resetWalletConnection() { clearWalletStorage(); window.location.reload(); }` |
| "Trouble connecting? Reset wallet connection" rendered in both `walletStatus === "restoring"` and plain `!isConnected` branches, not in the connected state | ✅ verified | Grepped the full file: `TroubleConnectingLink` referenced at exactly 2 call sites (lines 140, 198), inside the `restoring && !isConnected` early-return block and the `!isConnected` connect-gate block respectively; no reference anywhere in the connected-state render path |
| `WalletContext.tsx` changes are constant-naming only, no behavior change | ✅ verified | Diff adds two `export const` declarations (`WALLET_TYPE_KEY = "frontier_wallet_type"`, `WALLET_ADDRESS_KEY = "frontier_wallet_address"`) and replaces 4 inline string-literal call sites (`localStorage.setItem/removeItem`) with the constants — same strings, same call sites, same control flow |
| `tsc` clean | ✅ verified | Reproduced in a clean worktree at `f940250`: `pnpm --filter @workspace/frontier-al run check` — no output, exit clean |
| client `test` — 320 passed (was 311, +9 new) | ✅ verified | Reproduced exactly: "Test Files 56 passed (56)", "Tests 320 passed (320)". New files contribute exactly 9 (`walletReset.spec.ts` 6 `it()` blocks + `walletConnectResetLink.spec.tsx` 3 `it()` blocks) |
| `test:server` — 449 passed / 24 skipped, unchanged | ✅ verified | Reproduced exactly: "Test Files 55 passed \| 7 skipped (62)", "Tests 449 passed \| 24 skipped (473)" — identical to the PR #213 audit baseline, consistent with zero server files touched |
| `build` clean | ✅ verified | `pnpm --filter @workspace/frontier-al run build` completed (client 31.79s, server 269ms) with no errors; only pre-existing, unrelated warnings (chunk-size advice, PostCSS `from`-option notice, `lottie-web`'s `eval` notice, `bufferutil` build-script notice) |
| No server/funds/ASA/kestra/cinematics files touched | ✅ verified | `git diff --stat efd28a4..f940250` is exactly the 7 files listed above; targeted grep for guarded path patterns returns nothing |
| CI green on the PR's actual current head commit | ✅ verified | Both GitHub Actions checks (`Typecheck & server tests`, `Cloudflare Pages`) report `completed`/`success` against `f940250` specifically, timestamped consistently with that commit |

## Scope creep
None. All 7 files match the PR body's stated scope exactly, including the docs (`docs/HANDOFF.md`
+ new session note). No undisclosed changes to any server, chain, or cinematics file.

## Untested assertions / one independent finding beyond the PR's own claims
- **Pera Discover in-app-browser auto-connect edge case (found independently, not mentioned in
  the PR).** Immediately above the `if (!walletState) return` guard, Pera's `resumeSession()` has
  an earlier branch: if `window.navigator.userAgent` contains `"pera"` (i.e., the app is running
  inside Pera's own in-app "Discover" browser) **and** `!walletState` **and** `!state.activeWallet`,
  it calls `this.connect()` once, bypassing the early-return the PR's fix relies on. This does not
  contradict the PR's core claim (clearing the storage key still prevents the *storm*, since this
  branch only ever calls `connect()` once, not repeated `reconnectSession()` popups), and it is
  irrelevant to the owner's reported symptom (a normal browser, not Pera's in-app browser). Not a
  blocker, but worth flagging: the reset link, if clicked from inside Pera Discover itself, could
  trigger one single fresh connect popup on the subsequent reload rather than a fully clean slate.
  Low-severity, disclosed here for completeness rather than left silently unverified.
- **Not reproduced live** — honestly disclosed in the PR body itself ("Not reproduced live — no
  real Pera/WalletConnect session in this sandbox to trigger the actual storm against"). This
  audit did not close that gap either (no live Pera session available here). What *is*
  independently confirmed, line-by-line, against the actual installed SDK source: clearing
  `@txnlab/use-wallet:v4` genuinely empties every wallet's persisted state, which genuinely causes
  every wallet's `resumeSession()` early-return guard to fire on the next mount before any
  `reconnectSession()` call — the mechanism is real, not merely plausible. The end-to-end UX
  (click link → storage cleared → reload → clean reconnect, no residual popups) has not been
  exercised against a real stuck Pera session.

## Security
- No server files, no auth/session-issuance code, no funds/ASA/chain code touched.
- `clearWalletStorage()` only ever calls `removeItem` on a small, explicit, named key list (no
  wildcard/prefix clearing of arbitrary localStorage) and is wrapped per-key in try/catch — cannot
  throw and break the reset flow even in private-browsing storage-restricted contexts (confirmed
  by a dedicated test: `"doesn't throw if a given key removal fails"`).
- `resetWalletConnection()`'s only side effects are removing a fixed set of localStorage keys and
  `window.location.reload()` — no network calls, no new endpoint, no data exfiltration surface.
- `TroubleConnectingLink` renders static text via JSX (no `dangerouslySetInnerHTML`, no
  interpolated untrusted content) — no XSS vector.
- No new capability, endpoint, or data flow introduced; this is a client-side, additive recovery
  affordance layered on existing connect/disconnect logic.

## Honest-gap check
Confirmed the PR does **not** overclaim. It explicitly frames the deliverable as "a recovery
escape hatch, not a patch to SDK internals," states the storm's actual trigger
(`PeraWalletConnect.reconnectSession()`) is "inside a third-party dependency this app doesn't
control," and its own "Honest gaps" section states plainly: "Not reproduced live... the mechanism
is read directly from the SDK's own source (not assumed), but the recovery flow itself... hasn't
been exercised end-to-end on a real device. Owner should confirm on the device that was actually
stuck." `docs/HANDOFF.md`'s baton entry mirrors this same framing verbatim-in-substance. This is
an accurate, appropriately hedged disclosure — matches what this audit independently verified.

## What could NOT be verified
- Live end-to-end reproduction of the original popup storm and confirmation the reset link clears
  it on a real device with a real stuck Pera session (no such session available in this sandbox;
  same limitation the PR itself discloses).
- The Pera-Discover-in-app-browser auto-connect edge case noted above was traced statically, not
  exercised against a real Pera Discover browser session.

## Recommendation
**PASS.** All claimed file-level changes are verified byte-for-byte against the diff at the PR's
actual current head (`f940250`). The PR's central technical claim — that clearing
`localStorage["@txnlab/use-wallet:v4"]` causes every wallet's `resumeSession()` to bail out before
ever calling the third-party `reconnectSession()` that triggers the popup storm — was independently
traced through the actual installed SDK source (`@txnlab/use-wallet@4.6.0` and
`@txnlab/use-wallet-react@4.6.0` `dist/index.cjs`), not taken on faith from the PR's excerpts, and
holds. `tsc`, client tests (320, +9 exactly matching the two new files), server tests (449/24,
byte-identical to the pre-PR baseline), and a full production build were all independently
reproduced in a clean worktree at the exact head commit. Scope is exactly as described — 7 files,
all client/docs, zero server/funds/ASA/kestra/cinematics files touched. CI is green on the actual
head commit via a live run, not stale. The PR's own "Honest gaps" disclosure is accurate and not
overclaimed. One additional, low-severity edge case (Pera Discover in-app-browser auto-connect)
was found independently and is disclosed above as a non-blocking observation. Given the urgency
(owner fully blocked from wallet connect/testing), this is safe to merge now; recommend the owner
still confirm the reset link clears their actual stuck session on the device that triggered the
original report, per the PR's own disclosed gap.
