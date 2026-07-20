import { describe, it, expect, afterEach, vi } from "vitest";
import { isDbHalted } from "./dbHalt.js";

describe("dbHalt", () => {
  const prev = process.env.HALT_DB;

  afterEach(() => {
    if (prev === undefined) delete process.env.HALT_DB;
    else process.env.HALT_DB = prev;
  });

  it("returns false when HALT_DB is unset", () => {
    delete process.env.HALT_DB;
    expect(isDbHalted()).toBe(false);
  });

  it("returns false when HALT_DB is empty string", () => {
    process.env.HALT_DB = "";
    expect(isDbHalted()).toBe(false);
  });

  it("returns false when HALT_DB is not exactly 'true'", () => {
    process.env.HALT_DB = "false";
    expect(isDbHalted()).toBe(false);
    process.env.HALT_DB = "1";
    expect(isDbHalted()).toBe(false);
    process.env.HALT_DB = "yes";
    expect(isDbHalted()).toBe(false);
  });

  it("returns true when HALT_DB is exactly 'true'", () => {
    process.env.HALT_DB = "true";
    expect(isDbHalted()).toBe(true);
  });
});
