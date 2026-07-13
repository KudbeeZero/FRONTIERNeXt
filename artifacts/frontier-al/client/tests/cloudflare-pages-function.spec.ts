// ─────────────────────────────────────────────────────────────────────────────
// Focused tests for the Cloudflare Pages Function that serves
// /nft/metadata/* on the branded domain (frontierprotocol.app) by proxying
// to the Fly backend (frontiernext.fly.dev).
//
// The function is split into two source files:
//   * client/functions/nft/metadata/[[path]].ts   — Pages Function entrypoint
//     (filename with [[ ]] is a Cloudflare routing convention).
//   * client/functions/nft-metadata-proxy.ts      — the proxy logic, imported
//     by the function entrypoint AND exercised by this test (mocked fetch).
//
// `fetch` is mocked; the tests never contact the real Fly backend.
// The test also pins the _redirects and _routes.json shape so a typo at the
// edge can't silently re-break the wallet-visible URL.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import path from "path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  handleNftMetadataRequest,
  UPSTREAM_BASE,
  ALLOWED_METHODS,
} from "../functions/nft-metadata-proxy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = resolve(__dirname, "..", "public");
const REDIRECTS_PATH = resolve(PUBLIC_DIR, "_redirects");
const ROUTES_PATH = resolve(PUBLIC_DIR, "_routes.json");
const FUNCTIONS_DIR = resolve(__dirname, "..", "functions");
const PROXY_PATH = resolve(FUNCTIONS_DIR, "nft-metadata-proxy.ts");
const FUNCTION_ENTRY_PATH = resolve(FUNCTIONS_DIR, "nft", "metadata", "[[path]].ts");

/** Minimal helper: build a `Request` like Cloudflare Pages would hand the Function. */
function makeRequest(url: string, init: RequestInit = {}): Request {
  return new Request(url, init);
}

/** Build a mocked Response for the upstream Fly backend. */
function upstreamResponse(opts: {
  status: number;
  body?: string | null;
  contentType?: string;
  cacheControl?: string;
  etag?: string;
  lastModified?: string;
}): Response {
  const headers = new Headers();
  if (opts.contentType) headers.set("content-type", opts.contentType);
  if (opts.cacheControl) headers.set("cache-control", opts.cacheControl);
  if (opts.etag) headers.set("etag", opts.etag);
  if (opts.lastModified) headers.set("last-modified", opts.lastModified);
  return new Response(opts.body ?? null, { status: opts.status, headers });
}

