# Audit/Review — 2026-06-11 merge flatten (`fe7d4f8..24c4184`)

**Scope reviewed:** everything merged to `main` this session — PR #11 (admin-account
boot failfast), PR #7 (tutorial removal + `VITE_TEST_GLOBE`), PR #12 (Bomb Squad:
NFT delivery hijack, payment replay, battle concurrency + FRNTR→ASCEND display
rename), PR #8 (Session Relay Protocol). PRs #10 and #6 were closed as superseded.

**Method:** 7 independent finder angles (line-by-line, removed-behavior,
cross-file tracer, reuse, simplification, efficiency, altitude) → 29 candidates →
dedup → 13 verified individually → **9 survived** (4 refuted with evidence:
outer-catch release gap, conditional-claim mismatch, unbounded mem-Set,
FORCE_NEW_FRONTIER_ASA alias — each provably handled or intentional).

**Verification state of the merged tree (`24c4184`):** server suite **194/194
green**, client suite **31/31 green**, production build **green**,
`pnpm run check` (client tsc) **RED — 255 errors, pre-existing on `main` before
the merges** (identical count before/after; `@types/react` 18/19 workspace split).

## Findings (severity order)

1. **[security] Ungated endpoints remain** — `POST /api/orbital/trigger`
   (`routes.ts:2566`) and `POST /api/orbital/resolve/:id` (`routes.ts:2580`) are
   fully public; `POST /api/nft/retry-commander/:commanderId` (`routes.ts:991`)
   is not session-bound (caller supplies any `playerId`). Same device class
   PR #12 fixed on the two delivery routes; matches PR #12's own "still armed"
   list. `/api/weapons/mint-nft` was checked and IS session-gated.
2. **[bug] Incomplete rename in optimistic update** —
   `client/src/hooks/useGameState.ts:166` sets phantom key
   `frontier:` instead of `ascend:`; the mint-avatar optimistic balance
   decrement is a no-op until the server refetch. One-line fix.
3. **[ops] No boot-time check for `redeemed_payments`** — the replay guard
   (`routes.ts:78`) depends on staged migration `0005` which is not auto-applied;
   a deploy that skips it boots green and then fails every paid purchase
   (fail-closed, but invisible at startup). Add a boot existence check or apply
   the migration in the deploy runbook.
4. **[robustness] `release()` swallows store failures** (`security.ts:~229`) —
   a transient DB error during claim release permanently consumes the buyer's
   txid; manual admin row-delete is the only recovery. Fail-closed by design,
   but there is no retry/compensation path.
5. **[perf] Commander owner lookup is an unindexed JSONB containment scan**
   (`routes.ts:1091`) — O(players) per delivery request; add a GIN index on
   `players.commanders` or normalize.
6. **[cleanup] Replay-guard wiring duplicated** at `routes.ts:1660` and `:1945`
   — extract `withClaimedPayment(txId, purpose, refId, fn)`.
7. **[cleanup] Optimistic-claim WHERE patterns ×3 with no shared helper**
   (`storage/db.ts:1137`, `:1311`, `:1693`) — next parcel-mutating method can
   silently reintroduce the race.
8. **[cleanup] Delivery-gate wrapper duplicated** (`routes.ts:787–803` vs
   `:1084–1096`) — gate changes must be patched twice.
9. **[docs] FRNTR↔ASCEND naming boundary** is documented only in
   `night-reports/ASCEND-RENAME-MAP-2026-06-10.md`, not at the code boundary —
   add a short comment at `db-schema.ts` column mappings and the on-chain note
   protocol so nobody "fixes" the wire format.
