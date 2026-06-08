# Dev Environment & Fresh-Container Setup

Memory-layer doc for how this monorepo bootstraps, why fresh containers (Claude
Code on the web, fresh clones, CI) need an install step before tooling works, and
the fragility points to watch. Companion to `DEPLOYMENT_ENV_CHECKLIST.md` (which
covers *runtime/deploy* env) — this doc covers *build/test/dev* setup.

> **Origin:** written 2026-06-08 after a web session hit
> `error TS2688: Cannot find type definition file for 'node' / 'vite/client'`
> because the reclone'd container had no installed dependencies. The fix is the
> `SessionStart` hook described in §3.

---

## 1. Shape of the workspace

pnpm workspace monorepo. 9 packages:

| Package | Path | Role |
|---------|------|------|
| `@workspace/frontier-al` | `artifacts/frontier-al` | The game (full stack) — primary app |
| `@workspace/api-server` | `artifacts/api-server` | Worker host (scaffold) |
| `@workspace/mockup-sandbox` | `artifacts/mockup-sandbox` | UI prototyping — **never ships to prod** (React 18/19 type mismatch) |
| `@workspace/db` | `lib/db` | Drizzle schema + client |
| `@workspace/api-spec` | `lib/api-spec` | OpenAPI/Orval contracts |
| `@workspace/api-zod` | `lib/api-zod` | Zod schemas |
| `@workspace/api-client-react` | `lib/api-client-react` | React Query client |
| `@workspace/scripts` | `scripts` | Utility scripts |

**Hard rules baked into config:**
- **pnpm only.** Root `package.json` `preinstall` deletes `package-lock.json`/`yarn.lock`
  and hard-exits if the user agent isn't pnpm.
- **Supply-chain delay.** `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` (packages
  must be ≥1 day old). Allowlist via `minimumReleaseAgeExclude` (`@replit/*`, `stripe-replit-sync`).
- **Linux-x64 only.** `pnpm-workspace.yaml` `overrides` strip darwin/win32 native binaries
  (esbuild, lightningcss, rollup). The repo is not set up to install on macOS/Windows as-is.
- **Committed lockfile.** `pnpm-lock.yaml` (~370 KB) must stay committed; `--frozen-lockfile`
  installs depend on it.

---

## 2. The fresh-container problem

A reclone'd container has source but **no `node_modules`**. Every tooling entry point
assumes deps are present:

| Command (`artifacts/frontier-al`) | Needs deps | Needs `DATABASE_URL` / chain env |
|-----------------------------------|:----------:|:--------------------------------:|
| `pnpm run check` (tsc) | ✅ | ❌ |
| `pnpm run test:server` (vitest, node) | ✅ | ❌ (logic/type only) |
| `pnpm run build` (`tsx script/build.ts` → Vite + esbuild) | ✅ | ❌ |
| `pnpm run dev` (`tsx server/index.ts`) | ✅ | ✅ (`server/index.ts` asserts DATABASE_URL/SESSION_SECRET/PUBLIC_BASE_URL; chain vars in prod) |
| `pnpm run db:push` (drizzle-kit) | ✅ | ✅ (live Postgres) |

**Key insight:** lint/test/build are pure and need **no** secrets — only `dev`/`db:push`
do. So the bootstrap step is *just* `pnpm install`; injecting placeholder DB/chain
secrets at session start is unnecessary and undesirable.

Without an install step, the first `check`/`test`/`build` fails with:
```
error TS2688: Cannot find type definition file for 'node'.
error TS2688: Cannot find type definition file for 'vite/client'.
```

---

## 3. The SessionStart hook (Claude Code on the web)

`.claude/hooks/session-start.sh` (registered in `.claude/settings.json`) runs on every
web session and hydrates the workspace:

- **Remote-only:** no-ops unless `$CLAUDE_CODE_REMOTE == "true"` — local/Replit dev keeps
  managing its own deps.
- **Install:** `pnpm install --frozen-lockfile --prefer-offline` at `$CLAUDE_PROJECT_DIR`
  (root install hydrates all 9 packages). Matches CI and `scripts/post-merge.sh`.
- **pnpm version:** uses the image's pnpm (10.33.0, == CI). Only falls back to `corepack`
  if pnpm is absent, to avoid pulling a newer pnpm than CI.
- **No secrets injected** (see §2).
- **Synchronous:** the session waits (~10s cold, <1s warm/cached) so deps are guaranteed
  ready before the agent runs anything. Switch to async (`echo '{"async":true,...}'`) if
  faster startup is preferred, accepting a race where early commands may run pre-install.

Validate locally:
```bash
CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR="$PWD" ./.claude/hooks/session-start.sh
```

After it merges to the **default branch**, all future web sessions use it.

---

## 4. How the other environments install (keep these in sync)

| Environment | Install command | Node | pnpm | Source |
|-------------|-----------------|:----:|:----:|--------|
| CI (PR + push to main) | `pnpm install --frozen-lockfile` | 22 | 10.33.0 | `.github/workflows/ci.yml` |
| Replit post-merge | `pnpm install --frozen-lockfile` then `pnpm --filter db push` | 24 | image | `scripts/post-merge.sh` |
| Replit runtime | image-managed | 24 | image | `.replit` (`modules = ["nodejs-24"]`) |
| Web session | `pnpm install --frozen-lockfile --prefer-offline` | image | 10.33.0 | `.claude/hooks/session-start.sh` |

---

## 5. Fragility points (similar issues found during the investigation)

1. **Node version skew:** Replit `nodejs-24` vs CI `node 22`. Both ≥22 and currently
   compatible, but a Node-24-only API would pass on Replit and break CI (or vice-versa).
   If you pin one, pin both.
2. **`scripts/post-merge.sh` needs a live DB:** it runs `pnpm --filter db push` (drizzle-kit),
   which **requires `DATABASE_URL`** and Postgres reachability. With the var unset/unreachable
   it fails within the 20s `[postMerge]` timeout in `.replit`, which can block the merge.
   The web SessionStart hook deliberately does **not** run `db:push` for this reason.
3. **`tsconfig` deprecation:** `artifacts/frontier-al/tsconfig.json` uses `baseUrl: "."`,
   deprecated in TS 7.0. The app pins TS 5.6.3 (no error yet) but the workspace root uses
   5.9.3 (`tsc --build` warns). Migrate to `paths`-only or set `"ignoreDeprecations": "6.0"`.
4. **TS version split:** app TS 5.6.3 vs root devDep 5.9.3 — `check` (app) and
   `typecheck:libs` (root `tsc --build`) run different compilers. Bump together.
5. **`bufferutil` build script ignored:** `pnpm` prints "Ignored build scripts: bufferutil"
   — it's an *optional* `ws` perf accelerator; pure-JS fallback works. Harmless; approve via
   `pnpm approve-builds` only if you want the native speedup.
6. **esbuild bundle allowlist is manual:** `script/build.ts` hardcodes which deps are bundled
   vs externalized. A new server dependency that must be bundled needs adding to the allowlist
   or the build/runtime breaks.
7. **`minimumReleaseAge` can block urgent patches:** a same-day security release won't install
   until it's ≥1 day old unless allowlisted — expected trade-off, just know the lever.

---

## 6. Quick reference

```bash
# Fresh container, from repo root:
pnpm install --frozen-lockfile          # hydrate all 9 packages

cd artifacts/frontier-al
pnpm run check                          # tsc — no DB needed
pnpm run test:server                    # vitest (node) — no DB needed
pnpm run build                          # Vite + esbuild — no DB needed
# dev / db:push additionally require DATABASE_URL (+ chain env for dev/prod)
```
