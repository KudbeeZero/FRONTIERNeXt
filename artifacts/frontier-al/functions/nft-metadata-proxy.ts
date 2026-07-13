// Shared proxy logic for the Cloudflare Pages Function that serves
// /nft/metadata/* on the branded domain (frontierprotocol.app) by forwarding
// requests to the Fly backend (frontiernext.fly.dev).
//
// Cloudflare Pages _redirects only supports `200` rewrites to relative
// same-site URLs — the previous attempt (PR #260) used absolute
// `https://frontiernext.fly.dev/...` destinations, which Pages silently
// ignored, so /nft/metadata/* fell through to the SPA fallback and wallets
// received the Vite index.html instead of ARC-3 JSON. This module is the
// supported Pages Function implementation: the Pages Function file
// (nft/metadata/[[path]].ts) is a thin shim that dispatches here.
//
// Contract:
//   * /nft/metadata/:plotId                → upstream /nft/metadata/:plotId
//   * /nft/metadata/commander/:commanderId → upstream /nft/metadata/commander/:commanderId
//   * /nft/metadata/weapon/:weaponId       → upstream /nft/metadata/weapon/:weaponId
//
// The handler preserves:
//   * the upstream HTTP status (including 4xx/5xx error JSON)
//   * the upstream response body
//   * the upstream Content-Type
//   * cache-relevant response headers (Cache-Control, ETag, Last-Modified)
//   * the request query string
//
// It does NOT forward unsafe or unnecessary request headers (no cookies, no
// authorization, no client IP, no host). It only supports the read methods
// the metadata endpoints actually serve (GET, HEAD); writes are rejected with
// 405 rather than proxied.

export const UPSTREAM_BASE = "https://frontiernext.fly.dev";

export const ALLOWED_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD"]);

const ALLOW_HEADER = "GET, HEAD";

export type MetadataFetch = (
  input: string,
  init?: { method?: string; headers?: HeadersInit; redirect?: "manual" | "follow" },
) => Promise<Response>;

export interface ProxyOptions {
  fetchImpl?: MetadataFetch;
  upstreamBase?: string;
}

export async function handleNftMetadataRequest(
  request: Request,
  options: ProxyOptions = {},
): Promise<Response> {
  const upstreamBase = options.upstreamBase ?? UPSTREAM_BASE;
  const fetchImpl =
    options.fetchImpl ?? ((input: string, init?: { method?: string; headers?: HeadersInit; redirect?: "manual" | "follow" }) => fetch(input, init));

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return jsonError(400, "Bad Request");
  }

  // Defense in depth — `_routes.json` should already scope this Function to
  // /nft/metadata/*, but reject anything that isn't under that prefix here
  // too so the handler is safe to wire up under any other routing config.
  if (url.pathname !== "/nft/metadata" && !url.pathname.startsWith("/nft/metadata/")) {
    return jsonError(404, "Not Found");
  }

  // The metadata endpoints are read-only. Reject writes rather than proxy
  // arbitrary POST/PUT/DELETE bodies to the Fly backend.
  if (!ALLOWED_METHODS.has(request.method)) {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed", method: request.method }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Allow": ALLOW_HEADER,
        },
      },
    );
  }

  // Preserve the exact path + query string the wallet sent so the upstream
  // sees the same shape it would have seen if the wallet had called Fly
  // directly. Plots, commanders, and weapons all funnel through the same
  // Express handler (server/routes.ts); the path itself selects the route.
  const upstreamUrl = upstreamBase + url.pathname + url.search;

  // Forward only the request headers the upstream needs to render a correct
  // response. Cookies, authorization, and client IP from the branded-domain
  // edge would either be irrelevant or a privacy regression — strip them.
  const headers = new Headers();
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);
  const userAgent = request.headers.get("user-agent");
  if (userAgent) headers.set("user-agent", userAgent);

  let upstream: Response;
  try {
    upstream = await fetchImpl(upstreamUrl, {
      method: request.method,
      headers,
      redirect: "manual",
    });
  } catch {
    // Don't leak upstream error detail to the wallet — just report
    // unreachable. Cloudflare's edge logs the underlying cause.
    return jsonError(502, "Upstream Unreachable");
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);
  const cacheControl = upstream.headers.get("cache-control");
  if (cacheControl) responseHeaders.set("cache-control", cacheControl);
  const etag = upstream.headers.get("etag");
  if (etag) responseHeaders.set("etag", etag);
  const lastModified = upstream.headers.get("last-modified");
  if (lastModified) responseHeaders.set("last-modified", lastModified);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
