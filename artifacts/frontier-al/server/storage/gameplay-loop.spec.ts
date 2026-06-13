/**
 * server/storage/gameplay-loop.spec.ts
 *
 * End-to-end "playthrough" of the core gameplay loop, driven through the real
 * storage layer (MemStorage — pure in-memory, no DB, no chain, no funds). One
 * human player walks the full arc the game is built around:
 *
 *   bootstrap player → welcome bonus → acquire land → mine resources →
 *   collect to inventory → accrue + claim ASCEND ("mine Ascend") → mint commander
 *
 * Each step asserts the state transition AND the guard that protects it
 * (double-purchase, mining cooldown, insufficient-ASCEND mint). This is the
 * reproducible regression harness for "can a player actually get land, mine,
 * earn ASCEND, and mint" — the question that otherwise can only be answered by a
 * live testnet run.
 *
 * SCOPE / what this does NOT cover (intentionally — not testable in-process):
 *   - The HTTP route layer: ALGO payment verification (verifyAlgoPayment), the
 *     redeemedPayments replay guard, and session auth all live in
 *     server/routes.ts and require a live Algorand testnet txid. Those are
 *     exercised by the route handlers, not the storage layer under test here.
 *   - The on-chain NFT flow: plot/commander NFT mint + delivery are async,
 *     fire-and-forget, and need the admin wallet + a real ASA on testnet. This
 *     suite validates the in-game avatar grant (player.commanders), NOT the
 *     on-chain mint/delivery/retry.
 *   - Production economy: rates here are ECONOMY_MODE-derived (testing default),
 *     so assertions use the live constants rather than hard-coded numbers.
 *   - DbStorage parity: this runs MemStorage, the documented test backend; it
 *     mirrors but is not identical to the Postgres-backed DbStorage in prod.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { MemStorage } from "./mem";
import {
  WELCOME_BONUS_ASCEND,
  COMMANDER_INFO,
  calculateAscendPerDay,
} from "@shared/schema";
import type { LandParcel, Player } from "@shared/schema";

const DAY_MS = 1000 * 60 * 60 * 24;

describe("gameplay loop — full single-player playthrough (MemStorage)", () => {
  const storage = new MemStorage();
  let player: Player;
  let parcel: LandParcel;

  beforeAll(async () => {
    await storage.initialize();
    // A real human onboards by signing in with their wallet address.
    player = await storage.getOrCreatePlayerByAddress(
      "PLAYTHRUWALLETADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    );
  });

  it("bootstraps a fresh human player with starting resources and no land", () => {
    expect(player.isAI).toBe(false);
    expect(player.ownedParcels).toHaveLength(0);
    expect(player.ascend).toBe(0);
    expect(player.welcomeBonusReceived).toBe(false);
    // Seed resources so a new player isn't dead on arrival.
    expect(player.iron).toBeGreaterThan(0);
    expect(player.fuel).toBeGreaterThan(0);
  });

  it("grants the welcome bonus once and is idempotent on repeat", async () => {
    await storage.grantWelcomeBonus(player.id);
    const after = await storage.getPlayer(player.id);
    expect(after!.ascend).toBe(WELCOME_BONUS_ASCEND);
    expect(after!.welcomeBonusReceived).toBe(true);

    // A second grant must be a no-op — no double-dipping the bonus.
    await storage.grantWelcomeBonus(player.id);
    expect((await storage.getPlayer(player.id))!.ascend).toBe(WELCOME_BONUS_ASCEND);
  });

  it("acquires an unowned, for-sale parcel and rejects a double purchase", async () => {
    const state = await storage.getGameState();
    const target = state.parcels.find(
      (p) =>
        !p.ownerId &&
        p.purchasePriceAlgo !== null &&
        p.biome !== "water" &&
        !p.activeBattleId,
    );
    expect(target, "expected a fresh for-sale non-water parcel").toBeTruthy();

    const owned = await storage.purchaseLand({
      parcelId: target!.id,
      playerId: player.id,
    });
    expect(owned.ownerId).toBe(player.id);
    expect(owned.ownerType).toBe("player");
    expect(owned.purchasePriceAlgo).toBeNull(); // no longer for sale

    const refreshed = await storage.getPlayer(player.id);
    expect(refreshed!.ownedParcels).toContain(target!.id);

    // The same parcel cannot be bought twice — guards against replay/race.
    await expect(
      storage.purchaseLand({ parcelId: target!.id, playerId: player.id }),
    ).rejects.toThrow(/already owned/i);

    parcel = (await storage.getParcel(target!.id))!;
  });

  it("mines resources from owned land and then enforces the cooldown", async () => {
    const yieldOut = await storage.mineResources({
      parcelId: parcel.id,
      playerId: player.id,
    });
    const mined = yieldOut.iron + yieldOut.fuel + yieldOut.crystal;
    expect(mined).toBeGreaterThan(0);

    const afterParcel = await storage.getParcel(parcel.id);
    expect(
      afterParcel!.ironStored + afterParcel!.fuelStored + afterParcel!.crystalStored,
    ).toBe(mined);

    const afterPlayer = await storage.getPlayer(player.id);
    expect(afterPlayer!.totalIronMined).toBe(yieldOut.iron);

    // Immediate re-mine is blocked by the cooldown.
    await expect(
      storage.mineResources({ parcelId: parcel.id, playerId: player.id }),
    ).rejects.toThrow(/cooldown/i);
  });

  it("collects stored resources into the player inventory and clears the parcel", async () => {
    const before = await storage.getPlayer(player.id);
    const stored = await storage.getParcel(parcel.id);
    const expectedIron = before!.iron + stored!.ironStored;
    const storedIron = stored!.ironStored;

    const collected = await storage.collectAll(player.id);
    expect(collected.iron).toBe(storedIron);

    const after = await storage.getPlayer(player.id);
    expect(after!.iron).toBe(expectedIron);

    const clearedParcel = await storage.getParcel(parcel.id);
    expect(clearedParcel!.ironStored).toBe(0);
    expect(clearedParcel!.fuelStored).toBe(0);
    expect(clearedParcel!.crystalStored).toBe(0);
  });

  it("mines ASCEND: accrues over time on owned land and claims it to the balance", async () => {
    // ASCEND accrues passively per-day per-parcel; purchaseLand reset the claim
    // clock, so roll it back two days to simulate elapsed accrual. The parcel
    // from getParcel is the live stored reference.
    const live = (await storage.getParcel(parcel.id))!;
    live.lastAscendClaimTs = Date.now() - 2 * DAY_MS;

    const perDay = calculateAscendPerDay(live.improvements); // base testing rate
    const balanceBefore = (await storage.getPlayer(player.id))!.ascend;
    const earnedBefore = (await storage.getPlayer(player.id))!.totalAscendEarned;

    const result = await storage.claimAscend(player.id);

    // ~2 days of accrual at the base rate (tolerance for the sub-ms clock drift
    // between setting the timestamp and the claim reading Date.now()).
    expect(result.amount).toBeGreaterThanOrEqual(perDay * 2);
    expect(result.amount).toBeLessThan(perDay * 2 + 1);

    const after = await storage.getPlayer(player.id);
    expect(after!.ascend).toBeCloseTo(balanceBefore + result.amount, 5);
    expect(after!.totalAscendEarned).toBeCloseTo(earnedBefore + result.amount, 5);

    // The claim resets the clock — an immediate re-claim yields nothing.
    const second = await storage.claimAscend(player.id);
    expect(second.amount).toBe(0);
  });

  it("mints a commander by spending ASCEND and attaches it to the player", async () => {
    const tier = "sentinel" as const;
    const cost = COMMANDER_INFO[tier].mintCostAscend;
    // getPlayer returns the live object, so snapshot the numbers as primitives
    // before mintAvatar mutates them in place.
    const beforeAscend = (await storage.getPlayer(player.id))!.ascend;
    const beforeBurned = (await storage.getPlayer(player.id))!.totalAscendBurned;
    expect(beforeAscend).toBeGreaterThanOrEqual(cost);

    const avatar = await storage.mintAvatar({ playerId: player.id, tier });
    expect(avatar.tier).toBe(tier);

    const after = await storage.getPlayer(player.id);
    expect(after!.ascend).toBeCloseTo(beforeAscend - cost, 5);
    expect(after!.totalAscendBurned).toBeCloseTo(beforeBurned + cost, 5);
    expect(after!.commanders).toHaveLength(1);
    expect(after!.commander?.id).toBe(avatar.id);
    expect(after!.activeCommanderIndex).toBe(0);
  });

  it("rejects a commander mint when the player cannot afford it", async () => {
    const broke = await storage.getOrCreatePlayerByAddress(
      "BROKEWALLETADDRESSBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    );
    expect(broke.ascend).toBe(0);
    await expect(
      storage.mintAvatar({ playerId: broke.id, tier: "reaper" }),
    ).rejects.toThrow(/insufficient ascend/i);
  });
});
