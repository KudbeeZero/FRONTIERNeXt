import { describe, it, expect } from "vitest";
import { MemStorage } from "./mem";
import { CURRICULUM } from "@shared/university";

// A real module id so the test stays honest (the storage layer doesn't validate
// ids — that's the route's job via getModule — but using a real one documents intent).
const MODULE_ID = CURRICULUM[0].id;

describe("MemStorage university progress (persisted memory layer)", () => {
  const ADDR = "UNIVTESTADDRESS00000000000000000000000000000000000000000";

  it("records a passed course and persists it across reads", async () => {
    const storage = new MemStorage();
    const player = await storage.getOrCreatePlayerByAddress(ADDR);

    expect(await storage.getPassedCourses(player.id)).toEqual([]);

    const after = await storage.markCoursePassed(player.id, MODULE_ID);
    expect(after).toEqual([MODULE_ID]);
    expect(await storage.getPassedCourses(player.id)).toEqual([MODULE_ID]);
  });

  it("is idempotent — passing the same course twice keeps one entry", async () => {
    const storage = new MemStorage();
    const player = await storage.getOrCreatePlayerByAddress(ADDR);
    await storage.markCoursePassed(player.id, MODULE_ID);
    const second = await storage.markCoursePassed(player.id, MODULE_ID);
    expect(second).toEqual([MODULE_ID]);
  });

  it("throws for an unknown player", async () => {
    const storage = new MemStorage();
    await expect(storage.getPassedCourses("nope")).rejects.toThrow();
    await expect(storage.markCoursePassed("nope", MODULE_ID)).rejects.toThrow();
  });
});
