# 2026-07-06 — branded-domain login fix: stay on frontierprotocol.app, kill the popup storm

**Branch** `claude/wallet-domain-login-fix` · owner-reported, month-old: wallet login on
frontierprotocol.app throws ~12 popup windows + connection errors, then lands on
frontiernext.fly.dev instead of frontierprotocol.app/game.

## Root cause (live-probed + code-mapped)
1. frontierprotocol.app is Cloudflare Pages — static only. The deployed bundle had an empty
   `VITE_API_URL`, so all same-origin `/api/*` calls hit static files: GET → SPA HTML,
   POST `/api/dev/quick-auth` → **405** (probe-confirmed). Login could never work there.
2. The #162 workaround (`lib/gameUrl.ts`) therefore hard-jumped every non-fly host to
   `https://frontiernext.fly.dev/game`. localStorage (Bearer auth token + WalletConnect
   pairings) is per-origin → dropped on the hop → forced re-connect on fly.dev.
3. Pera resurfaces every leftover half-open WalletConnect pairing as its own popup on the next
   connect; `purgeStaleSession` only ran AFTER a failed connect, so pairings accumulated across
   origins/attempts → the ~12-window storm.
4. Fly CORS for the branded origin is already live (probe: correct `Access-Control-Allow-*`),
   but allow-headers lacked `x-admin-key` (admin page would fail cross-origin preflight).

## Fix (client-first, no dashboard dependency)
- **`lib/backendOrigin.ts` (new)**: runtime backend resolution — env override wins; same-origin
  on localhost/`*.fly.dev`; Fly backend on backend-less hosts. Pure + 8 unit tests.
- `lib/queryClient.ts` API base and `hooks/useGameSocket.ts` WS base use it.
- **52 raw `fetch("/api…")` sites across 24 files** rewritten through `resolveApiUrl()` (they
  bypassed the base and broke on the branded host). Scripted, tsc-verified.
- **`lib/gameUrl.ts`**: `/game` stays on the current origin (VITE_GAME_URL still overrides) —
  no more fly.dev hop; auth token + pairings survive.
- **`WalletContext.connect`**: purge stale pairings BEFORE dialing when the wallet isn't
  connected (was only after failure) — stops popup accumulation. One guarded line.
- `server/index.ts`: CORS allow-headers += `x-admin-key`.
- `ENV_VARS.md` updated (VITE_API_URL/VITE_WS_URL now optional; VITE_GAME_URL leave unset).

## Evidence
- Live probes: branded `/api/health` returns SPA HTML; branded quick-auth POST 405; Fly CORS
  headers correct for the branded origin; deployed branded bundle contains hardcoded
  `frontiernext.fly.dev/game`.
- Green: tsc · client **221** (213 + 8 new) · server 415/14 · build OK.

## Honest gaps
- **Not browser-verified** (sandbox). The popup storm involves Pera/WalletConnect internals —
  the pre-connect purge + no-hop should eliminate it, but the owner must smoke-test on
  frontierprotocol.app after the Cloudflare production deploy: connect wallet on landing →
  Enter Game → should stay on frontierprotocol.app/game with one wallet prompt, no popups.
- Requires BOTH deploys to take effect: Cloudflare Pages production (client) + Fly (server CORS
  header). Both trigger from main.
- Third-party-cookie auth cross-origin remains browser-dependent; Bearer token (primary
  mechanism) is unaffected and now survives since there's no origin hop.

## Merge + deploy outcome

**Merged to main as `7cde4a4c` (PR #175, squash).** Before merge, two independent review passes
(a code review + an adversarial "disruptor" pass, run in parallel, each blind to the other) both
caught the same two real gaps the 52-site scripted rewrite missed:
- `client/src/components/game/WarRoomPanel.tsx:254` — raw `fetch(url)` for `/api/parcels/attackable`
  (War Room targeting), never routed through `resolveApiUrl`.
- `client/src/pages/admin.tsx` — `adminFetch()` used a raw same-origin `fetch()`; this is also why
  the CORS `x-admin-key` allow-header change in this PR was, until this fix, dead code.

The disruptor pass additionally found a real (if narrow) race: `WalletContext.connect()` had no
reentrancy guard, so a second `connect()` call fired while the first was still in flight (e.g. a
fast double-tap re-opening the wallet picker inside the 250ms deferred-open window) would purge
the pairing the first attempt had just opened. Fixed with a `connectInFlight` ref guard.

All three fixed in a follow-up commit on the same branch/PR (`d6fc175` → `7cde4a4c`), re-verified:
tsc clean, client 221/221, server 415/14 skipped. **CI (run 28762805358) and Fly deploy (run
28763239489) both confirmed `completed`/`success` on the merge commit** — Fly's Deploy step
finished 2026-07-06T02:09:25Z. Cloudflare Pages redeploys the client from `main` on its own
GitHub integration (not a gated CI check).

**Still not browser-verified** — the owner needs to do the real smoke test on
frontierprotocol.app now that both deploys have landed.
