// ─────────────────────────────────────────────────────────────────────────────
// Regression test for the Cloudflare Pages routing of NFT metadata on the
// branded domain (frontierprotocol.app).
//
// History:
//   * PR #260 added external-origin `200` proxy rules to _redirects. Those
//     rules are UNSUPPORTED by Cloudflare Pages (which only accepts relative
//     same-site `200` destinations), so they were silently ignored at the
//     edge and /nft/metadata/* fell through to the SPA fallback — wallets
//     saw the Vite index.html instead of ARC-3 JSON.
//   * This PR replaces the unsupported _redirects proxy with a Cloudflare
//     Pages Function (client/functions/nft/metadata/[[path]].ts) scoped to
//     /nft/metadata/* by client/public/_routes.json. _redirects now contains
//     ONLY the /* → /index.html SPA fallback.
//
// This test does NOT spin up Cloudflare — it asserts the committed routing
// files are shaped the way the production wallet-visible URL depends on, so
// a typo can't silently re-break the proxy.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import path from "path";
import { describe, it, expect } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = resolve(__dirname, "..", "public");
const FUNCTIONS_DIR = resolve(__dirname, "..", "..", "functions");
const REDIRECTS = resolve(PUBLIC_DIR, "_redirects");
const ROUTES_JSON = resolve(PUBLIC_DIR, "_routes.json");
const FUNCTION_ENTRY = resolve(FUNCTIONS_DIR, "nft", "metadata", "[[path]].ts");
const PROXY_MODULE = resolve(FUNCTIONS_DIR, "nft-metadata-proxy.ts");

interface RedirectRule {
  pattern: string;
  destination: string;
  status: number;
}

/** Parse the Cloudflare Pages _redirects file. Blank lines and `#` comments are skipped. */
function parseRedirects(source: string): RedirectRule[] {
  return source
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((line) => {
      const parts = line.split(/\s+/);
      if (parts.length < 2) {
        throw new Error(`bad _redirects line (need ≥ 2 columns): ${JSON.stringify(line)}`);
      }
      const [pattern, destination, statusRaw] = parts;
      const status = statusRaw ? Number(statusRaw) : 200;
      if (!Number.isInteger(status) || status < 200 || status > 599) {
        throw new Error(`bad _redirects status on line: ${JSON.stringify(line)}`);
      }
      return { pattern, destination, status };
    });
}

describe("client/public/_redirects — branded-domain SPA fallback (no external-origin proxy)", () => {
  it("the _redirects file exists at client/public/_redirects", () => {
    expect(existsSync(REDIRECTS), `expected ${REDIRECTS} to exist`).toBe(true);
  });

  it("keeps a SPA fallback rule (/* → /index.html, 200)", () => {
    const source = readFileSync(REDIRECTS, "utf8");
    const rules = parseRedirects(source);

    const spaRule = rules.find((r) => r.pattern === "/*");
    expect(spaRule, "missing /* SPA fallback").toBeDefined();
    expect(spaRule!.destination).toBe("/index.html");
    expect(spaRule!.status).toBe(200);
  });

  it("contains no external-origin /nft/metadata/* proxy rule (PR #260 fix)", () => {
    const source = readFileSync(REDIRECTS, "utf8");
    const rules = parseRedirects(source);

    for (const rule of rules) {
      // Cloudflare Pages only accepts relative `200` destinations, so the
      // absolute Fly URLs that PR #260 used would be silently ignored. The
      // NFT metadata proxy is now a Pages Function (see _routes.json), not
      // a _redirects rule, so no rule in this file should target Fly.
      expect(
        /^https?:\/\//i.test(rule.destination),
        `absolute destination is not allowed in _redirects: ${JSON.stringify(rule)}`,
      ).toBe(false);
    }
  });

  it("contains no rule that matches /nft/metadata/* at all (proxy moved to Pages Function)", () => {
    const source = readFileSync(REDIRECTS, "utf8");
    const rules = parseRedirects(source);

    const nftMetadataRule = rules.find(
      (r) => r.pattern === "/nft/metadata" || r.pattern.startsWith("/nft/metadata/"),
    );
    expect(
      nftMetadataRule,
      "no /nft/metadata/* rule is expected in _redirects — proxy now lives in client/functions/nft/metadata/[[path]].ts",
    ).toBeUndefined();
  });

  it("does not touch /nft/biomes/* (static CDN assets stay on the branded host)", () => {
    const source = readFileSync(REDIRECTS, "utf8");
    const rules = parseRedirects(source);

    const biomeRule = rules.find((r) => r.pattern.startsWith("/nft/biomes/"));
    expect(
      biomeRule,
      "no /nft/biomes/* proxy rule is expected — those PNGs ship from client/public/nft/biomes/ and must stay on the CDN",
    ).toBeUndefined();
  });

  it("does not proxy /api/* (the client bundles VITE_API_URL to the Fly backend directly)", () => {
    const source = readFileSync(REDIRECTS, "utf8");
    const rules = parseRedirects(source);

    const apiRule = rules.find((r) => r.pattern.startsWith("/api/"));
    expect(apiRule, "no /api/* redirect rule is expected — the client points directly at the Fly backend").toBeUndefined();
  });
});

describe("client/public/_routes.json — Pages Function scope", () => {
  it("the _routes.json file exists at client/public/_routes.json", () => {
    expect(existsSync(ROUTES_JSON), `expected ${ROUTES_JSON} to exist`).toBe(true);
  });

  it("scopes Pages Functions to /nft/metadata/* only (no other paths trigger a Function)", () => {
    const source = readFileSync(ROUTES_JSON, "utf8");
    const parsed = JSON.parse(source) as { version: number; include: string[]; exclude?: string[] };
    expect(parsed.version).toBe(1);
    expect(parsed.include).toEqual(["/nft/metadata/*"]);
  });

  it("excludes /nft/biomes/* from the Pages Function (defense-in-depth on top of the static-asset path)", () => {
    const source = readFileSync(ROUTES_JSON, "utf8");
    const parsed = JSON.parse(source) as { version: number; include: string[]; exclude?: string[] };
    expect(parsed.exclude ?? []).toContain("/nft/biomes/*");
  });
});

describe("client/functions — Pages Function source layout", () => {
  it("ships the Pages Function entrypoint at client/functions/nft/metadata/[[path]].ts", () => {
    expect(existsSync(FUNCTION_ENTRY), `expected ${FUNCTION_ENTRY} to exist`).toBe(true);
  });

  it("ships the shared proxy module at client/functions/nft-metadata-proxy.ts", () => {
    expect(existsSync(PROXY_MODULE), `expected ${PROXY_MODULE} to exist`).toBe(true);
  });

  it("entrypoint imports the shared proxy module (not a re-implementation)", () => {
    const source = readFileSync(FUNCTION_ENTRY, "utf8");
    expect(source).toMatch(/from\s+["']\.\.\/\.\.\/nft-metadata-proxy["']/);
  });
});
