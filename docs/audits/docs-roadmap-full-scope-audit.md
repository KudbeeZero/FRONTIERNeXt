# Audit: PR #207 — docs: merge full-scope audit into master roadmap + baton rewrite

## Verdict: CONCERNS

## PR / branch / commit
- PR #207, branch `docs/roadmap-full-scope-audit`, head `a13b3af018e4c1436f6548d8c118477fb422dd25`
- Base: `main` @ `42b4a5c76e0c1668b4814fba63a67b1a7fb86c21`
- CI on head: "Typecheck & server tests" ✅ success, "Cloudflare Pages" ✅ success

## Method
Independent auditor subagent fetched PR metadata + full diff via GitHub MCP tools, fetched
both `origin/main` and `origin/docs/roadmap-full-scope-audit` locally, confirmed local HEAD
== PR base (ancestor check passed), read the full ~750-line diff in one pass (no
truncation), and ran `pnpm run typecheck` + `pnpm --filter @workspace/frontier-al run check`
directly against the tree. Never checked out the PR branch in the main working tree
(confirmed clean throughout, no leftover worktree).

## Scope claim (docs-only, 7 files)
✅ **Verified exactly.** `git diff origin/main...origin/docs/roadmap-full-scope-audit --stat`
shows precisely the 7 claimed files, 328(+)/311(-), zero code/config/CI/migration/
package.json changes. Two commits, both docs-only by inspection.

## Process / invariants
- ✅ `docs/HANDOFF.md` "⚖️ Working agreement — LOCKED IN" block is **byte-for-byte identical**
  between main and the PR branch.
- ✅ No HARD RULE violations: Phase 26 explicitly lists `wip/atomic-purchase` as 🚫
  (don't-touch); every mainnet-adjacent queue item (M3-3, M3-4, M3-6) is hedged as
  ADR-first / funds-gated / read-only dry-run.
- ✅ No over-claiming found: new findings are explicitly hedged ("read-only exploration...
  exploration-grade," "each queued unit must re-confirm its anchors before coding," "not yet
  fix-verified").
- ✅ `pnpm run typecheck` (root) and `pnpm --filter @workspace/frontier-al run check` both
  green with zero errors — corroborates the docs-only claim independently of the diff stat.

## Claims vs. evidence (spot-checked headline findings)

| Finding | Verdict | Evidence |
|---|---|---|
| W1 — weapon damage never settled | ✅ verified | `server/weapons/engagementStore.ts:156` computes `damage`; `EngagementStatus` includes `"impacted"` (line 25) but it is never assigned anywhere (only `"intercepted"` is set, line 190) |
| N1 — no atomic delivery/rollback | ✅ verified | `attemptDelivery` called at `routes.ts:2084`; ALGO payment consumed ~line 1954; mint-failure `.catch` (~2100-2106) only flips status to `"failed"`, no refund/retry |
| chain-services-audit.md correction | ✅ verified | `routes.ts:2084`, `routes.ts:994`, `routes.ts:1052` all exact |
| U2 — dead `BottomNav.tsx` | ✅ verified | Component never imported/rendered anywhere; `HudShell.tsx:47` comments "Drop-in replacement for `<BottomNav>`" |
| U3 — Armory "FR" mislabel | ✅ verified | `ArmoryPanel.tsx:253` exactly `Unlock · {e.unlockCost} FR` |
| N6 — mainnet ASAs keep admin manager/reserve | ✅ verified | `land.ts:57-60` — manager/reserve unconditional; only freeze/clawback conditioned on mainnet |
| W5 — weapon-NFT mint 503 without `PUBLIC_BASE_URL` | ✅ verified | exact line `routes.ts:2644` |
| W2/W4 — loadout dead / badges credit non-impact | ✅ verified | `service.ts` credits kills whenever `status !== "intercepted"`, with a comment admitting no later server tick exists |
| N3 — ASCEND ASA id not pinned | ⚠️ partial | Core claim correct (`asa.ts:117,128` lookup-by-name, no env-pinned ID); but sub-claim that `755818217` appears "only in handbook.html" is **false** — also appears in `shared/university/curriculum.ts` and 6+ markdown docs. Minor inaccuracy, doesn't undermine the substantive point. |
| U1 — `/university` missing WalletProvider | ⚠️ partial | Literally true (`App.tsx:84-86` bare), but `university.tsx`'s own doc-comment states this is deliberate (no wallet needed, doesn't touch chain/funds) and `UniversityPanel.tsx` uses zero wallet/auth hooks. Looks like an intentional design choice mischaracterized as a defect. |
| U4 — `BattlesPanel` uses `Date.now()` where `WarRoomPanel` uses `serverNow()` | ❌ **false — reversed** | `BattlesPanel.tsx` actually uses `serverNow()` (lines 35, 197) for its real comparison; its one `Date.now()` (line 194) is a legitimate local-freshness check, not a server-time comparison. `WarRoomPanel.tsx` is the one using `Date.now()` (lines 29, 154) against server-relative timestamps — the real clock-drift risk lives there. Queue item **M2-6** as written targets the wrong file. |

## Scope creep
None found. Diff is exactly the 7 claimed files.

## Untested assertions
None found — new findings are consistently hedged as exploration-grade/unverified, not
claimed as fixed or validated.

## Security
No funds/ASA/auth/secrets code touched (docs-only). The findings *documented* by this PR
(W1, N1, N3, N6) are real and security/funds-relevant, but this PR itself makes no code
change — it only queues them for future gated units.

## What I could NOT verify
Anything requiring live deployment, on-chain TestNet state, or a running server/DB (e.g.
whether `smoke:testnet` succeeds, whether wallet-popup vectors P1-P3 reproduce live, actual
runtime behavior of `/university` without WalletProvider).

## Recommendation
Two real defects in the roadmap's own findings, both fixable in the doc itself before merge:
1. **U4 is factually reversed** — will misdirect a future paid unit (M2-6) at the wrong file
   (`BattlesPanel.tsx` instead of `WarRoomPanel.tsx`) and leave the real clock-drift bug
   untouched.
2. **U1 is likely a mischaracterization** of an intentional, comment-documented design choice
   as a defect.

Neither issue is a funds/security/scope/CI problem — this is a "fix the doc, then merge"
CONCERNS, not a FAIL.
