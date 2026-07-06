# 2026-07-06 — Battle-map visuals + dataviz research → draft plan

**Branch:** `claude/session-failure-review-rwsbol` (restarted from main after #194
merged) · **Unit:** owner /goal — research three battle-engine map/cinematic
features + a dataviz pass, deliver a detailed draft plan on a branch. **Docs-only.**

## What happened

1. Merged **#194** (retroactive audit of #193 + baton repair) on green CI — owner's
   /goal lifted the hold; docs-only, self-contained.
2. Deployed two parallel research agents:
   - **Battle/cinematic architecture** — mapped the full cinematic spine
     (`battle-sequence.ts` 10-beat timeline, `battleSequencePlayback.ts` pure
     channels, `cinematicBus` pub/sub, 10 globe layers), inventoried server data
     not yet on the map, proposed 6 candidates.
   - **Economic surfaces** — inventoried every token/economics surface, found
     factually wrong + fabricated data on live pages, inventoried chartable
     endpoints, proposed 7 chart candidates.
3. Synthesized
   [`docs/BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md`](../docs/BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md):
   - **Three selected battle features** (before/during/after arc): B1 War Council
     Muster · B2 Shield Wall · B3 Battle Scars. All real-data, zero server change,
     additive layers following the pure-module + thin-renderer pattern.
   - **Dataviz units:** D1 truth pass (🔴 landing claims 10B supply, real ASA is
     1B; tokenomics page ships a synthetic sine-wave "trend" chart; frozen 4,218
     ticker) → D2 faction-control + battle-pulse charts (existing endpoints,
     recharts already in bundle) → D3 economics snapshot table + real supply-flow
     history. Chart specs follow the dataviz skill (form-by-job, validated
     palettes, hover layer, one axis, dark mode).

## Key research facts worth remembering

- `cinematicBus` is the sanctioned extension point — new FX layers subscribe
  without touching `GlobeBattleSequence.tsx` (HARD-RULE-gated).
- Attacker-side pending battles have NO visual today; `Battle` rows already carry
  `sourceParcelId`/`troopsCommitted` client-side.
- `battle:resolved` broadcast omits pillage (spoils convoy runner-up needs 3 fields
  added, values already computed at routes.ts:3028-3040).
- **No economics time-series exists anywhere** — any honest history chart needs the
  D3 snapshot table; treasury fees are the one backfillable series
  (`treasury_ledger.createdAt`).
- recharts ^2.15.2 + `ui/chart.tsx` wrapper already in the bundle.

## Verification

Docs-only. tsc + suites were green at `c0850c0` this session (re-run during the
#193 audit); no code touched since.

## For the next session

Audit + merge the plan PR, then start **Unit D1** (truth pass). Execution order and
full unit specs are in the plan doc.
