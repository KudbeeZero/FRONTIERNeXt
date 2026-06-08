# 2026-06-08 — Web SessionStart hook + dev-environment memory

## Why
A Claude Code web session reclones into a container with **no `node_modules`**, so
`pnpm run check`/`test:server`/`build` failed with
`TS2688: Cannot find type definition file for 'node' / 'vite/client'` until a manual
`pnpm install`. Every fresh session would repeat this.

## Done
- **`.claude/hooks/session-start.sh`** + **`.claude/settings.json`**: SessionStart hook,
  remote-only (`$CLAUDE_CODE_REMOTE`), runs `pnpm install --frozen-lockfile --prefer-offline`
  at `$CLAUDE_PROJECT_DIR`. Uses the image pnpm (10.33.0, == CI); falls back to corepack only
  if pnpm is missing. Synchronous. Injects **no** secrets (lint/test/build don't need them).
- **`docs/DEV_ENVIRONMENT.md`** (new, detailed): workspace shape, the fresh-container problem,
  the hook, per-env install matrix (CI/Replit/web), and fragility points found in the
  investigation (Node 22↔24 skew; `post-merge.sh` needs a live DB; `baseUrl` TS-7 deprecation;
  app TS 5.6.3 vs root 5.9.3; manual esbuild allowlist; `minimumReleaseAge` patch delay;
  `bufferutil` ignored build script).
- Memory layers wired: `CLAUDE.md` new "Fresh-container / web-session setup" section;
  `PROJECT MEMORY.md` §6 gotcha + §8 index pointer.

## Validation
- ✅ Hook: installs deps, idempotent, non-remote no-op (exit 0).
- ✅ Lint: `pnpm --filter @workspace/frontier-al run check` → exit 0.
- ✅ Test: one spec (`engine/markets/resolve.spec.ts`) → 10/10.

## Notes
- Hook runs **synchronous** (waits for install). Pro: deps guaranteed before the agent acts.
  Con: slower session start. Flip to async in the hook if faster startup is preferred.
- Investigation surfaced fragility items (see DEV_ENVIRONMENT.md §5) as future cleanups, not
  fixed here.
- Separate from the security-audit branch; opened as its own focused PR.
