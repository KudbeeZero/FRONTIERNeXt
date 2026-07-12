# FRONTIER Background-Loop Cost Control

Reduces recurring Neon database usage from the production background loops
without disabling the AI war or breaking active combat.

## Root cause

The AI scheduler was running every 20 seconds (4,320 executions/day) and
each run performed an unfiltered `SELECT * FROM parcels` over the full
~21,000-row globe plus an unconditional `gameMeta` write. The battle
resolver was running every 5 seconds and piggy-backed two unconditional
parcel UPDATE statements for expired EMP / sabotage debuffs. Together
these loops dominated Neon compute and data-transfer usage despite being
mostly idle (no active battles, no AI actions).

## Loop inventory (before)

| Loop | Interval | Runs/day | Notes |
|---|---|---|---|
| AI scheduler (`runAITurn`) | 20 s | 4,320 | Full parcel scan + gameMeta write every run |
| Battle resolver (`resolveBattles`) | 5 s | 17,280 | Already idle-gated; piggy-backed 2 unconditional parcel UPDATEs |
| `battle_tick` broadcast | 1 s | 86,400 | Already idle-gated (no WS clients → 0 work) |
| Orbital scheduler | 5 min | 288 | Already idle-gated (random skip before any DB) |
| Plot NFT mint retry | 60 s | 1,440 | Already idle-gated (early-returns when queue empty) |
| ASCEND transfer retry | 30 s | 2,880 | Already idle-gated (early-returns when queue empty) |

## Loop inventory (after)

| Loop | Interval | Runs/day | Δ |
|---|---|---|---|
| AI scheduler | **120 s** (env `AI_TURN_INTERVAL_MS`, floor 30 s) | **720** | **−4,320 (−83.3 %)** |
| Battle resolver | 5 s (unchanged) | 17,280 | Debuff cleanup removed |
| `battle_tick` broadcast | 1 s (unchanged) | 86,400 | — |
| Debuff cleanup | **60 s** (env `DEBUFF_CLEANUP_INTERVAL_MS`, floor 10 s) | 1,440 | Moved out of resolver; **−15,840 UPDATE statements/day** |

## Exact changes

### 1. Configurable AI cadence — `server/routes.ts:3254`

The hardcoded `20000` in the AI `setInterval` is replaced with
`resolveAiTurnIntervalMs()` (a thin `clampIntervalMs` wrapper, default
120 000 ms, floor 30 000 ms). The `AI_ENABLED !== "true"` hard-stop is
preserved unchanged — it is enforced both at the route (`routes.ts:3247`)
and in `runAITurn` itself (`ai-engine.ts:87`), so when the flag is off the
scheduler never calls into the storage layer and the AI pays zero DB
cost.

### 2. Configurable debuff cleanup — `server/util/debuffCleanup.ts`

The two unconditional parcel UPDATEs in the battle resolver
(`routes.ts:3230-3239`) are removed from the 5 s loop and consolidated into
a single bounded UPDATE in `runDebuffCleanup(db)`, driven by its own
`setInterval` at `DEBUFF_CLEANUP_INTERVAL_MS` (default 60 s, floor 10 s).
The new UPDATE clears **both** debuff types in one statement: the WHERE
clause covers `emp_debuff_until IS NOT NULL AND < now` OR
`sabotage_debuff_until IS NOT NULL AND < now`, and the SET uses
`CASE` so each field is only mutated when its own debuff is the expired
one. A parcel with only an expired EMP cannot lose an active sabotage
timer (and vice versa).

Net effect: the debuff-cleanup workload drops from 2 updates × 17,280
runs/day = 34,560 to 1 update × 1,440 runs/day = 1,440 — a
**−34,560 / −95.8 %** reduction in debuff-cleanup queries.

### 3. Reduced parcel projection — `server/storage/ai-engine.ts:62-86`

The unconditional `db.select().from(parcelsTable)` (every column of every
row, including `improvements`, `influence`, `ascendAccumulated`, etc.)
is replaced with a bounded projection of the 17 fields actually consumed
by the four-faction strategies, reconquest filter, VANGUARD raid-release,
passive resource upkeep, and range calculations:

