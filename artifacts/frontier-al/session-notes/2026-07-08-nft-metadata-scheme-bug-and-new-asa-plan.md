# 2026-07-08 — NFT metadata missing URL scheme (real bug, fixed) + new-ASA plan

## What prompted this

Owner asked to launch a new ASCEND token (same name, new ASA ID) since the
current one has a dead Replit metadata URL baked in from creation. Follow-up
questions: "how do we get the metadata working?" and "are the images linked
up?"

## Investigation

Checked the live `/nft/metadata/:plotId` response (via `frontiernext.fly.dev`,
the domain that actually works — see below) and found the `image`/
`external_url` fields have **no protocol scheme**:
```
"image": "frontierprotocol.app/nft/biomes/desert.png"
```
should be `"https://frontierprotocol.app/nft/biomes/desert.png"`. Every one
of ~10 call sites in `routes.ts` that builds these fields does
`${baseUrl}/...` where `baseUrl` comes straight from `process.env.PUBLIC_BASE_URL`
with no scheme validation. The on-chain `url` field of an already-minted
plot NFT (764909648, set at mint time) DOES have the correct
`https://api.frontierprotocol.app/...` scheme — proving `PUBLIC_BASE_URL`
was correctly set with a scheme at some earlier point and is now, live,
missing it. Confirmed the image files themselves are fine
(`https://frontierprotocol.app/nft/biomes/desert.png` → 200 OK, valid PNG) —
this was purely a missing-scheme string bug, not a missing-asset one.

## Fix

`server/services/chain/client.ts`'s `assertChainConfig()` already normalizes
`PUBLIC_BASE_URL` by deriving it from `REPLIT_DOMAINS` (with a scheme) when
unset. Extended the same startup normalization to also fix a scheme-less
value that was set directly — `if (set && !/^https?:\/\//.test(...))` prepend
`https://`. Fixed once at the single point every route reads from
(`assertChainConfig()` runs at server bootstrap, `server/index.ts:212`,
before any request is served), rather than patching ~10 individual call
sites in `routes.ts`.

New `server/services/chain/client.spec.ts` — pure env-var test, no live
chain/DB needed: scheme-less input gets `https://` prepended, an
already-correct URL is left untouched, `http://` (local dev) is respected
rather than double-prefixed, and the REPLIT_DOMAINS-derive path still works.

## api.frontierprotocol.app is still broken (separate issue, needs owner action)

Independent of the above: `https://api.frontierprotocol.app/*` currently
returns Cloudflare **525** ("SSL handshake failed with origin") on every
request — confirmed via direct curl (`cf-ray` header present, DNS resolves
to Cloudflare's edge). This is the SAME issue found earlier this session
(2026-07-07 production URL investigation) — `frontierprotocol.app` (the
frontend, Cloudflare Pages) works fine, but the `api.` subdomain specifically
can't complete TLS to whatever origin Cloudflare has configured for it. This
is Cloudflare DNS / origin-certificate configuration, not app code — I
cannot fix it from here. The app itself doesn't depend on this subdomain
working (client falls back to `frontiernext.fly.dev` correctly, confirmed
working throughout this session), but any on-chain metadata `url` set to
`api.frontierprotocol.app` (as the existing plot NFTs are) won't resolve for
external wallets/explorers until this is fixed on Cloudflare's dashboard.

## New ASA (owner's original ask) — plan, not executed

Found the existing mechanism: `server/services/chain/asa.ts`'s
`getOrCreateAscendAsa({ forceNew })`, gated by `FORCE_NEW_ASA` /
`FORCE_NEW_FRONTIER_ASA` env vars. Did **not** execute this — it:
- requires the admin wallet's private key (`ALGORAND_ADMIN_MNEMONIC`, a Fly
  secret this session has no access to) to sign the asset-create transaction
- only runs on server startup, so requires setting the env var on Fly AND
  triggering a redeploy
- **must be unset again immediately after** — the guard only skips creation
  when `forceNew` is false; leaving it `true` would mint a NEW "Ascend" ASA
  on every subsequent restart
- orphans every current player's ASCEND balance (including the owner's) from
  the game's tracked economy going forward — old balance stays in wallets on
  the old ASA, but the game starts awarding/tracking the new ASA ID instead

Good news found while investigating: `getOrCreateAscendAsa`'s create call
(`asa.ts:155`) already reads `PUBLIC_BASE_URL` for the token's `url` field —
so once the scheme-normalization fix above is live, a freshly-minted ASA
would automatically get the correct metadata URL, no further code change
needed. The ASA ID itself is never hardcoded anywhere in the client or
server (`getAscendAsaId()`/`getCachedAsaId()` throughout) — once a new one
exists, the running app picks it up automatically. "Filled everywhere" is
already true by design; the only manual step is the mint itself, which is
an ops/secrets action for the owner, not a code change.

## Scope check

Server-only (`client.ts` + new spec). No client code touched. The fix
touches string formatting around an existing, already-correct code path —
no new funds/ASA transfer logic. No mainnet-adjacent code.

## Verified green

- `pnpm run check` (tsc) — clean
- `pnpm run test:server` — 458 passed (was 454, +4 new), 24 skipped
- `pnpm run test` (client) — 330 passed, unchanged (no client files touched)
- `pnpm run build` — clean production build
