# FRONTIER Agent Dashboard — specification (Mission Control)

> Spec for the owner-facing Mission Control dashboard that makes every agent, watcher, and
> gate visible and killable. UI-first, read-only against real data (HARD RULE: no mock data
> on live surfaces — panels ship with real endpoints or clearly-labeled placeholder frames
> behind a dev flag until wired).

## Where it lives

- Builds on the existing **dashboard v2 widget system**
  (`artifacts/frontier-al/client/src/components/game/dashboard/**`: drag/snap-grid, resizable
  widgets, `useWidgetLayout`, TopBar toggle) — Mission Control is a new widget *set* plus a
  dedicated route (`/mission-control`, desktop-first), not a new framework.
- Server side: one aggregation namespace `GET /api/ops/*` (read-only), gated by the existing
  `requireAdminKey` / `isAdminRequest` in `server/security.ts`.

## Agent card (the core unit)

Every registered agent/watcher (see `FRONTIER_AGENT_REGISTRY.md`) renders one card:

| Field | Source |
|---|---|
| name + role | registry (static) |
| status: `active / sleeping / stale / unknown` | heartbeat (last-run timestamp vs expected cadence) |
| spawned_by | registry (session / cron / server boot / Kestra) |
| current task | last log line / job label |
| allowed actions | registry permissions list |
| forbidden actions | registry (rendered in red, always visible) |
| last report | link to latest artifact (session note, audit doc, txn id) |
| confidence | agent-self-reported on last run (`high/med/low`), else `—` |
| risk level | registry (`none / read / write / funds`) |
| repo/branch touched | last PR/branch if any |
| wallet/txn access | `none / read / testnet-sign` (mainnet-sign does not exist pre-gates) |
| memory/state updated? | did last run write state (baton, DB, reports)? |
| PR linked | open PR # if the agent's work is awaiting audit |
| kill switch | per-agent enable/disable (writes a flag the runner checks each cycle) |

**Kill-switch semantics:** flags are fail-closed — a missing/unreadable flag means OFF for
anything with write or funds risk, ON only for read-only monitors.

## Panels (widget set)

1. **Mission Control view** — grid of agent cards, sorted by risk then status; header counts
   (active/sleeping/stale) and a global "pause all writers" switch.
2. **Wallet safety panel** — admin/treasury address (address only), balance, min-balance locked
   by ASAs, network badge (TESTNET in green / MAINNET in red-never-expected), last 10 outbound
   txns with explorer links. Source: existing chain client + indexer reads.
3. **Transaction watcher panel** — live tail of chain events (mints, deliveries, ASCEND
   transfers, clawbacks, upgrade notes) from the existing `chainEventLog`/`chainEventStore`,
   with per-type counts and a failed/retry queue view (`transferQueue` depth, oldest item age).
4. **PR watcher panel** — open PRs, head CI state, awaiting-audit flag from the baton, stale
   warning (>48h open). Source: GitHub API via a server-side poller (token server-side only).
5. **Aether companion panel** — status of the story-mode/voice pipeline (aether-journey):
   generated-asset inventory, missing VO chapters, `ELEVENLABS_API_KEY` presence (boolean only).
6. **Battle/armory system panel** — battle engine health: battles resolved last 24h, veritas
   provable-fairness last run + result, weapon engagements, sim determinism check timestamp.
7. **Security-pass panel** — last `/security-pass` date + findings count (open vs fixed), rate-
   limiter hit counts, auth failures, idempotency replays blocked. Source: `docs/audit/` index +
   counters already tracked server-side.
8. **Next owner action panel** — top of the dashboard: the single thing the owner should do
   next (fund wallet / audit PR #N / approve gate X), driven by baton + registry state.

## Non-goals

- No agent control beyond enable/disable (no prompt-editing UI in v1).
- No mainnet anything.
- No client-side secrets: all tokens/keys stay server-side; panels consume `/api/ops/*` only.

## Build order (maps to FIRST_10_PRS)

shell (route + widget set, static registry data) → wallet safety (real reads) → transaction
watcher (real event log) → PR watcher → remaining panels one PR each.
