# 2026-07-13 — NFT metadata proxy via Cloudflare Pages Function (replaces PR #260)

## Context

PR #260 added external-origin `200` proxy rules to
`artifacts/frontier-al/client/public/_redirects` so that
`https://frontierprotocol.app/nft/metadata/2368` would resolve to the
Fly backend's ARC-3 JSON instead of the Vite SPA shell. Plot NFT ASAs
are minted with the branded domain as their assetURL
(`server/services/chain/land.ts:54`), so wallets and indexers hit the
branded-domain URL.

The PR's verified production curl shows the SPA was still being
served:

```
$ curl -i https://frontierprotocol.app/nft/metadata/2368
HTTP/2 200
content-type: text/html
body: <!DOCTYPE html><html lang="en" class="dark">… (Vite SPA shell)
```

**Root cause:** Cloudflare Pages `_redirects` only supports `200`
rewrites to *relative, same-site* URLs. The three proxy rules in PR
#260 used absolute `https://frontiernext.fly.dev/...` destinations,
which Pages silently ignored at the edge. Requests to
`/nft/metadata/*` therefore still fell through to the `/* →
/index.html` SPA fallback rule.

## Fix (this unit)

Replaced the unsupported `_redirects` proxy with a Cloudflare Pages
Function — the supported mechanism.

| File | Change |
|------|--------|
| `artifacts/frontier-al/client/functions/nft/metadata/[[path]].ts` | New — Pages Function entrypoint. The `[[path]]` filename is a Pages routing rule (catch-all optional) and matches `/nft/metadata` AND `/nft/metadata/<any path...>` in a single file. Dispatches to the shared proxy module. |
| `artifacts/frontier-al/client/functions/nft-metadata-proxy.ts` | New — shared, testable proxy logic. Forwards the request to `https://frontiernext.fly.dev` preserving upstream status / body / `Content-Type` / cache headers / query string. Supports GET + HEAD only (rejects POST/PUT/DELETE/PATCH with 405). Forwards only `accept` / `user-agent` request headers (no cookies, no auth, no client IP, no host). Returns 502 on upstream unreachable. Defense-in-depth `/nft/metadata` prefix check. |
| `artifacts/frontier-al/client/public/_routes.json` | New — scopes the Pages Function to `/nft/metadata/*` only; `/nft/biomes/*` is explicitly excluded so the static CDN biome art stays on the edge. |
| `artifacts/frontier-al/client/public/_redirects` | Updated — removed the three external-origin `/nft/metadata/*` proxy rules; only the `/* → /index.html` SPA fallback remains. |
| `artifacts/frontier-al/vite.config.ts` | Updated — added a `frontier-al:copy-pages-functions` plugin (apply: build) that copies `client/functions/` to `dist/public/functions/` on the production build. Vite only auto-copies `client/public/*`. |
| `artifacts/frontier-al/tsconfig.json` | Updated — added `client/functions/**/*` to the typecheck include list so the function is verified by `pnpm run check`. |
| `artifacts/frontier-al/client/tests/cloudflare-pages-function.spec.ts` | New — 22-case focused test on the handler (route mapping for plot/commander/weapon, query-string preservation, upstream status preservation, upstream content-type preservation, HEAD support, 405 for unsupported methods, 502 on upstream unreachable, header sanitization, upstream-base override, `/nft/metadata` prefix defense, allowed-methods set, plus the redirects/routes.json/functions source-layout regression). Mocks `fetch`; never contacts production. |
| `artifacts/frontier-al/client/tests/cloudflare-redirects.spec.ts` | Updated — repointed at the new mechanism (Pages Function + `_routes.json`, no external `/nft/metadata` rules in `_redirects`); 12 cases. |

## Routing scope (Cloudflare Pages project root)

- **Pages project root:** `artifacts/frontier-al/dist/public/` (the
  Vite build output, which is also the `outputDirectory` declared in
  `vercel.json` and the build output used by the Cloudflare Pages
  project).
- **Pages Function entrypoint at runtime:** `dist/public/functions/nft/metadata/[[path]].ts`
  (sourced from `client/functions/nft/metadata/[[path]].ts` via the
  new Vite plugin).
- **Shared proxy module at runtime:** `dist/public/functions/nft-metadata-proxy.ts`.
- **`_routes.json` behavior at runtime:** `include: ["/nft/metadata/*"]`
  restricts Pages Function invocation to those paths; `exclude:
  ["/nft/biomes/*"]` is a defense-in-depth check that prevents the
  function from ever running for a static biome file. Static assets,
  SPA routes, and the `/*` `_redirects` SPA fallback are not affected.

