/**
 * server/routes/ascendMetadata.spec.ts
 *
 * Focused tests for the ASCEND fungible token metadata handler. This
 * handler serves the JSON document referenced as the on-chain `url` field
 * of ASCEND ASA 764083761. It is NOT ARC-3 — ARC-3 is a per-unit NFT
 * metadata standard; a fungible token's asset-level metadata is a plain
 * JSON document with the on-chain identity fields (name, unit-name,
 * decimals, total) plus display fields (description, image, external_url).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ascendMetadataHandler,
  buildAscendMetadata,
  ASCEND_ASA_ID,
  ASCEND_TOTAL_SUPPLY_RAW,
  ASCEND_DECIMALS,
  ASCEND_UNIT_NAME,
  ASCEND_NAME,
} from "./ascendMetadata";

/** Minimal Response stub: captures status, body, and headers. */
function makeRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: unknown = undefined;
  return {
    status(code: number) {
      statusCode = code;
      return this;
    },
    set(name: string, value: string) {
      headers[name] = value;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
    get headers() {
      return headers;
    },
  };
}

describe("ascendMetadataHandler — ASCEND ASA 764083761 fungible-token metadata", () => {
  const originalEnv = process.env.PUBLIC_BASE_URL;

  beforeEach(() => {
    delete process.env.PUBLIC_BASE_URL;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PUBLIC_BASE_URL;
    } else {
      process.env.PUBLIC_BASE_URL = originalEnv;
    }
  });

  it("returns 503 with a clear error when PUBLIC_BASE_URL is not configured", () => {
    const res = makeRes();
    ascendMetadataHandler({} as never, res as never);

    expect(res.statusCode).toBe(503);
    const body = res.body as { error: string };
    expect(body.error).toMatch(/PUBLIC_BASE_URL/);
    expect(body.error).toMatch(/ASCEND/);
  });

  it("returns 200 with a JSON body and the canonical ASCEND metadata document when PUBLIC_BASE_URL is set", () => {
    process.env.PUBLIC_BASE_URL = "https://frontiernext.fly.dev";
    const res = makeRes();
    ascendMetadataHandler({} as never, res as never);

    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.name).toBe(ASCEND_NAME);
    expect(body.unit_name).toBe(ASCEND_UNIT_NAME);
    expect(body.decimals).toBe(ASCEND_DECIMALS);
    expect(body.total).toBe(Number(ASCEND_TOTAL_SUPPLY_RAW));
    expect(typeof body.description).toBe("string");
    expect((body.description as string).length).toBeGreaterThan(40);
    expect(body.image).toBe("https://frontiernext.fly.dev/nft/ascend.svg");
    expect(body.external_url).toBe("https://frontiernext.fly.dev/");
  });

  it("strips trailing slashes from PUBLIC_BASE_URL when building image and external_url", () => {
    process.env.PUBLIC_BASE_URL = "https://frontiernext.fly.dev///";
    const res = makeRes();
    ascendMetadataHandler({} as never, res as never);

    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.image).toBe("https://frontiernext.fly.dev/nft/ascend.svg");
    expect(body.external_url).toBe("https://frontiernext.fly.dev/");
  });

  it("uses a 1-hour Cache-Control so wallets/indexers pick up future updates without hammering the server", () => {
    process.env.PUBLIC_BASE_URL = "https://frontiernext.fly.dev";
    const res = makeRes();
    ascendMetadataHandler({} as never, res as never);

    expect(res.headers["Cache-Control"]).toBe("public, max-age=3600");
  });

  it("identifies itself as the ASCEND fungible token (not ARC-3, not per-unit)", () => {
    process.env.PUBLIC_BASE_URL = "https://frontiernext.fly.dev";
    const res = makeRes();
    ascendMetadataHandler({} as never, res as never);

    const body = res.body as { properties: Record<string, unknown> };
    expect(body.properties.asaId).toBe(ASCEND_ASA_ID);
    expect(body.properties.tokenType).toBe("fungible");
    expect(body.properties.standard).not.toBe("ARC-3");
    expect(body.properties.network).toBe("algorand-testnet");
    expect(body.properties.game).toBe("FRONTIER");
  });

  it("matches the on-chain ASCEND ASA identity (name Ascend, unit-name ASCEND, decimals 6, total 1B*10^6)", () => {
    const onChain = {
      name: ASCEND_NAME,
      unit_name: ASCEND_UNIT_NAME,
      decimals: ASCEND_DECIMALS,
      total: Number(ASCEND_TOTAL_SUPPLY_RAW),
    };
    const built = buildAscendMetadata("https://example.test") as typeof onChain;
    expect(built).toMatchObject(onChain);
  });

  it("does NOT use the request Host header for any URL (prevents Host-header poisoning of the on-chain assetURL)", () => {
    process.env.PUBLIC_BASE_URL = "https://frontiernext.fly.dev";
    const spoofedReq = {
      headers: { host: "attacker.example" },
    } as never;
    const res = makeRes();
    ascendMetadataHandler(spoofedReq, res as never);

    const body = res.body as Record<string, unknown>;
    expect((body.image as string).startsWith("https://attacker.example")).toBe(false);
    expect((body.external_url as string).startsWith("https://attacker.example")).toBe(false);
    expect(body.image).toBe("https://frontiernext.fly.dev/nft/ascend.svg");
  });
});
