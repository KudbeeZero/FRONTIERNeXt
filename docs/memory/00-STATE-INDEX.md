# 00 — Index & Current State

> Canonical, machine-and-human-readable memory-layer index. KILO reads this at
> session start (`KILO_RUNNER_PROMPT.md` step 2) and rewrites it at closeout
> (`SESSION_UPDATER.md`). This file is the source of truth for "where are we."
> If it disagrees with `main` HEAD, that is a memory-layer gap — flag it at
> closeout, do not silently trust it.

**Updated (UTC)** | 2026-07-16T03:31:00Z

## Current commit

- **HEAD:** `f397a8e` — docs(memory): resync state index and baton (#271)
- **Date (UTC):** 2026-07-16T03:31:00Z
- **Note:** tip is a `docs: update session log [skip ci]` commit produced by
  `.github/workflows/session-log.yml`. The latest *feature* merge is PR #271
  (`f397a8e`). STATE-INDEX resynced during the Release Coordinator merge pass;
  PR #272 (mobile playability) is being rebased onto this HEAD.

## Latest merged PR

- **#269** `ae57840` — docs(memory): KILO runner prompt + session updater (single trigger, no Notion)
- **#268** `88ff4ff` — feat(planner): Planner Draft Persistence (localStorage) — Phase 4
- **#267** `b96f273` — feat(frontier): Battle Planner globe attack path visualization — Phase 3
- **#266** `affaa52` — feat(frontier): add Battle Planner outcome preview — Phase 2
- **#265** `ba2e71f` — test(mobile): add globe touch regression coverage

## Launch verdict

- **Network:** Algorand **TestNet** only. No mainnet config present in this lane.
- **`/mainnet-gate`:** Not required for this lane (docs/process only; no
  funds/ASA/wallet/chain changes). Status: **N/A for this lane.**
- **Standing posture:** mainnet remains gated; nothing reaches mainnet without a
  `/mainnet-gate` PASS **and** an `algo-auditor` pass. See
  `docs/MAINNET_READINESS_FLOW.md`.

## Active blocker

- **Owner-only Fly activation:** agents cannot set Fly secrets (no `flyctl` /
  `FLY_API_TOKEN`, no secret-setting workflow). Owner must run:
  ```
  flyctl secrets set -a frontiernext AI_ENABLED=true AI_TURN_INTERVAL_MS=120000 DEBUFF_CLEANUP_INTERVAL_MS=60000 AI_MAX_ACTIVE_BATTLES=12
  ```
  then confirm `/health` returns 200 and observe for 15 min (AI ~120 s,
  debuff ~60 s, active battles ≤ 12). See
  `docs/memory/FRONTIER_BACKGROUND_LOOP_COST_CONTROL.md`.

## Owner action

- Fund session wallet `JD7CFMNMX4PO2HSJNRYBXUWR3W7YYLC5M3GMK4MEOCEWHZLAU2IKT7IKZA`
  (2–5 TestNet ALGO) for `smoke:testnet`.
- Decide P2: keep landing+game on separate origins (accept second wallet
  connect) or unify origin / add session handoff.
- Smoke tests still unconfirmed on-device: tab-switching post-#178 (phone +
  desktop); gate audio; draggable plot panel.
- Decide the orphaned `artifacts/api-server` + `lib/*` island; prune ~140 dead
  remote branches.

## Current priorities

- **Memory layer in sync:** this resync lane closes the gap between the seed
  commit `2e81dc6` and current `main` (`3a15bad`); STATE-INDEX, HANDOFF, and
  `10-completed/_INDEX.md` now reflect PRs #266–#269.
- **Next engineering lane (recommended):** after the memory-layer sync, resume
  the feature roadmap — faction economy / treasury / equity / contribution-ledger
  foundation (deferred by PR #256) or the next Battle Planner / sub-plot combat
  implementation phase, per `PRODUCTION_READINESS_ROADMAP.md`. Owner approval
  required before any sub-plot combat application-code PR.

## How this index stays current

Updated by KILO at every session closeout per `SESSION_UPDATER.md` (all five
targets above). The GitHub `.github/workflows/session-log.yml` is the **sole**
session-updater trigger: it appends a lightweight `SESSION_LOG.md` on every
push to `main`; its double-commit pattern (log → re-trigger → log) is expected
and healthy, not a duplicate no-op. The separate
`.github/workflows/memory-session-check.yml` is a *verification* check only — it
does not write memory and is not a session-updater trigger.
