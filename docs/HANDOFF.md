# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `feat/route-loop-integration-test`
- **PR:** [#22](https://github.com/KudbeeZero/FRONTIERNeXt/pull/22) (client
  route-layer loop integration test)
- **Audit status:** `AWAITING_AUDIT`
- Note: **PR #21 audited PASS (independent) + merged** (`3d463c5`); audit at
  `docs/audits/claude-handoff-audit-t5ci91.md`. **Stale PR #16 closed**
  (owner-authorized) — one-open-PR invariant restored.
- **CI gates green** (frontier-al scope = `ci.yml`): `check` 0,
  `test:server` **210/210**, `test` **36/36** (was 31, +5).

## What this chat did (for the auditor)
Added `artifacts/frontier-al/client/tests/route-loop.spec.tsx` (+5 client tests,
31→36) — a **client route-layer integration test**. It renders the real `<App/>`
(wouter) via `react-dom/server` under `ssrPath` and asserts the route loop:
- app/router **boots** without crashing,
- `/` renders the **real LandingPage** shell,
- `/game` **mounts** the gameplay page (route → page render boundary),
- unknown route → **real NotFound (404)**,
- the three outputs are **distinct** (Switch selects per-path → a dropped/mis-wired
  Route breaks an assertion).
- **No game logic / routing changed. No new deps, no jsdom** (Node env +
  react-dom). Wallet/auth/blockchain boundary mocked explicitly + realistically
  (disconnected wallet): `walletManager`, `@txnlab/use-wallet-react`,
  `@/contexts/WalletContext`, `WalletConnect`, `testMode`; the WebGL gameplay page
  is stubbed at its render boundary.
- **Untested / not covered (honest):** `/game`'s real 3D entry state is *mounted*,
  not deeply rendered (WebGL Canvas can't run headless) — stubbed at the page
  boundary. SSR runs render bodies, not effects, so effect-driven behavior
  (WebSocket/fetch/localStorage) is out of scope here.

## NEXT chat
- **Proposed branch:** `test/gamelayout-entry-state`.
- **Scope options (one unit each):**
  1. **GameLayout entry-state component test:** mock the game-state/blockchain
     hooks (`useGameState`→error, `useBlockchainActions`, `useGameSocket`,
     `useCurrentPlayer`, `useOrbitalEngine`) + stub `PlanetGlobe`/`@react-three/fiber`,
     assert the REAL entry states (loading / `data-testid="game-error"` /
     disconnected). Closes the "3D entry state is only mounted" gap from #22.
  2. **Server route-loop test:** mount `/api/actions/*` with mocked storage
     (`vi.mock`) + mocked `verifyAlgoPayment`; assert purchase incl. the **replay
     guard** (redeemedPayments) + auth wiring.
  3. **Port PR #10's algod-first finality check** into `verifyAlgoPayment`
     (indexer-only today). **Funds-economic → `algo-auditor` + `/security-pass`.**
  4. `feat/rate-limit-actions` — rate-limit `/api/actions/*` (mint-on-prepare DoS).
  5. `chore/align-vite-types` — fix the pre-existing `mockup-sandbox` root-typecheck
     failure (vite/`@types/node` mismatch; not in CI).
- **Open risks:**
  - ⚠️ `/game` real 3D entry state unrendered in CI (only mounted) — #1.
  - ⚠️ Live payment verification + on-chain NFT flow remain **unvalidated** in CI.
  - ⚠️ `verifyAlgoPayment` finality is indexer-only — #3.
  - ⚠️ No rate limit on `/api/actions/*` — #4.
  - ⚠️ Migration `0005_redeemed_payments.sql` must be applied before deploying the
    replay guard.
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/`
  may point at mainnet; no funds/ASA/transfer code to mainnet without
  `/mainnet-gate` **and** `algo-auditor`; no funds-moving phase ships without that.
