// AUTO-SPLIT from server/routes.ts (feat/routes-refactor, MASTER A2).
// Mechanical domain extraction — handler bodies are verbatim, zero logic change.

import type { Express, Request, Response } from "express";
import path from "path";
import { getBattleReplay, recordSubParcelWorldEvent, recordArchetypeWorldEvent } from "../services/redis";
import algosdk from "algosdk";
import { storage } from "../storage";
import { mineActionSchema, upgradeActionSchema, attackActionSchema, buildActionSchema, purchaseActionSchema, collectActionSchema, claimFrontierActionSchema, mintAvatarActionSchema, specialAttackActionSchema, deployDroneActionSchema, deploySatelliteActionSchema, SlimGameState, createTradeOrderSchema, placeBetSchema, createMarketSchema, resolveMarketSchema, terraformActionSchema } from "@shared/schema";
import { z } from "zod";
import { db, withDbRetry, getPoolStats } from "../db";
import { parcels as parcelsTable, plotNfts as plotNftsTable, players as playersTable, mintIdempotency as mintIdempotencyTable, battles as battlesTable, gameEvents as gameEventsTable, gameMeta, tradeOrders as tradeOrdersTable, subParcels as subParcelsTable, orbitalEvents as orbitalEventsTable, commanderNfts as commanderNftsTable, commanderMintIdempotency as commanderMintIdempotencyTable } from "../db-schema";
import { eq, sql, desc } from "drizzle-orm";
import { recommendTerraform, type TerraformGoal } from "../engine/narrative/advisor";
import { broadcastGameState, broadcastRaw, markDirty } from "../wsServer";
import { appendWorldEvent, listWorldEvents, getRecentWorldEvents } from "../worldEventStore";

// ── Chain Service ─────────────────────────────────────────────────────────────
// All algosdk usage is now isolated in server/services/chain/*.
// Routes import ONLY from the service layer — never from algosdk directly.
import { getFrontierAsaId, getOrCreateFrontierAsa, isAddressOptedIn, setFrontierAsaId, batchedTransferFrontierAsa, clawbackFrontierAsa } from "../services/chain/asa";
import { enqueueFrontierTransfer } from "../services/chain/transferQueue";
import { getAdminAddress, getAdminBalance, getAlgodClient, getIndexerClient } from "../services/chain/client";
import { mintLandNft, transferLandNft, attemptDelivery } from "../services/chain/land";
import { recordUpgradeOnChain } from "../services/chain/upgrades";
import { mintCommanderNft, transferCommanderNft, forwardLiquiditySplit, verifyAlgoPayment, attemptCommanderDelivery } from "../services/chain/commander";
import {
  bootstrapFactionIdentities,
  getAllFactionAsaIds,
  getFactionAsaId,
  FACTION_DEFINITIONS,
} from "../services/chain/factions";
import { fromMicroFRNTR } from "../storage/game-rules";
import {
  ECONOMY_MODE,
  LAND_DAILY_FRNTR_RATE,
  LAND_DAILY_FRNTR_RATE_TEST,
  LAND_DAILY_FRNTR_RATE_PROD,
  EMISSION_CHECK_PARCEL_COUNTS,
  projectedDailyEmissions,
  COMMANDER_MINT_FRNTR_ACTIVE,
  COMMANDER_ALGO_NETWORK_FEE,
  COMMANDER_ALGO_PRICE_ACTIVE,
  LAND_PURCHASE_ALGO_ACTIVE,
  TESTING_ECONOMY_SUMMARY,
} from "../../shared/economy-config";
import { getAlgoUsdPrice, usdToMicroAlgo } from "../services/priceOracle";
import { requireAdminKey, enumerationLimiter, authLimiter, clampLimit } from "../security";
import {
  getAuth,
  isWalletAuthRequired,
  issueNonce,
  verifyAuthAndNonce,
  signSession,
  setSessionCookie,
  clearSessionCookie,
} from "../auth";
import { scopeGameStateFor } from "../stateScope";
import { assessWelcomeBonusEligibility } from "../services/chain/eligibility";
import type { RouteContext } from "./context";

