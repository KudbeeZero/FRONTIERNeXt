# Audit — `claude/transactions-plane-game-status-vu6xqr` (PR #18)

**Verdict:** PASS *(auditor returned CONCERNS; the sole blocking concern was
independently refuted as a stale-local-`main`-ref artifact — see below).*

- **PR:** #18 — security hardening of the transactions surface
- **Branch:** `claude/transactions-plane-game-status-vu6xqr`
- **Head SHA:** `4f7880d` (baton commit; code in `1297104`)
- **Base:** `origin/main` = `bfea649` (PR #17)
- **CI on head:** run #63 on `4f7880d` → **success** (no `[skip ci]`).

## Claims vs. evidence

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | `verifyAlgoPayment` rejects close-remainder/rekey riders, fail-closed, dual-shape, +5 tests | ✅ | `commander.ts:244-257` — rider check runs unconditionally, **before** the sender/receiver/amount accept checks and the `return`. Dual-shape (`"close-remainder-to" ?? closeRemainderTo`, `"close-amount" ?? closeAmount`, `"rekey-to" ?? rekeyTo`). 5 new tests in `commander.spec.ts`, all green. |
| 2 | `/api/orbital/trigger` + `/resolve/:id` gated behind `requireAdminKey`; no legitimate caller | ✅ | `routes.ts:2570-2571`, `2585-2586` — `requireAdminKey` is first line of each. Grep of client/server/ops finds zero callers. The live orbital loop uses an internal `setInterval` calling `storage.triggerOrbitalCheck()` directly (`routes.ts:~2717`), bypassing the HTTP route — gating breaks nothing. |
| 3 | retry-commander session-bound via `assertPlayerOwnership`; client switched to `apiRequest` | ✅ | `routes.ts:993-997` drops body-`playerId` trust → `assertPlayerOwnership(req,res)`. `GameLayout.tsx:~409` now `apiRequest("POST", …)` (sends Bearer + credentials). Only one client caller existed; it was updated. |
| 4 | `useMintAvatar` optimistic update fixed (`frontier`→`ascend`, real per-tier cost) | ✅ | `useGameState.ts:167-169` now decrements `COMMANDER_INFO[action.tier]?.mintCostAscend` on `ascend`. Fields confirmed in `schema.ts:598,608,618,628,730`. |
| 5 | Green: tsc 0, server 202/202, client 31/31, build clean | ✅ | Auditor re-ran: `check` → 0 errors; `test:server` → 202/202; `test` → 31/31. CI run #63 green. |

## Tests run (auditor, matching CI)
- `pnpm --filter @workspace/frontier-al run check` → tsc, **0 errors**
- `pnpm --filter @workspace/frontier-al run test:server` → **202/202** (27 files)
- `pnpm --filter @workspace/frontier-al run test` → **31/31** (4 files)

## Scope creep
None. Commit `1297104` touches only the 5 claimed files (+81/−10). `HANDOFF.md`
is the baton (expected). Diff vs `origin/main` is 6 files, +123/−56.

## Refuted concern (was flagged MAJOR)
The auditor reported `main` "84 commits stale → merging dumps ~83 un-audited
commits." **False alarm:** it diffed against the **local** `main` ref
(`aca26ca`, PR #1, never updated locally). `origin/main` is `bfea649` (PR #17),
which is exactly PR #18's GitHub base. `git log origin/main..HEAD` = **2 commits**
(the security commit + baton). GitHub merges against the real base, landing only
this PR's changes. The protocol invariant is not violated.

## Security
The change is a net hardening of the funds/auth surface (rider rejection, admin
gating, session binding) — all fail-closed. No secrets. No funds-moving code
added (rider check only rejects). Does **not** require `algo-auditor` (no new
funds movement; the algod-first finality rewrite remains out of scope/queued).

## What I could NOT verify
- Live testnet behavior, real wallet signing, on-chain finality.
- **Low-severity untested edge:** the rider check is truthy-based. If algosdk v3's
  *indexer* model ever returned a zero-`Address` object (instead of `undefined`)
  for an absent `rekeyTo`/`closeRemainderTo`, a legitimate payment could be
  falsely rejected. The indexer omits unset fields (the passing accept-path tests
  confirm `undefined` → not rejected), so this does not arise on the actual code
  path — noted as a future hardening, not a blocker.
- Build artifact not independently produced (tsc passes; CI build green).
