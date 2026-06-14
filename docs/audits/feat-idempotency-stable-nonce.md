# Audit — PR #29 `feat/idempotency-stable-nonce` (stable nonce, ID-003+001+002)

**Verdict: PASS** (independent, retroactive — #29 had merged with green CI but no
recorded `/handoff-audit`; this backfills the gate). Two minor cosmetic nits, no
defect.

## PR / branch / commit
- **PR:** [#29](https://github.com/KudbeeZero/FRONTIERNeXt/pull/29) — two-phase
  idempotency (claim → record/release → 200 replay), folding in ID-001 (`safeUuid`)
  + ID-002 (escaped target).
- **Branch:** `feat/idempotency-stable-nonce` · **base** `ea78a77` · **head**
  `26ddac4` (code `ec4e814`) · merged to `main`.
- **Method:** two independent auditor subagents — one correctness/tests (isolated
  worktree, full suite re-run), one read-only funds/security replay lens.

## Claims vs evidence (correctness auditor — all ✅)
| Claim | Evidence |
|---|---|
| Two-phase store (`claim/complete/remove`) + guard `claim/record/release`; storeless Map; fail-closed | `idempotencyGuard.ts:43-52,58-60,88-165` |
| Fresh→run/record; completed dup→200 replay; in-flight→409; bad nonce→400; store err→503 | `guardClaimOrRespond` `routes.ts:148-167` (replay `res.json(JSON.parse(idem.response))` :162); rejection map :135-146; spec cases 1,2,3,5,6,7 |
| Failed mutation→release; claim-frontier no-credit paths (404, wallet_not_opted_in) release | `routes.ts:2006-2008,1963,1981`; spec case 4 |
| ID-002 `${encodeURIComponent(parcelId)}:${type}`; ID-001 safeUuid never throws, matches charset | `routes.ts:1632,1707`; `safeUuid.ts:9-30` + `safeUuid.spec.ts` |
| GameLayout one nonce/action via `.mutate()`; useClaimAscend uses safeUuid | `GameLayout.tsx:295,337`; `useGameState.ts:87,116,159` |
| Migration 0007 (response_json + completed_at), staged | `migrations/0007_*.sql:19-20`; no boot runner |
| +27 tests; server 236→240, client 45→49 | counts confirmed |

## Tests (re-run by the auditor)
`check` → tsc 0; `test:server` → **240 passed (30 files)**; `test` → **49 passed
(8 files)**; `pnpm install --frozen-lockfile` clean (no new deps). Matches claims.

## Security / funds (read-only auditor — PASS)
- **No funds-math change** — claim-frontier enqueue args, build `fireBurn(cost)`,
  storage math all identical (`routes.ts:1991-1998,1707-1714`). **`algo-auditor`
  not warranted.**
- **No re-credit/re-burn/re-enqueue on replay** — replay returns before the
  mutation; `record` only on success (`routes.ts:165-168,1631,1701,1953`).
- **Cross-player isolation** — key `${action}:${playerId}[:${target}]:${nonce}`,
  playerId = auth-verified session player (global mutation middleware
  `routes.ts:463-481` + `routeOwnership.ts:39-41`). No cross-player replay leak.
- **In-flight race** — atomic `INSERT…ON CONFLICT DO NOTHING RETURNING`; loser
  gets `in_progress`→409. No TOCTOU double-mutate.
- **Stored response** — only server-generated bodies, no secrets; `JSON.parse`
  only parses prior server output.

## Findings
- **LOW (now resolved by ID-004):** `idempotencyGuard.ts` comment referenced an
  "ID-004 prune" that didn't exist → unbounded `action_nonces` growth + permanent
  409 on crash-orphaned rows. This is exactly what `chore/action-nonces-ttl`
  (this chat's unit) implements; the comment is corrected there.
- **INFO (pre-existing):** auth-off (`WALLET_AUTH_REQUIRED=false`) client-trusts
  `playerId` — documented posture, defer to `/mainnet-gate`. Not introduced by #29.
- **Cosmetic:** `shared/schema.ts` listed as changed but unmodified
  (`idempotencyKey` pre-existed in #28); a claim-frontier zero-amount claim is
  still recorded/replayed (idempotent, harmless) though a comment over-narrows.

## Could not verify
Live Postgres `INSERT…ON CONFLICT` + `response_json` round-trip and true
cross-instance race (no live DB); on-chain ASCEND de-dup beyond the DB credit
(the transfer queue is fire-and-forget by existing design).
