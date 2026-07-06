import { describe, it, expect } from "vitest";
import {
  hostServesBackend,
  resolveBackendOrigin,
  resolveBackendWsBase,
} from "./backendOrigin";

const SAME_ORIGIN_WS = "wss://example.test";

describe("hostServesBackend", () => {
  it("is true for localhost, 127.0.0.1 and *.fly.dev", () => {
    expect(hostServesBackend("localhost")).toBe(true);
    expect(hostServesBackend("127.0.0.1")).toBe(true);
    expect(hostServesBackend("frontiernext.fly.dev")).toBe(true);
  });

  it("is false for the branded domain and Pages previews", () => {
    expect(hostServesBackend("frontierprotocol.app")).toBe(false);
    expect(hostServesBackend("frontieralgo.pages.dev")).toBe(false);
  });
});

describe("resolveBackendOrigin", () => {
  it("env override always wins (trailing slash stripped)", () => {
    expect(resolveBackendOrigin("https://api.example/", "frontierprotocol.app")).toBe(
      "https://api.example",
    );
    expect(resolveBackendOrigin("https://api.example", "localhost")).toBe("https://api.example");
  });

  it("falls back to the Fly backend on backend-less hosts", () => {
    expect(resolveBackendOrigin(undefined, "frontierprotocol.app")).toBe(
      "https://frontiernext.fly.dev",
    );
    expect(resolveBackendOrigin("", "frontieralgo.pages.dev")).toBe(
      "https://frontiernext.fly.dev",
    );
  });

  it("stays same-origin (empty) on localhost and fly.dev", () => {
    expect(resolveBackendOrigin(undefined, "localhost")).toBe("");
    expect(resolveBackendOrigin(undefined, "frontiernext.fly.dev")).toBe("");
    expect(resolveBackendOrigin(undefined, undefined)).toBe("");
  });
});

describe("resolveBackendWsBase", () => {
  it("env override wins", () => {
    expect(resolveBackendWsBase("wss://ws.example/", "frontierprotocol.app", SAME_ORIGIN_WS)).toBe(
      "wss://ws.example",
    );
  });

  it("uses the Fly WSS endpoint on backend-less hosts", () => {
    expect(resolveBackendWsBase(undefined, "frontierprotocol.app", SAME_ORIGIN_WS)).toBe(
      "wss://frontiernext.fly.dev",
    );
  });

  it("stays same-origin on hosts that serve the backend", () => {
    expect(resolveBackendWsBase(undefined, "frontiernext.fly.dev", SAME_ORIGIN_WS)).toBe(
      SAME_ORIGIN_WS,
    );
    expect(resolveBackendWsBase(undefined, "localhost", SAME_ORIGIN_WS)).toBe(SAME_ORIGIN_WS);
  });
});
