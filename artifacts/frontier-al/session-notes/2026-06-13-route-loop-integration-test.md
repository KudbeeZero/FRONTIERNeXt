# 2026-06-13 — Client route-layer loop integration test (PR #22)

## Branch & commit
- **Branch:** `feat/route-loop-integration-test`
- **Test commit:** `7e567d6` (baton commit follows on push)

## PR & CI
- **PR:** [#22](https://github.com/KudbeeZero/FRONTIERNeXt/pull/22) — client
  route-layer loop integration test. **Open, AWAITING_AUDIT.**
- **CI status:** running on push; locally verified green (see Tests).
- Relay context: **PR #21** (mainnet-readiness workflow layer) audited PASS +
  merged (`3d463c5`); **stale PR #16 closed** (owner-authorized) to restore the
  one-open-PR invariant.

## What shipped
- `artifacts/frontier-al/client/tests/route-loop.spec.tsx` (+5 tests, client
  31→36). Renders real `<App/>` (wouter) via `react-dom/server` under `ssrPath`:
  boots, `/`→real LandingPage, `/game`→gameplay page mount, unknown→real NotFound,
  per-path outputs distinct.
- Appended independent PASS audit of #21 to `docs/audits/claude-handoff-audit-t5ci91.md`.
- **No game logic / routing changed. No new deps, no jsdom.**

## Tests run (exact results)
- `pnpm install --frozen-lockfile` → OK (lockfile unchanged)
- `pnpm --filter @workspace/frontier-al run check` → **tsc 0 errors**
- `pnpm --filter @workspace/frontier-al run test` → **36/36 (5 files)** (was 31)
- `pnpm --filter @workspace/frontier-al run test:server` → **210/210 (28 files)**
- `pnpm run typecheck` (root) → still **FAILS only in `artifacts/mockup-sandbox`**
  (vite/`@types/node` mismatch; pre-existing on `origin/main`; not in `ci.yml`).

## Verified vs untested
- **Test-backed:** the route loop (boot, `/`, `/game` mount, 404, per-path
  distinctness) — green in CI scope.
- **Untested / not covered (honest):** `/game`'s real 3D entry state is *mounted*,
  not deeply rendered — the WebGL globe (`@react-three/fiber`) can't run headless,
  so the page is stubbed at its render boundary. SSR runs render bodies, not
  effects, so WebSocket/fetch/localStorage behavior is out of scope. Info
  subroutes not individually asserted.

## Known risks
- `/game` real entry state unrendered in CI (only mounted) — next unit.
- Live payment verification + on-chain NFT flow remain unvalidated in CI.
- `verifyAlgoPayment` finality indexer-only; no rate limit on `/api/actions/*`;
  migration `0005_redeemed_payments.sql` must be applied before deploying the
  replay guard.

## Next unit (proposed)
- **`test/gamelayout-entry-state`** — mock game-state/blockchain hooks + stub
  PlanetGlobe/@react-three/fiber; assert the REAL GameLayout entry states
  (loading / `game-error` / disconnected). Closes the #22 gap.

## Off-limits (unchanged)
- Do not merge `wip/atomic-purchase`; nothing in `ops/kestra/` points at mainnet;
  no funds/ASA/transfer code to mainnet without `/mainnet-gate` **and**
  `algo-auditor`; no funds-moving phase ships without that.

## Durable lesson
- Client tests run in the **Node** vitest env (no jsdom). For route/render checks,
  `react-dom/server.renderToStaticMarkup` + wouter `Router ssrPath` works with NO
  new deps; SSR skips effects, which conveniently sidesteps WebSocket/localStorage
  but means effect-driven behavior needs a different (jsdom) harness.
