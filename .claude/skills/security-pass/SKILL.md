---
name: security-pass
description: Focused, surgical security review of the current change or a named surface — NO broad refactors. Walks a fixed checklist against the FRONTIER-AL server/client/chain code: auth boundaries, wallet/signature verification, API input validation (zod schemas), rate limits, secrets handling, CORS + security headers, transaction/finality assumptions, replay/idempotency guards, admin endpoints, logs leaking secrets, and dependency risk. For every issue it FIXES, it must add or extend a test that fails before and passes after (no fix without a test). All findings — fixed and accepted-risk — are documented in the app audit trail at artifacts/frontier-al/docs/audit/ (a dated report). Fail-closed bias: when a check is ambiguous, flag it rather than wave it through. Keeps changes minimal and centralized (server/security.ts, server/auth.ts, server/rateLimitStore.ts) rather than scattering logic.
---

# /security-pass — surgical security review (fix + test + document)

A focused security review that does **not** refactor broadly. It walks a fixed
checklist, fixes what it can prove with a test, and records every finding. The
bias is **fail-closed**: an ambiguous check is a finding, not a pass.

## When to use
- A change touches auth, wallets/signatures, payments, admin routes, input
  handling, headers/CORS, or secrets.
- Before promoting a funds-or-auth surface toward mainnet (pairs with
  [`/mainnet-gate`](../mainnet-gate/SKILL.md)).

## Scope discipline (read first)
- **No broad refactors.** Touch only what a finding requires.
- **Centralize**, don't scatter: auth in `server/auth.ts`, security helpers in
  `server/security.ts`, limits in `server/rateLimitStore.ts`.
- **No fix without a test.** Every fix adds/extends a test (unit, or a small
  `tsx` HTTP/WS integration test that mounts the real handler and asserts status
  codes — the suite is single-process).
- **Never weaken** an existing control to make a test pass.

## The checklist (each → ✅ ok / ⚠️ finding / ❌ vuln, with file:line)

1. **Auth boundaries** — every mutating route is behind session auth or
   `requireAdminKey`; `assertPlayerOwnership` is applied where a caller acts on a
   player/resource. Note where `WALLET_AUTH_REQUIRED=false` changes posture.
2. **Wallet / signature verification** — signatures actually verified server-side;
   no trust of client-supplied `playerId`/address without a bound session.
3. **API input validation** — every body parsed by a zod schema; reject extra/
   malformed fields; numeric bounds enforced.
4. **Rate limits** — mutating/expensive endpoints (esp. `/api/actions/*`, mint/
   prepare) have a limiter; none is a finding (mint-on-prepare DoS).
5. **Secrets handling** — no secrets in code, logs, or the repo; only via env;
   documented in `ENV_VARS.md` / `docs/DEPLOYMENT_ENV_CHECKLIST.md`.
6. **CORS + headers** — allowlist origins (no `*` with credentials); security
   headers (HSTS, X-Content-Type-Options, frame options) present in prod.
7. **Transaction / finality assumptions** — payment verification confirms real
   on-chain finality (algod cross-check, not indexer-only); correct
   sender/receiver/amount; rejects close-remainder / rekey riders.
8. **Replay / idempotency** — paid actions are guarded against replay
   (`redeemedPayments`) and mints are idempotent; the guard fails closed.
9. **Admin endpoints** — every admin/ops route is gated; constant-time key
   compare; no query-param key in prod.
10. **Logs leaking secrets** — no mnemonics, keys, tokens, or full addresses in
    logs/errors returned to clients.
11. **Dependency risk** — no obviously-risky/abandoned deps added; lockfile
    intact; run a secret scan over the diff.

## For anything Algorand-economic (funds, ASA, transfers)
Invoke the **`algo-auditor`** gate as well — `/security-pass` is not a substitute
for the funds-economic audit. Nothing funds-moving ships without that pass.

## Output + documentation
- Print a checklist table (item → verdict → file:line → fix/accepted-risk).
- Write a dated report to **`artifacts/frontier-al/docs/audit/`** (the app's
  security audit trail — alongside `2026-06-07-api-access-control-audit.md`,
  `chain-services-audit.md`), listing findings, fixes (with the test that backs
  each), and any accepted risks with rationale.
- Update `ENV_VARS.md` / `docs/DEPLOYMENT_ENV_CHECKLIST.md` if a finding adds or
  changes a secret/env.

## Invariants
- No fix lands without a test that backs it.
- No broad refactor; minimal, centralized changes only.
- Findings are documented, not just mentioned. Ambiguous = flagged, not passed.
