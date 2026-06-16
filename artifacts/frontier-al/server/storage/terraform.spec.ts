/**
 * server/storage/terraform.spec.ts
 *
 * Proves the terraform → biome path that NFT metadata depends on:
 * converting a parcel's biome actually mutates parcel.biome (the value
 * GET /nft/metadata/:plotId reads into the ARC-3 attributes + biome image URL).
 * Pure — runs against MemStorage, no DB.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("crypto", () => {
  let counter = 0;
  return { randomUUID: () => `tf-uuid-${++counter}` };
});

import { MemStorage } from "./mem.js";
import { TERRAFORM_BIOME_MAP, TERRAFORM_COSTS } from "@shared/schema";

let storage: MemStorage;
let ownerId: string;
let plotId: number;
let currentBiome: string;

beforeEach(async () => {
  storage = new MemStorage();
  await (storage as any).initialize();

  const owner = await storage.getOrCreatePlayerByAddress("TERRAFORM_OWNER");
  ownerId = owner.id;
  const state = await storage.getGameState();
  const unowned = state.parcels.find((p) => p.ownerId === null && p.purchasePriceAlgo !== null)!;
  const bought = await storage.purchaseLand({ playerId: ownerId, parcelId: unowned.id });
  plotId = bought.plotId;
  currentBiome = bought.biome;

  const p = await storage.getPlayer(ownerId);
  if (p) p.ascend = 100;
});

/** A prototype target whose mapped server biome differs from the current one. */
function differentTarget(current: string): { proto: string; mapped: string } {
  for (const proto of Object.keys(TERRAFORM_BIOME_MAP)) {
    const mapped = TERRAFORM_BIOME_MAP[proto];
    if (mapped !== current) return { proto, mapped };
  }
  throw new Error("no differing biome found");
}

describe("terraformParcel — convert_biome drives the metadata biome", () => {
  it("writes the new (mapped) biome onto the parcel", async () => {
    const { proto, mapped } = differentTarget(currentBiome);
    const res = await storage.terraformParcel(plotId, ownerId, {
      type: "convert_biome",
      targetBiome: proto,
    } as any);

    expect(res.error).toBeUndefined();
    expect(res.parcel.biome).toBe(mapped);

    // Read-back: the stored parcel (what metadata reads) reflects the new biome.
    const state = await storage.getGameState();
    expect(state.parcels.find((p) => p.plotId === plotId)!.biome).toBe(mapped);
  });

  it("deducts the convert_biome cost from the owner", async () => {
    const { proto } = differentTarget(currentBiome);
    const before = (await storage.getPlayer(ownerId))!.ascend;
    await storage.terraformParcel(plotId, ownerId, { type: "convert_biome", targetBiome: proto } as any);
    const after = (await storage.getPlayer(ownerId))!.ascend;
    expect(before - after).toBe(TERRAFORM_COSTS["convert_biome"]);
  });

  it("rejects converting to the biome it already is (no charge)", async () => {
    const before = (await storage.getPlayer(ownerId))!.ascend;
    const res = await storage.terraformParcel(plotId, ownerId, {
      type: "convert_biome",
      targetBiome: currentBiome,
    } as any);
    expect(res.error).toContain("already has that biome");
    expect((await storage.getPlayer(ownerId))!.ascend).toBe(before);
  });

  it("rejects when the owner cannot afford it", async () => {
    const p = await storage.getPlayer(ownerId);
    if (p) p.ascend = 1;
    const { proto } = differentTarget(currentBiome);
    const res = await storage.terraformParcel(plotId, ownerId, { type: "convert_biome", targetBiome: proto } as any);
    expect(res.error).toContain("Insufficient ASCEND");
  });

  it("rejects a non-owner", async () => {
    const { proto } = differentTarget(currentBiome);
    const res = await storage.terraformParcel(plotId, "not-the-owner", { type: "convert_biome", targetBiome: proto } as any);
    expect(res.error).toBeTruthy();
  });
});
