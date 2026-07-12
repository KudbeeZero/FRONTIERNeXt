import { randomUUID } from "crypto";
import type {
  GameEvent,
  MineAction,
  UpgradeAction,
  AttackAction,
  PurchaseAction,
} from "@shared/schema";
import {
  MINE_COOLDOWN_MS,
  UPGRADE_COSTS,
  ATTACK_BASE_COST,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  gameMeta,
  players as playersTable,
  parcels as parcelsTable,
} from "../db-schema";
import { sphereDistance } from "../sphereUtils";
import {
  evaluateReconquest,
  shouldAbandonAfterCapture,
  type AiFactionState,
  type ContestedPlot,
} from "../engine/ai/reconquest.js";
import { rowToPlayer, rowToParcel } from "./game-rules";
import { withFactionVoice } from "../engine/narrative/factionVoice.js";

type DB = typeof db;
type Player = ReturnType<typeof rowToPlayer>;
// Parcels from db.select() are raw ParcelRow; the loop reads only primitive
// fields, so we keep these loosely typed to avoid row<->domain mapping churn.
type Parcel = any;

/** Reasonable cooldown applied to an AI faction after it launches an attack. */
export const AI_ATTACK_COOLDOWN_MS = 60_000;
/** Maximum number of AI-launched battles that may be active at once. */
export const AI_MAX_ACTIVE_BATTLES = 12;
/** SPECTRE only attacks once its combined iron+fuel stockpile reaches this floor. */
export const SPECTRE_ATTACK_RESOURCE_MIN = 120;
/** Base attack range (radians on the sphere) for AI-launched attacks. */
export const AI_ATTACK_RANGE = 0.11;
/** How close a NEXUS-7 plot must be to a KRONOS parcel to trigger a counterattack. */
export const KRONOS_THREAT_RANGE = 0.12;

/** Minimal shape of an active battle, as consumed by the AI loop. */
export interface AiActiveBattle {
  id: string;
  attackerId: string;
  targetParcelId: string;
  status: string;
}

export type AiOps = {
  mineResources:  (action: MineAction)    => Promise<any>;
  collectAll:     (playerId: string)       => Promise<any>;
  purchaseLand:   (action: PurchaseAction) => Promise<any>;
  deployAttack:   (action: AttackAction)   => Promise<any>;
  upgradeBase:    (action: UpgradeAction)  => Promise<any>;
  addEvent:       (event: Omit<GameEvent, "id"> & { id?: string }) => Promise<void>;
  /** Optional: supply currently-active battles so the loop can enforce caps/dedup. */
  getActiveBattles?: () => Promise<AiActiveBattle[]>;
};

interface AiTurnContext {
  now: number;
  /** Running count of AI-launched battles across this tick (enforces the cap). */
  aiActiveBattleCount: number;
  /** Target parcel ids already covered by an active battle this tick. */
  battleTargetIds: Set<string>;
  newEvents: GameEvent[];
}

/**
 * AI turn logic extracted from DbStorage.
 * Caller is responsible for calling initialize() before invoking this function.
 *
 * All four faction behaviors are wired to act every tick, each with a distinct
 * strategy. Safeguards (one action per faction per turn, no duplicate/self
 * attacks, cooldown, and a global active-battle cap) are enforced here; the
 * database layer (`deployAttack`) additionally rejects self-targets and targets
 * that are already under attack.
 */
