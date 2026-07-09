import { describe, it, expect, vi } from "vitest";
import { strictLimiter } from "./security";

describe("strictLimiter middleware (M1-6)", () => {
  it("is exported and is a function", () => {
    expect(strictLimiter).toBeDefined();
    expect(typeof strictLimiter).toBe("function");
  });

  it("calls next() on first request (within limit)", async () => {
    const mockReq = {
      ip: "127.0.0.1",
      headers: {},
    } as any;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    } as any;
    const next = vi.fn();

    await strictLimiter(mockReq, mockRes, next);
    expect(next).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it("returns 429 after exceeding limit", async () => {
    // Create a fresh limiter with limit of 2 for testing
    const { rateLimit } = await import("express-rate-limit");
    const testLimiter = rateLimit({
      windowMs: 60_000,
      limit: 2,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many requests" },
    });

    const mockReq = {
      ip: "192.168.1.1",
      headers: {},
    } as any;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    } as any;
    const next = vi.fn();

    // First two requests should pass
    await testLimiter(mockReq, mockRes, next);
    expect(next).toHaveBeenCalledTimes(1);
    
    await testLimiter(mockReq, mockRes, next);
    expect(next).toHaveBeenCalledTimes(2);

    // Third request should be rate limited
    await testLimiter(mockReq, mockRes, next);
    expect(next).toHaveBeenCalledTimes(2); // next not called again
    expect(mockRes.status).toHaveBeenCalledWith(429);
  });
});
