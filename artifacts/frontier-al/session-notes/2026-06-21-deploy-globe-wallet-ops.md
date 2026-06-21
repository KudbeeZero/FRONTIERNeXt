# 2026-06-21 — Live-ops: Fly deploy, globe look, wallet login

A long owner-directed live-ops session (deploy + UI firefighting), not the usual one-unit flow.
Owner paced it from mobile; **owner reviews/approves/merges every PR** (no auto-merge — locked).

## Shipped + merged (owner-merged each)
- **#85** — repaired a malformed `fly.toml` (Fly's "scale from UI" auto-merged #84 with a duplicate
  health check + two `[[vm]]` blocks → deploy failed at config parse). Fix-forward, valid TOML.
- **#86** — one-tap **DB Push** GH workflow (`workflow_dispatch` → `drizzle-kit push` against a
  `DATABASE_URL` repo secret) + `docs/DEPLOY_FLY.md`. Diagnosed the `/api/game/state` 500 = empty DB
  (no schema); after push, world auto-seeds (21k plots + 4 factions).
- **#87** — `/` boots straight into the game (landing bypassed). **#88** — fixed the `route-loop`
  test that pinned the old `/`→landing behavior (caused a red `main` after #87 merged on red).
- **#89** — ambient space scenery (moon/station/asteroid from owner art, backgrounds removed locally
  with Pillow → transparent PNGs) + parcel tile tuning. **Later reverted** (see #91/#92).
- **#90** — **wallet WS auth death-loop fix**: socket reconnected on ANY close incl. the server's
  `1008` auth-reject, exhausted the retry budget, then quit forever + never cleared the stale token =
  "flash → connection lost." Now: connect only with a token; on `1008` clear token + bounded re-auth
  (`authVersion`/`onSessionRejected`); `isAuthRejectClose` unit-tested. `/security-pass` PASS
  (`docs/audit/2026-06-21-wallet-ws-auth-loop-security-pass.md`).
- **#91** — globe declutter: removed moon/station/asteroid + atmosphere glow; background → black;
  (terrain briefly ×2.2 then reverted to ×1.4 within the PR); biome tiles restored; PLOT #N hover
  popup added; plot cards hidden on mobile.
- **#92** — Lute-only wallet + planet brightness ×1.4→**×2.6**. **Lute-only was wrong** (see #93).
- **#93** — **restore Pera for mobile** (Lute is a desktop *extension*, "not available in Safari").
  Picker = **Pera + Lute** (dropped Defly + Kibisis).

## State at end
- `main` @ **`30293d3`** (Merge #93). No open PR (before this closeout PR).
- **Deploy LIVE:** `frontiernext.fly.dev` up + seeded (`/api/game/state` 200). Frontend
  `frontierprotocol.app` points `VITE_API_URL`/`VITE_WS_URL` straight at `frontiernext.fly.dev`
  (the custom `api.frontierprotocol.app` host was abandoned — needed a Fly TLS cert, kept 530/525).
  `CLIENT_ORIGIN` set on Fly for CORS.
- **Globe:** no moon/station/glow, black bg, planet ×2.6, biome tiles, PLOT #N popup, mobile plot
  cards hidden.
- **Wallet:** Pera (mobile) + Lute (desktop). Testnet wallets (admin + 4 factions) in Fly secrets only.

## Tests (this closeout, on `origin/main` 30293d3)
- `pnpm --filter @workspace/frontier-al run check` → **green** (tsc).
- `test:server` → **332 passed / 11 skipped**.
- `test` (client) → **87 passed** (incl. `wsAuthClose.spec.ts`, `route-loop.spec.tsx`).

## Known risks / honest flags
- **Agent cannot see the rendered 3D globe** (no browser/GPU) — globe brightness + mobile wallet
  connect are **owner-verified only**. Owner last reported planet still dark + wallet tab-storm;
  ×2.6 + Pera+Lute is the latest attempt, not visually confirmed by the agent.
- **Mobile wallets:** Lute can't work on a phone (extension); Pera needs the **Pera app** installed.
  If Pera still spawns tabs → it's the connect loop (deep-link/auto-auth), not the wallet list.
- **Keep Fly `SESSION_SECRET` stable** across deploys (rotation = all sessions drop).
- `*.pages.dev` **preview** links have no backend env → "CONNECTION ERROR"; use the real site.
- Carryover: the wallet **wall** + **500-ASCEND welcome bonus** still live (entry overhaul is queued,
  gated). Migrations/secrets ops unchanged.

## Next unit (proposed)
**Animated plot menu** off the PLOT #N popup (zoom-to-plot + buy/upgrade) — cosmetic/UI, owner merges.
Then the gated entry overhaul (remove wall + no welcome bonus + accept-ASA) via `/security-pass`.

## Off-limits
No funds/ASA/transfer toward mainnet without `/mainnet-gate` + `algo-auditor`; don't merge
`wip/atomic-purchase`; nothing in `ops/kestra/` at mainnet; no mock/demo data in plot/HUD surfaces;
**do not auto-merge — owner merges every PR.**
