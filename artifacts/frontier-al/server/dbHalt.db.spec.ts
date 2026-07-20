import { describe, it, expect, afterEach, vi } from "vitest";

describe("withDbRetry (halt behavior)", () => {
  const prevDbUrl = process.env.DATABASE_URL;
  const prevHalt = process.env.HALT_DB;

  afterEach(() => {
    if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDbUrl;
    if (prevHalt === undefined) delete process.env.HALT_DB;
    else process.env.HALT_DB = prevHalt;
    vi.resetModules();
  });

  it("throws when HALT_DB=true even for a trivial query", async () => {
    process.env.DATABASE_URL = "postgres://test";
    process.env.HALT_DB = "true";

    vi.doMock("pg", () => ({
      Pool: class MockPool {
        on = vi.fn();
        totalCount = 0;
        idleCount = 0;
        waitingCount = 0;
        query = vi.fn().mockResolvedValue({ rows: [] });
      },
    }));

    const { withDbRetry } = await import("./db.js");
    await expect(withDbRetry(() => Promise.resolve("ok"), "test")).rejects.toThrow("Database operations halted");
  });
});
