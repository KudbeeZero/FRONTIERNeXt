# 2026-07-16 — Mission Control dashboard (internal dev tool)

## Context

The owner needs one internal place to see repo health, workflow status, the
memory layer state, latest merges, the active engineering lane, blockers, owner
actions, and launch readiness. This is an internal developer tool — no
authentication, no backend, no database, no blockchain, no gameplay changes.

## What shipped

- `client/src/pages/MissionControl.tsx` — the `/mission-control` route page.
  Seven panels laid out mobile-first (single column; 2-column grid at `lg`):
  1. System Status (main HEAD SHA, latest merged PR, release status, sync status)
  2. Workflow Health (Summary / Session updater / Memory index / Perplexity / Notion)
  3. Current Priorities (active lane, next lane, blockers, deferred)
  4. Build Health (client tests, server tests, build, typecheck, Cloudflare Pages)
  5. Owner Actions (Fly activation, TestNet wallet funding, branch pruning, mobile QA)
  6. Memory Layer (latest session log, latest merged PR, completed lane, baton state)
  7. Branch Hygiene (active / stale / drafts / superseded)
- `client/src/components/mission-control/missionControlData.ts` — the single
  static, hand-maintained data source. No API, no polling, no DB.
- `client/src/components/mission-control/StatusChip.tsx` — color-coded status
  chip (Healthy / Warning / Manual / Disabled).
- `client/src/components/mission-control/MissionControlSection.tsx` — reusable
  collapsible section; sections collapse on mobile, open by default on `lg`.
- `App.tsx` — added the `/mission-control` route, lazy-loaded, mounted
  **outside** the shared `WalletProvider` (same pattern as `/admin` and
  `/university`): no wallet/chain context.
- `vitest.config.ts` — client vitest config with the `@` alias (server tests
  keep their own `--config vitest.server.config.ts`).
- `client/src/components/mission-control/missionControlData.test.ts` — data
  contract guard (SHAs present, valid statuses, sections populated).

## Nice-to-haves included (trivial)

- Status color chips (✓)
- Copy-SHA button on the main HEAD row (✓)
- Collapsible sections on mobile (✓)

## Files changed

| File | Change |
|------|--------|
| `client/src/pages/MissionControl.tsx` | New — dashboard route page (7 panels). |
| `client/src/components/mission-control/missionControlData.ts` | New — static data source. |
| `client/src/components/mission-control/StatusChip.tsx` | New — status chip. |
| `client/src/components/mission-control/MissionControlSection.tsx` | New — collapsible section + KV row. |
| `client/src/App.tsx` | Route added (lazy, outside WalletProvider). |
| `vitest.config.ts` | New — client test config. |
| `client/src/components/mission-control/missionControlData.test.ts` | New — data-contract test. |

## Validation

- `pnpm run check` (tsc) → clean.
- `pnpm run test` (client) → 3/3 pass.
- `pnpm run test:server` → 706/706 pass.
- `pnpm run build` → green; `MissionControl` code-split into its own chunk
  (`MissionControl-hjZEC8dd.js`, ~8.5 kB).

## Headless visual testing

The `docs/HEADLESS_VISUAL_TESTING.md` recipe was attempted but could not run in
this sandbox: Chromium (`chrome-headless-shell`) fails at launch with
`error while loading shared libraries: libnspr4.so` — the container is missing
the OS shared-library deps for a headless browser, and installing them needs
apt/root network access. The dashboard is a pure static client route (no
Postgres/WebGL/server required), but it still could not be rendered here.
**Desktop / iPhone portrait / iPhone landscape screenshots are NOT captured in
this environment** — flagged honestly rather than faked. Owner device QA (and
the existing visual-smoke path on a capable host) remains the verification path
for mobile layout.

## Out of scope (per stop condition)

- No backend automation, databases, economy work, or branch cleanup.
- No wallet/chain/ASA/auth changes.
- Fly activation, TestNet wallet funding, branch pruning, and mobile QA are
  surfaced as owner-action cards but not executed.

## PR

- Branch: `feat/mission-control-dashboard` (off `origin/main` @ `0913ac4`).
- Opened after local validation; awaiting owner review.
