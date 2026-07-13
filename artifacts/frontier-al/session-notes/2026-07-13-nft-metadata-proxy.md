# 2026-07-13 — NFT metadata proxy for the branded domain (PR #260)

## Context

The Perplexity Land Economy audit reported that
`https://frontierprotocol.app/nft/metadata/2368` returns the Vite
SPA shell instead of ARC-3 JSON, while
`https://frontiernext.fly.dev/nft/metadata/2368` returns the
correct JSON body. Plot NFT ASAs are minted with the branded
domain as their assetURL
(`server/services/chain/land.ts:54`), so wallets and indexers
resolve the branded-domain URL — which currently returns HTML.

## Verified problem (pre-fix)

```
$ curl -i https://frontierprotocol.app/nft/metadata/2368
HTTP/2 200
content-type: text/html
body: <!DOCTYPE html><html lang="en" class="dark">… (Vite SPA shell)

$ curl -i https://frontiernext.fly.dev/nft/metadata/2368
HTTP/2 200
content-type: application/json; charset=utf-8
body: {"name":"Frontier Plot #2368",...,"properties":{...}}
```

## Root cause

`artifacts/frontier-al/client/public/_redirects` did not exist.
Cloudflare Pages (the host of `frontierprotocol.app`) caught the
request with its default `/* → 200` SPA fallback and served
`/index.html`. No rule proxied the path to the Fly backend.

The static Vite build ships:
- `client/public/nft/biomes/*` (PNG/SVG biome art) — stays on the
  CDN, unaffected by this fix.
- `client/public/{assets,images,textures,story,favicon.png,robots.txt,sitemap.xml,globe-rebuild-preview.html}`
  — also unaffected.

The Express backend serves `/nft/metadata/*` on Fly, behind the
canonical `frontiernext.fly.dev` host.

## Fix

Added `artifacts/frontier-al/client/public/_redirects`:

```
/nft/metadata/commander/:commanderId  https://frontiernext.fly.dev/nft/metadata/commander/:commanderId  200
/nft/metadata/weapon/:weaponId        https://frontiernext.fly.dev/nft/metadata/weapon/:weaponId       200
/nft/metadata/:plotId                  https://frontiernext.fly.dev/nft/metadata/:plotId               200
/*                                    /index.html                                                       200
```

- Status `200` is a **transparent proxy**, not a 3xx redirect, so
  the wallet-visible URL stays on the branded domain and the body
  is the backend's ARC-3 JSON. No wallet re-resolves a different
  origin.
- ORDER MATTERS in Cloudflare Pages: each request matches the
  FIRST rule whose source pattern matches. The `/nft/metadata/*`
  proxy block is listed before the `/*` SPA fallback so the
  catch-all can never shadow it.
- `/nft/biomes/*` is deliberately NOT proxied — static CDN assets
  ship from `client/public/nft/biomes/` and Pages's static-asset
  serving wins for paths that exist on the CDN.
- `/api/*` is deliberately NOT proxied — the client bundles
  `VITE_API_URL` to Fly directly.

## Files changed

| File | Change |
|------|--------|
| `artifacts/frontier-al/client/public/_redirects` | New (37 lines) — Cloudflare Pages redirect rules. |
| `artifacts/frontier-al/client/tests/cloudflare-redirects.spec.ts` | New (128 lines) — 8-case regression spec on the committed rules. |

## Verification

- **Focused test:** `pnpm --filter @workspace/frontier-al run test -- client/tests/cloudflare-redirects.spec.ts`
  → **74/74 files, 466/466 tests pass** (8 new).
- **Typecheck:** `pnpm --filter @workspace/frontier-al run check` (tsc) → clean.
- **CI:** PR #260 — `Typecheck & server tests` PASSED, `Cloudflare Pages` PASSED (preview deploy green).
- **Self-audit:** diff is 2 files / 165 lines; no application code, no chain/ASA, no auth, no idempotency, no marketing copy, no archetype/energy, no dependencies touched.

## Production verification (owner action)

Cloudflare Pages auto-creates a preview URL for PRs. After this
PR merges, the owner should run:

```bash
curl -i https://frontierprotocol.app/nft/metadata/2368
curl -i https://frontierprotocol.app/nft/metadata/commander/1
curl -i https://frontierprotocol.app/nft/metadata/weapon/1
curl -i https://frontierprotocol.app/nft/biomes/forest.png
curl -i https://frontierprotocol.app/game
```

Expected:
- `/nft/metadata/2368` → 200, `Content-Type: application/json`,
  ARC-3 body with `name`, `description`, `image`, `properties`.
- `/nft/metadata/commander/1` → 200, ARC-3 JSON.
- `/nft/metadata/weapon/1` → 200, ARC-3 JSON.
- `/nft/biomes/forest.png` → 200, `Content-Type: image/png`, static
  PNG bytes (NOT proxied to Fly).
- `/game` → 200, `Content-Type: text/html`, SPA shell.

## Rollback

Revert the single merge commit. Removes both
`client/public/_redirects` and the regression spec in one
merge-revert; Pages reverts to its default SPA fallback behavior.

## Out of scope (separate lanes, NOT this PR)

- **ASCEND ASA `764083761` on-chain URL reconfiguration** — the
  ASA's current URL points at a dead Replit placeholder. This is
  an OWNER-SIGNED ON-CHAIN ACTION (`asset_config` tx signed by the
  ASA manager address `ZK55X7SGIGMLGORVNJHHPTYZMZOGSQNVROBHX7N27X6ZEQRHAZ2UPKOXQU`).
  Verified in the Perplexity launch-blocker audit; intentionally
  NOT bundled with the NFT-metadata proxy PR.
- **Marketing copy "permanent on-chain bonuses"** — INTENTIONAL
  roadmap language; no code implements it. A separate
  DOCUMENTATION/COPY PR may clarify status, but is not a blocker.
- **Archetype / energy / terraforming** — all CATALOG_ONLY by
  design (`shared/subplotArchitecture.ts`,
  `shared/energyGrid.ts`); no launch-blocker implication.
- **ascendPerDay = 0 in API responses** — INTENTIONAL fog-of-war /
  EPI redaction (`server/stateScope.ts:27`); works as designed for
  non-viewer parcels; viewer's own parcels show the real value.

## PR

- #260 — https://github.com/KudbeeZero/FRONTIERNeXt/pull/260
- Merge commit: `36fbf6c` on `main`.
