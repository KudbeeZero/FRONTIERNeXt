# Audit — `claude/transactions-plane-game-status-vu6xqr` (PR #18)

**Verdict:** PASS

> Independent audit performed by chat `claude/handoff-audit-t5ci91` (2026-06-13).
> This replaces the self-audit that the previous chat committed inside PR #18 —
> the protocol requires the audit to be independent and done by the *next* chat,
> not by the chat that authored the PR. A fresh adversarial auditor subagent
> re-derived the verdict from the diff + tests and reached the **same PASS**,
> corroborating the in-PR self-audit.

- **PR:** #18 — "fix(security): harden transaction surface — gate orbital ops,
  reject payment riders, session-bind commander retry"
- **Branch:** `claude/transactions-plane-game-status-vu6xqr`
- **Merged commit on `main`:** `c292138` (squash), parent `bfea649` (PR #17).
- **Head SHA (PR):** `4e396c9`.
- **Merge status:** **already merged by the owner** (`KudbeeZero`) at
  2026-06-13T21:27:38Z — same waived-by-owner pattern the baton notes for #17
  and #15. This audit confirms what is already on `main` is sound; there is no
  pending merge left to gate.
- **CI on head:** "Typecheck & server tests" → **success**, "Cloudflare Pages" →
  **success** (no `[skip ci]` on the head commit).

## Claims vs. evidence

Audited `git diff bfea649 c292138` in full (single squashed commit, 7 files,
+176/−56).

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | `verifyAlgoPayment` rejects close-remainder/rekey riders, dual-shape, fail-closed, +5 tests | ✅ verified | `commander.ts:249-257` — rider check runs **unconditionally before** the sender/receiver/amount accept checks and the `return`. Dual-shape: `payFields["close-remainder-to"] ?? payFields.closeRemainderTo`, `["close-amount"] ?? .closeAmount`, `txn["rekey-to"] ?? txn.rekeyTo`. 5 new tests in `commander.spec.ts:144-190` (3 kebab, 2 camelCase), all green. Pure tightening: only adds `throw` paths, never widens acceptance. |
| 2 | `/api/orbital/trigger` + `/resolve/:id` gated behind `requireAdminKey`; no legitimate caller | ✅ verified | `routes.ts:2571` and `:2586` — `if (!requireAdminKey(req, res)) return;` is the first line of each handler. Grep of client/server/ops finds **zero** HTTP callers. The live orbital loop (`routes.ts:2717-2719`) calls `storage.triggerOrbitalCheck()` directly via `setInterval`, bypassing the HTTP route — gating breaks nothing. |
| 3 | retry-commander session-bound via `assertPlayerOwnership` | ✅ verified | `routes.ts:993-998` — drops trust of body `playerId`, calls `assertPlayerOwnership(req,res)`, returns early on null. |
| 4 | client retry switched raw `fetch` → `apiRequest` (sends Bearer + credentials) | ✅ verified | `GameLayout.tsx:409` — `apiRequest("POST", \`/api/nft/retry-commander/${commanderId}\`, { playerId: player.id })`; import added at L32. |
| 5 | `useMintAvatar` optimistic update fixed (`frontier`→`ascend`, real per-tier cost) | ✅ verified | `useGameState.ts:169` writes `ascend: Math.max(0, (p.ascend ?? 0) - (COMMANDER_INFO[action.tier]?.mintCostAscend ?? 0))`. `COMMANDER_INFO.mintCostAscend` confirmed real at `schema.ts:598,608,618,628`; import added L4. |
| 6 | Green: tsc 0, server 202/202 (+5), client 31/31, build clean | ✅ verified | Re-run below. |

## Tests run (independent auditor, matching CI, after `CI=true pnpm install --frozen-lockfile`)

- `pnpm --filter @workspace/frontier-al run check` → tsc, **0 errors**, exit 0
- `pnpm --filter @workspace/frontier-al run test:server` → **202 passed (27 files)**, exit 0
- `pnpm --filter @workspace/frontier-al run test` → **31 passed (4 files)**, exit 0
- Build not independently re-run (tsc passes; CI "Cloudflare Pages" + "Typecheck
  & server tests" both green on the head commit).

## Scope creep

**None.** The code commit touches exactly the 5 claimed files. `docs/HANDOFF.md`
(the baton) and `docs/audits/…md` (the in-PR audit doc) are protocol artifacts,
not code. No unrelated hunks.

## Untested assertions

The PR's self-description of its test coverage is **accurate and not
over-claimed**:
- Rider rejection is unit-tested against **mocked indexer responses only**, not
  a live testnet txn carrying a real rider.
- Orbital gating and retry session-binding are verified by **reading the wired
  middleware + a caller grep**, not by HTTP integration tests.

## Security

- **`requireAdminKey` fails CLOSED in prod** (`security.ts:55-77`): no `ADMIN_KEY`
  configured → 503 in production (dev returns true for convenience only);
  constant-time `safeEqual`; query-param fallback disabled in prod. Sound. **No
  severity.**
- **Rider check fails closed** — runs before all accept logic; truthy
  `closeRemainderTo`/`rekeyTo` or `closeAmount > 0` rejects. Accept-path tests
  confirm absent fields (`undefined`) do not trip it. **No severity.**
- **LOW (pre-existing, not introduced here) — `assertPlayerOwnership` only
  session-binds when wallet auth is ON.** `auth.ts:43`: `isWalletAuthRequired()`
  is false only when `WALLET_AUTH_REQUIRED === "false"`. With that escape-hatch
  flag set, `assertPlayerOwnership` falls back to trusting `req.body.playerId`
  (`routes.ts:247,253`), so retry-commander reverts to guess-a-pair behavior.
  This is a repo-wide auth posture (the same helper guards ~15 endpoints),
  defaults to secure, and is **out of this PR's scope** — noted, not blocking.

## What I could NOT verify

- Live testnet behavior, real wallet signing, actual on-chain finality.
- Orbital gating / retry binding under a real HTTP round-trip (verified by code
  reading only).
- Build artifact not independently produced.
- Low-severity truthy-edge: if algosdk v3's *indexer* model ever returned a
  zero-`Address` object (rather than `undefined`) for an absent
  `rekeyTo`/`closeRemainderTo`, a legitimate payment could be falsely rejected.
  The indexer omits unset fields (accept-path tests confirm `undefined` → not
  rejected), so it does not arise on the actual code path — future hardening,
  not a blocker.

## Final verdict

**PASS** — all six claims hold with `file:line` evidence, all suites green
(tsc 0 / server 202/202 / client 31/31), zero scope creep, and every change is a
fail-closed net hardening of the funds/auth surface. The only caveat (auth
fallback when `WALLET_AUTH_REQUIRED=false`) is pre-existing and out of scope.
Already merged to `main` by the owner; this audit confirms `main` is sound.
