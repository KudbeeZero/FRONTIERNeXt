# 2026-07-16 — Battle Planner route + page shell (Phase 5 route)

## Context

Battle Planner UI components existed (`BattlePlanner.tsx`, `BattleTargetSelector.tsx`, `usePlannerDraft.ts`) but were only accessible embedded in `CommanderPanel.tsx`. This unit adds a dedicated `/battle-planner` route and page shell so the planner can be navigated to directly.

## What shipped

- `artifacts/frontier-al/client/src/pages/battle-planner.tsx` — new `BattlePlannerPage` shell that wires existing `BattlePlanner` to `useGameState`, `useAttack`, `useCurrentPlayer`, `useWallet`, `useToast`.
- `artifacts/frontier-al/client/src/App.tsx` — added `/battle-planner` route + lazy import.
- `artifacts/frontier-al/client/tests/battle-planner-page.spec.tsx` — SSR smoke test proving the page mounts without throwing.
- `docs/HANDOFF.md` — baton refreshed: PR #276 marked MERGED, NEXT lane set to faction economy / Battle Planner continuation.
- `docs/memory/00-STATE-INDEX.md` — HEAD updated to `f9fb5b6`.
- `docs/audits/feat-battle-planner-phase-5-route.md` — self-audit report.

## Files changed

- `artifacts/frontier-al/client/src/App.tsx`
- `artifacts/frontier-al/client/src/pages/battle-planner.tsx`
- `artifacts/frontier-al/client/tests/battle-planner-page.spec.tsx`
- `docs/HANDOFF.md`
- `docs/memory/00-STATE-INDEX.md`
- `docs/audits/feat-battle-planner-phase-5-route.md`

## Validation

- `pnpm run check` — clean
- `pnpm run test:server` — 73 passed | 8 skipped
- `pnpm run test` — 1 file / 9 tests passed
- `pnpm run build` — green (49.78s client + 925ms server)
- CI green on PR #276 head: Typecheck & server tests ✅ + Cloudflare Pages ✅ + Memory Layer Session Check ✅

## Notes / risks

- This is a route/page shell only. The underlying `BattlePlanner` component still lives in `CommanderPanel`; no duplication of planner logic.
- `BattlePlannerPage` uses `useCurrentPlayer()` which reads from `/api/game/state`. If the player is not loaded, the page shows a loading/connect-wallet state.
- Planner draft persistence (`usePlannerDraft`) is wired in the page via `readDraft`/`writeDraft`/`clearDraft`, but draft hydration is minimal (source parcel + commander only).
- Full planner interaction flow, wallet connect/disconnect, and attack mutation branches are not covered by the smoke test — future DOM harness needed.

## Next unit

Resume feature roadmap — next Battle Planner phase (e.g., planner list/saved plans) or faction economy / treasury / equity / contribution-ledger foundation per `PRODUCTION_READINESS_ROADMAP.md`. Owner approval required before any sub-plot combat application-code PR.
