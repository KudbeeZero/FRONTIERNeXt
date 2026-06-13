# 2026-06-13 — Real GameLayout entry-state coverage (PR #23)

## Branch & commit
- **Branch:** `test/gamelayout-entry-state`
- **Test commit:** `49e86fd` (baton commit follows on push)

## PR & CI
- **PR:** [#23](https://github.com/KudbeeZero/FRONTIERNeXt/pull/23) — real
  GameLayout entry-state coverage for `/game`. **Open, AWAITING_AUDIT.**
- **CI status:** running on push; locally verified green (see Tests).
- Relay context: **PR #22** audited PASS + merged (`e0a6a2b`).

## What shipped
- `artifacts/frontier-al/client/tests/gamelayout-entry.spec.tsx` (+5 tests, client
  36→41). Renders the **real GameLayout** (`/game`) via `react-dom/server` under
  wouter `ssrPath`; asserts wallet-gate, game-error, wallet-restoring, main-shell
  mount, and gate mutual-exclusivity.
- Appended independent PASS audit of #22 to
  `docs/audits/feat-route-loop-integration-test.md`.
- **No game behavior changed. No jsdom, no new deps.**

## Tests run (exact results)
- `pnpm install --frozen-lockfile` → OK (lockfile unchanged)
- `pnpm --filter @workspace/frontier-al run check` → **tsc 0 errors**
- `pnpm --filter @workspace/frontier-al run test` → **41/41 (6 files)** (was 36)
- `pnpm --filter @workspace/frontier-al run test:server` → **210/210 (28 files)**
- `pnpm run typecheck` (root) → still **FAILS only in `artifacts/mockup-sandbox`**
  (vite/`@types/node` mismatch; pre-existing on `origin/main`; not in `ci.yml`).

## Verified vs untested
- **Test-backed:** the four real GameLayout entry states + shell mount + gate
  mutual-exclusivity (mocked only at browser/WebGL/data boundaries).
- **Untested / not covered (honest, NOT faked):** real 3D PlanetGlobe scene
  (WebGL), effect-driven behavior (WebSocket connect, post-mount fetch,
  localStorage), and the connected shell with live `gameState` data. SSR runs
  render bodies, not effects; the globe is mocked to `null`. Needs a
  WebGL-capable/jsdom harness — next unit.

## Known risks
- `/game` real 3D + effect/WebSocket behavior unrendered in CI.
- Live payment verification + on-chain NFT flow unvalidated in CI.
- `verifyAlgoPayment` finality indexer-only; no rate limit on `/api/actions/*`;
  migration `0005_redeemed_payments.sql` must precede the replay guard deploy.

## Next unit (proposed)
- **`test/gamelayout-connected-shell`** (jsdom + WebGL stub) — connected shell
  with populated `gameState`, PlanetGlobe stubbed; assert TopBar/HUD panels +
  effect wiring (WebSocket subscribe). Weigh the jsdom devDep vs value.

## Off-limits (unchanged)
- Do not merge `wip/atomic-purchase`; nothing in `ops/kestra/` points at mainnet;
  no funds/ASA/transfer code to mainnet without `/mainnet-gate` **and**
  `algo-auditor`; no funds-moving phase ships without that.

## Durable lesson
- When SSR-rendering the real `<App/>`, **don't mock `@/hooks/use-toast`** — the
  top-level `<Toaster/>` reads `toasts.map`, so a partial mock (missing `toasts`)
  crashes the whole render. The real `useToast` is SSR-safe; leave it real.
- GameLayout's `<PlanetGlobe>` is gated on `gameState` truthy, so the main shell
  (`data-testid="game-layout"`) mounts WebGL-free when `gameState` is undefined —
  a clean headless "shell mounts" assertion.
