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

export function registerGameRoutes(app: Express, ctx: RouteContext): void {
  const { assertPlayerOwnership, maybeGrantWelcomeBonus, fireBurn, adviceLimiter, algodClient, indexerClient } = ctx;

  app.get("/api/game/state", async (req, res) => {
    try {
      const gameState = await withDbRetry(() => storage.getGameState(), "getGameState");
      // Scope to the requesting viewer (fog of war / EPI). Anonymous → fully
      // redacted. The WS broadcast below re-scopes per connection.
      const auth = getAuth(req);
      res.json(scopeGameStateFor(gameState, auth?.playerId ?? null));
      broadcastGameState(gameState);
    } catch (error) {
      console.error("Error fetching game state:", error);
      res.status(500).json({ error: "Failed to fetch game state" });
    }
  });

  app.get("/api/game/slim-state", async (req, res) => {
    try {
      const slimState = await withDbRetry(() => storage.getSlimGameState(), "getSlimGameState");
      res.json(slimState);
    } catch (error) {
      console.error("Error fetching slim game state:", error);
      res.status(500).json({ error: "Failed to fetch game state" });
    }
  });

  app.get("/api/game/parcel/:id", async (req, res) => {
    try {
      const parcel = await storage.getParcel(req.params.id);
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      res.json(parcel);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parcel" });
    }
  });

  app.get("/api/game/player/:id", async (req, res) => {
    try {
      const player = await storage.getPlayer(req.params.id);
      if (!player) return res.status(404).json({ error: "Player not found" });
      res.json(player);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch player" });
    }
  });

  /**
   * Wallet-based player lookup / auto-creation.
   * Called by the client immediately after a wallet connects.
   * Returns the existing player for that address, or creates a fresh one.
   * Also grants the 500 FRONTIER welcome bonus on first login.
   */
  app.get("/api/game/player-by-address/:address", async (req, res) => {
    try {
      const { address } = req.params;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ error: "Address is required" });
      }

      const player = await storage.getOrCreatePlayerByAddress(address);
      const wb = await maybeGrantWelcomeBonus(player.id, address);

      // Return fresh player data (welcomeBonusReceived reflects any grant)
      const fresh = await storage.getPlayer(player.id);
      res.json({ ...fresh, welcomeBonus: wb.granted, welcomeBonusReason: wb.reason });
    } catch (error) {
      console.error("player-by-address error:", error);
      res.status(500).json({ error: "Failed to get or create player" });
    }
  });

  app.get("/api/testnet/progress/:address", async (req, res) => {
    // Testnet-only debug surface — never expose on mainnet (writes/reads mission
    // progress without auth). 404 hides its existence in production.
    if (process.env.ALGORAND_NETWORK === "mainnet") return res.sendStatus(404);
    try {
      const { address } = req.params;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ error: "Address is required" });
      }
      const player = await storage.getOrCreatePlayerByAddress(address);
      res.json({
        playerId: player.id,
        completedMissions: player.testnetProgress || [],
        stats: {
          territories: player.ownedParcels.length,
          totalIronMined: player.totalIronMined,
          totalFuelMined: player.totalFuelMined,
          totalCrystalMined: player.totalCrystalMined,
          totalFrontierEarned: player.totalFrontierEarned,
          attacksWon: player.attacksWon,
          attacksLost: player.attacksLost,
          hasCommander: player.commanders.length > 0,
          hasDrones: player.drones.length > 0,
          welcomeBonusReceived: player.welcomeBonusReceived,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch testnet progress" });
    }
  });

  app.post("/api/testnet/progress", async (req, res) => {
    // Testnet-only debug surface — never expose on mainnet (writes mission
    // progress without auth). 404 hides its existence in production.
    if (process.env.ALGORAND_NETWORK === "mainnet") return res.sendStatus(404);
    try {
      const { address, completedMissions } = req.body;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ error: "Address is required" });
      }
      if (!Array.isArray(completedMissions)) {
        return res.status(400).json({ error: "completedMissions must be an array" });
      }
      const player = await storage.getOrCreatePlayerByAddress(address);
      await storage.updateTestnetProgress(player.id, completedMissions);
      res.json({ success: true, completedMissions });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update progress" });
    }
  });

  // Returns all faction identity records for the game UI, enriched with live stats
  app.get("/api/factions", async (_req, res) => {
    try {
      const factionAsaIds = getAllFactionAsaIds();

      // Aggregate member counts and territory counts from DB
      const [allHumanPlayers, allParcels, allAiPlayers] = await Promise.all([
        db.select({
          id: playersTable.id,
          playerFactionId: playersTable.playerFactionId,
        }).from(playersTable).where(eq(playersTable.isAi, false)),
        db.select({
          ownerId: parcelsTable.ownerId,
        }).from(parcelsTable),
        db.select({
          id: playersTable.id,
          name: playersTable.name,
          iron: playersTable.iron,
          fuel: playersTable.fuel,
          crystal: playersTable.crystal,
          treasury: playersTable.treasury,
        }).from(playersTable).where(eq(playersTable.isAi, true)),
      ]);

      const memberCounts: Record<string, number> = {};
      for (const p of allHumanPlayers) {
        if (p.playerFactionId) {
          memberCounts[p.playerFactionId] = (memberCounts[p.playerFactionId] ?? 0) + 1;
        }
      }

      const territoryCounts: Record<string, number> = {};
      for (const parcel of allParcels) {
        if (parcel.ownerId) {
          territoryCounts[parcel.ownerId] = (territoryCounts[parcel.ownerId] ?? 0) + 1;
        }
      }

      // Map AI player IDs to faction names
      const aiPlayerByName: Record<string, { id: string; iron: number; fuel: number; crystal: number; treasury: number }> = {};
      for (const ai of allAiPlayers) {
        aiPlayerByName[ai.name] = {
          id: ai.id,
          iron: ai.iron,
          fuel: ai.fuel,
          crystal: ai.crystal ?? 0,
          treasury: ai.treasury ?? 0,
        };
      }

      const factions = FACTION_DEFINITIONS.map((f) => {
        const aiPlayer = aiPlayerByName[f.name];
        const aiTerritoryCount = aiPlayer ? (territoryCounts[aiPlayer.id] ?? 0) : 0;
        return {
          name:            f.name,
          unitName:        f.unitName,
          assetName:       f.assetName,
          behavior:        f.behavior,
          lore:            f.lore,
          totalSupply:     f.totalSupply,
          assetId:         factionAsaIds[f.name] ?? null,
          explorerUrl:     factionAsaIds[f.name]
            ? `https://allo.info/asset/${factionAsaIds[f.name]}`
            : null,
          onChain:         factionAsaIds[f.name] != null,
          // Live stats
          memberCount:     memberCounts[f.name] ?? 0,
          territoryCount:  aiTerritoryCount,
          iron:            aiPlayer?.iron ?? 0,
          fuel:            aiPlayer?.fuel ?? 0,
          crystal:         aiPlayer?.crystal ?? 0,
          treasury:        aiPlayer?.treasury ?? 0,
        };
      });
      res.json({ factions });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch faction data" });
    }
  });

  // Join (or switch) faction alignment for the current player
  app.post("/api/factions/:name/join", async (req, res) => {
    try {
      const factionName = decodeURIComponent(req.params.name);
      const { playerId } = req.body as { playerId?: string };

      if (!playerId) return res.status(400).json({ error: "playerId required" });

      const def = FACTION_DEFINITIONS.find((f) => f.name === factionName);
      if (!def) return res.status(404).json({ error: "Faction not found" });

      // Ensure this is a human player
      const [playerRow] = await db
        .select({ id: playersTable.id, isAi: playersTable.isAi, playerFactionId: playersTable.playerFactionId, factionJoinedAt: playersTable.factionJoinedAt })
        .from(playersTable)
        .where(eq(playersTable.id, playerId));

      if (!playerRow) return res.status(404).json({ error: "Player not found" });
      if (playerRow.isAi) return res.status(400).json({ error: "AI players cannot join factions" });

      // Enforce 24h cooldown on faction switching (first-time joins are always allowed)
      const COOLDOWN_MS = 24 * 60 * 60 * 1000;
      if (playerRow.playerFactionId && playerRow.playerFactionId !== factionName) {
        const joinedAt = playerRow.factionJoinedAt ? Number(playerRow.factionJoinedAt) : 0;
        const elapsed = Date.now() - joinedAt;
        if (elapsed < COOLDOWN_MS) {
          return res.status(400).json({
            error: "Faction switch cooldown active",
            cooldownEndsAt: joinedAt + COOLDOWN_MS,
          });
        }
      }

      await db
        .update(playersTable)
        .set({
          playerFactionId: factionName,
          factionJoinedAt: Date.now(),
        })
        .where(eq(playersTable.id, playerId));

      markDirty();
      res.json({ success: true, factionName, previousFaction: playerRow.playerFactionId ?? null });
    } catch (err) {
      res.status(500).json({ error: "Failed to join faction" });
    }
  });

  // Leave faction (set to unaligned)
  app.post("/api/factions/leave", async (req, res) => {
    try {
      const { playerId } = req.body as { playerId?: string };
      if (!playerId) return res.status(400).json({ error: "playerId required" });

      const [playerRow] = await db
        .select({ id: playersTable.id, playerFactionId: playersTable.playerFactionId })
        .from(playersTable)
        .where(eq(playersTable.id, playerId));

      if (!playerRow) return res.status(404).json({ error: "Player not found" });

      await db
        .update(playersTable)
        .set({ playerFactionId: null, factionJoinedAt: null })
        .where(eq(playersTable.id, playerId));

      markDirty();
      res.json({ success: true, previousFaction: playerRow.playerFactionId ?? null });
    } catch (err) {
      res.status(500).json({ error: "Failed to leave faction" });
    }
  });

  // Get members for a specific faction
  app.get("/api/factions/:name/members", async (req, res) => {
    try {
      const factionName = decodeURIComponent(req.params.name);
      const def = FACTION_DEFINITIONS.find((f) => f.name === factionName);
      if (!def) return res.status(404).json({ error: "Faction not found" });

      const members = await db
        .select({
          id: playersTable.id,
          name: playersTable.name,
          factionJoinedAt: playersTable.factionJoinedAt,
          territoriesCaptured: playersTable.territoriesCaptured,
          attacksWon: playersTable.attacksWon,
        })
        .from(playersTable)
        .where(eq(playersTable.playerFactionId as any, factionName));

      res.json({
        factionName,
        members: members.map((m) => ({
          id: m.id,
          name: m.name,
          joinedAt: m.factionJoinedAt ? Number(m.factionJoinedAt) : null,
          territoriesCaptured: m.territoriesCaptured,
          attacksWon: m.attacksWon,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch faction members" });
    }
  });

  app.get("/api/game/leaderboard", async (req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/parcels/attackable", async (req, res) => {
    try {
      const { session } = req as any;
      const playerId = (session?.playerId as string) ?? "";
      const biomeFilter = req.query.biome as string | undefined;

      const rows = await withDbRetry(
        () =>
          db
            .select({
              id:             parcelsTable.id,
              plotId:         parcelsTable.plotId,
              biome:          parcelsTable.biome,
              ownerId:        parcelsTable.ownerId,
              defenseLevel:   parcelsTable.defenseLevel,
              lat:            parcelsTable.lat,
              lng:            parcelsTable.lng,
              ironStored:     parcelsTable.ironStored,
              fuelStored:     parcelsTable.fuelStored,
              crystalStored:  parcelsTable.crystalStored,
              activeBattleId: parcelsTable.activeBattleId,
            })
            .from(parcelsTable)
            .where(
              sql`
                ${parcelsTable.ownerId} IS NOT NULL
                AND ${parcelsTable.ownerId} != ${playerId}
                AND ${parcelsTable.activeBattleId} IS NULL
                ${biomeFilter ? sql`AND ${parcelsTable.biome} = ${biomeFilter}` : sql``}
              `
            )
            .orderBy(
              sql`(${parcelsTable.ironStored} + ${parcelsTable.fuelStored} + ${parcelsTable.crystalStored}) DESC`
            )
            .limit(50),
        "getAttackableParcels"
      );

      res.json({ parcels: rows });
    } catch (err) {
      console.error("[/api/parcels/attackable]", err);
      res.status(500).json({ error: "Failed to fetch attackable parcels" });
    }
  });

  // ── Admin key guard (used for internal/admin endpoints) ───────────────────
  // NOTE: requireAdminKey is now imported from ./security — it fails CLOSED in
  // production (a missing ADMIN_KEY no longer grants access) and only accepts
  // the key via the x-admin-key header in prod (never the query string, which
  // would be captured by access logs).

  app.post("/api/game/resolve-battles", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const resolved = await storage.resolveBattles();
      res.json({ success: true, resolved });
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve battles" });
    }
  });

  app.post("/api/game/ai-turn", async (req, res) => {
    if (!requireAdminKey(req, res)) return;
    try {
      const events = await storage.runAITurn();
      res.json({ success: true, events });
    } catch (error) {
      res.status(500).json({ error: "Failed to run AI turn" });
    }
  });

  // ── Testnet Reset ─────────────────────────────────────────────────────────
  // Wipe all game data and re-seed from scratch. Testnet only.
  app.post("/api/game/reset", async (_req, res) => {
    if (!requireAdminKey(_req, res)) return;
    try {
      console.log("[RESET] Wiping game data for testnet reset…");
      // Clear all tables in dependency order
      await db.delete(subParcelsTable);
      await db.delete(tradeOrdersTable);
      await db.delete(orbitalEventsTable);
      await db.delete(gameEventsTable);
      await db.delete(battlesTable);
      await db.delete(plotNftsTable);
      await db.delete(mintIdempotencyTable);
      await db.delete(parcelsTable);
      await db.delete(playersTable);
      // Reset game_meta so seeder runs on next init
      await db.update(gameMeta).set({ initialized: false, currentTurn: 1, lastUpdateTs: 0 }).where(eq(gameMeta.id, 1));
      console.log("[RESET] All tables cleared. Re-seeding…");

      // Reset the storage init state and re-seed
      storage.resetInitState();
      await storage.initialize();

      // Broadcast fresh state
      const freshState = await storage.getGameState();
      broadcastGameState(freshState);

      console.log("[RESET] Testnet reset complete.");
      res.json({ success: true, message: "Game reset and re-seeded successfully", totalParcels: freshState.parcels.length });
    } catch (error) {
      console.error("[RESET] Error:", error);
      res.status(500).json({ error: "Failed to reset game" });
    }
  });

  // ── Orbital Event Engine API ──────────────────────────────────────────────

  /** GET /api/orbital/active — return all live gameplay-affecting impact events */
  app.get("/api/orbital/active", async (_req, res) => {
    try {
      const events = await storage.getActiveOrbitalEvents();
      res.json({ events });
    } catch (error) {
      console.error("[ORBITAL-DEBUG] getActiveOrbitalEvents error:", error);
      res.status(500).json({ error: "Failed to fetch orbital events" });
    }
  });

  /** POST /api/orbital/trigger — server rolls for an impact event (called by interval) */
  app.post("/api/orbital/trigger", async (_req, res) => {
    try {
      const event = await storage.triggerOrbitalCheck();
      if (event) {
        console.log(`[ORBITAL-DEBUG] POST /api/orbital/trigger | NEW IMPACT | id: ${event.id} | type: ${event.type}`);
      }
      res.json({ event: event ?? null });
    } catch (error) {
      console.error("[ORBITAL-DEBUG] triggerOrbitalCheck error:", error);
      res.status(500).json({ error: "Failed to trigger orbital check" });
    }
  });

  /** POST /api/orbital/resolve/:id — mark an impact event resolved + apply effects */
  app.post("/api/orbital/resolve/:id", async (req, res) => {
    try {
      await storage.resolveOrbitalEvent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("[ORBITAL-DEBUG] resolveOrbitalEvent error:", error);
      res.status(500).json({ error: "Failed to resolve orbital event" });
    }
  });

  // World Intel API endpoints
  app.get("/api/world/events", async (req, res) => {
    try {
      const { start, end, types, limit } = req.query;
      const filters: import("@shared/worldEvents").WorldEventFilters = {};
      if (start)  filters.start  = Number(start);
      if (end)    filters.end    = Number(end);
      // Always clamp — an unbounded `limit` lets a caller dump the entire event
      // log in one request (off-chain activity-intelligence scrape).
      filters.limit = clampLimit(limit, 100, 200);
      if (types)  filters.types  = String(types).split(",") as import("@shared/worldEvents").WorldEventType[];
      res.json(listWorldEvents(filters));
    } catch { res.status(500).json({ error: "Failed to fetch world events" }); }
  });

  app.get("/api/world/events/recent", (_req, res) => {
    try { res.json(getRecentWorldEvents()); }
    catch { res.status(500).json({ error: "Failed to fetch recent events" }); }
  });

  // Battle replay — returns the stored replay record for a resolved battle.
  // Available for 24 hours after resolution. Returns 404 after expiry.
  app.get("/api/battle/replay/:battleId", async (req, res) => {
    try {
      const { battleId } = req.params;
      if (!battleId || typeof battleId !== "string") {
        return res.status(400).json({ error: "battleId is required" });
      }
      const replay = await getBattleReplay(battleId);
      if (!replay) {
        return res.status(404).json({
          error: "Replay not available",
          reason: "Battle replay expires after 24 hours or Redis is not configured"
        });
      }
      res.json(replay);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch battle replay" });
    }
  });


  // Staggered background tasks — avoids hammering Neon with simultaneous queries
  setInterval(async () => {
    try {
      const resolved = await withDbRetry(() => storage.resolveBattles(), "resolveBattles");
      if (resolved.length > 0) {
        for (const battle of resolved) {
          try {
            const parcel = await storage.getParcel(battle.targetParcelId);
            if (parcel) {
              const resolvedAttacker = await storage.getPlayer(battle.attackerId).catch(() => undefined);
              const [defenderRow] = battle.defenderId
                ? await db.select({ name: playersTable.name }).from(playersTable).where(eq(playersTable.id, battle.defenderId))
                : [undefined];

              const nowTs = Date.now();
              appendWorldEvent({
                type: "battle_resolved",
                timestamp: nowTs,
                lat: parcel.lat,
                lng: parcel.lng,
                plotId: parcel.plotId,
                playerId: battle.attackerId,
                severity: battle.outcome === "attacker_wins" ? "high" : "medium",
                metadata: {
                  battleId: battle.id,
                  outcome: battle.outcome,
                  attacker: resolvedAttacker?.name ?? "Unknown",
                }
              });

              // ── Rich WS broadcast so clients can render a live outcome card ──
              broadcastRaw({
                type:          "battle:resolved",
                battleId:      battle.id,
                outcome:       battle.outcome,
                plotId:        parcel.plotId,
                lat:           parcel.lat,
                lng:           parcel.lng,
                biome:         parcel.biome,
                attackerName:  resolvedAttacker?.name ?? "Unknown",
                defenderName:  defenderRow?.name ?? "Unclaimed",
                attackerPower: Math.round(battle.attackerPower ?? 0),
                defenderPower: Math.round(battle.defenderPower ?? 0),
                randFactor:    battle.randFactor ?? 0,
                timestamp:     nowTs,
              });
            }
          } catch { /* non-critical */ }
        }
        markDirty();
      }

      // ── Clear expired EMP / Sabotage debuffs ─────────────────────────────
      try {
        const nowDebuff = Date.now();
        await db.update(parcelsTable)
          .set({ defenseLevel: sql`LEAST(${parcelsTable.defenseLevel} + 2, 10)`, empDebuffUntil: null } as any)
          .where(sql`${parcelsTable.empDebuffUntil} IS NOT NULL AND ${parcelsTable.empDebuffUntil} < ${nowDebuff}`);
        await db.update(parcelsTable)
          .set({ yieldMultiplier: sql`LEAST(${parcelsTable.yieldMultiplier} * 2, 2.0)`, sabotageDebuffUntil: null } as any)
          .where(sql`${parcelsTable.sabotageDebuffUntil} IS NOT NULL AND ${parcelsTable.sabotageDebuffUntil} < ${nowDebuff}`);
      } catch { /* non-critical */ }
    } catch (error) {
      console.warn("Background task (battles):", error instanceof Error ? error.message : error);
    }
  }, 15000);

  setInterval(async () => {
    try {
      if (process.env.AI_ENABLED === "true") {
        const aiEvents = await withDbRetry(() => storage.runAITurn(), "runAITurn");
        if (aiEvents && aiEvents.length > 0) markDirty();
      }
    } catch (error) {
      console.warn("Background task (AI):", error instanceof Error ? error.message : error);
    }
  }, 20000);

  // Orbital check every 5 minutes
  setInterval(async () => {
    try {
      const event = await withDbRetry(() => storage.triggerOrbitalCheck(), "triggerOrbitalCheck");
      if (event) {
        console.log(`[ORBITAL] new impact id=${event.id} type=${event.type}`);
        markDirty();
      }
    } catch (error) {
      console.warn("[ORBITAL] background check:", error instanceof Error ? error.message : error);
    }
  }, 5 * 60 * 1000);

  // ── Trade Station ────────────────────────────────────────────────────────────

  app.get("/api/season/current", async (_req, res) => {
    try {
      const season = await storage.getCurrentSeason();
      res.json({ season });
    } catch (err) {
      console.error("[season] getCurrentSeason error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /api/season/history — get all past seasons */
  app.get("/api/season/history", async (_req, res) => {
    try {
      const seasons = await storage.getSeasonHistory();
      res.json({ seasons });
    } catch (err) {
      console.error("[season] getSeasonHistory error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /api/battles/history — paginated battle log with optional filters */
  app.get("/api/battles/history", async (req, res) => {
    try {
      const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit  ?? "20"), 10)));
      const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"),  10));
      const outcome = req.query.outcome as string | undefined;
      const player  = req.query.player  as string | undefined;

      // Fetch resolved battles from DB, newest first
      const allResolved = await db.select()
        .from(battlesTable)
        .where(eq(battlesTable.status, "resolved"))
        .orderBy(desc(battlesTable.resolveTs));

      // Pre-load player names for lookup
      const playerIds = new Set<string>();
      for (const b of allResolved) {
        playerIds.add(b.attackerId);
        if (b.defenderId) playerIds.add(b.defenderId);
      }
      const playerRows = playerIds.size > 0
        ? await db.select({ id: playersTable.id, name: playersTable.name })
            .from(playersTable)
            .where(sql`${playersTable.id} = ANY(ARRAY[${sql.raw([...playerIds].map(id => `'${id}'`).join(","))}]::text[])`)
        : [];
      const nameById = new Map(playerRows.map(p => [p.id, p.name]));

      // Pre-load parcel plotIds
      const parcelIds = [...new Set(allResolved.map(b => b.targetParcelId))];
      const parcelRows = parcelIds.length > 0
        ? await db.select({ id: parcelsTable.id, plotId: parcelsTable.plotId, biome: parcelsTable.biome })
            .from(parcelsTable)
            .where(sql`${parcelsTable.id} = ANY(ARRAY[${sql.raw(parcelIds.map(id => `'${id}'`).join(","))}]::text[])`)
        : [];
      const parcelById = new Map(parcelRows.map(p => [p.id, p]));

      // Build enriched records and apply filters
      let records = allResolved.map(b => {
        const attackerName = nameById.get(b.attackerId) ?? "Unknown";
        const defenderName = b.defenderId ? (nameById.get(b.defenderId) ?? "Unclaimed") : "Unclaimed";
        const parcel       = parcelById.get(b.targetParcelId);
        return {
          id:            b.id,
          attackerName,
          defenderName,
          plotId:        parcel?.plotId ?? 0,
          biome:         parcel?.biome  ?? "plains",
          outcome:       b.outcome,
          attackerPower: b.attackerPower,
          defenderPower: b.defenderPower,
          randFactor:    b.randFactor   ?? 0,
          pillagedIron:  0,
          pillagedFuel:  0,
          pillagedCrystal: 0,
          resolvedAt:    b.resolveTs,
          startTs:       b.startTs,
          resolveTs:     b.resolveTs,
        };
      });

      if (outcome) records = records.filter(r => r.outcome === outcome);
      if (player)  records = records.filter(r =>
        r.attackerName.toLowerCase().includes(player.toLowerCase()) ||
        r.defenderName.toLowerCase().includes(player.toLowerCase())
      );

      const total   = records.length;
      const paged   = records.slice(offset, offset + limit);
      res.json({ battles: paged, total, hasMore: offset + limit < total });
    } catch (err) {
      console.error("[battles/history]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** GET /api/admin/metrics — per-route timing diagnostics (admin-gated) */
}
