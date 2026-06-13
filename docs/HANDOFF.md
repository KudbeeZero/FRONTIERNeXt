# HANDOFF — the baton

> Single source of truth for "what's next." Keep it short — a baton, not a log.
> Full protocol: [docs/SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md).

## Current baton
- **Branch:** `test/gamelayout-entry-state`
- **PR:** [#23](https://github.com/KudbeeZero/FRONTIERNeXt/pull/23) (real
  GameLayout entry-state coverage for `/game`)
- **Audit status:** `AWAITING_AUDIT`
- Note: **PR #22 audited PASS (independent) + merged** (`e0a6a2b`); audit at
  `docs/audits/feat-route-loop-integration-test.md`.
- **CI gates green** (frontier-al scope = `ci.yml`): `check` 0,
  `test:server` **210/210**, `test` **41/41** (was 36, +5).

## What this chat did (for the auditor)
Added `artifacts/frontier-al/client/tests/gamelayout-entry.spec.tsx` (+5 client
tests, 36→41) — renders the **real GameLayout** (`/game`) via `react-dom/server`
under wouter `ssrPath` and asserts its entry-state shells:
- **wallet-gate** (disconnected visitor) → `data-testid="wallet-gate"`,
- **game-error** (`useGameState` error) → `data-testid="game-error"`,
- **wallet-restoring** (`walletStatus:"restoring"`) → `data-testid="wallet-restoring"`,
- **main shell mounts** (connected, `gameState` undefined → no 3D canvas) →
  `data-testid="game-layout"`,
- gates are mutually exclusive (inputs change the rendered state).
- **No game behavior changed. No jsdom, no new deps.** Mocked only the
  browser/WebGL/data boundaries (wallet, walletManager, WalletConnect,
  `TEST_GLOBE=false`, `PlanetGlobe→null`, data/socket/chain hooks); real
  `useToast`/`Toaster` kept. The 4 entry early-returns precede the gated globe,
  so no WebGL is hit.
- **Out of scope (documented, not faked):** the real 3D PlanetGlobe scene,
  effect-driven behavior (WebSocket/fetch/localStorage), and the connected shell
  with live `gameState` data — need a WebGL-capable/jsdom harness.

## NEXT chat
- **Proposed branch:** `test/gamelayout-connected-shell`.
- **Scope options (one unit each):**
  1. **Connected shell test (jsdom + WebGL stub):** render the connected shell
     with populated `gameState` + `PlanetGlobe` stubbed; assert TopBar/HUD panels
     and effect wiring (WebSocket subscribe). Closes the effect/3D gap from #23.
     (Likely needs jsdom — weigh the new devDep vs value.)
  2. **Server route-loop test:** mount `/api/actions/*` with mocked storage
     (`vi.mock`) + mocked `verifyAlgoPayment`; assert purchase incl. the **replay
     guard** (redeemedPayments) + auth wiring.
  3. **Port PR #10's algod-first finality check** into `verifyAlgoPayment`
     (indexer-only today). **Funds-economic → `algo-auditor` + `/security-pass`.**
  4. `feat/rate-limit-actions` — rate-limit `/api/actions/*` (mint-on-prepare DoS).
  5. `chore/align-vite-types` — fix the pre-existing `mockup-sandbox` root-typecheck
     failure (vite/`@types/node` mismatch; not in CI).
- **Open risks:**
  - ⚠️ `/game` real 3D scene + effect/WebSocket behavior still unrendered in CI — #1.
  - ⚠️ Live payment verification + on-chain NFT flow remain **unvalidated** in CI.
  - ⚠️ `verifyAlgoPayment` finality is indexer-only — #3.
  - ⚠️ No rate limit on `/api/actions/*` — #4.
  - ⚠️ Migration `0005_redeemed_payments.sql` must be applied before deploying the
    replay guard.
- **Off-limits:** do not merge `wip/atomic-purchase`; nothing in `ops/kestra/`
  may point at mainnet; no funds/ASA/transfer code to mainnet without
  `/mainnet-gate` **and** `algo-auditor`; no funds-moving phase ships without that.