describe("client/functions/nft-metadata-proxy.ts — handler behavior", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies a plot metadata request to the matching path on the Fly backend", async () => {
    fetchMock.mockResolvedValue(
      upstreamResponse({
        status: 200,
        body: JSON.stringify({ name: "Frontier Plot #2368" }),
        contentType: "application/json; charset=utf-8",
      }),
    );

    const response = await handleNftMetadataRequest(
      makeRequest("https://frontierprotocol.app/nft/metadata/2368"),
      { fetchImpl: fetchMock as unknown as typeof fetch },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://frontiernext.fly.dev/nft/metadata/2368");
    expect(calledInit.method).toBe("GET");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await response.text()).toBe('{"name":"Frontier Plot #2368"}');
  });

  it("proxies a commander metadata request to /nft/metadata/commander/:id", async () => {
    fetchMock.mockResolvedValue(
      upstreamResponse({
        status: 200,
        body: "{}",
        contentType: "application/json; charset=utf-8",
      }),
    );

    const response = await handleNftMetadataRequest(
      makeRequest("https://frontierprotocol.app/nft/metadata/commander/1"),
      { fetchImpl: fetchMock as unknown as typeof fetch },
    );

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://frontiernext.fly.dev/nft/metadata/commander/1");
    expect(response.status).toBe(200);
  });

  it("proxies a weapon metadata request to /nft/metadata/weapon/:id", async () => {
    fetchMock.mockResolvedValue(
      upstreamResponse({
        status: 200,
        body: "{}",
        contentType: "application/json; charset=utf-8",
      }),
    );

    const response = await handleNftMetadataRequest(
      makeRequest("https://frontierprotocol.app/nft/metadata/weapon/1"),
      { fetchImpl: fetchMock as unknown as typeof fetch },
    );

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://frontiernext.fly.dev/nft/metadata/weapon/1");
    expect(response.status).toBe(200);
  });

  it("preserves the query string when proxying", async () => {
    fetchMock.mockResolvedValue(
      upstreamResponse({ status: 200, body: "{}", contentType: "application/json" }),
    );

    await handleNftMetadataRequest(
      makeRequest("https://frontierprotocol.app/nft/metadata/2368?network=testnet&v=2"),
      { fetchImpl: fetchMock as unknown as typeof fetch },
    );

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(
      "https://frontiernext.fly.dev/nft/metadata/2368?network=testnet&v=2",
    );
  });

  it("preserves the upstream status (e.g. 404 for an unknown plot) instead of returning the SPA", async () => {
    fetchMock.mockResolvedValue(
      upstreamResponse({
        status: 404,
        body: JSON.stringify({ error: "Plot not found" }),
        contentType: "application/json; charset=utf-8",
      }),
    );

    const response = await handleNftMetadataRequest(
      makeRequest("https://frontierprotocol.app/nft/metadata/9999999"),
      { fetchImpl: fetchMock as unknown as typeof fetch },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await response.text()).toBe('{"error":"Plot not found"}');
  });

  it("preserves the upstream Content-Type (and the cache headers that matter for indexers)", async () => {
    fetchMock.mockResolvedValue(
      upstreamResponse({
        status: 200,
        body: "{}",
        contentType: "application/json; charset=utf-8",
        cacheControl: "public, max-age=300",
        etag: '"abc123"',
        lastModified: "Mon, 13 Jul 2026 00:00:00 GMT",
      }),
    );

    const response = await handleNftMetadataRequest(
      makeRequest("https://frontierprotocol.app/nft/metadata/2368"),
      { fetchImpl: fetchMock as unknown as typeof fetch },
    );

    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(response.headers.get("etag")).toBe('"abc123"');
    expect(response.headers.get("last-modified")).toBe("Mon, 13 Jul 2026 00:00:00 GMT");
  });

  it("allows HEAD requests (some wallets pre-check existence) without calling upstream unsafe", async () => {
    fetchMock.mockResolvedValue(
      upstreamResponse({ status: 200, body: null, contentType: "application/json" }),
    );

    const response = await handleNftMetadataRequest(
      makeRequest("https://frontierprotocol.app/nft/metadata/2368", { method: "HEAD" }),
      { fetchImpl: fetchMock as unknown as typeof fetch },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, calledInit] = fetchMock.mock.calls[0];
    expect(calledInit.method).toBe("HEAD");
    expect(response.status).toBe(200);
  });

  it("rejects POST/PUT/DELETE with 405 (does NOT proxy arbitrary writes)", async () => {
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      fetchMock.mockReset();
      const response = await handleNftMetadataRequest(
        makeRequest("https://frontierprotocol.app/nft/metadata/2368", { method }),
        { fetchImpl: fetchMock as unknown as typeof fetch },
      );
      expect(response.status, `${method} should be rejected`).toBe(405);
      expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
      expect(response.headers.get("allow")).toBe("GET, HEAD");
      expect(fetchMock, `${method} should never reach upstream`).not.toHaveBeenCalled();
    }
  });

  it("returns 502 when the upstream is unreachable, without leaking internal detail", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await handleNftMetadataRequest(
      makeRequest("https://frontierprotocol.app/nft/metadata/2368"),
      { fetchImpl: fetchMock as unknown as typeof fetch },
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    const body = await response.text();
    expect(body).not.toContain("ECONNREFUSED");
    expect(body).toContain("Upstream Unreachable");
  });

  it("forwards only accept / user-agent request headers (no cookies / auth / ip)", async () => {
    fetchMock.mockResolvedValue(
      upstreamResponse({ status: 200, body: "{}", contentType: "application/json" }),
    );

    await handleNftMetadataRequest(
      makeRequest("https://frontierprotocol.app/nft/metadata/2368", {
        headers: {
          accept: "application/json",
          "user-agent": "pera-wallet/1.0",
          cookie: "session=secret",
          authorization: "Bearer leaked",
          "x-forwarded-for": "1.2.3.4",
          origin: "https://frontierprotocol.app",
        },
      }),
      { fetchImpl: fetchMock as unknown as typeof fetch },
    );

    const [, calledInit] = fetchMock.mock.calls[0];
    const sent = new Headers(calledInit.headers);
    expect(sent.get("accept")).toBe("application/json");
    expect(sent.get("user-agent")).toBe("pera-wallet/1.0");
    expect(sent.has("cookie")).toBe(false);
    expect(sent.has("authorization")).toBe(false);
    expect(sent.has("x-forwarded-for")).toBe(false);
    expect(sent.has("origin")).toBe(false);
  });

  it("uses the configured upstream base when overridden (test-only override)", async () => {
    fetchMock.mockResolvedValue(
      upstreamResponse({ status: 200, body: "{}", contentType: "application/json" }),
    );

    await handleNftMetadataRequest(
      makeRequest("https://frontierprotocol.app/nft/metadata/2368"),
      { fetchImpl: fetchMock as unknown as typeof fetch, upstreamBase: "https://example.test" },
    );

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://example.test/nft/metadata/2368");
    expect(UPSTREAM_BASE).toBe("https://frontiernext.fly.dev");
  });

  it("rejects requests outside /nft/metadata (defense in depth — _routes.json should already scope this)", async () => {
    const response = await handleNftMetadataRequest(
      makeRequest("https://frontierprotocol.app/api/game/state"),
      { fetchImpl: fetchMock as unknown as typeof fetch },
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exposes only GET + HEAD as allowed methods", () => {
    expect(Array.from(ALLOWED_METHODS).sort()).toEqual(["GET", "HEAD"]);
  });
});