export function registerSubparcelRoutes(app: Express, ctx: RouteContext): void {
  const { assertPlayerOwnership, maybeGrantWelcomeBonus, fireBurn, adviceLimiter, algodClient, indexerClient } = ctx;

  app.get("/api/plots/:plotId/sub-parcels", async (req, res) => {
    const plotId = parseInt(req.params.plotId);
    if (!plotId || isNaN(plotId)) return res.status(400).json({ error: "Invalid plotId" });
    try {
      const subParcels = await storage.getSubParcels(plotId);
      res.json({ plotId, subParcels, isSubdivided: subParcels.length > 0 });
    } catch (err) {
      console.error("[sub-parcels] getSubParcels error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/plots/:plotId/subdivide — subdivide a macro-plot into 9 sub-parcels */
  app.post("/api/plots/:plotId/subdivide", async (req, res) => {
    const plotId = parseInt(req.params.plotId);
    const { playerId } = req.body;
    if (!plotId || isNaN(plotId)) return res.status(400).json({ error: "Invalid plotId" });
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    try {
      const result = await storage.subdivideParcel(plotId, playerId);
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();
      res.json({ success: true, subParcels: result.subParcels });
    } catch (err) {
      console.error("[sub-parcels] subdivideParcel error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/plots/:plotId/terraform — apply a terraform action to an owned plot */
  app.post("/api/plots/:plotId/terraform", async (req, res) => {
    const plotId = parseInt(req.params.plotId);
    if (!plotId || isNaN(plotId)) return res.status(400).json({ error: "Invalid plotId" });
    const parsed = terraformActionSchema.safeParse({ ...req.body, plotId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    try {
      const result = await storage.terraformParcel(plotId, parsed.data.playerId, parsed.data.action);
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();
      res.json({ success: true, parcel: result.parcel });
    } catch (err) {
      console.error("[terraform] error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/plots/:plotId/terraform-advice?goal=defense|yield|balanced
   * Read-only terraforming recommendation for a plot. Uses the deterministic
   * heuristic by default; upgrades to a Claude recommendation when
   * ANTHROPIC_API_KEY is configured (falls back to the heuristic on any error).
   */
  app.get("/api/plots/:plotId/terraform-advice", adviceLimiter, async (req, res) => {
    const plotId = parseInt(String(req.params.plotId), 10);
    if (!plotId || isNaN(plotId)) return res.status(400).json({ error: "Invalid plotId" });
    const goalParam = String(req.query.goal ?? "balanced");
    const goal: TerraformGoal = (["defense", "yield", "balanced"].includes(goalParam) ? goalParam : "balanced") as TerraformGoal;
    if (!db) return res.status(503).json({ error: "Database not available" });
    try {
      const [parcel] = await db
        .select({
          biome:           parcelsTable.biome,
          stability:       parcelsTable.stability,
          hazardLevel:     parcelsTable.hazardLevel,
          yieldMultiplier: parcelsTable.yieldMultiplier,
        })
        .from(parcelsTable)
        .where(eq(parcelsTable.plotId, plotId))
        .limit(1);
      if (!parcel) return res.status(404).json({ error: "Plot not found" });

      const advice = await recommendTerraform({
        biome:           parcel.biome as import("@shared/schema").BiomeType,
        stability:       parcel.stability ?? 100,
        hazardLevel:     parcel.hazardLevel ?? 0,
        yieldMultiplier: parcel.yieldMultiplier ?? 1,
        goal,
      });
      res.json(advice);
    } catch (err) {
      console.error("[terraform-advice] error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/sub-parcels/:subParcelId/purchase — buy an unowned sub-parcel */
  app.post("/api/sub-parcels/:subParcelId/purchase", async (req, res) => {
    const { subParcelId } = req.params;
    const { playerId } = req.body;
    if (!subParcelId) return res.status(400).json({ error: "Invalid subParcelId" });
    if (!playerId)    return res.status(400).json({ error: "playerId required" });
    try {
      const result = await storage.purchaseSubParcel(subParcelId, playerId);
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();

      const sp = result.subParcel;
      // Broadcast real-time label update to all connected clients
      broadcastRaw({
        type:        "sub_parcel_purchased",
        subParcelId: sp.id,
        parentPlotId: sp.parentPlotId,
        subIndex:    sp.subIndex,
        ownerId:     playerId,
      });

      // Persist to Upstash world event stream (fire-and-forget)
      storage.getParcelBiomeByPlotId(sp.parentPlotId).then(biome => {
        recordSubParcelWorldEvent({
          type:     "sub_parcel_purchased",
          plotId:   sp.parentPlotId,
          subIndex: sp.subIndex,
          biome,
          playerId,
          price:    sp.purchasePriceFrontier,
        }).catch(() => {});
      }).catch(() => {});

      res.json({ success: true, subParcel: sp });
    } catch (err) {
      console.error("[sub-parcels] purchaseSubParcel error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/sub-parcels/:subParcelId/build — build or upgrade an improvement on an owned sub-parcel */
  app.post("/api/sub-parcels/:subParcelId/build", async (req, res) => {
    const { subParcelId } = req.params;
    const { playerId, improvementType } = req.body;
    if (!subParcelId)     return res.status(400).json({ error: "Invalid subParcelId" });
    if (!playerId)        return res.status(400).json({ error: "playerId required" });
    if (!improvementType) return res.status(400).json({ error: "improvementType required" });
    try {
      const result = await storage.buildSubParcelImprovement(subParcelId, playerId, improvementType);
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();

      const sp = result.subParcel;
      const imp = sp.improvements?.find(i => i.type === improvementType);
      const newLevel = imp?.level ?? 1;

      // Broadcast real-time label update to all connected clients
      broadcastRaw({
        type:           "sub_parcel_upgraded",
        subParcelId:    sp.id,
        parentPlotId:   sp.parentPlotId,
        subIndex:       sp.subIndex,
        improvementType,
        level:          newLevel,
        ownerId:        playerId,
      });

      // Persist to Upstash world event stream (fire-and-forget)
      storage.getParcelBiomeByPlotId(sp.parentPlotId).then(biome => {
        recordSubParcelWorldEvent({
          type:           "sub_parcel_upgraded",
          plotId:         sp.parentPlotId,
          subIndex:       sp.subIndex,
          biome,
          playerId,
          improvementType,
          level:          newLevel,
        }).catch(() => {});
        recordUpgradeOnChain({
          plotId:         sp.parentPlotId,
          subIndex:       sp.subIndex,
          biome,
          improvementType,
          level:          newLevel,
          playerId,
        }).catch(() => {});
      }).catch(() => {});

      res.json({ success: true, subParcel: sp });
    } catch (err) {
      console.error("[sub-parcels] buildSubParcelImprovement error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Sub-Parcel Archetype Assignment ───────────────────────────────────────

  /** POST /api/sub-parcels/:subParcelId/archetype — assign a strategic archetype */
  app.post("/api/sub-parcels/:subParcelId/archetype", async (req, res) => {
    const { subParcelId } = req.params;
    const { playerId, archetype, archetypeLevel = 1, energyAlignment } = req.body;
    if (!subParcelId) return res.status(400).json({ error: "subParcelId required" });
    if (!playerId)    return res.status(400).json({ error: "playerId required" });
    if (!archetype)   return res.status(400).json({ error: "archetype required" });
    try {
      const result = await storage.assignSubParcelArchetype(
        subParcelId, playerId, archetype, archetypeLevel, energyAlignment
      );
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();

      const sp = result.subParcel;

      broadcastRaw({
        type:            "sub_parcel_archetype_set",
        subParcelId:     sp.id,
        parentPlotId:    sp.parentPlotId,
        subIndex:        sp.subIndex,
        archetype:       sp.archetype,
        archetypeLevel:  sp.archetypeLevel,
        energyAlignment: sp.energyAlignment,
        ownerId:         playerId,
        factionBonus:    result.factionBonus,
      });

      storage.getParcelBiomeByPlotId(sp.parentPlotId).then(biome => {
        recordArchetypeWorldEvent({
          plotId:          sp.parentPlotId,
          subIndex:        sp.subIndex,
          biome,
          archetype:       sp.archetype!,
          archetypeLevel:  sp.archetypeLevel,
          energyAlignment: sp.energyAlignment ?? undefined,
          playerId,
          factionBonus:    result.factionBonus,
        }).catch(() => {});
      }).catch(() => {});

      res.json({ success: true, subParcel: sp, factionBonus: result.factionBonus });
    } catch (err) {
      console.error("[sub-parcels] assignSubParcelArchetype error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Sub-Parcel Battle ──────────────────────────────────────────────────────

  /** POST /api/sub-parcels/:subParcelId/attack — immediate sub-parcel battle */
  app.post("/api/sub-parcels/:subParcelId/attack", async (req, res) => {
    const { subParcelId } = req.params;
    const { attackerParcelId, commanderId, troops, iron, fuel, crystal, attackerId } = req.body;
    if (!subParcelId)     return res.status(400).json({ error: "subParcelId required" });
    if (!attackerId)      return res.status(400).json({ error: "attackerId required" });
    if (!attackerParcelId) return res.status(400).json({ error: "attackerParcelId required" });
    try {
      const result = await storage.attackSubParcel(subParcelId, attackerId, {
        attackerParcelId,
        commanderId: commanderId ?? undefined,
        troops: Math.max(1, parseInt(troops ?? "1") || 1),
        iron:    Math.max(0, parseInt(iron ?? "0") || 0),
        fuel:    Math.max(0, parseInt(fuel ?? "0") || 0),
        crystal: Math.max(0, parseInt(crystal ?? "0") || 0),
      });
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();
      if (result.outcome === "attacker_wins") {
        const sp = await storage.getSubParcel(subParcelId);
        broadcastRaw({ type: "sub_parcel_battle_resolved", subParcelId, outcome: result.outcome, newOwnerId: attackerId });
        // World event with real biome
        if (sp) {
          storage.getParcelBiomeByPlotId(sp.parentPlotId).then(biome => {
            recordSubParcelWorldEvent({ type: "sub_parcel_purchased", plotId: sp.parentPlotId, subIndex: sp.subIndex, biome, playerId: attackerId }).catch(() => {});
          }).catch(() => {});
        }
      }
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("[sub-parcels] attackSubParcel error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Sub-Parcel Listings ────────────────────────────────────────────────────

  /** GET /api/sub-parcels/listings — all open listings */
  app.get("/api/sub-parcels/listings", async (_req, res) => {
    try {
      const listings = await storage.getOpenSubParcelListings();
      res.json({ listings });
    } catch (err) {
      console.error("[listings] getOpenSubParcelListings error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/sub-parcels/listings — create a listing */
  app.post("/api/sub-parcels/listings", async (req, res) => {
    const { sellerId, subParcelId, askPriceFrontier } = req.body;
    if (!sellerId)         return res.status(400).json({ error: "sellerId required" });
    if (!subParcelId)      return res.status(400).json({ error: "subParcelId required" });
    if (!askPriceFrontier) return res.status(400).json({ error: "askPriceFrontier required" });
    try {
      const result = await storage.createSubParcelListing(sellerId, subParcelId, Number(askPriceFrontier));
      if (result.error) return res.status(400).json({ error: result.error });
      broadcastRaw({ type: "sub_parcel_listed", listing: result.listing });
      res.json({ success: true, listing: result.listing });
    } catch (err) {
      console.error("[listings] createSubParcelListing error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** DELETE /api/sub-parcels/listings/:id — cancel a listing */
  app.delete("/api/sub-parcels/listings/:id", async (req, res) => {
    const { id } = req.params;
    const { sellerId } = req.body;
    if (!sellerId) return res.status(400).json({ error: "sellerId required" });
    try {
      const result = await storage.cancelSubParcelListing(sellerId, id);
      if (result.error) return res.status(400).json({ error: result.error });
      broadcastRaw({ type: "sub_parcel_listing_cancelled", listingId: id });
      res.json({ success: true });
    } catch (err) {
      console.error("[listings] cancelSubParcelListing error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/sub-parcels/listings/:id/buy — purchase a listed sub-parcel */
  app.post("/api/sub-parcels/listings/:id/buy", async (req, res) => {
    const { id } = req.params;
    const { buyerId } = req.body;
    if (!buyerId) return res.status(400).json({ error: "buyerId required" });
    try {
      const result = await storage.buySubParcelListing(buyerId, id);
      if (result.error) return res.status(400).json({ error: result.error });
      markDirty();
      broadcastRaw({ type: "sub_parcel_sold", listing: result.listing });
      res.json({ success: true, listing: result.listing });
    } catch (err) {
      console.error("[listings] buySubParcelListing error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Season Endpoints ───────────────────────────────────────────────────────

  /** GET /api/season/current — get the active season info */
}