export async function runAITurn(db: DB, ops: AiOps): Promise<GameEvent[]> {
  if (process.env.AI_ENABLED !== 'true') return [];
  const now = Date.now();
  const newEvents: GameEvent[] = [];

  const [allAiPlayers, allParcels] = await Promise.all([
    db.select().from(playersTable).where(eq(playersTable.isAi, true)),
    db.select().from(parcelsTable),
  ]);

  const parcelById = new Map(allParcels.map((p) => [p.id, p]));
  const ownerMap: Map<string, string[]> = new Map();
  for (const p of allParcels) {
    if (p.ownerId) {
      if (!ownerMap.has(p.ownerId)) ownerMap.set(p.ownerId, []);
      ownerMap.get(p.ownerId)!.push(p.id);
    }
  }
  const aiIds = new Set(allAiPlayers.map((p) => p.id));

  // Load active battles once for cap + dedup checks this tick.
  const activeBattles = ops.getActiveBattles ? await ops.getActiveBattles() : [];
  const aiActiveBattleCount = activeBattles.filter((b) => aiIds.has(b.attackerId)).length;
  const battleTargetIds = new Set(activeBattles.map((b) => b.targetParcelId));

  const ctx: AiTurnContext = { now, aiActiveBattleCount, battleTargetIds, newEvents };

  for (const aiRow of allAiPlayers) {
    if (Math.random() > 0.4) continue; // ~60% per-tick rate limit

    const ai = rowToPlayer(aiRow, ownerMap.get(aiRow.id) ?? []);
    const ownedParcels = ai.ownedParcels
      .map((id) => parcelById.get(id))
      .filter((p): p is typeof allParcels[0] => !!p)
      .map(rowToParcel);

    // ── Passive resource upkeep (not a "turn action") ────────────────────────
    for (const parcel of ownedParcels) {
      if (now - parcel.lastMineTs >= MINE_COOLDOWN_MS) {
        try { await ops.mineResources({ playerId: ai.id, parcelId: parcel.id }); } catch {}
        break;
      }
    }
    for (const parcel of ownedParcels) {
      if (parcel.ironStored + parcel.fuelStored + parcel.crystalStored > 50) {
        try { await ops.collectAll(ai.id); } catch {}
        break;
      }
    }

    // ── Per-faction gating state ───────────────────────────────────────────────
    const behavior = (ai.aiBehavior ?? "expansionist") as string;
    const onCooldown = !!ai.attackCooldownUntil && now < ai.attackCooldownUntil;
    const moraleDebuffed = !!ai.moraleDebuffUntil && now < ai.moraleDebuffUntil;
    const canAfford = ai.iron >= ATTACK_BASE_COST.iron && ai.fuel >= ATTACK_BASE_COST.fuel;
    const canAttack =
      !onCooldown && !moraleDebuffed && canAfford &&
      ctx.aiActiveBattleCount < AI_MAX_ACTIVE_BATTLES;

    let acted = false; // one major action per faction per turn

    // ── AI Reconquest (all factions) ──────────────────────────────────────────
    const contestedPlots: ContestedPlot[] = allParcels
      .filter((p) =>
        p.ownerType === "player" &&
        (p as any).capturedFromFaction === ai.name &&
        (p as any).capturedAt != null
      )
      .map((p): ContestedPlot => ({
        parcelId:            p.id,
        plotId:              p.plotId,
        richness:            p.richness,
        capturedFromFaction: (p as any).capturedFromFaction,
        capturedAt:          Number((p as any).capturedAt),
        handoverCount:       (p as any).handoverCount ?? 0,
        currentDefenseLevel: p.defenseLevel,
      }));

    if (!acted && contestedPlots.length > 0 && canAttack) {
      const avgDefense = ownedParcels.length > 0
        ? ownedParcels.reduce((s, p) => s + p.defenseLevel, 0) / ownedParcels.length
        : 0;

      const factionState: AiFactionState = {
        id:                  ai.id,
        name:                ai.name,
        behavior:            behavior as AiFactionState["behavior"],
        iron:                ai.iron,
        fuel:                ai.fuel,
        ownedTerritoryCount: ownedParcels.length,
        averageDefenseLevel: avgDefense,
        moraleDebuffUntil:   ai.moraleDebuffUntil ?? 0,
        attackCooldownUntil: ai.attackCooldownUntil ?? 0,
      };

      const decision = evaluateReconquest(factionState, contestedPlots, now, Math.random(), ATTACK_BASE_COST);
      if (decision.shouldAttempt && decision.targetParcelId) {
        const target = parcelById.get(decision.targetParcelId);
        if (target && target.ownerId !== ai.id && !ctx.battleTargetIds.has(target.id)) {
          acted = await launchAttack(db, ops, ctx, ai, target, "reconquest", decision.reason, 1);
        }
      }
    }

    // ── Behavior-driven primary action ────────────────────────────────────────
    if (!acted && canAttack) {
      switch (behavior) {
        case "expansionist": // NEXUS-7: hammer the weakest enemy territory in range
          acted = await actExpansionist(db, ops, ctx, ai, ownedParcels, allParcels);
          break;
        case "raider": // VANGUARD: strike the most valuable / vulnerable enemy plot
          acted = await actRaider(db, ops, ctx, ai, ownedParcels, allParcels, allAiPlayers);
          break;
        case "defensive": // KRONOS: fortify, counterattack NEXUS-7 when threatened
          acted = await actDefensive(db, ops, ctx, ai, ownedParcels, allParcels, allAiPlayers);
          break;
        case "economic": // SPECTRE: build resources, then hit strategic/high-yield plots
          acted = await actEconomic(db, ops, ctx, ai, ownedParcels, allParcels);
          break;
        default:
          acted = await actExpansionist(db, ops, ctx, ai, ownedParcels, allParcels);
      }
    }

    // ── Expansion fallback (only if no attack happened this turn) ──────────────
    if (!acted && (behavior === "expansionist" || behavior === "economic")) {
      acted = await tryExpand(db, ops, ctx, ai, ownedParcels, allParcels);
    }

    // ── VANGUARD raid release: abandon freshly-raided plots ────────────────────
    if (ai.name === "VANGUARD" && shouldAbandonAfterCapture("VANGUARD")) {
      const justConquered = allParcels.filter((p) =>
        p.ownerId === ai.id &&
        (p as any).capturedFromFaction === "VANGUARD" &&
        (p as any).capturedAt != null &&
        (now - Number((p as any).capturedAt)) < 15 * 60 * 1000
      );
      for (const raidPlot of justConquered) {
        if (process.env.AI_ENABLED === 'true') {
          try {
            await db.update(parcelsTable)
              .set({
                ownerId:              null,
                ownerType:            null,
                purchasePriceAlgo:    0.5,
                capturedFromFaction:  null,
                capturedAt:           null,
              } as any)
              .where(eq(parcelsTable.id, raidPlot.id));

            const evt: GameEvent = {
              id:          randomUUID(),
              type:        "ai_action",
              playerId:    ai.id,
              parcelId:    raidPlot.id,
              description: withFactionVoice(ai.name, "raid", raidPlot.plotId ?? now, `${ai.name} raided plot #${raidPlot.plotId} and withdrew`),
              timestamp:   now,
            };
            await ops.addEvent(evt);
            newEvents.push(evt);
          } catch {}
        }
      }
    }
  }

  // Bump turn counter
  await db.update(gameMeta)
    .set({ currentTurn: sql`${gameMeta.currentTurn} + 1`, lastUpdateTs: now })
    .where(eq(gameMeta.id, 1));

  return newEvents;
}

