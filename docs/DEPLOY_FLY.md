# Deploying the FRONTIER backend to Fly.io

The FRONTIER backend (`artifacts/frontier-al`) is deployed to Fly.io as
**`frontiernext`** in region **`ord`**, behind **`https://api.frontierprotocol.app`**.
The player frontend is served separately by Cloudflare Pages at
`https://frontierprotocol.app`.

> The backend also serves its own copy of the game UI (Vite build in
> `dist/public`), but players should reach the game via the Cloudflare Pages URL.
> `api.frontierprotocol.app` is the API/WebSocket origin.

## What's in the repo root

Fly's **"Deploy from GitHub"** flow scans the **repo root of the default branch
(`main`)**, so the deploy files live at the root even though the backend is a
subfolder:

- **`Dockerfile`** — multi-stage. Builds the whole pnpm workspace (client via
  Vite, server via esbuild → `dist/index.cjs`), then ships a production-only
  `pnpm deploy` bundle. Runs `node dist/index.cjs`.
- **`fly.toml`** — `app = frontiernext`, `primary_region = ord`,
  `internal_port = 5000`, a `GET /health` check, one always-on machine.
- **`.dockerignore`** — keeps `node_modules`, `.git`, `dist`, `.env`, logs and
  heavy non-build assets out of the build context.

No application code was changed: the server already reads `process.env.PORT`
(default `5000`) and binds `0.0.0.0` (`server/index.ts`), and exposes
`GET /health` → `200 OK`.

## Runtime facts

| | |
|---|---|
| Runtime | Node 22 (matches CI; `@types/node` ^20, runtime tested on v22) |
| Package manager | pnpm 10.33.0 (corepack, matches CI) |
| Build | `pnpm --filter @workspace/frontier-al run build` (Vite + esbuild) |
| Start | `node dist/index.cjs` (cwd `/app`, serves `dist/public`) |
| Listen | `0.0.0.0:${PORT:-5000}` |
| Health | `GET /health` → `200 "OK"` |

## Secrets & env vars

Set as Fly **secrets** (never commit). Full descriptions in
`artifacts/frontier-al/docs/DEPLOYMENT_ENV_CHECKLIST.md` and `ENV_VARS.md`.

Required to boot:

```bash
fly secrets set -a frontiernext \
  DATABASE_URL="postgres://…?sslmode=require" \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  PUBLIC_BASE_URL="https://api.frontierprotocol.app" \
  ALGORAND_ADMIN_MNEMONIC="…25 words…" \
  ALGORAND_ADMIN_ADDRESS="…admin address…"
```

Strongly recommended for production:

```bash
fly secrets set -a frontiernext \
  ADMIN_KEY="$(openssl rand -hex 32)" \
  CLIENT_ORIGIN="https://frontierprotocol.app"
  # add UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN ONLY if you run >1 machine
```

Non-secret env (`NODE_ENV`, `PORT`, `ALGORAND_NETWORK=testnet`) is set in
`fly.toml` `[env]`. `ALGORAND_NETWORK` must stay `testnet` unless the move to
mainnet has cleared `/mainnet-gate` **and** the `algo-auditor`.

### CORS

CORS is an explicit allowlist driven by `CLIENT_ORIGIN` (comma-separated, **no
wildcard** — credentials/cookies are in play). Set it to the exact frontend
origin(s):

```
CLIENT_ORIGIN=https://frontierprotocol.app
```

Add any additional origins actually used (e.g. `https://frontieralgo.pages.dev`
for the Cloudflare Pages preview) as extra comma-separated entries.

## Database migrations

Migrations are **applied manually** out-of-band (the app does not run them at
boot, and there is intentionally **no Fly `release_command`** for them — schema
changes are out of scope for deployment). Before first traffic, ensure
migrations `0000`–`0010` are applied to `DATABASE_URL` (see
`artifacts/frontier-al/migrations/` and the data-reconciliation docs).

## Deploy (owner runs these)

```bash
# 1. Create the app without deploying (links this repo's fly.toml).
fly launch --no-deploy --name frontiernext --region ord
#    (or validate the image only: fly deploy --build-only)

# 2. Set secrets (see above).
fly secrets set KEY=value -a frontiernext

# 3. Deploy.
fly deploy -a frontiernext

# 4. Issue the TLS cert for the API hostname.
fly certs add api.frontierprotocol.app -a frontiernext
```

## Cloudflare DNS (after a successful deploy)

`api.frontierprotocol.app` already exists in Cloudflare but is not yet pointed at
Fly. After the deploy + `fly certs add`:

1. Point the record at the target Fly gives you (`fly certs show
   api.frontierprotocol.app -a frontiernext`) — typically a `CNAME` to
   `frontiernext.fly.dev` (or the A/AAAA it requests).
2. Set it **DNS-only (grey cloud)** while Fly issues the certificate. You may
   re-enable the orange proxy afterward if desired, but grey-cloud avoids cert
   issuance problems.

## Frontend API wiring (Cloudflare Pages — document only)

The frontend reads the backend origin from Vite env vars at build time:

- `VITE_API_URL=https://api.frontierprotocol.app` — REST base
  (`client/src/lib/queryClient.ts`).
- `VITE_WS_URL=wss://api.frontierprotocol.app` — WebSocket base
  (`client/src/hooks/useGameSocket.ts`).

Set these in the Cloudflare Pages project env and rebuild the frontend so it
calls the Fly backend. (Also confirm `VITE_TEST_GLOBE` reads `false` before any
deploy.)

## Verification done in this change (no live deploy)

- `pnpm --filter @workspace/frontier-al run build` — green (client + server).
- `pnpm deploy --prod` bundle + overlaid `dist` — server boots and resolves
  **all** externalized modules (fails only on missing real secrets, as expected).
- `docker build -t frontiernext-fly .` — green.
