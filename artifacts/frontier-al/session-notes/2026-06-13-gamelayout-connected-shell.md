# 2026-06-13 — Connected GameLayout shell coverage (PR #24)

## Branch & commit
- **Branch:** `test/gamelayout-connected-shell`
- **Test commit:** `14b1ee8` (baton commit follows on push)

## PR & CI
- **PR:** [#24](https://github.com/KudbeeZero/FRONTIERNeXt/pull/24) — connected
  GameLayout shell coverage. **Open, AWAITING_AUDIT.**
- **CI status:** running on push; locally verified green (see Tests).
- Relay context: **PR #23** audited PASS + merged (`6c009c9`).

## What shipped
- `artifacts/frontier-al/client/tests/gamelayout-connected-shell.spec.tsx`
  (+4 tests, client 41→45). Renders the **real GameLayout** (`/game`) via
  `react-dom/server`; asserts the connected shell (past the wallet gate) and its
  always-on regions: `game-layout`, `top-bar`, `bottom-nav` — incl. a
  `gameState`-present render (globe stubbed).
- Appended independent PASS audit of #23 to `docs/audits/test-gamelayout-entry-state.md`.
- **No game behavior changed. No jsdom, no new deps.**

## Tests run (exact results)
- `pnpm install --frozen-lockfile` → OK (lockfile unchanged)
- `pnpm --filter @workspace/frontier-al run check` → **tsc 0 errors**
- `pnpm --filter @workspace/frontier-al run test` → **45/45 (7 files)** (was 41)
- `pnpm --filter @workspace/frontier-al run test:server` → **210/210 (28 files)**
- `pnpm run typecheck` (root) → still **FAILS only in `artifacts/mockup-sandbox`**
  (vite/`@types/node` mismatch; pre-existing; not in `ci.yml`).

## Verified vs untested
- **Test-backed:** connected wallet reaches the real shell; top-level regions
  (top bar, bottom nav) render; shell mounts with `gameState` present (globe
  stubbed); markers required (fails if shell unmounts).
- **Untested / not covered (honest, NOT faked):** real 3D PlanetGlobe/Three
  scene, real WebSocket (`useGameSocket` mocked), real wallet provider, and
  effect-driven behavior (post-mount fetch, socket subscribe). SSR runs render
  bodies only; the globe is mocked to null.

## Decision: SSR sufficed → no jsdom
The connected shell chrome (`game-layout`/`top-bar`/`bottom-nav`) renders OUTSIDE
the `gameState`-gated block (GameLayout.tsx:765/807/1128), so it mounts WebGL-free
under `react-dom/server`. jsdom would only be needed to exercise effects (out of
scope), so per the unit's no-dependency-churn rule it was NOT added.

## Known risks
- Real 3D + effect/WebSocket behavior unrendered in CI.
- Live payment verification + on-chain NFT flow unvalidated in CI.
- `verifyAlgoPayment` finality indexer-only; no rate limit on `/api/actions/*`;
  migration `0005_redeemed_payments.sql` must precede the replay-guard deploy.

## Next unit (proposed)
- **`feat/route-loop-server`** — server `/api/actions/*` test (mock storage +
  `verifyAlgoPayment`) asserting the replay guard + auth wiring; CI-testable in
  the server suite; gives `/mainnet-gate` real evidence for the purchase path.

## Off-limits (unchanged)
- Do not merge `wip/atomic-purchase`; nothing in `ops/kestra/` points at mainnet;
  no funds/ASA/transfer code to mainnet without `/mainnet-gate` **and**
  `algo-auditor`; no funds-moving phase ships without that.

## Durable lesson
- The GameLayout connected-shell chrome (TopBar/BottomNav/ActivityFeed + root
  `game-layout`) is rendered OUTSIDE the `gameState ?` block, so it SSR-renders
  with `gameState` either undefined OR a minimal empty-arrays object — no jsdom
  needed for connected-shell region coverage. Reserve jsdom for genuine
  effect/WebGL exercising.
