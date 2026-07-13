// ─────────────────────────────────────────────────────────────────────────────
// Regression test for the Cloudflare Pages _redirects rules committed at
// artifacts/frontier-al/client/public/_redirects.
//
// The branded domain (frontierprotocol.app) is a Cloudflare Pages static host
// with no Express behind it. Plot/commander/weapon NFT metadata is served by
// the Fly backend (frontiernext.fly.dev). Plot NFT ASAs carry the branded
// domain as their assetURL (server/services/chain/land.ts:54), so wallets
// resolve frontierprotocol.app/nft/metadata/<plotId>#arc3 and the redirect
// file is what makes that resolve to real ARC-3 JSON instead of the Vite SPA
// shell.
//
// This test does NOT spin up Cloudflare — it asserts the committed rules file
// is shaped the way the production routing depends on, so a typo in the
// commit can't silently break the wallet-visible metadata URL.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";

const REDIRECTS = resolve(process.cwd(), "client", "public", "_redirects");

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

describe("client/public/_redirects — branded-domain NFT metadata routing", () => {
  it("the _redirects file exists at client/public/_redirects", () => {
    expect(existsSync(REDIRECTS), `expected ${REDIRECTS} to exist`).toBe(true);
  });

  it("proxies plot metadata to the Fly backend (frontiernext.fly.dev)", () => {
    const source = readFileSync(REDIRECTS, "utf8");
    const rules = parseRedirects(source);

    const plotRule = rules.find((r) => r.pattern === "/nft/metadata/:plotId");
    expect(plotRule, "missing /nft/metadata/:plotId rule").toBeDefined();
    expect(plotRule!.destination).toBe("https://frontiernext.fly.dev/nft/metadata/:plotId");
    expect(plotRule!.status).toBe(200);
  });

  it("proxies commander metadata to the Fly backend", () => {
    const source = readFileSync(REDIRECTS, "utf8");
    const rules = parseRedirects(source);

    const cmdrRule = rules.find((r) => r.pattern === "/nft/metadata/commander/:commanderId");
    expect(cmdrRule, "missing /nft/metadata/commander/:commanderId rule").toBeDefined();
    expect(cmdrRule!.destination).toBe("https://frontiernext.fly.dev/nft/metadata/commander/:commanderId");
    expect(cmdrRule!.status).toBe(200);
  });

  it("proxies weapon metadata to the Fly backend", () => {
    const source = readFileSync(REDIRECTS, "utf8");
    const rules = parseRedirects(source);

    const weaponRule = rules.find((r) => r.pattern === "/nft/metadata/weapon/:weaponId");
    expect(weaponRule, "missing /nft/metadata/weapon/:weaponId rule").toBeDefined();
    expect(weaponRule!.destination).toBe("https://frontiernext.fly.dev/nft/metadata/weapon/:weaponId");
    expect(weaponRule!.status).toBe(200);
  });

  it("keeps a SPA fallback rule (/* → /index.html, 200)", () => {
    const source = readFileSync(REDIRECTS, "utf8");
    const rules = parseRedirects(source);

    const spaRule = rules.find((r) => r.pattern === "/*");
    expect(spaRule, "missing /* SPA fallback").toBeDefined();
    expect(spaRule!.destination).toBe("/index.html");
    expect(spaRule!.status).toBe(200);
  });

  it("orders /nft/metadata/* BEFORE the /* SPA fallback (catch-all can't shadow it)", () => {
    const source = readFileSync(REDIRECTS, "utf8");
    const rules = parseRedirects(source);

    const firstNftIndex = rules.findIndex((r) => r.pattern.startsWith("/nft/metadata/"));
    const spaIndex = rules.findIndex((r) => r.pattern === "/*");

    expect(firstNftIndex, "no /nft/metadata/* rule found").toBeGreaterThanOrEqual(0);
    expect(spaIndex, "no /* SPA fallback found").toBeGreaterThanOrEqual(0);
    expect(
      firstNftIndex,
      `Cloudflare Pages matches the FIRST rule. The /nft/metadata/* proxy must appear before the /* SPA fallback (proxy at ${firstNftIndex}, fallback at ${spaIndex}).`
    ).toBeLessThan(spaIndex);
  });

  it("does not touch /nft/biomes/* (static CDN assets stay on the branded host)", () => {
    const source = readFileSync(REDIRECTS, "utf8");
    const rules = parseRedirects(source);

    const biomeRule = rules.find((r) => r.pattern.startsWith("/nft/biomes/"));
    expect(
      biomeRule,
      "no /nft/biomes/* proxy rule is expected — those PNGs ship from client/public/nft/biomes/ and must stay on the CDN"
    ).toBeUndefined();
  });

  it("does not proxy /api/* (the client bundles VITE_API_URL to the Fly backend directly)", () => {
    const source = readFileSync(REDIRECTS, "utf8");
    const rules = parseRedirects(source);

    const apiRule = rules.find((r) => r.pattern.startsWith("/api/"));
    expect(apiRule, "no /api/* redirect rule is expected — the client points directly at the Fly backend").toBeUndefined();
  });
});