/** Launch an attack if all safeguards pass; returns true if a battle was created. */
async function launchAttack(
  db: DB,
  ops: AiOps,
  ctx: AiTurnContext,
  ai: Player,
  target: Parcel,
  kind: string,
  reason: string,
  troops: number,
): Promise<boolean> {
  if (!target || !target.ownerId || target.ownerId === ai.id) return false; // no self-attacks
  if (ctx.battleTargetIds.has(target.id)) return false;                     // no duplicate coverage
  if (ctx.aiActiveBattleCount >= AI_MAX_ACTIVE_BATTLES) return false;       // global cap
  if (process.env.AI_ENABLED !== 'true') return false;

  try {
    await ops.deployAttack({
      attackerId:      ai.id,
      targetParcelId:  target.id,
      troopsCommitted: troops,
      resourcesBurned: { iron: ATTACK_BASE_COST.iron, fuel: ATTACK_BASE_COST.fuel },
    });

    const evt: GameEvent = {
      id:          randomUUID(),
      type:        "ai_action",
      playerId:    ai.id,
      parcelId:    target.id,
      description: withFactionVoice(ai.name, kind as any, target.plotId ?? ctx.now, reason),
      timestamp:   ctx.now,
    };
    await ops.addEvent(evt);
    ctx.newEvents.push(evt);

    // Apply a reasonable cooldown so a faction does not attack every tick.
    await db.update(playersTable)
      .set({ attackCooldownUntil: ctx.now + AI_ATTACK_COOLDOWN_MS } as any)
      .where(eq(playersTable.id, ai.id));

    ctx.aiActiveBattleCount += 1;
    ctx.battleTargetIds.add(target.id);
    return true;
  } catch {
    return false;
  }
}

/** Enemy-owned parcels within range of any owned parcel, excluding already-battling targets. */
function enemyPlotsInRange(
  ai: Player,
  ownedParcels: Parcel[],
  allParcels: Parcel[],
  range: number,
  battleTargetIds: Set<string>,
): Parcel[] {
  const out: Parcel[] = [];
  for (const owned of ownedParcels) {
    for (const p of allParcels) {
      if (!p.ownerId || p.ownerId === ai.id) continue;
      if (p.biome === "water") continue;
      if (battleTargetIds.has(p.id)) continue;
      if (sphereDistance(owned.lat, owned.lng, p.lat, p.lng) <= range) out.push(p);
    }
  }
  return out;
}

/** NEXUS-7 (expansionist): attack the weakest enemy territory within range. */
async function actExpansionist(
  db: DB, ops: AiOps, ctx: AiTurnContext,
  ai: Player, ownedParcels: Parcel[], allParcels: Parcel[],
): Promise<boolean> {
  const targets = enemyPlotsInRange(ai, ownedParcels, allParcels, AI_ATTACK_RANGE, ctx.battleTargetIds);
  if (targets.length === 0) return false;
  targets.sort((a, b) => a.defenseLevel - b.defenseLevel); // weakest first
  return launchAttack(db, ops, ctx, ai, targets[0], "assault", `${ai.name} strikes a weak enemy outpost`, 1);
}

