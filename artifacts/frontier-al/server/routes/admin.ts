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
import { _apiRouteTimings, SLOW_API_THRESHOLD_MS } from "./_timing";
import { GAME_CONFIG } from "../config/gameConfig";

export function registerAdminRoutes(app: Express, ctx: RouteContext): void {
  const { assertPlayerOwnership, maybeGrantWelcomeBonus, fireBurn, adviceLimiter, algodClient, indexerClient } = ctx;

  app.post("/api/admin/markets", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const parsed = createMarketSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const market = await withDbRetry(() => storage.createMarket(parsed.data, "admin"), "createMarket");
      res.json(market);
    } catch (err) {
      console.error("[markets] createMarket error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/markets/:id/resolve", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const parsed = resolveMarketSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const result = await withDbRetry(() => storage.resolveMarket(req.params.id, parsed.data.winningOutcome), "resolveMarket");
      if ("error" in result) return res.status(400).json({ error: result.error });
      res.json(result);
    } catch (err) {
      console.error("[markets] resolveMarket error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/mint-status/:plotId", async (req, res) => {
    if (!requireAdminKey(req, res)) return;

    const plotId = parseInt(req.params.plotId, 10);
    if (isNaN(plotId)) {
      return res.status(400).json({ error: "Invalid plotId" });
    }

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    try {
      const [nftRecord] = await db
        .select()
        .from(plotNftsTable)
        .where(eq(plotNftsTable.plotId, plotId));

      const idmpKey = `mint-plot-${plotId}`;
      const [idempotencyKey] = await db
        .select()
        .from(mintIdempotencyTable)
        .where(eq(mintIdempotencyTable.key, idmpKey));

      if (!nftRecord && !idempotencyKey) {
        return res.status(404).json({ error: "No mint record found for this plot" });
      }

      res.json({
        plotId,
        nftRecord: nftRecord || null,
        idempotencyKey: idempotencyKey || null,
      });
    } catch (error) {
      console.error(`[admin] mint-status error plotId=${plotId}`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Sub-Parcel Endpoints ───────────────────────────────────────────────────

  /** GET /api/plots/:plotId/sub-parcels — list sub-parcels for a macro-plot */
  app.get("/api/admin/metrics", (req, res) => {
    if (!requireAdminKey(req, res)) return;
    const routes = Object.entries(_apiRouteTimings)
      .filter(([, s]) => s.count > 0)
      .map(([route, s]) => ({
        route,
        count: s.count,
        avgMs: Math.round(s.totalTimeMs / s.count),
        maxMs: s.maxTimeMs,
        slowCount: s.slowCount,
      }))
      .sort((a, b) => b.count - a.count);
    res.json({ slowThresholdMs: SLOW_API_THRESHOLD_MS, routes });
  });

  /** GET /api/admin/battles-live — currently pending battles */
  app.get("/api/admin/battles-live", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const pending = await db.select()
        .from(battlesTable)
        .where(eq(battlesTable.status, "pending"))
        .orderBy(battlesTable.resolveTs);

      const playerIds = [...new Set([...pending.map(b => b.attackerId), ...pending.filter(b => b.defenderId).map(b => b.defenderId!)])];
      const playerRows = playerIds.length > 0
        ? await db.select({ id: playersTable.id, name: playersTable.name })
            .from(playersTable)
            .where(sql`${playersTable.id} = ANY(ARRAY[${sql.raw(playerIds.map(id => `'${id}'`).join(","))}]::text[])`)
        : [];
      const nameById = new Map(playerRows.map(p => [p.id, p.name]));

      const parcelRows = pending.length > 0
        ? await db.select({ id: parcelsTable.id, plotId: parcelsTable.plotId })
            .from(parcelsTable)
            .where(sql`${parcelsTable.id} = ANY(ARRAY[${sql.raw(pending.map(b => `'${b.targetParcelId}'`).join(","))}]::text[])`)
        : [];
      const plotIdById = new Map(parcelRows.map(p => [p.id, p.plotId]));

      res.json(pending.map(b => ({
        id:           b.id,
        attackerName: nameById.get(b.attackerId) ?? "Unknown",
        defenderName: b.defenderId ? (nameById.get(b.defenderId) ?? "Unclaimed") : "Unclaimed",
        plotId:       plotIdById.get(b.targetParcelId) ?? 0,
        startTs:      b.startTs,
        resolveTs:    b.resolveTs,
      })));
    } catch (err) {
      console.error("[admin/battles-live]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /api/admin/ai-activity — AI faction status + last action per faction */
  app.get("/api/admin/ai-activity", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const factionRows = await db
        .select()
        .from(playersTable)
        .where(eq(playersTable.isAi, true));

      const result = await Promise.all(
        factionRows.map(async (f) => {
          const [lastEvent] = await db
            .select()
            .from(gameEventsTable)
            .where(eq(gameEventsTable.playerId, f.id))
            .orderBy(desc(gameEventsTable.ts))
            .limit(1);

          const [{ count }] = await db
            .select({ count: sql<number>`cast(count(*) as int)` })
            .from(parcelsTable)
            .where(eq(parcelsTable.ownerId, f.id));

          const recentMs = 5 * 60 * 1000;
          const isActive = lastEvent && (Date.now() - lastEvent.ts) < recentMs;

          return {
            name: f.name,
            behavior: f.aiBehavior ?? "expansionist",
            iron: f.iron,
            fuel: f.fuel,
            crystal: f.crystal,
            plotCount: count ?? 0,
            status: isActive ? "ACTIVE" : "MONITORING",
            lastAction: lastEvent
              ? { description: lastEvent.description, timestamp: lastEvent.ts }
              : null,
          };
        })
      );

      res.json({
        factions: result,
        aiEnabled: process.env.AI_ENABLED === "true",
        tickIntervalSecs: 20,
      });
    } catch (err) {
      console.error("[admin/ai-activity]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** POST /api/admin/season/start — start a new season (admin only) */
  app.post("/api/admin/season/start", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    const { name, daysLen } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    try {
      const season = await storage.startSeason(name, daysLen ?? GAME_CONFIG.season.defaultDays);
      markDirty();
      res.json({ success: true, season });
    } catch (err: any) {
      console.error("[season] startSeason error", err);
      res.status(400).json({ error: err.message ?? "Failed to start season" });
    }
  });

  /** POST /api/admin/season/settle — settle the current season */
  app.post("/api/admin/season/settle", async (_req, res) => {
    if (!requireAdminKey(_req, res)) return;
    try {
      const season = await storage.settleCurrentSeason();
      if (!season) return res.status(404).json({ error: "No active season to settle" });
      markDirty();
      res.json({ success: true, season });
    } catch (err) {
      console.error("[season] settleCurrentSeason error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/admin/status
   * Health + readiness probe for monitoring tools and deployment health checks.
   * Returns Algorand chain connectivity, DB pool stats, and AI faction state.
   * Protected by ADMIN_KEY when set; open otherwise (useful for deploy probes).
   */
  app.get("/api/admin/status", async (_req, res) => {
    if (!requireAdminKey(_req, res)) return;

    const startedAt = process.hrtime.bigint();

    // ── Algorand chain probe ───────────────────────────────────────────────────
    let algorand: Record<string, unknown> = { connected: false, network: process.env.ALGORAND_NETWORK ?? "testnet" };
    try {
      const algodProbeStart = Date.now();
      const algod = getAlgodClient();
      const nodeStatus = await algod.status().do() as unknown as Record<string, unknown>;
      const latencyMs = Date.now() - algodProbeStart;
      const toNum = (v: unknown) => (typeof v === "bigint" ? Number(v) : v);
      algorand = {
        connected: true,
        network: process.env.ALGORAND_NETWORK ?? "testnet",
        latencyMs,
        lastRound: toNum(nodeStatus["last-round"] ?? nodeStatus.lastRound) ?? null,
        catchupTime: toNum(nodeStatus["catchup-time"]) ?? null,
      };
    } catch (algodErr) {
      algorand = {
        connected: false,
        network: process.env.ALGORAND_NETWORK ?? "testnet",
        error: algodErr instanceof Error ? algodErr.message : String(algodErr),
      };
    }

    // ── DB pool stats ──────────────────────────────────────────────────────────
    const dbPool = getPoolStats();

    // ── DB ping ───────────────────────────────────────────────────────────────
    let dbPingMs: number | null = null;
    let dbConnected = false;
    try {
      const dbPingStart = Date.now();
      await withDbRetry(() => db.execute(sql`SELECT 1`), "admin-status-ping", 1);
      dbPingMs = Date.now() - dbPingStart;
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    // ── AI faction summary ────────────────────────────────────────────────────
    const aiEnabled = process.env.AI_ENABLED === "true";
    let aiFactions: unknown[] = [];
    try {
      const aiFactionRows = await withDbRetry(
        () => db.select({ id: playersTable.id, name: playersTable.name, isAi: playersTable.isAi, aiBehavior: playersTable.aiBehavior, iron: playersTable.iron, fuel: playersTable.fuel, crystal: playersTable.crystal })
          .from(playersTable)
          .where(eq(playersTable.isAi, true)),
        "admin-status-ai-factions",
        1
      );
      aiFactions = aiFactionRows.map(f => ({
        name: f.name,
        behavior: f.aiBehavior ?? "expansionist",
        resources: { iron: f.iron, fuel: f.fuel, crystal: f.crystal },
      }));
    } catch {
      aiFactions = [];
    }

    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    res.json({
      ok: algorand.connected && dbConnected,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      probeLatencyMs: Math.round(elapsedMs),
      algorand,
      db: {
        connected: dbConnected,
        pingMs: dbPingMs,
        pool: dbPool,
      },
      ai: {
        enabled: aiEnabled,
        factionCount: aiFactions.length,
        factions: aiFactions,
      },
      env: {
        nodeEnv: process.env.NODE_ENV ?? "development",
        network: process.env.ALGORAND_NETWORK ?? "testnet",
        asaId: getFrontierAsaId() ?? null,
      },
    });
  });

}
