// Cloudflare Pages Function entrypoint for /nft/metadata/* on the branded
// domain (frontierprotocol.app).
//
// This file lives at the Cloudflare Pages project root, not inside the Vite
// build output. The project root for the Cloudflare Pages app `frontieralgo`
// is `artifacts/frontier-al/`, so the `functions/` directory must be a
// sibling of `client/` and `dist/` at that level — Cloudflare reads
// functions from the project root and deploys them as Workers, separately
// from the static build output. Putting `functions/` inside `dist/public/`
// (the build output) is NOT discovered by Cloudflare.
//
// Cloudflare Pages routes by filename:
//   * `nft/metadata/[[path]].ts` matches /nft/metadata AND /nft/metadata/<any
//     path...>. The double-bracket `[[path]]` is a *catch-all* (the slug is
//     optional), so this single file handles the three metadata shapes
//     (plotId, commander/:id, weapon/:id) without needing three files.
//   * The static Vite build keeps owning /nft/biomes/*, /assets/*, /images/*,
//     /textures/*, /story/*, /favicon.png, /robots.txt, /sitemap.xml, and
//     every SPA route — see client/public/_routes.json (the include pattern
//     scopes THIS Function to /nft/metadata/* only) and _redirects (which
//     only retains the /* → /index.html SPA fallback now).
//
// All real work lives in nft-metadata-proxy.ts so the proxy can be unit-tested
// without spinning up Cloudflare.

import { handleNftMetadataRequest } from "../../nft-metadata-proxy";

interface PagesFunctionContext {
  request: Request;
  env: unknown;
  params: Record<string, string | string[]>;
  data: unknown;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
}

export const onRequest = async (context: PagesFunctionContext): Promise<Response> => {
  return handleNftMetadataRequest(context.request);
};
