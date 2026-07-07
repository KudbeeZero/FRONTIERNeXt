# 2026-07-07 — "/" loads the globe directly, landing page moved to "/landing"

Owner directive: skip the marketing landing page entirely — the root URL should drop
straight into the game/globe, not require a separate "/game" hop.

## Change

- `client/src/App.tsx` — the root route (`/`) now mounts `<GamePage/>` (same component
  as `/game`, kept for existing links). The old landing page is kept, not deleted — moved
  to `/landing`, not linked from primary nav, easy to restore as the default later.
- `client/src/contexts/WalletContext.tsx` — `shouldAutoAuthenticateForPath` now treats
  `/` as an in-game route too (auto-prompts the one wallet signature once connected),
  matching `/game`'s existing behavior.

## Scope check

Purely a routing swap — no wallet/auth logic changed, no funds/ASA code touched. The
`DEV_MODE` auto-login-redirect branch in `GameLayout.tsx` (`window.location.replace("/")`)
is unaffected in behavior: it already redirects to `/` on a missing dev session, which
now IS the game page itself (previously bounced to landing for auto-login). This branch
is confirmed dead on the Cloudflare Pages build regardless (`DEV_MODE=false` there, per
its own existing code comment), so no behavior change on the deployed target being tested.

## Tests

- `client/tests/shouldAutoAuthenticateForPath.spec.ts` — updated: `/` now expected `true`,
  `/landing` added to the marketing-routes `false` list (replacing `/`).
- `client/tests/route-loop.spec.tsx` — updated: `/` now asserts the gameplay page mounts
  (was asserting the landing page); added a case confirming `/landing` still serves the
  real landing page; `/game` case unchanged.

## Verified green

- `pnpm run check` (tsc) — clean
- `pnpm run test` (client) — 326 passed (was 325; net +1, existing tests updated not added)
- `pnpm run test:server` — 449 passed, 24 skipped (unchanged, no server files touched)
- `pnpm run build` — clean production build
