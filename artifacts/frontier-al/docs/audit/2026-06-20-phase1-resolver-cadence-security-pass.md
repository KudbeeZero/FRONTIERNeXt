# Security pass — Phase-1 PR5: resolver cadence env-config + 5s default

- **Date:** 2026-06-20
- **Branch / PR:** `phase/01-resolver-cadence` → `main` (#75)
- **Scope reviewed:** the PR5 diff — `server/util/intervals.ts` (NEW), its swap into the two
  `routes.ts` background `setInterval` cadences (battle auto-resolver, `battle_tick`), and the env docs.
- **Verdict:** **PASS** (1 finding found + fixed + tested; no accepted risks).

## Checklist

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Auth boundaries | ✅ n/a | No routes added/changed; only a background interval cadence + a pure helper. |
| 2 | Wallet / signature verification | ✅ n/a | No wallet/signature surface touched. |
| 3 | API input validation | ⚠️→✅ fixed | The "input" is the operator env `BATTLE_RESOLVE_INTERVAL_MS`, coerced by `clampIntervalMs`. The new helper bounded the **low** end (floor) but not the **high** end — see Finding 1. Fixed + tested. |
| 4 | Rate limits / DoS | ⚠️→✅ fixed | Same root cause as #3: an unbounded/overflowing cadence becomes a 1ms hot loop against Neon (self-DoS). The floor (1000ms) bounds the aggressive end; the new ceiling bounds the overflow end. |
| 5 | Secrets handling | ✅ ok | `BATTLE_RESOLVE_INTERVAL_MS` is a non-secret tunable; documented in `ENV_VARS.md` + `docs/DEPLOYMENT_ENV_CHECKLIST.md`. No secret added/logged. |
| 6 | CORS + headers | ✅ n/a | Unchanged. |
| 7 | Transaction / finality | ✅ n/a | No chain/payment code; `resolveBattles()` math + idempotency unchanged (cadence only). |
| 8 | Replay / idempotency | ✅ ok | Resolver is idempotent + concurrency-guarded (`battle-concurrency.spec.ts`); changing how often it polls cannot double-resolve a battle. |
| 9 | Admin endpoints | ✅ n/a | None touched. |
| 10 | Logs leaking secrets | ✅ ok | The interval `console.warn` paths are unchanged and log only error messages, no secrets. |
| 11 | Dependency risk | ✅ ok | No deps added; no lockfile change; helper is pure stdlib. |

## Finding 1 — `clampIntervalMs` did not bound the upper end (fail-open → self-DoS)

- **Severity:** Low (operator-only misconfiguration; no external attacker vector).
- **Where:** `server/util/intervals.ts` (new in this PR).
- **What:** the original `Math.max(floor, Number(raw) || def)` clamps the low end only. A non-finite
  value — `Number("1e999") === Infinity`, which is truthy so it survives `|| def` — or any finite value
  above Node's timer `TIMEOUT_MAX` (`2_147_483_647`) is silently coerced by Node's timers to **1ms**.
  The interval then fires ~1000×/س against `storage.resolveBattles()` / Neon — a hot loop that is the
  exact opposite of the floor's documented "don't hammer shared infra" intent. A plausible trigger is
  an operator setting a very large number to "effectively disable" the poll.
- **Fix:** add a finite-guard (`!Number.isFinite(parsed) → def`) and a 24h ceiling
  (`MAX_INTERVAL_MS = 86_400_000`, well under `TIMEOUT_MAX`) via `Math.min(MAX_INTERVAL_MS, …)`. All
  pre-existing behavior preserved (unset/`NaN`/`""`/`"0"`→def; sub-floor→floor; in-range honored;
  negative→floor).
- **Test (fails before, passes after):** `server/util/intervals.spec.ts` → `describe("upper bound")`:
  `"1e999"` → `def` (was `Infinity`), `"9999999999"` and `DAY_MS+1` → `DAY_MS` (was the raw overflowing
  value), and `DAY_MS` honored at the ceiling. Server suite **300 pass / 11 skip** (was 297).

## Notes
- `BATTLE_DURATION_MS` (battle length) and the combat-resolution math are untouched — out of scope and
  unchanged. The AI(20s)/orbital(5min) intervals remain hardcoded literals (not env-driven); they do
  not flow through `clampIntervalMs`, so this finding does not apply to them. Routing them through the
  helper is an optional future cleanup, noted in the baton.
