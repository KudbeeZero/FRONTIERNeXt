# Audit — PR #60 · loot-box open flow + mining award trigger

**Verdict: PASS** (two non-blocking concerns — coverage-honesty, not defects)

- **PR:** #60 — `feat(loot-box): finish open flow + mining award trigger`
- **Branch:** `claude/game-feature-scan-bnk4ie`
- **Head SHA:** `b06c6c7d3012e19552e7e2cb86f67cfce3827bf0`
- **Base / merge-base:** `main` @ `9e53108` (branched *before* #61 merged)
- **Audited by:** independent auditor subagent (adversarial, worktree-isolated), tested
  on the **post-merge tree** — `origin/main` @ `8dc7a72` (which includes the merged #61
  coverage gate) merged into the #60 branch. Only conflict was `docs/HANDOFF.md`
  (resolved as a union preserving both batons); no other conflicts.

## Claims vs. evidence

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Pure deterministic roll; total weight DERIVED; reuses `mulberry32`/`hashSeed`; open seed `hashSeed(lootBoxId, playerId)` → idempotent | ✅ (loose wording) | `server/engine/lootbox/open.ts:31` (`totalWeight = table.reduce(...)`, not hardcoded), `:33-41` weighted pick. `open.ts` imports `mulberry32` (`:17`); `hashSeed` is used by the *callers* (`db.ts:819`, `mem.ts` open) — "reusing mulberry32/hashSeed" is loose but functionally true. Determinism test `open.spec.ts:13-21`. |
| 2 | Storage: cap on unopened; double-open safe via conditional UPDATE rowCount; vault `LEAST(...,CAP)`; player-scoped lookup = ownership | ✅ | `db.ts:782-839`. Cap counts unopened via `isNull(openedAt)`, returns null at cap (`:788-792`). Race guard: `.for("update")` lock (`:809`) + conditional `UPDATE ... WHERE id=? AND opened_at IS NULL`, bails on `rowCount===0` (`:824-829`). Vault `LEAST(...,RARE_MINERAL_VAULT_CAP)` (`:834`). Ownership `WHERE id=? AND playerId=?` (`:806`). Mem mirror `mem.ts:399-440`. |
| 3 | Hydration fix (`game-rules.ts` was hardcoded `lootBoxes: []`) | ✅ | `game-rules.ts:163` now `lootBoxes,`; hydrated in `getPlayer`/`getOrCreatePlayerByAddress` via `rowToLootBox` (`db.ts:643,427`). |
| 4 | Mining trigger (3%→common) in BOTH backends; ONLY trigger wired | ✅ | `db.ts:749` + `mem.ts:392`, both `rollLootBoxAward("mine_action", ...)`. `LOOT_BOX_DROP_CHANCE.mine_action = 0.03` (`schema.ts:71`). No `battle_victory`/`orbital_impact` call sites — deferral honest. |
| 5 | Route mirrors upgrade template; matches `MUTATION_PATH_RE`; ownership mw verifies playerId; idempotency on lootBoxId; not_found→404, already_opened→409 | ✅ | `routes.ts:1685-1714`. Path matches `MUTATION_PATH_RE` (`:500`); global mw runs `evaluateOwnership` over body `playerId` (`:507-517`); `guardClaimOrRespond` claim/replay (`:191-207`); status map (`:1700`). |
| 6 | Migration 0010 additive `IF NOT EXISTS`; matches db-schema | ✅ | `migrations/0010_loot_box_inventory.sql` — `CREATE TABLE IF NOT EXISTS`, 2 indexes, 4 `ADD COLUMN IF NOT EXISTS *_vault`. Matches `db-schema.ts:588-601` (table) + `:233-236` (vault cols). |
| 7 | Client hook + InventoryPanel per-box Open (disabled while opening); toast; GameLayout wiring; 2 SSR mocks | ✅ | `useGameState.ts:79-94` (`useOpenLootBox`); `InventoryPanel.tsx:265-301` (`disabled={opening||!!openingLootBoxId||!onOpenLootBox}`); `GameLayout.tsx:298-325` toast; mocks in both `gamelayout-*.spec.tsx`. |
| 8 | check ✓, root typecheck ✓, test:server 279 (+13), test 57, build ✓ | ✅ | Reproduced — see Tests below. |
| 9 | Fully additive; NO combat/orbital/canvas/funds/chain touched | ✅ | 17 files, all loot-box/docs/notes. Grep for `algosdk|mnemonic|sendRawTransaction|transfer|asaId` → **0 hits**. |

## Tests (reproduced on the post-merge tree, exact output)

```
pnpm install --frozen-lockfile        → OK (949 pkgs; coverage-v8 from #61 present)
frontier-al check (tsc)               → clean
frontier-al test:server               → 35 files, 279 passed (279)   [matches +13]
frontier-al coverage:server           → PASS — Lines 93.12% / Branches 77.9% /
                                          Stmts 91.4% / Funcs 90.27% (thresholds 80/70/80/80)
frontier-al test (client)             → 10 files, 57 passed (57)
frontier-al build                     → ✓ (client + dist/index.cjs; pre-existing chunk-size warns only)
root typecheck                        → green (mockup-sandbox excluded)
```

**#61 coverage gate unaffected:** `vitest.server.config.ts:35-42` `include` = `shared/weapons/**`,
`shared/university/**`, `shared/economy-config.ts`, `shared/weapon-economy.ts`,
`server/engine/{battle,markets}/resolve.ts`. `server/engine/lootbox/**` is **absent**, so
the loot-box code does not enter the coverage report; numbers are identical to #61's baseline.

## Scope creep
**None.** All 17 changed files are loot-box scope plus docs (`HANDOFF.md`, session note). No
globe/combat/canvas/orbital render code; no chain/funds/ASA code. `db-schema.ts` is **not** in
the diff (table/vault defs pre-existed; 0010 backfills them) — consistent with the PR claim.

## Security
- **Route authorization:** ✅ No regression. Covered by the global mutation middleware
  (path matches `MUTATION_PATH_RE`), same posture as existing mutation routes. (Dev-mode
  `isWalletAuthRequired()===false` skips ownership — pre-existing repo-wide posture, not introduced here.)
- **Data-layer ownership:** ✅ Both backends scope by `playerId`; opening another player's box →
  `not_found` (tested for Mem, `lootbox.storage.spec.ts:74-81`).
- **Double-open race:** ✅ Db path uses `SELECT ... FOR UPDATE` + conditional `UPDATE ... WHERE opened_at IS NULL` on `rowCount`; vault credited at most once.
- **Vault cap bypass:** ✅ `LEAST(col + amount, RARE_MINERAL_VAULT_CAP)` server-side.
- **SQL injection:** ✅ None. `db.ts:833` uses `sql.raw(col)`, but `col` comes from a fixed
  literal keyed by `MINERAL_TO_VAULT_FIELD[reward.mineral]`, and `reward.mineral` originates
  from hardcoded drop tables — **no user input reaches `sql.raw`**.
- **Input validation:** ✅ `openLootBoxActionSchema` (zod) at route entry; `ZodError`→400.
- **Idempotency replay:** ✅ keyed on `lootBoxId` via `guardClaimOrRespond`; release-on-failure prevents permanent lock.

No CRITICAL/HIGH/MED/LOW security issues introduced.

## Concerns (non-blocking)
1. **DbStorage SQL path is NOT covered by automated tests.** All 6 storage tests use
   **MemStorage only** (`lootbox.storage.spec.ts:8`). The Db-specific guards — `FOR UPDATE`
   lock, conditional-UPDATE `rowCount` double-open guard, SQL `LEAST(...)` cap, in-transaction
   cap count — are **unverified by any test** (need Postgres). Mem re-implements the same
   *behavior* in JS, so logic is exercised, but the SQL is not. The "double-open safe / vault-capped"
   claims for the DB path are **by-construction, not test-backed**. Follow-up: a Postgres integration test.
2. **Migration 0010 must be applied before any deploy** that uses DbStorage. It is a STAGED
   migration (not run at boot); DbStorage reads/writes `loot_box_inventory` after `initialize()`.
   Extends the existing "migrations 0000–0008 must be applied" rule to 0010 (0009 chain_events also pending).

## What I could NOT verify
- **DB-integration runtime** (Postgres `FOR UPDATE` concurrency, conditional UPDATE under contention,
  `LEAST` clamp): no Postgres in the audit environment — covered only indirectly by the Mem backend.
- **On-chain / funds:** N/A — no chain code in this PR (verified absent).
- **Live UI behavior** (toast, button-disable): not browser-verified; only SSR mocks + client unit suite.

## Gate action
**PASS → merge.** Resolve the `docs/HANDOFF.md` baton conflict as a union (preserve both #61's
merged coverage-gate status and #60's loot-box status), confirm gates green on the resolved tree,
then squash-merge #60 into `main`. Carry both concerns forward in the baton's open-risks list.
