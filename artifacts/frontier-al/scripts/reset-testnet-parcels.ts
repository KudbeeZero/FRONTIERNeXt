import { db } from "../server/db";
import { eq, sql } from "drizzle-orm";
import {
  gameMeta,
  parcels as parcelsTable,
  plotNfts,
  mintIdempotency,
  plotMintRetryQueue,
  subParcels,
  tradeOrders,
  orbitalEvents,
  gameEvents,
  battles,
} from "../server/db-schema";
import { TOTAL_PLOTS, LAND_PURCHASE_ALGO, BASE_STORAGE_CAPACITY } from "@shared/schema";
import { generateFibonacciSphere } from "../server/sphereUtils";
import { biomeFromLatitude, latLngToXYZ } from "../server/storage/game-rules";
import { randomUUID } from "crypto";
import { resetNetworkIsAllowed, hasResetMismatch, type Counts } from "../server/storage/reset-helpers";

type Counts = {
  parcels: number;
  available: number;
  minted: number;
  plotNfts: number;
  mintIdempotency: number;
  plotMintRetryQueue: number;
  subParcels: number;
  tradeOrders: number;
  orbitalEvents: number;
  gameEvents: number;
  battles: number;
};

async function countAll(): Promise<Counts> {
  const [
    parcels,
    available,
    minted,
    plotNfts,
    mintIdempotency,
    plotMintRetryQueue,
    subParcels,
    tradeOrders,
    orbitalEvents,
    gameEvents,
    battles,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(parcelsTable),
    db.select({ count: sql<number>`count(*)` }).from(parcelsTable).where(sql`${parcelsTable.ownerId} IS NULL`),
    db.select({ count: sql<number>`count(*)` }).from(parcelsTable).where(sql`${parcelsTable.ownerId} IS NOT NULL`),
    db.select({ count: sql<number>`count(*)` }).from(plotNfts),
    db.select({ count: sql<number>`count(*)` }).from(mintIdempotency),
    db.select({ count: sql<number>`count(*)` }).from(plotMintRetryQueue),
    db.select({ count: sql<number>`count(*)` }).from(subParcels),
    db.select({ count: sql<number>`count(*)` }).from(tradeOrders),
    db.select({ count: sql<number>`count(*)` }).from(orbitalEvents),
    db.select({ count: sql<number>`count(*)` }).from(gameEvents),
    db.select({ count: sql<number>`count(*)` }).from(battles),
  ]);

  return {
    parcels: parcels[0]?.count ?? 0,
    available: available[0]?.count ?? 0,
    minted: minted[0]?.count ?? 0,
    plotNfts: plotNfts[0]?.count ?? 0,
    mintIdempotency: mintIdempotency[0]?.count ?? 0,
    plotMintRetryQueue: plotMintRetryQueue[0]?.count ?? 0,
    subParcels: subParcels[0]?.count ?? 0,
    tradeOrders: tradeOrders[0]?.count ?? 0,
    orbitalEvents: orbitalEvents[0]?.count ?? 0,
    gameEvents: gameEvents[0]?.count ?? 0,
    battles: battles[0]?.count ?? 0,
  };
}

async function resetTestnetParcels() {
  const network = process.env.ALGORAND_NETWORK ?? process.env.VITE_ALGORAND_NETWORK;
  if (!resetNetworkIsAllowed(network)) {
    console.error("[RESET] REFUSED: ALGORAND_NETWORK=mainnet. This script is TestNet/dev only.");
    process.exit(1);
  }
  console.log(`[RESET] Network=${network || "(unset, defaulting to testnet)"}\n`);

  console.log("[RESET] Counting before state…");
  const before = await countAll();
  console.log(JSON.stringify(before, null, 2));

  await db.transaction(async (tx) => {
    console.log("\n[RESET] Clearing stale queue/notification/tx rows…");
    await tx.delete(subParcels);
    await tx.delete(tradeOrders);
    await tx.delete(orbitalEvents);
    await tx.delete(gameEvents);
    await tx.delete(battles);
    await tx.delete(plotNfts);
    await tx.delete(mintIdempotency);
    await tx.delete(plotMintRetryQueue);

    console.log("[RESET] Resetting parcel inventory…");
    const coords = generateFibonacciSphere(TOTAL_PLOTS);
    const now = Date.now();
    const rows = coords.map((coord) => {
      const biome = biomeFromLatitude(coord.lat, coord.plotId);
      const { x, y, z } = latLngToXYZ(coord.lat, coord.lng);
      return {
        id: randomUUID(),
        plotId: coord.plotId,
        lat: coord.lat,
        lng: coord.lng,
        x,
        y,
        z,
        biome,
        richness: Math.floor(Math.random() * 60) + 40,
        defenseLevel: 1,
        ironStored: 0,
        fuelStored: 0,
        crystalStored: 0,
        storageCapacity: BASE_STORAGE_CAPACITY,
        lastMineTs: 0,
        yieldMultiplier: 1.0,
        improvements: [] as object[],
        purchasePriceAlgo: LAND_PURCHASE_ALGO[biome],
        ascendAccumulated: 0,
        lastAscendClaimTs: now,
        ascendPerDay: 1,
        ownerId: null,
        ownerType: null,
      };
    });

    await tx.execute(sql`TRUNCATE TABLE ${parcelsTable} RESTART IDENTITY CASCADE`);
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      await tx.insert(parcelsTable).values(rows.slice(i, i + BATCH));
      if ((i + BATCH) % 5000 === 0 || i + BATCH >= rows.length) {
        console.log(`  inserted ${Math.min(i + BATCH, rows.length)} / ${rows.length} parcels`);
      }
    }

    const [meta] = await tx.select().from(gameMeta).where(eq(gameMeta.id, 1));
    if (meta) {
      await tx.update(gameMeta).set({ initialized: true, currentTurn: 1, lastUpdateTs: now }).where(eq(gameMeta.id, 1));
    } else {
      await tx.insert(gameMeta).values({ id: 1, initialized: true, currentTurn: 1, lastUpdateTs: now });
    }
  });

  console.log("\n[RESET] Counting after state…");
  const after = await countAll();
  console.log(JSON.stringify(after, null, 2));

  if (hasResetMismatch(after)) {
    console.error("\n[RESET] FAILED: post-reset mismatch.");
    process.exit(1);
  }

  console.log(`\n[RESET] SUCCESS: ${after.parcels} parcels available (exactly ${TOTAL_PLOTS}).`);
}

resetTestnetParcels().catch((err) => {
  console.error("[RESET] Fatal:", err);
  process.exit(1);
});