## Removed `_redirects` rules

The three unsupported external-origin rules from PR #260:

```
/nft/metadata/commander/:commanderId  https://frontiernext.fly.dev/nft/metadata/commander/:commanderId  200
/nft/metadata/weapon/:weaponId       https://frontiernext.fly.dev/nft/metadata/weapon/:weaponId       200
/nft/metadata/:plotId                https://frontiernext.fly.dev/nft/metadata/:plotId                200
```

Replaced by the Pages Function above. The `/* → /index.html` SPA
fallback is preserved.

## Verification

- **Focused test (new file):** `pnpm --filter @workspace/frontier-al exec vitest run client/tests/cloudflare-pages-function.spec.ts`
  → **22/22 pass.**
- **Focused test (updated file):** `pnpm --filter @workspace/frontier-al exec vitest run client/tests/cloudflare-redirects.spec.ts`
  → **12/12 pass.** Combined: **34/34.**
- **TypeScript:** `pnpm --filter @workspace/frontier-al run check` (tsc)
  → clean.
- **Client build:** `pnpm --filter @workspace/frontier-al exec vite build`
  → clean. `dist/public/functions/nft/metadata/[[path]].ts` and
  `dist/public/functions/nft-metadata-proxy.ts` are present in the
  build output. `dist/public/_routes.json` is also shipped.
- **`git diff --check`** → clean.
- **Self-audit:** diff is 8 files / 665 insertions / 72 deletions; no
  application code (no server, no chain, no ASA, no auth, no
  idempotency, no marketing copy, no archetype/energy, no
  dependencies). Routing-only change scoped to the Cloudflare Pages
  project root. NFT URL construction in `server/services/chain/*` is
  unchanged. Express `/nft/metadata/*` route on Fly is unchanged.

## Production verification (owner action)

Cloudflare Pages auto-creates a preview URL for the PR. After this
PR merges, the owner should run on the branded domain:

```bash
curl -i https://frontierprotocol.app/nft/metadata/2368
curl -i https://frontierprotocol.app/nft/metadata/commander/1
curl -i https://frontierprotocol.app/nft/metadata/weapon/1
curl -i https://frontierprotocol.app/nft/metadata/9999999
curl -i https://frontierprotocol.app/nft/biomes/forest.png
curl -i https://frontierprotocol.app/game
```

Expected (matches PR #260 acceptance, now actually achievable):

- `/nft/metadata/2368` → 200, `Content-Type: application/json`,
  ARC-3 body with `name`, `description`, `image`, `properties`.
- `/nft/metadata/commander/1` → 200, ARC-3 JSON.
- `/nft/metadata/weapon/1` → 200, ARC-3 JSON.
- `/nft/metadata/9999999` → 404, `Content-Type: application/json`,
  `{"error":"Plot not found"}` (NOT the SPA shell).
- `/nft/biomes/forest.png` → 200, `Content-Type: image/png`, static
  PNG bytes (still on the CDN, never hit the Function).
- `/game` → 200, `Content-Type: text/html`, SPA shell.

## Rollback

Revert the single merge commit. Removes the Pages Function, the
`nft-metadata-proxy.ts` module, the `_routes.json` scoping file, the
redirects cleanup, the Vite plugin, the tsconfig include, and both
test files in one revert. Cloudflare Pages reverts to its default
SPA fallback behavior (the broken PR #260 state — wallets see the
SPA shell for `/nft/metadata/*`).

## Out of scope (separate lanes, NOT this PR)

- **ASCEND ASA `764083761` on-chain URL reconfiguration** — the
  ASA's current URL points at a dead Replit placeholder. This is an
  OWNER-SIGNED ON-CHAIN ACTION (`asset_config` tx signed by the ASA
  manager address). Verified in the Perplexity launch-blocker audit;
  intentionally NOT bundled with the Pages-Function proxy PR.
- **Battle Planner / Battle Target Selector** — next lane after this
  routing fix.
- **Faction economy / treasury / equity / contribution-ledger** —
  separate future work.

## PR

- Branch: `fix/pages-function-nft-metadata-proxy`
- Head commit: `82f4c17`
- Base: `origin/main` at `354cbdf` (PR #260's merge commit `36fbf6c`,
  rewritten by the baton as `354cbdf`).
