# syntax=docker/dockerfile:1
#
# FRONTIER backend (artifacts/frontier-al) — container image for Fly.io.
#
# This is a pnpm monorepo: the deployable backend lives in artifacts/frontier-al
# and its server bundle is built with esbuild (dist/index.cjs), while its client
# is built with Vite (dist/public, served statically in production). The build
# needs the FULL workspace + devDeps; the runtime only needs the prod deps, so we
# use `pnpm deploy --prod` to emit a flattened, production-only node_modules and
# overlay the already-built `dist` on top of it.
#
# The server reads PORT (default 5000) and binds 0.0.0.0 — no app code change is
# needed for Fly. See docs/DEPLOY_FLY.md for secrets, certs and DNS wiring.

# ── Builder ───────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

# Pin pnpm to match CI (10.33.0) via corepack.
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy the whole workspace. A frozen-lockfile install needs every workspace
# package manifest, and the build needs the frontier-al source. .dockerignore
# keeps node_modules / build outputs / secrets out of the context.
COPY . .

# Full install (devDeps required: vite, esbuild, tsx, tailwind, …).
# --frozen-lockfile skips resolution, so the workspace minimumReleaseAge gate
# does not block the build.
RUN pnpm install --frozen-lockfile

# Build-time client flags (baked into the Vite bundle). Passed from fly.toml
# [build.args]. VITE_DEV_MODE='true' enables the no-wallet playtest entry; unset
# on a normal/mainnet build so the dev paths compile out. Defaults to off.
ARG VITE_DEV_MODE=""
ARG VITE_DEV_AUTOLOGIN=""
ENV VITE_DEV_MODE=$VITE_DEV_MODE
ENV VITE_DEV_AUTOLOGIN=$VITE_DEV_AUTOLOGIN

# Build the client (Vite → dist/public) and server (esbuild → dist/index.cjs).
RUN pnpm --filter @workspace/frontier-al run build

# Emit a production-only bundle (flattened node_modules, no devDeps).
# `pnpm deploy` respects .gitignore and therefore drops the (gitignored) dist,
# so we overlay the freshly-built dist back on top.
RUN pnpm --filter @workspace/frontier-al deploy --prod --legacy /app/deploy \
 && cp -r /app/artifacts/frontier-al/dist /app/deploy/dist

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

ENV NODE_ENV=production
# Fly routes to internal_port; the server falls back to 5000 when PORT is unset.
ENV PORT=5000

WORKDIR /app

# Self-contained production bundle: dist/index.cjs (server), dist/public (client),
# and a prod-only node_modules. cwd is /app so process.cwd()/dist/public resolves.
COPY --from=builder /app/deploy ./

# Drop privileges — the `node` user ships with the base image.
USER node

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
