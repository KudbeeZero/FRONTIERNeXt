---
name: test-matrix
description: Builds a visible testing-coverage matrix for FRONTIER-AL so coverage gaps are explicit instead of assumed. Rows are the load-bearing surfaces — server, client, blockchain/chain service, economy math, battle/AI loop, wallet flows, purchase flow, claim (ASCEND) flow, admin flow, and deployment env checks. Each row is marked covered / partial / missing / blocked, with the test file(s) or the reason as evidence. It is primarily a reporting skill (it writes/refreshes a matrix doc); it only ADDS missing tests when they are high-value AND inside the current unit's scope — it never expands scope to chase coverage, and never fakes a "covered" mark. Blocked rows (e.g. anything needing a live testnet wallet or Postgres) are called out as blocked, not silently dropped.
---

# /test-matrix — make test coverage visible

Turns "I think it's tested" into an explicit grid. Coverage gaps you can see are
gaps you can plan; gaps you assume away ship to mainnet. This skill reports the
matrix and, only within the current unit's scope, fills high-value holes.

## When to use
- During a unit, to see what the change does/doesn't cover.
- Before a release gate, alongside [`/mainnet-gate`](../mainnet-gate/SKILL.md).

## Rows (the surfaces that must be accounted for)

| Surface | What "covered" means | Where tests live (today) |
|---|---|---|
| Server | route/storage logic under vitest | `server/**/*.spec.ts` (`test:server`) |
| Client | components/hooks under vitest | `client` config (`test`) |
| Blockchain / chain service | payment verify, mint, transfer, riders | `server/services/chain/*.spec.ts` |
| Economy math | rates, costs, ASCEND accrual, burns | `shared` + `server/tests/economy-config.spec.ts` |
| Battle / AI loop | deterministic resolve, concurrency | `server/engine/battle/*.spec.ts`, `storage/battle-concurrency.spec.ts` |
| Wallet flows | session binding, signature, opt-in | `server/auth.spec.ts`, `veritas/wallet.spec.ts` |
| Purchase flow | land buy → ownership + replay guard | `storage/gameplay-loop.spec.ts` (storage), route layer = gap |
| Claim flow | ASCEND accrual + claim | `storage/gameplay-loop.spec.ts` |
| Admin flow | admin gating, ops endpoints | `security.spec.ts` (gating), HTTP = gap |
| Deployment env | required envs present/valid | `validate-env.js`, env checklist |

## Marks (use exactly these)
- **covered** — a test asserts the behavior; cite the file.
- **partial** — some paths tested, key paths not (say which).
- **missing** — no test; cite what a high-value test would assert.
- **blocked** — cannot be tested in this environment; cite why (e.g. needs a live
  testnet wallet + funded account + ASA, or Postgres `DATABASE_URL`). Never
  downgrade a blocked row to "covered."

## Procedure
1. Enumerate the rows; for each, grep the test dirs and mark it with evidence.
2. Run the suites to confirm the "covered" claims are real and green
   (`check` / `test:server` / `test`).
3. **Only if inside the current unit's scope**, add missing **high-value** tests
   (prefer the storage/unit layer; for wiring, a small `tsx` HTTP/WS integration
   test). Do not expand the unit's scope to chase coverage — list out-of-scope
   gaps as follow-ups instead.
4. Write/refresh the matrix doc (e.g. in `docs/` or the session note) so the grid
   is visible to the next chat.

## Invariants
- Never mark a row "covered" without a test that backs it (no faked status).
- Blocked stays blocked until the blocker (testnet/DB) is removed.
- Adding tests is scope-bounded — coverage work doesn't silently grow the unit.
