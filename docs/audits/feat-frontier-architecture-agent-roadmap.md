# Audit — PR #174 `feat/frontier-architecture-agent-roadmap` (six FRONTIER docs)

**Verdict: CONCERNS** (docs-only, no HARD RULE violation, CI green — but one
load-bearing factual claim, repeated across three of the six docs, is stale
relative to current code and should be corrected before it drives PR planning)

## PR / branch / commit
- PR #174, branch `feat/frontier-architecture-agent-roadmap`, head
  `4d4a8b42d5a8f17d20a43b0d12cb039e166ac3db`, base `main @ eab3eef` (matches
  the docs' own stated baseline).
- `mergeable_state: clean`, draft, state `open`. Baton already marks it
  `AWAITING_OWNER_REVIEW` with an explicit "do not auto-merge" note — this
  audit does not override that; it is input to the owner's review.
- Diff: `docs/FRONTIER_ARCHITECTURE_TRUTH.md`, `FRONTIER_AGENT_REGISTRY.md`,
  `FRONTIER_MASTER_ROADMAP.md`, `FRONTIER_AGENT_DASHBOARD_SPEC.md`,
  `FRONTIER_FIRST_10_PRS.md`, `FRONTIER_BRANCH_MACHINE.md` (all new),
  `docs/HANDOFF.md` (baton), `artifacts/frontier-al/session-notes/2026-07-06-frontier-docs-suite.md`
  (new). 8 files, +735/-4. **Zero code changes** — confirmed by
  `git diff --name-only origin/main...HEAD`.

## Tests
- CI on head `4d4a8b4`: `Typecheck & server tests` → **success**;
  `Cloudflare Pages` → **success** (checked live via GitHub API, not
  paraphrased). Consistent with the PR body's local claim (tsc clean · server
  415/14 skipped · client 213 · `git diff --check` clean) — docs-only change,
  no reason to doubt it.

## Claim checks (spot-check against code, file:line evidence)

| # | Claim | Doc | Evidence | Verdict |
|---|---|---|---|---|
| 1 | Autonomous worker table (battle resolver 2996, AI faction loop 3062, orbital 3074, battle tick 3093, market resolver 3230, all `setInterval` in `routes.ts`) | ARCHITECTURE_TRUTH §4, AGENT_REGISTRY §A | `server/routes.ts:2996,3062,3068(AI_ENABLED gate),3074,3093,3230` — all exact line matches, incl. cadences (5000ms floor 1000, 20s literal, 5min comment, 1000ms floor 250, 60s comment) | ✅ |
| 2 | Reapers at `server/index.ts:~242–252` | ARCHITECTURE_TRUTH §4 | `server/index.ts:242` (`_actionNoncePruneInterval`), `:252` (`_purchaseIntentReapInterval`) | ✅ |
| 3 | ASCEND transfer worker, 30s, `services/chain/transferQueue.ts` | AGENT_REGISTRY #7 | `transferQueue.ts:177,184` — `startAscendTransferWorker(intervalMs = 30_000)` | ✅ |
| 4 | `AI_ENABLED` double-gated at 11+ sites (loop + every mutation) | ARCHITECTURE_TRUTH §7 | `storage/ai-engine.ts:48,135,169,243,283,320,377,411` (8) + `routes.ts:3064,4054,4142` (3) = 11 | ✅ |
| 5 | No `/mission-control` route, no `/api/ops/*` exist in code | ARCHITECTURE_TRUTH §2 | `grep "Route path" client/src/App.tsx` → 12 routes, no `/mission-control`; `grep "api/ops" server/routes.ts` → no hits | ✅ |
| 6 | `smoke:testnet` → `tsx script/testnet-nft-smoke.ts` | AGENT_REGISTRY #16, MASTER_ROADMAP | `artifacts/frontier-al/package.json:14` | ✅ |
| 7 | `fly.toml` ships `VITE_DEV_MODE=true`, `VITE_DEV_AUTOLOGIN=true`, `FREE_PURCHASES=true` | ARCHITECTURE_TRUTH §7 | `fly.toml:17,22,36` — exact | ✅ |
| 8 | Dashboard v2 flag `lib/dashboard/flag.ts`, default-off, `?dashboard=1`/localStorage; 9 default widgets | ARCHITECTURE_TRUTH §2, AGENT_DASHBOARD_SPEC | `client/src/lib/dashboard/flag.ts` (matches exactly); `dashboard/defaults.ts` — 9 `id:` entries | ✅ |
| 9 | **SEV1 — "the purchase route does not call `verifyAlgoPayment`"** | ARCHITECTURE_TRUTH §6, MASTER_ROADMAP Phase 6, FIRST_10_PRS PR 6 | `server/routes.ts:1930-1941` — the `/api/actions/purchase` handler **already calls `verifyAlgoPayment`** (with replay-guard claim at `:1944-1956`) whenever `!FREE_PURCHASES`. This code path landed in `8fe1030` (2026-06-24), the **same merge** that carries `chain-services-audit.md` — i.e., the audit's "never calls verifyAlgoPayment" finding was already stale the day it was written, and this PR's "fresh 2026-07-06 audit" repeated it without re-checking current `routes.ts`. What genuinely **is** still true: `forwardLiquiditySplit` is imported (`routes.ts:41`) and never called anywhere (`grep -rn "forwardLiquiditySplit(" server/` → only the definition) — that half of the old SEV1 holds. | ⚠ (see Finding A) |
| 10 | `recordUpgradeOnChain` Address-vs-string — doc hedges ("code inspection suggests v3 accepts `Address`") rather than asserting the older audit's "likely throws" | ARCHITECTURE_TRUTH §6 | `node_modules/.../algosdk@3.5.2/dist/types/makeTxn.d.ts` / `base.d.ts`: `sender: string | Address` — v3.5.2 (the pinned version, `package.json:71` `^3.5.2`) **does** accept an `Address` object. The new doc's hedged framing is *more* accurate than the older audit's confident "throws" claim | ✅ (good catch, no fix needed) |

