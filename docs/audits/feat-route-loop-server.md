# Audit — `feat/route-loop-server` (PR #25)

**Verdict:** PASS

> Independent adversarial subagent audit over `git diff 501b770 a30a850`, gating
> the merge of PR #25. Extra scrutiny: it modifies production auth code.

- **PR:** #25 — "feat(security): centralize + test the route-loop auth/ownership decision"
- **Head SHA:** `a30a850`; **base:** `501b770`. 8 files, +345/−56.
- **CI on head:** "Typecheck & server tests" + "Cloudflare Pages" → success.
- **Merged:** as merge commit `089825b` after this PASS.

## Behavior preservation (critical — production auth)
The auditor compared the old inline logic vs the new `evaluateOwnership` + call
sites line-by-line and proved the decision is **identical** for every case:
- `authRequired && !auth` → 401 (same message);
- `auth && ownerId && ownerId !== auth.playerId` → 403 (same message);
- `authRequired === false && !auth` → allowed (escape hatch preserved);
- auth present, ownerId absent/matching → allowed.
`assertPlayerOwnership`'s post-verdict existence/`isAI` checks unchanged. The one
ordering delta (middleware sets `req.auth` after the 403 check instead of before)
is **unobservable** — a 403 sends the response and never calls `next()`, so the
handler never reads `req.auth`. Error strings byte-match the originals.

## Claims (all ✅)
- Diff = exactly 8 files (routeOwnership.ts + spec, routes.ts, #24 audit,
  security-pass report, baton, session note, README). No client/schema/config/
  lockfile/package.json change.
- 7 new tests import real code (`evaluateOwnership`, `createPaymentReplayGuard`,
  `mineActionSchema`) and cover happy / missing-auth / invalid-auth / replay /
  malformed / safe-error. No secrets. #24 audit doc consistent.

## Tests (auditor, matching CI, at `a30a850`)
- `check` → tsc **0**; `test:server` → **217/217** (210 prior all green =
  behavior-preservation evidence); `test` → **45/45**; lockfile unchanged.
- Root `pnpm run typecheck` fails ONLY in `artifacts/mockup-sandbox` (pre-existing).

## Mutation check (non-vacuous proof)
Inverting the 403 condition (`!==` → `===`) in `routeOwnership.ts` dropped server
tests to 214/217 (tests #1/#3/#6 caught it); cleanly reverted.

## Findings
No scope creep, over-claim, secrets, or vacuous tests. The security-pass report
honestly flags pre-existing out-of-scope items.

**Gate action:** PASS → PR #25 merged (`089825b`). Next unit started on
`feat/actions-idempotency-nonce` off the new `main`.
