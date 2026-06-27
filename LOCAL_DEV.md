# Local Development — Quick Start

Get the FRONTIERNeXt monorepo running on a fresh desktop. The flagship app is
**FRONTIER-AL** (`artifacts/frontier-al`); these steps boot its server + client locally.

> This is the *developer* setup. For how the game is played, see
> [`artifacts/frontier-al/GETTING_STARTED.md`](artifacts/frontier-al/GETTING_STARTED.md).
> For production deploys, see [`artifacts/frontier-al/DEPLOYMENT.md`](artifacts/frontier-al/DEPLOYMENT.md).
> Full env reference: [`artifacts/frontier-al/ENV_VARS.md`](artifacts/frontier-al/ENV_VARS.md).

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node** | **22+** | CI runs Node 22. |
| **pnpm** | **10.33.0** | **pnpm only** — `npm`/`yarn` are blocked by a `preinstall` hook. Enable via corepack. |
| **PostgreSQL** | **16** | Mandatory — the server will not boot without a database (see §3). |

```bash
# Enable the pinned pnpm via corepack (ships with Node)
corepack enable
corepack prepare pnpm@10.33.0 --activate
```

## 2. Clone & install

```bash
git clone https://github.com/KudbeeZero/FRONTIERNeXt.git
cd FRONTIERNeXt
pnpm install            # workspace install (pnpm only)
```

## 3. Start a local Postgres + apply migrations

`DATABASE_URL` is **required** — `server/storage.ts` throws a fatal error at startup
if it's unset (there is no in-memory fallback). The quickest local DB:

```bash
# Same image CI uses. Leaves Postgres on localhost:5432 (user/pass: postgres)
docker run --name frontier-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=frontier -p 5432:5432 -d postgres:16
```

Then apply the Drizzle migrations (`migrations/0000`–`0011`):

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/frontier?sslmode=disable" \
  pnpm --filter @workspace/frontier-al run db:push
```

## 4. Configure environment

Copy the template and edit it:

```bash
cp artifacts/frontier-al/.env.example artifacts/frontier-al/.env
```

Minimum to boot the game locally with **no wallet / no TestNet ALGO** (dev sentinel
player). Edit `artifacts/frontier-al/.env` to:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/frontier?sslmode=disable
ALGORAND_NETWORK=testnet
SESSION_SECRET=any-local-dev-string-min-16-chars
NODE_ENV=development
PORT=5000                 # ⚠ template ships PORT=3000 which collides with the client — use 5000
CLIENT_ORIGIN=http://localhost:3000
PUBLIC_BASE_URL=http://localhost:5000

# No-wallet dev play (NEVER set these on mainnet):
DEV_LOGIN_ENABLED=true    # server: enables POST /api/dev/quick-auth (fail-closed)
VITE_DEV_MODE=true        # client: shows the "⚙ Dev / Test Mode" button
VITE_DEV_AUTOLOGIN=true   # client: zero-click — drop straight into the game on load
```

- `ALGORAND_ADMIN_MNEMONIC` / `ALGORAND_ADMIN_ADDRESS` are only needed for **real
  on-chain** ops (ASA creation, NFT minting/transfer) — leave the placeholders for plain
  UI/gameplay dev.
- `UPSTASH_REDIS_*` is optional; without it the app uses per-process in-memory stores
  (fine for single-instance local dev).
- See [`ENV_VARS.md`](artifacts/frontier-al/ENV_VARS.md) for the complete list.

## 5. Run it (two terminals)

```bash
# Terminal 1 — API + WebSocket server on :5000
pnpm --filter @workspace/frontier-al run dev:server

# Terminal 2 — Vite client on :3000 (proxies /api and /ws to :5000)
pnpm --filter @workspace/frontier-al run dev:client
```

Open **http://localhost:3000**. With the dev flags above you land straight in the game
as the shared `DEV-TEST-COMMANDER`.

> Second app (optional): the story-mode prologue —
> `pnpm --filter @workspace/aether-journey run dev`.

## 6. Verify your setup

```bash
pnpm run typecheck                                    # whole-workspace tsc (project refs)
pnpm --filter @workspace/frontier-al run check        # frontier-al typecheck
pnpm --filter @workspace/frontier-al run test:server  # expect 411 passed / 14 skipped
pnpm --filter @workspace/frontier-al run test         # client — expect 189 passed
pnpm --filter @workspace/frontier-al run build        # full production build
```

## 7. Gotchas

- **`DATABASE_URL` is fatal if missing** — boot fails with a clear `[FATAL]` message. Run
  the Postgres step first.
- **pnpm only** — `npm install` / `yarn` abort via the root `preinstall` hook.
- **`PORT` in the template is `3000`** — that collides with the Vite client; set `PORT=5000`
  (or unset it; the server defaults to 5000).
- **Supply-chain guard** — `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` (1 day):
  brand-new dependency versions are refused unless allowlisted. Prefer the workspace
  `catalog:` for shared deps.
- **`mockup-sandbox`** is excluded from the aggregate typecheck by design.

## 8. How work lands here

This repo runs a **one-chat = one-reviewed-PR** loop — read
[`CLAUDE.md`](CLAUDE.md) and [`docs/SESSION_PROTOCOL.md`](docs/SESSION_PROTOCOL.md) before
making changes. Develop on a branch, keep tests green, open one PR into `main`.
