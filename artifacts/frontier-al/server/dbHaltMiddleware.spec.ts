import { describe, it, expect, afterEach, vi } from "vitest";
import express from "express";
import { haltDbMiddleware, guardInterval } from "./dbHaltMiddleware.js";

describe("haltDbMiddleware", () => {
  const prev = process.env.HALT_DB;

  afterEach(() => {
    if (prev === undefined) delete process.env.HALT_DB;
    else process.env.HALT_DB = prev;
  });

  it("returns 503 when HALT_DB is true", async () => {
    process.env.HALT_DB = "true";
    const res = await new Promise<any>((resolve) => {
      const req = { method: "GET", url: "/test", headers: {}, on: () => {} } as any;
      const res = {
        statusCode: 200,
        status: function (code: number) { this.statusCode = code; return this; },
        json: function (body: any) { resolve({ status: this.statusCode, json: () => Promise.resolve(body) }); return this; },
        send: function () { resolve({ status: this.statusCode }); return this; },
        setHeader: () => {},
        getHeader: () => undefined,
      } as any;
      haltDbMiddleware(req, res, () => {});
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Database temporarily unavailable — service halted" });
  });

  it("passes through when HALT_DB is false", async () => {
    delete process.env.HALT_DB;
    const res = await new Promise<any>((resolve) => {
      const req = { method: "GET", url: "/test", headers: {}, on: () => {} } as any;
      const res = {
        statusCode: 200,
        status: function (code: number) { this.statusCode = code; return this; },
        json: function (body: any) { resolve({ status: this.statusCode, json: () => Promise.resolve(body) }); return this; },
        send: function () { resolve({ status: this.statusCode }); return this; },
        setHeader: () => {},
        getHeader: () => undefined,
      } as any;
      haltDbMiddleware(req, res, () => {
        res.json({ ok: true });
      });
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("guardInterval", () => {
  const prev = process.env.HALT_DB;

  afterEach(() => {
    if (prev === undefined) delete process.env.HALT_DB;
    else process.env.HALT_DB = prev;
  });

  it("skips the wrapped function when HALT_DB is true", async () => {
    process.env.HALT_DB = "true";
    const fn = vi.fn();
    const guarded = guardInterval(fn);
    await guarded();
    expect(fn).not.toHaveBeenCalled();
  });

  it("runs the wrapped function when HALT_DB is false", async () => {
    delete process.env.HALT_DB;
    const fn = vi.fn().mockResolvedValue(undefined);
    const guarded = guardInterval(fn);
    await guarded();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("swallows errors from the wrapped function when HALT_DB is true", async () => {
    process.env.HALT_DB = "true";
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    const guarded = guardInterval(fn);
    await expect(guarded()).resolves.toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it("swallows errors from the wrapped function when HALT_DB is false", async () => {
    delete process.env.HALT_DB;
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    const guarded = guardInterval(fn);
    await expect(guarded()).resolves.toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