/** VANGUARD (raider): strike the most valuable / vulnerable enemy plot in range. */
async function actRaider(
  db: DB, ops: AiOps, ctx: AiTurnContext,
  ai: Player, ownedParcels: Parcel[], allParcels: Parcel[], allAiPlayers: any[],
): Promise<boolean> {
  const range = AI_ATTACK_RANGE * 1.4; // raiders roam wider
  const targets = enemyPlotsInRange(ai, ownedParcels, allParcels, range, ctx.battleTargetIds);
  if (targets.length === 0) return false;
  const nexus = allAiPlayers.find((p) => p.name === "NEXUS-7");
  const nexusTargets = nexus ? targets.filter((p) => p.ownerId === nexus.id) : [];
  const pool = nexusTargets.length > 0 ? nexusTargets : targets;
  // Richest first, then least-defended.
  pool.sort((a, b) => (b.richness - a.richness) - (a.defenseLevel - b.defenseLevel));
  return launchAttack(db, ops, ctx, ai, pool[0], "assault", `${ai.name} raids a high-value enemy plot`, 2);
}

/** KRONOS (defensive): fortify home, then counterattack NEXUS-7 when it gets close. */
async function actDefensive(
  db: DB, ops: AiOps, ctx: AiTurnContext,
  ai: Player, ownedParcels: Parcel[], allParcels: Parcel[], allAiPlayers: any[],
): Promise<boolean> {
  const nexus = allAiPlayers.find((p) => p.name === "NEXUS-7");
  if (nexus) {
    const nexusPlots = allParcels.filter((p) => p.ownerId === nexus.id && !ctx.battleTargetIds.has(p.id));
    for (const owned of ownedParcels) {
      const near = nexusPlots.find(
        (p) => sphereDistance(owned.lat, owned.lng, p.lat, p.lng) <= KRONOS_THREAT_RANGE,
      );
      if (near) {
        const hit = await launchAttack(db, ops, ctx, ai, near, "assault", `${ai.name} counterattacks NEXUS-7`, 1);
        if (hit) return true;
      }
    }
  }

  // Otherwise fortify: upgrade the weakest defended owned parcel.
  const weak = ownedParcels
    .filter((p) => p.defenseLevel < 5)
    .sort((a, b) => a.defenseLevel - b.defenseLevel)[0];
  if (weak && ai.iron >= UPGRADE_COSTS.defense.iron && ai.fuel >= UPGRADE_COSTS.defense.fuel) {
    if (process.env.AI_ENABLED === 'true') {
      try {
        await ops.upgradeBase({ playerId: ai.id, parcelId: weak.id, upgradeType: "defense" });
        const evt: GameEvent = {
          id: randomUUID(), type: "ai_action", playerId: ai.id, parcelId: weak.id,
          description: withFactionVoice(ai.name, "expand", weak.plotId ?? ctx.now, `${ai.name} fortifies defenses`),
          timestamp: ctx.now,
        };
        await ops.addEvent(evt);
        ctx.newEvents.push(evt);
        return true;
      } catch {}
    }
  }
  return false;
}

/** SPECTRE (economic): only attack once stockpiled, targeting the richest enemy plot. */
async function actEconomic(
  db: DB, ops: AiOps, ctx: AiTurnContext,
  ai: Player, ownedParcels: Parcel[], allParcels: Parcel[],
): Promise<boolean> {
  if (ai.iron + ai.fuel < SPECTRE_ATTACK_RESOURCE_MIN) return false; // build first
  const targets = enemyPlotsInRange(ai, ownedParcels, allParcels, AI_ATTACK_RANGE, ctx.battleTargetIds);
  if (targets.length === 0) return false;
  targets.sort((a, b) => b.richness - a.richness); // strategic / high-yield first
  return launchAttack(db, ops, ctx, ai, targets[0], "assault", `${ai.name} strikes a high-yield territory`, 1);
}

/** Expand into the cheapest unowned plot within range (non-combat growth). */
async function tryExpand(
  db: DB, ops: AiOps, ctx: AiTurnContext,
  ai: Player, ownedParcels: Parcel[], allParcels: Parcel[],
): Promise<boolean> {
  for (const owned of ownedParcels) {
    const nearby = allParcels.filter((p) => {
      if (p.ownerId || p.purchasePriceAlgo == null || p.biome === "water") return false;
      return sphereDistance(owned.lat, owned.lng, p.lat, p.lng) < 0.08;
    });
    if (nearby.length === 0) continue;
    const target = nearby[Math.floor(Math.random() * nearby.length)];
    if (process.env.AI_ENABLED === 'true') {
      try {
        await ops.purchaseLand({ playerId: ai.id, parcelId: target.id });
        const evt: GameEvent = {
          id: randomUUID(), type: "ai_action", playerId: ai.id, parcelId: target.id,
          description: withFactionVoice(ai.name, "expand", target.plotId ?? ctx.now, `${ai.name} expanded its territory`),
          timestamp: ctx.now,
        };
        await ops.addEvent(evt);
        ctx.newEvents.push(evt);
        return true;
      } catch {}
    }
    return false;
  }
  return false;
}
