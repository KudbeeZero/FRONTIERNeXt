# Audit: PR #209 — fix(server): close concurrent lost-update in placeBet

## Verdict: PASS

## PR / branch / commit
- PR #209, branch `claude/handoff-audit-f5w0qn`, head `bef281f87d1d7a0f73ec10b08606b76930538d7a`
- Base: `main` @ `7f6a9e3e9fed341f1608521fd6207e33eff4ad38`
- CI on head: "Typecheck & server tests" ✅ success, "Cloudflare Pages" ✅ success

## Method
Independent auditor subagent fetched the full PR diff + file list via GitHub MCP tools, read
`server/storage/placebet.db.spec.ts` and the `placeBet` diff in full, cross-checked the test's
minimal schema against `server/db-schema.ts`, and — going further than a read-only review —
built a schema-compatible **buggy variant** in an isolated `git worktree` (main working tree
never touched, confirmed clean before/after) and ran the new spec against it on a throwaway
Postgres to independently reproduce the fail-before/pass-after story, rather than trusting the
PR body's account of it. Also independently re-ran `check`, `test:server`, `test`,
`coverage:server`, `test:server:db`, and `build`.

## Scope
✅ **Verified exactly.** 5 files changed: `artifacts/frontier-al/package.json`,
`artifacts/frontier-al/server/storage/db.ts`, new
`artifacts/frontier-al/server/storage/placebet.db.spec.ts`, new
`artifacts/frontier-al/session-notes/2026-07-07-fix-placebet-atomicity.md`, `docs/HANDOFF.md`.
No `routes.ts`, schema/migration, or client code touched; the baton diff is narrative-only.

## Claims vs. evidence

| Claim | Verdict | Evidence |
|---|---|---|
| Whole method wrapped in one transaction | ✅ verified | `db.ts:3271-3335`, `this.db.transaction(async (tx) => {...})` |
| `FOR UPDATE` on both market and player rows, **before any mutation** | ✅ verified | Market lock `db.ts:3272-3280`; player lock `db.ts:3292-3296`; first mutation at `db.ts:3304` — every line traced in between, no mutation or stale-data check precedes either lock |
| Conditional relative debit/credit as belt-to-the-lock | ✅ verified | Debit `db.ts:3304-3309` (`ascend - amount WHERE ... ascend >= amount RETURNING id`); pool credit `db.ts:3311-3319` (`WHERE ... status='open' RETURNING *`), both bail on empty result |
| Pre-existing business rules (`resolvesAt`/`resolutionCutoffTs`/`status`) preserved, not weakened | ✅ verified | Diffed against base `7f6a9e3` — verbatim |
| Pool-credit → position-insert gap safe | ✅ verified (structural) | Both inside the one transaction; a throw rolls back atomically, same pattern as `claimWinnings`/`fillTradeOrder`/`grantWelcomeBonus` (`db.ts:910,1116,2311,3376`). Not forced-failure-tested directly, but structurally identical to 3 already-merged sibling fixes. |
| New deterministic FOR-UPDATE-lock test proves fixed-vs-buggy | ✅ verified independently | Auditor built its own schema-compatible buggy variant in an isolated worktree and confirmed: deterministic lock test **fails** on buggy code, serial + naive `Promise.all` tests **pass** on buggy code (false negative) — exactly matches the PR's documented "only the lock-forcing test discriminates" claim |
| Test's minimal schema matches real schema | ✅ verified | `players.ascend`→`frontier integer`, `players.isAi`→`is_ai boolean`, full `prediction_markets`/`market_positions` column sets checked against `server/db-schema.ts` and `rowToMarket`'s field list |
| `package.json`'s `test:server:db` includes the new spec, no typo | ✅ verified | Confirmed by successfully running the script itself |
| Quantitative claims (446/24 skipped, coverage %, client 285, 21/21 DB specs, build green) | ✅ verified | All reproduced exactly by the auditor against real Postgres 16 + this exact working tree |

## Scope creep
None found.

## Untested assertions
None — "proven" is used twice in the PR body and both instances were independently reproduced
by the auditor, not just read.

## Security / economy-integrity
No mainnet/ASA/on-chain transfer code touched (purely in-game DB balance movement between a
player and a market pool). `wip/atomic-purchase` and `ops/kestra/` untouched; no mock data; no
globe/combat/canvas change.

## What could NOT be verified
Multi-instance/production concurrent traffic behavior (requires a live deployed environment) —
the locking semantics that matter here are Postgres-native and don't depend on server process
count, so this is assessed as low risk. The pool-credit → position-insert rollback path was not
directly forced-failure-tested (inferred from transaction semantics + structural identity with
3 merged sibling fixes).

## Procedural note (not a defect)
PR was in **draft** state — converted to ready-for-review as part of this audit's merge step.
