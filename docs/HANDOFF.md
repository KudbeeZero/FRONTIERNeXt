# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `test/gamelayout-connected-shell`
- **PR:** [#24](https://github.com/KudbeeZero/FRONTIERNeXt/pull/24) (connected
  GameLayout shell coverage for `/game`)
- **Audit status:** `AWAITING_AUDIT`
- Note: **PR #23 audited PASS (independent) + merged** (`6c009c9`); audit at
  `docs/audits/test-gamelayout-entry-state.md`.
- **CI gates green** (frontier-al scope = `ci.yml`): `check` 0,
  `test:server` **210/210**, `test` **45/45** (was 41, +4).

## What this chat did (for the auditor)
Added `artifacts/frontier-al/client/tests/gamelayout-connected-shell.spec.tsx`
(+4 client tests, 41→45) — covers the connected GameLayout shell (after the
wallet gate). Renders the **real** GameLayout (`/game`) via `react-dom/server`:
- connected wallet reaches the real shell → `data-testid="game-layout"` (not
  gate/error/restoring),
- connected top-level regions render → `data-testid="top-bar"` + `"bottom-nav"`,
- connected shell mounts with `gameState` present too (globe stubbed, no WebGL),
- shell markers required (fails if the connected shell stops mounting).
- **No jsdom, no new dep, no game behavior change.** The shell chrome is outside
  the `gameState`-gated block (GameLayout.tsx:765/807/1128), so it mounts
  WebGL-free; jsdom wasn't required so wasn't added. Mocked only boundaries
  (connected wallet, walletManager, WalletConnect, `TEST_GLOBE=false`,
  `PlanetGlobe→null`, data/socket/chain hooks); real `useToast`/`Toaster`.
- **Out of scope (documented, NOT faked, no coverage claimed):** real 3D
  PlanetGlobe/Three scene, real WebSocket (`useGameSocket` mocked), real wallet
  provider, effect-driven behavior (post-mount fetch, socket subscribe), and the
  data-populated panels' internal contents.

## NEXT chat
- **Proposed branch:** `feat/route-loop-server`.
- **Scope options (one unit each):**
  1. **Server route-loop test:** mount `/api/actions/*` with mocked storage
     (`vi.mock`) + mocked `verifyAlgoPayment`; assert purchase incl. the **replay
     guard** (redeemedPayments) + auth wiring. Gives `/mainnet-gate` real evidence
     for the purchase path. CI-testable (server suite).
  2. **Port PR #10's algod-first finality check** into `verifyAlgoPayment`
     (indexer-only today). **Funds-economic → `algo-auditor` + `/security-pass`.**
  3. `feat/rate-limit-actions` — rate-limit `/api/actions/*` (mint-on-prepare DoS).
  4. `chore/align-vite-types` — fix the pre-existing `mockup-sandbox` root-typecheck
     failure (vite/`@types/node` mismatch; not in CI).
  5. WebGL-capable/jsdom harness for the real PlanetGlobe/effect layer (only if
     that coverage is genuinely wanted; weigh the new devDep).
- **Open risks:**
  - ⚠️ Real 3D scene + effect/WebSocket behavior still unrendered in CI — #5.
  - ⚠️ Live payment verification + on-chain NFT flow remain **unvalidated** in CI — #1/#2.
  - ⚠️ `verifyAlgoPayment` finality is indexer-only — #2.
  - ⚠️ No rate limit on `/api/actions/*` — #3.
  - ⚠️ Migration `0005_redeemed_payments.sql` must be applied before deploying the
    replay guard.
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/`
  may point at mainnet; no funds/ASA/transfer code to mainnet without
  `/mainnet-gate` **and** `algo-auditor`; no funds-moving phase ships without that.
