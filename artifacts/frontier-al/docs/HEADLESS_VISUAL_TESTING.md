# Headless visual testing — render the real 3D globe in a sandbox, no display needed

> **Proven working 2026-07-06** in a Claude Code remote sandbox (Linux container, no GPU, no
> display, outbound HTTPS through a policy proxy). Produced full screenshots of the live
> 21,000-plot globe, the faction gate, and the `?dashboard=1` widget canvas. This doc is the
> strict, exact recipe — follow it verbatim before improvising.

## Why this works (and why naive attempts fail)

1. **WebGL without a GPU:** headless Chromium renders WebGL in software via SwiftShader when
   launched with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. The
   21k-plot globe builds fine — it just needs generous wait times (~30s after load).
2. **Never screenshot the production site from a sandboxed agent.** Sandbox egress proxies
   (e.g. the Claude Code agent proxy) reset full-browser TLS connections even when `curl`
   works — you'll get `net::ERR_CONNECTION_RESET` and waste an hour. **Run the game locally
   instead**: `localhost` traffic skips the proxy entirely.
3. **The server hard-requires Postgres** (`server/db.ts` throws without `DATABASE_URL`) — but
   a throwaway local cluster takes ~20s to stand up and the server seeds all 21,000 parcels
   itself on first boot (~1 min).

## The exact recipe

### 0. Preconditions
- Node 22+, pnpm, repo installed (`pnpm install` at root).
- Postgres binaries present (`/usr/lib/postgresql/16/bin` in the Claude sandbox — check with
  `ls /usr/lib/postgresql`).
- Playwright installed globally or in the tree, plus a Chromium binary
  (Claude sandbox: `NODE_PATH=/opt/node22/lib/node_modules`, browser at
  `/opt/pw-browsers/chromium` — do NOT run `playwright install`).

### 1. Throwaway Postgres (as a non-root user — initdb refuses root)
```bash
mkdir -p /var/tmp/pgfrontier && chown nobody:nogroup /var/tmp/pgfrontier
su -s /bin/bash nobody -c "\
  /usr/lib/postgresql/16/bin/initdb -D /var/tmp/pgfrontier/data -U frontier --auth=trust \
    > /var/tmp/pgfrontier/initdb.log 2>&1 && \
  /usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pgfrontier/data -l /var/tmp/pgfrontier/pg.log \
    -o '-p 5433 -k /var/tmp/pgfrontier' start && \
  /usr/lib/postgresql/16/bin/createdb -h /var/tmp/pgfrontier -p 5433 -U frontier frontier"
```
Gotchas hit in practice: `initdb` **cannot run as root**; the `nobody` user **cannot traverse
into the session scratchpad** (root-owned parent) — use `/var/tmp`.

### 2. Schema
```bash
cd artifacts/frontier-al
DATABASE_URL="postgresql://frontier@localhost:5433/frontier?sslmode=disable" \
  npx drizzle-kit push --force
```

### 3. Server (background)
```bash
NODE_ENV=development DEV_LOGIN_ENABLED=true SESSION_SECRET=localdevsecret \
PUBLIC_BASE_URL=http://localhost:5000 \
DATABASE_URL="postgresql://frontier@localhost:5433/frontier?sslmode=disable" \
  npx tsx server/index.ts > /tmp/server.log 2>&1 &
```
- `PUBLIC_BASE_URL` is **required** (startup throws without it). Chain secrets
  (`ALGORAND_ADMIN_*`) are optional in dev — blockchain features just disable with a warning.
- First boot seeds 21,000 parcels (~60s). Wait for `world seed complete` in the log, and
  verify with `curl -s --noproxy '*' http://localhost:5000/api/game/state | head -c 200`.
- `--noproxy '*'` matters on any curl to localhost when HTTPS_PROXY is set.

### 4. Client (background)
```bash
VITE_DEV_MODE=true npx vite --port 3000 --strictPort > /tmp/vite.log 2>&1 &
```
Vite's dev proxy (vite.config.ts) forwards `/api` and the WS to `:5000` — no extra config.

### 5. Capture — `script/visual-smoke.cjs`
A ready-made capture script is checked in at
[`script/visual-smoke.cjs`](../script/visual-smoke.cjs). Run it with:
```bash
NODE_PATH=/opt/node22/lib/node_modules node script/visual-smoke.cjs
```
What it does (and why each step exists):
- Launches Chromium with the SwiftShader flags above, 1600×900 viewport.
- **Auth:** POSTs `/api/dev/quick-auth` (gated by `DEV_LOGIN_ENABLED=true` server-side +
  `VITE_DEV_MODE=true` client-side) and writes `frontier_auth_token` /
  `frontier_dev_session` / `frontier_dev_address` into localStorage — the same three keys the
  real landing-page dev button sets. No wallet needed.
- **Faction gate:** clears the "Pick your faction" gate with **programmatic** `el.click()` via
  `page.evaluate` — Playwright's trusted clicks get intercepted by an overlay div here, so
  DOM-level clicks are the reliable path.
- **Waits ~30s** after navigation before the first screenshot (software-WebGL build time for
  21k plot meshes), then captures the globe, and `?dashboard=1` for the widget canvas.

### 6. Teardown
```bash
kill %1 %2 2>/dev/null   # server + vite (or by pid)
su -s /bin/bash nobody -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pgfrontier/data stop"
rm -rf /var/tmp/pgfrontier
```

## What this unlocks
- **Visual battle testing**: drive an attack via the dev player (the game APIs accept the dev
  session token), then screenshot the War Room, BattleWatchModal, and the globe cinematic
  while a battle resolves.
- **Before/after screenshots for UI PRs** — attach to the PR instead of "not browser-verified".
- **Dashboard/widget iteration** (`?dashboard=1`): the snap-grid canvas renders headlessly,
  so layout/animation work can be visually checked in-session.

## Known limits (honest)
- SwiftShader is slow: budget 30s+ per page settle; animations render but timing is not
  representative of real GPUs — don't judge animation smoothness from these captures.
- Wallet flows (Pera/Defly popups, WalletConnect pairing) still can't be exercised — the dev
  quick-auth path bypasses wallets entirely. Owner-on-device remains the only true wallet test.
- The dev player is faction-gated per browser context; the capture script clears the gate
  each run.