describe("client/public/_redirects — branded-domain SPA fallback (PR #260 external-origin rules removed)", () => {
  it("exists at client/public/_redirects", () => {
    expect(existsSync(REDIRECTS_PATH), `expected ${REDIRECTS_PATH} to exist`).toBe(true);
  });

  it("no longer contains an external-origin /nft/metadata/* proxy rule (PR #260 fix)", () => {
    const source = readFileSync(REDIRECTS_PATH, "utf8");
    const lines = source
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));

    for (const line of lines) {
      // External-origin rules would target https://frontiernext.fly.dev/nft/metadata/...
      // (or any absolute URL under that path). Reject every external-origin
      // metadata rule here, regardless of which row it sits in.
      expect(
        /\bnft\/metadata\b.*\bhttps?:\/\//i.test(line),
        `external-origin /nft/metadata rule is no longer allowed: ${JSON.stringify(line)}`,
      ).toBe(false);
      // And no absolute Fly URL of any shape should remain in the file.
      expect(
        line.includes("https://frontiernext.fly.dev"),
        `absolute Fly URL no longer allowed in _redirects (Pages only supports relative status-200 rewrites): ${JSON.stringify(line)}`,
      ).toBe(false);
    }
  });

  it("retains the /* → /index.html SPA fallback (status 200)", () => {
    const source = readFileSync(REDIRECTS_PATH, "utf8");
    const lines = source
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));

    const spaRule = lines.find((l) => l.split(/\s+/)[0] === "/*");
    expect(spaRule, "missing /* SPA fallback").toBeDefined();
    const [, dest, status] = spaRule!.split(/\s+/);
    expect(dest).toBe("/index.html");
    expect(status).toBe("200");
  });
});

describe("client/public/_routes.json — Pages Function scope", () => {
  it("exists at client/public/_routes.json", () => {
    expect(existsSync(ROUTES_PATH), `expected ${ROUTES_PATH} to exist`).toBe(true);
  });

  it("scopes Pages Functions to /nft/metadata/* only", () => {
    const source = readFileSync(ROUTES_PATH, "utf8");
    const parsed = JSON.parse(source) as { version: number; include: string[]; exclude?: string[] };
    expect(parsed.version).toBe(1);
    expect(parsed.include).toContain("/nft/metadata/*");
  });

  it("excludes /nft/biomes/* from the Pages Function (static CDN assets stay on the edge)", () => {
    const source = readFileSync(ROUTES_PATH, "utf8");
    const parsed = JSON.parse(source) as { version: number; include: string[]; exclude?: string[] };
    expect(parsed.exclude ?? []).toContain("/nft/biomes/*");
  });
});

describe("client/functions — Pages Function source layout", () => {
  it("ships the shared proxy module at client/functions/nft-metadata-proxy.ts", () => {
    expect(existsSync(PROXY_PATH), `expected ${PROXY_PATH} to exist`).toBe(true);
  });

  it("ships the Pages Function entrypoint at client/functions/nft/metadata/[[path]].ts", () => {
    expect(existsSync(FUNCTION_ENTRY_PATH), `expected ${FUNCTION_ENTRY_PATH} to exist`).toBe(true);
  });

  it("entrypoint imports the shared proxy module (not a re-implementation)", () => {
    const source = readFileSync(FUNCTION_ENTRY_PATH, "utf8");
    expect(source).toMatch(/from\s+["']\.\.\/\.\.\/nft-metadata-proxy["']/);
  });
});