## Internal consistency

- All 13 cross-doc markdown links resolve (checked every `[..](...)`
  reference across the six docs plus `SESSION_PROTOCOL.md` and
  `../artifacts/frontier-al/docs/NEXT_LEVEL_PLAYBOOK.md`).
- FIRST_10_PRS ordering vs MASTER_ROADMAP phases: intentionally
  non-monotonic and the docs say so explicitly (registry→switches→shell
  reordered ahead of their nominal phase numbers; "ordering is
  dependency-driven"). Not a defect.
- No doc weakens a HARD RULE — `wip/atomic-purchase`, `ops/kestra/` mainnet
  ban, no-mock-data, funds-path owner-gate, and mem/db parallel-storage
  guidance are all restated consistently across ARCHITECTURE_TRUTH,
  AGENT_REGISTRY, MASTER_ROADMAP, and BRANCH_MACHINE.
- **Finding B (minor):** `FRONTIER_FIRST_10_PRS.md` PR 1 ("chore: machine-readable
  agent registry", files `docs/state/agent-registry.json` +
  `shared/opsRegistry.ts`) and `FRONTIER_MASTER_ROADMAP.md` Phase 13 ("Memory /
  State Layer", files `docs/state/registry.json` + generator + supersession
  notices) both claim branch name **`chore/state-registry-json`** for two
  different-scoped pieces of work. Not fixed (a rename is a scope/structure
  decision, out of the "typo/path/line-ref only" fix budget for this audit) —
  flagging for the next session to pick one name before either branch opens.
- **Finding C (cosmetic, not fixed):** approximate counts drift slightly:
  "36 audit reports across both levels" (ARCHITECTURE_TRUTH §9, AGENT_REGISTRY
  Phase 7 context) vs. actual 18 (`artifacts/frontier-al/docs/audit/`) + 19
  real reports in `docs/audits/` (20 files minus `README.md`) = 37; "75 session
  notes" (AGENT_REGISTRY, Memory/State Librarian row) vs. actual 77
  (`find artifacts/frontier-al/session-notes -name '*.md'`). Off by 1-2 in
  each case — expected drift for a repo that gains files every session, not
  worth hand-editing since it goes stale again immediately.

## Fixes applied in this audit

None of the load-bearing wording needed a byte-level fix — I found no
typos, no wrong file paths, and every line-number reference I spot-checked
(11 of them, well past the ~8 requested) was **exactly correct**, which is
unusually high precision for a hand-written architecture doc. The one real
defect (Finding A, the stale SEV1 purchase-verification claim) is a
substantive factual claim, not a typo/path/line-ref, so per my instructions
I did not rewrite it myself — it needs an owner/next-session decision
(re-verify current behavior with `FREE_PURCHASES=false` on TestNet, then
correct `ARCHITECTURE_TRUTH.md` §6, `MASTER_ROADMAP.md` Phase 6, and
`FIRST_10_PRS.md` PR 6 to reflect that the verification code already exists
and the remaining gap is enabling it + a TestNet click-test, not writing new
verification logic). **No files were edited by this audit.**

## Scope creep
None. Diff is exactly the six docs + baton + one session note, as claimed.

## Untested assertions
None beyond the normal nature of planning docs (roadmap phases are
explicitly framed as proposals, not claims of completed work) — the docs are
disciplined about marking `Missing`/`unknown` rather than asserting done.

## Security
No code touched. The docs correctly keep every funds/wallet/claim path
behind "owner, explicit" in the gate matrix (`FRONTIER_BRANCH_MACHINE.md`
gate matrix table) and repeat the four-gate rule (TestNet click-test + txn
watcher capture + `/security-pass` + owner approval) for chain writes.

## What I could NOT verify
- Whether Kestra flows are actually deployed/running (docs correctly mark
  this "unknown" themselves — not something a static repo audit can settle).
- Live wallet balance / on-chain state (would require RPC calls this audit
  didn't make; not requested).

## Recommendation
Owner may merge as-is per the merge-on-green docs lane in
`FRONTIER_BRANCH_MACHINE.md` (CI green, docs-only, no HARD RULE issue) — but
should read Finding A before greenlighting FIRST_10 PR 6, since that PR is
currently scoped as "write the missing verification" when the real remaining
work is smaller (flip `FREE_PURCHASES` off on a TestNet click-test path and
confirm the existing `verifyAlgoPayment` + replay-guard code behaves as
expected end-to-end, then update the three docs that call it "missing").

## I have read and understood the full system

Five things a future session must carry forward from this audit:

1. **The plot-purchase SEV1 is (mostly) already fixed in code** —
   `server/routes.ts:1930-1956` calls `verifyAlgoPayment` and claims a
   replay guard whenever `FREE_PURCHASES` is off. The remaining real gap is
   an *ops/verification* step (TestNet click-test with the flag flipped),
   not new application code. Don't let FIRST_10 PR 6 re-implement something
   that exists.
2. **The "agents" in this repo are almost all `setInterval` loops inside
   `server/routes.ts` (~2996-3230) plus a few standalone modules**
   (`transferQueue.ts`, `priceOracle.ts`, `season/manager.ts`) — there is no
   HERMES, no router, no Mission Control, no `/api/ops/*` today. Every
   "agent" doc in this PR is careful to say so; don't let later summaries
   blur planned vs. real.
3. **The highest-risk live process is the ASCEND transfer worker**
   (`transferQueue.ts`, 30s cadence, real TestNet fund movement, zero kill
   switch) — it's rightly first in line for FIRST_10 PR 2's kill-switch work,
   ahead of anything UI.
4. **Two structurally different SEV1s remain genuinely open**: (a)
   `forwardLiquiditySplit` is real dead code (imported, never called — still
   true today), and (b) the live TestNet ASA `755818217` was minted without a
   clawback address and is immutable; new asset creation code already sets
   `clawback: adminAddr` (`services/chain/asa.ts:158`), so the *fix* is
   "create the mainnet ASA correctly from genesis," not a code change.
5. **One-PR-at-a-time discipline is intact and this PR respects it**: the
   baton explicitly says "DO NOT auto-merge #174 — owner reviews it," CI is
   green on head, the diff is exactly the six docs + baton + session note,
   and every cross-doc link resolves. The gate matrix, HARD RULES, and
   mainnet-blocking invariants are repeated consistently across all six new
   docs with no loosening anywhere I checked.
