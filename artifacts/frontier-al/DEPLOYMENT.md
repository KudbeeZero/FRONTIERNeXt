# FRONTIER — Production Deployment Guide

## Architecture

FRONTIER consists of two deployable units, hosted separately:

| Unit | What it is | Host |
|------|-----------|------|
| **Backend** | Node.js + Express HTTP + WebSocket server (`server/`) | **Fly.io** (`frontiernext`, region `ord`) — see [`docs/DEPLOY_FLY.md`](../../docs/DEPLOY_FLY.md) |
| **Frontend SPA** | Vite-built React app (`client/`) | **Cloudflare Pages** (`frontierprotocol.app`) — own GitHub integration, redeploys automatically from `main` |

> The backend also serves its own copy of the built client (`dist/public`) as a
> fallback, but players reach the game via the Cloudflare Pages URL.
> `api.frontierprotocol.app` is the API/WebSocket origin the frontend calls.

This is a single-operator setup — one Fly app, one Cloudflare Pages project, no
multi-host fallback (Render/Railway/Heroku/Vercel configs have been removed
from the repo; they were never the deployed target).

## Deploying the backend

Full instructions, secrets checklist, CORS setup, DB-migration steps, and the
one-tap GitHub Actions deploy path: **[`docs/DEPLOY_FLY.md`](../../docs/DEPLOY_FLY.md)**.

## Deploying the frontend

Cloudflare Pages watches `main` and rebuilds automatically — no manual deploy
step. Build-time env vars (`VITE_API_URL`, `VITE_WS_URL`) point it at the Fly
backend; see `docs/DEPLOY_FLY.md`'s "Frontend API wiring" section.

## Local development

```bash
pnpm install
cp artifacts/frontier-al/.env.example artifacts/frontier-al/.env   # fill in DATABASE_URL, ALGORAND_*, etc.
pnpm --filter @workspace/frontier-al run dev   # server :5000 + Vite client :3000
```

Open `http://localhost:3000` — the Vite dev-server proxy forwards `/api`,
`/nft`, `/faction`, and `/ws` to `:5000` transparently; no `VITE_API_URL` /
`VITE_WS_URL` needed locally.

## Environment variables

Full reference: [`ENV_VARS.md`](./ENV_VARS.md) and
[`docs/DEPLOYMENT_ENV_CHECKLIST.md`](./docs/DEPLOYMENT_ENV_CHECKLIST.md).