```
id, ownerId, ownerType, lat, lng, biome, defenseLevel, richness,
ironStored, fuelStored, crystalStored, lastMineTs,
capturedFromFaction, capturedAt, handoverCount, purchasePriceAlgo, plotId
```

The strategies and `enemyPlotsInRange` already read exactly these fields
(verified by reading the full `ai-engine.ts`); no engine logic was
redesigned and no spatial index was added. At 21,000 parcels this roughly
halves the per-tick data transfer (the full row is ~30 columns including
JSONB `improvements` / `trajectory`).

### 4. `gameMeta.currentTurn` / `lastUpdateTs` — preserved (evidence-based)

Traced every consumer of `currentTurn` and `lastUpdateTs` in the
server (grep `artifacts/frontier-al/server/**`). Findings:

- The **only writer of `currentTurn`** is `runAITurn` (`ai-engine.ts:253`).
  The seed initializes it; no other background loop or mutation touches
  it. Consumers are the claim-winnings / place-bet `isResolvable` check
  and the public game-state snapshot (`db.ts:515`).
- `lastUpdateTs` is written by many code paths (purchase, battle resolve,
  season manager, etc.) — the AI's `now` write at `ai-engine.ts:254` is
  redundant with those.

Because `currentTurn` is AI-turn bookkeeping whose clock the rest of the
game depends on (claim/bet "is this source resolvable now?"), and the
repository evidence does not prove that an idle AI tick is safe to skip,
the `gameMeta` update is **kept unconditional** and the dependency is
documented here. The 120 s cadence (vs 20 s) already reduces the write
rate by 83.3 %.

## Loops left untouched (already acceptably gated)

- Battle resolver cadence (5 s) and `battle_tick` cadence (1 s).
- Orbital scheduler (5 min) — random-skip before any DB read.
- Plot NFT mint retry (60 s) — early-returns when queue empty.
- ASCEND transfer retry (30 s) — early-returns when queue empty.
- All four faction strategies; 60 s attack cooldown; 12-battle cap;
  duplicate / self-attack protections.

## Production environment values

| Variable | Value | Why |
|---|---|---|
| `AI_ENABLED` | `true` | Keep the war on. |
| `AI_TURN_INTERVAL_MS` | `120000` | Default. 120 s cadence. |
| `DEBUFF_CLEANUP_INTERVAL_MS` | `60000` | Default. 60 s cadence. |
| `AI_MAX_ACTIVE_BATTLES` | `12` | Unchanged safeguard. |

(Floors of 30 s and 10 s prevent misconfiguration from re-introducing the
hot loop. `clampIntervalMs` also clamps `Infinity` and the empty string
back to the default.)

## Rollout and verification

1. Merge this branch into `main`.
2. Fly auto-deploys.
3. Verify the new cadence on the Fly logs: AI scheduler should fire
   every 120 s; debuff cleanup should appear as a single combined
   UPDATE every 60 s.
4. Spot-check: confirm the four AI factions still battle within a few
   minutes of each other, battles still resolve, debuffs still clear
   (EMP restores defense, sabotage restores yield).
5. Verify the deferred-optimization (`explain analyze` of the new
   parcel projection) once the change has run for a day.

## Rollback

Revert the merge commit (`git revert -m 1 <merge-sha>`) and redeploy. The
env vars can stay — they are no-ops at the pre-cost-control defaults
(`AI_TURN_INTERVAL_MS=20000` is below the 30 s floor and would be
clamped up to 30 s, so revert in lockstep if the old 20 s behavior is
required).

## Deferred future optimization

The full parcel scan is still a sequential read of ~21,000 rows every
120 s. The next step is to **query only AI-owned parcels plus nearby
candidate targets** — i.e. the AI factions' currently-held parcels
(joined on `ownerId IN (ai_faction_ids)` and indexed by
`parcels_owner_id_idx`) and then expand outward by sphere distance to a
bounded candidate set. This is deliberately out of scope for this PR
and will land in a follow-up unit once the per-faction query
selectivity is measured.
