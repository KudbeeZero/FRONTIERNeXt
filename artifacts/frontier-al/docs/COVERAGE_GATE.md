# Coverage gate — deterministic game-math core

> **TL;DR:** CI fails if the **deterministic game-math core** drops below **80% line
> coverage**. This is a quantitative gate on the pure logic that matters — it is **not**
> a claim that the whole package is 80% covered (whole `server/shared` is ~22%, reported
> informationally only).

## What is gated

`vitest.server.config.ts` → `test.coverage` with `provider: "v8"`. The gate's `include`
is a curated set of pure, deterministic game-math modules — the logic the server unit
suite actually exercises:

- `shared/weapons/**` — weapon attributes, ballistics, intercept, scale, unlocks, catalog
- `shared/university/**` — grading
- `shared/economy-config.ts` — economy math
- `shared/weapon-economy.ts` — weapon pricing/economy
- `server/engine/battle/resolve.ts` — battle resolution
- `server/engine/battle/replayLog.ts` — battle replay log construction (2026-07-06: had a spec,
  wasn't gated)
- `server/engine/battle/verify.ts` — battle proof/audit hash (2026-07-06: had a spec, wasn't gated)
- `server/engine/battle/tuning.ts` — balance constants (2026-07-06: had a spec, wasn't gated)
- `server/engine/battle/random.ts` — seeded RNG (2026-07-06: had a spec, wasn't gated)
- `server/engine/markets/resolve.ts` — market resolution

**Thresholds:** `lines 80 / statements 80 / functions 80 / branches 70`.
**Current (measured):** lines **94%**, statements 92%, functions 91%, branches 80% — all clear.

Run locally:

```bash
pnpm --filter @workspace/frontier-al run coverage:server
```

CI runs this as the **"Coverage gate (deterministic game-math core ≥ 80%)"** step in
`.github/workflows/ci.yml`, between `test:server` and the client `test`.

## What is NOT gated — and why (honest exclusions)

Whole `server/**` + `shared/**` line coverage is only **~22%**. The bulk of the server
is integration / I/O-heavy and cannot be unit-covered without a live DB or testnet
wallet — these are the **"blocked" rows** in the `/test-matrix` framework:

- `server/storage/**` — DB layer (incl. the ~3.3k-line `db.ts`), seeders, AI engine
- `server/services/**` — Redis, price-oracle, Algorand chain client (network)
- `server/routes.ts`, `server/index.ts` — HTTP/WS wiring
- `server/engine/season`, `server/engine/narrative` — stateful managers / flavor
- `server/veritas/**`, `server/engine/battle/{sim,smoke}.ts` — dev/grind tooling
- **`server/engine/ai/reconquest.ts`** — AI faction reconquest/attack logic. **Honest gap, not an
  oversight**: as of 2026-07-06 this file has **no spec file at all** (0% coverage, confirmed by
  temporarily adding it to the gate's `include` and observing `reconquest.ts | 0 | 0 | 0 | 0`).
  It was left out of this gate rather than added, because a 0%-covered module diluted into a
  multi-file global-aggregate gate would still show "80%+ — passing" while hiding a completely
  untested AI attack path. Needs its own test-writing unit before it's safe to gate.

These are deliberately **out of the gate, not number-gamed out of it.** Excluding them
keeps the gate honest: it protects deterministic logic at a real 80%+ rather than
diluting to a meaningless whole-package percentage.

For the whole-package figure (informational, **never** gated):

```bash
pnpm --filter @workspace/frontier-al run coverage:server:full   # ~22% lines
```

## Relationship to /test-matrix

- `/test-matrix` = **qualitative** grid (covered / partial / missing / blocked) across
  all load-bearing surfaces, with evidence. Good for "where are the gaps?"
- This gate = **quantitative** floor on the deterministic math core. Good for "did a
  change quietly erode coverage of the logic that matters?"

They are complementary; this gate does not replace the matrix.

## Scope notes / future work

- **Client coverage is not gated** (UI-heavy; far below 80%). A client ratchet is
  possible future work, separate from this gate.
- **Raising whole `server/shared` toward 80%** would require a large DB/storage/service
  test backfill — explicitly a **separate future PR**, not part of this unit.
- If you add a new deterministic game-math module, consider adding it to the gate's
  `include` so it's protected too.
