/**
 * server/storage/ai-engine.spec.ts
 *
 * Focused unit tests for the four-faction AI battle loop in `ai-engine.ts`.
 * Exercises `runAITurn` with a mock `db` + `AiOps` (no real Postgres, no chain,
 * no wallets). Proves every faction can act, targets the right plots, and that
 * the safeguards (one action/turn, no duplicate/self attacks, cooldown, active
 * battle cap) hold.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runAITurn, AI_MAX_ACTIVE_BATTLES } from "./ai-engine.js";
import { players as playersTable, parcels as parcelsTable } from "../db-schema";

// ── Builders ──────────────────────────────────────────────────────────────────

function playerRow(over: any = {}): any {
  return {
    id: "ai", address: "AI_X", name: "FACTION", isAi: true, aiBehavior: "expansionist",
    iron: 100, fuel: 100, crystal: 0, ascendBalanceMicro: 0, commanders: [],
    totalIronMined: 0, totalFuelMined: 0, totalCrystalMined: 0, totalAscendEarned: 0,
    totalAscendBurned: 0, attacksWon: 0, attacksLost: 0, territoriesCaptured: 0,
    activeCommanderIndex: 0, specialAttacks: [], drones: [], satellites: [],
    welcomeBonusReceived: false, moraleDebuffUntil: 0, attackCooldownUntil: 0,
    consecutiveLosses: 0, testnetProgress: [], playerFactionId: null,
    factionJoinedAt: null, xenoriteVault: 0, voidShardVault: 0, plasmaCoreVault: 0,
    darkMatterVault: 0, ...over,
  };
}

function parcelRow(over: any = {}): any {
  return {
    id: "parcel", plotId: 1, lat: 0, lng: 0, biome: "plains", richness: 50,
    ownerId: null, ownerType: null, defenseLevel: 1, ironStored: 0, fuelStored: 0,
    crystalStored: 0, storageCapacity: 100, lastMineTs: 0, activeBattleId: null,
    yieldMultiplier: 1, improvements: [], purchasePriceAlgo: 0.5, ascendAccumulated: 0,
    lastAscendClaimTs: 0, ascendPerDay: 0, influence: 0, influenceRepairRate: 0,
    capturedFromFaction: null, capturedAt: null, handoverCount: 0, hazardLevel: 0,
    stability: 100, terraformStatus: "none", terraformLevel: 0, ...over,
  };
}

interface Scenario {
  attacks: any[];
  events: any[];
  updates: any[];
  activeTargets: Set<string>;
  ops: any;
  db: any;
}

function makeScenario(aiRows: any[], parcelRows: any[], activeBattles: any[] = []): Scenario {
  const attacks: any[] = [];
  const events: any[] = [];
  const updates: any[] = [];
  const activeTargets = new Set<string>();
  const parcelMap = new Map(parcelRows.map((p) => [p.id, p]));

  const ops = {
    mineResources: async () => {},
    collectAll: async () => {},
    purchaseLand: async () => {},
    upgradeBase: async () => {},
    addEvent: async (e: any) => { events.push(e); },
    getActiveBattles: async () => activeBattles,
    deployAttack: async (a: any) => {
      const target = parcelMap.get(a.targetParcelId);
      if (!target) throw new Error("no target");
      if (target.ownerId === a.attackerId) throw new Error("self attack");
      if (activeTargets.has(a.targetParcelId)) throw new Error("duplicate");
      activeTargets.add(a.targetParcelId);
      attacks.push(a);
      return { id: "b" + attacks.length, ...a };
    },
  };

  const db = {
    select: () => ({
      from: (table: any) => {
        const rows =
          table === playersTable ? aiRows :
          table === parcelsTable ? parcelRows : [];
        const promise: any = Promise.resolve(rows);
        // drizzle's from() is thenable AND chainable with .where()
        promise.where = () => promise;
        return promise;
      },
    }),
    update: () => ({
      set: (setObj: any) => ({
        where: () => { updates.push(setObj); return Promise.resolve(); },
      }),
    }),
  };

  return { attacks, events, updates, activeTargets, ops, db };
}

let savedRandom: any;
beforeEach(() => {
  savedRandom = Math.random;
  vi.spyOn(Math, "random").mockReturnValue(0);
  process.env.AI_ENABLED = "true";
});
afterEach(() => {
  Math.random = savedRandom;
  delete process.env.AI_ENABLED;
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("runAITurn — four factions act", () => {
  it("AI_ENABLED=false is a hard stop (no battles, no events)", async () => {
    process.env.AI_ENABLED = "false";
    const nexus = playerRow({ id: "nexus", name: "NEXUS-7", aiBehavior: "expansionist", ownedParcels: ["n_own"] });
    const s = makeScenario([nexus], [
      parcelRow({ id: "n_own", ownerId: "nexus", ownerType: "ai", lat: 10, lng: 10 }),
      parcelRow({ id: "enemy", ownerId: "human", ownerType: "player", lat: 10.05, lng: 10, defenseLevel: 1 }),
    ]);
    const out = await runAITurn(s.db, s.ops);
    expect(out).toEqual([]);
    expect(s.attacks).toHaveLength(0);
  });

  it("all four factions launch a battle under valid conditions", async () => {
    const nexus = playerRow({ id: "nexus", name: "NEXUS-7", aiBehavior: "expansionist", iron: 100, fuel: 100, ownedParcels: ["n_own"] });
    const kronos = playerRow({ id: "kronos", name: "KRONOS", aiBehavior: "defensive", iron: 100, fuel: 100, ownedParcels: ["k_own"] });
    const vanguard = playerRow({ id: "vanguard", name: "VANGUARD", aiBehavior: "raider", iron: 100, fuel: 100, ownedParcels: ["v_own"] });
    const spectre = playerRow({ id: "spectre", name: "SPECTRE", aiBehavior: "economic", iron: 100, fuel: 100, ownedParcels: ["s_own"] });

    const s = makeScenario([nexus, kronos, vanguard, spectre], [
      parcelRow({ id: "n_own", ownerId: "nexus", ownerType: "ai", lat: 10, lng: 10 }),
      parcelRow({ id: "n_enemy", ownerId: "human1", ownerType: "player", lat: 10.05, lng: 10, defenseLevel: 1 }),
      parcelRow({ id: "k_own", ownerId: "kronos", ownerType: "ai", lat: 20, lng: 20 }),
      parcelRow({ id: "n2", ownerId: "nexus", ownerType: "ai", lat: 20.05, lng: 20 }),
      parcelRow({ id: "v_own", ownerId: "vanguard", ownerType: "ai", lat: 30, lng: 30 }),
      parcelRow({ id: "v_enemy", ownerId: "human2", ownerType: "player", lat: 30.05, lng: 30, richness: 90 }),
      parcelRow({ id: "s_own", ownerId: "spectre", ownerType: "ai", lat: 40, lng: 40 }),
      parcelRow({ id: "s_enemy", ownerId: "human3", ownerType: "player", lat: 40.05, lng: 40, richness: 80 }),
    ]);

    await runAITurn(s.db, s.ops);

    const attackers = new Set(s.attacks.map((a) => a.attackerId));
    expect(attackers.has("nexus")).toBe(true);
    expect(attackers.has("kronos")).toBe(true);
    expect(attackers.has("vanguard")).toBe(true);
    expect(attackers.has("spectre")).toBe(true);
    const targets = s.attacks.map((a) => a.targetParcelId);
    expect(new Set(targets).size).toBe(targets.length);
  });
});

describe("runAITurn — strategy target selection", () => {
  it("NEXUS-7 (expansionist) attacks the weakest enemy territory in range", async () => {
    const nexus = playerRow({ id: "nexus", name: "NEXUS-7", aiBehavior: "expansionist", ownedParcels: ["n_own"] });
    const s = makeScenario([nexus], [
      parcelRow({ id: "n_own", ownerId: "nexus", ownerType: "ai", lat: 10, lng: 10 }),
      parcelRow({ id: "weak", ownerId: "h1", ownerType: "player", lat: 10.05, lng: 10, defenseLevel: 1 }),
      parcelRow({ id: "strong", ownerId: "h1", ownerType: "player", lat: 10.1, lng: 10, defenseLevel: 9 }),
    ]);
    await runAITurn(s.db, s.ops);
    expect(s.attacks).toHaveLength(1);
    expect(s.attacks[0].targetParcelId).toBe("weak");
  });

  it("VANGUARD (raider) prefers a NEXUS-7 plot over a richer neutral plot", async () => {
    const vanguard = playerRow({ id: "vanguard", name: "VANGUARD", aiBehavior: "raider", ownedParcels: ["v_own"] });
    const nexus = playerRow({ id: "nexus", name: "NEXUS-7", aiBehavior: "expansionist", ownedParcels: ["nexus_p"] });
    const s = makeScenario([vanguard, nexus], [
      parcelRow({ id: "v_own", ownerId: "vanguard", ownerType: "ai", lat: 30, lng: 30 }),
      parcelRow({ id: "nexus_p", ownerId: "nexus", ownerType: "ai", lat: 30.05, lng: 30, richness: 40, defenseLevel: 5 }),
      parcelRow({ id: "rich_neutral", ownerId: "h1", ownerType: "player", lat: 30.1, lng: 30, richness: 99, defenseLevel: 1 }),
    ]);
    await runAITurn(s.db, s.ops);
    // NEXUS-7 may also act; we only assert VANGUARD picked the NEXUS-7 plot.
    const vHit = s.attacks.find((a) => a.attackerId === "vanguard");
    expect(vHit).toBeDefined();
    expect(vHit!.targetParcelId).toBe("nexus_p");
  });

  it("KRONOS (defensive) counterattacks NEXUS-7 when it is in range", async () => {
    const kronos = playerRow({ id: "kronos", name: "KRONOS", aiBehavior: "defensive", iron: 100, fuel: 100, ownedParcels: ["k_own"] });
    const nexus = playerRow({ id: "nexus", name: "NEXUS-7", aiBehavior: "expansionist", ownedParcels: ["n_own"] });
    const s = makeScenario([kronos, nexus], [
      parcelRow({ id: "k_own", ownerId: "kronos", ownerType: "ai", lat: 20, lng: 20 }),
      parcelRow({ id: "n_own", ownerId: "nexus", ownerType: "ai", lat: 20.05, lng: 20 }),
    ]);
    await runAITurn(s.db, s.ops);
    // NEXUS-7 may also act; we only assert KRONOS's counterattack on NEXUS-7.
    const kronosHit = s.attacks.find((a) => a.attackerId === "kronos");
    expect(kronosHit).toBeDefined();
    expect(kronosHit!.targetParcelId).toBe("n_own");
  });

  it("KRONOS (defensive) fortifies instead of attacking when NEXUS-7 is not a threat", async () => {
    const kronos = playerRow({ id: "kronos", name: "KRONOS", aiBehavior: "defensive", iron: 100, fuel: 100, ownedParcels: ["k_own"] });
    const s = makeScenario([kronos], [
      parcelRow({ id: "k_own", ownerId: "kronos", ownerType: "ai", lat: 20, lng: 20, defenseLevel: 1 }),
      parcelRow({ id: "far_enemy", ownerId: "h1", ownerType: "player", lat: 80, lng: 80, defenseLevel: 1 }),
    ]);
    await runAITurn(s.db, s.ops);
    expect(s.attacks).toHaveLength(0);
    expect(s.events.some((e) => /fortif/i.test(e.description))).toBe(true);
  });

  it("SPECTRE (economic) does NOT attack until iron+fuel reach the resource floor", async () => {
    const spectre = playerRow({ id: "spectre", name: "SPECTRE", aiBehavior: "economic", iron: 50, fuel: 50, ownedParcels: ["s_own"] });
    const s = makeScenario([spectre], [
      parcelRow({ id: "s_own", ownerId: "spectre", ownerType: "ai", lat: 40, lng: 40 }),
      parcelRow({ id: "s_enemy", ownerId: "h1", ownerType: "player", lat: 40.05, lng: 40, richness: 80 }),
    ]);
    await runAITurn(s.db, s.ops);
    expect(s.attacks).toHaveLength(0);
  });

  it("SPECTRE (economic) attacks the richest enemy plot once stockpiled", async () => {
    const spectre = playerRow({ id: "spectre", name: "SPECTRE", aiBehavior: "economic", iron: 100, fuel: 100, ownedParcels: ["s_own"] });
    const s = makeScenario([spectre], [
      parcelRow({ id: "s_own", ownerId: "spectre", ownerType: "ai", lat: 40, lng: 40 }),
      parcelRow({ id: "poor", ownerId: "h1", ownerType: "player", lat: 40.05, lng: 40, richness: 20 }),
      parcelRow({ id: "rich", ownerId: "h2", ownerType: "player", lat: 40.1, lng: 40, richness: 95 }),
    ]);
    await runAITurn(s.db, s.ops);
    expect(s.attacks).toHaveLength(1);
    expect(s.attacks[0].targetParcelId).toBe("rich");
  });
});

describe("runAITurn — safeguards", () => {
  function basicFour() {
    const nexus = playerRow({ id: "nexus", name: "NEXUS-7", aiBehavior: "expansionist", iron: 100, fuel: 100, ownedParcels: ["n_own"] });
    const kronos = playerRow({ id: "kronos", name: "KRONOS", aiBehavior: "defensive", iron: 100, fuel: 100, ownedParcels: ["k_own"] });
    const vanguard = playerRow({ id: "vanguard", name: "VANGUARD", aiBehavior: "raider", iron: 100, fuel: 100, ownedParcels: ["v_own"] });
    const spectre = playerRow({ id: "spectre", name: "SPECTRE", aiBehavior: "economic", iron: 100, fuel: 100, ownedParcels: ["s_own"] });
    const parcels = [
      parcelRow({ id: "n_own", ownerId: "nexus", ownerType: "ai", lat: 10, lng: 10 }),
      parcelRow({ id: "n_enemy", ownerId: "human1", ownerType: "player", lat: 10.05, lng: 10, defenseLevel: 1 }),
      parcelRow({ id: "k_own", ownerId: "kronos", ownerType: "ai", lat: 20, lng: 20 }),
      parcelRow({ id: "n2", ownerId: "nexus", ownerType: "ai", lat: 20.05, lng: 20 }),
      parcelRow({ id: "v_own", ownerId: "vanguard", ownerType: "ai", lat: 30, lng: 30 }),
      parcelRow({ id: "v_enemy", ownerId: "human2", ownerType: "player", lat: 30.05, lng: 30 }),
      parcelRow({ id: "s_own", ownerId: "spectre", ownerType: "ai", lat: 40, lng: 40 }),
      parcelRow({ id: "s_enemy", ownerId: "human3", ownerType: "player", lat: 40.05, lng: 40 }),
    ];
    return { nexus, kronos, vanguard, spectre, parcels };
  }

  it("one action per faction per turn (no faction attacks twice in one tick)", async () => {
    const { nexus, kronos, vanguard, spectre, parcels } = basicFour();
    parcels.push(parcelRow({ id: "n_enemy2", ownerId: "humanX", ownerType: "player", lat: 10.08, lng: 10, defenseLevel: 1 }));
    const s = makeScenario([nexus, kronos, vanguard, spectre], parcels);
    await runAITurn(s.db, s.ops);
    const nexusAttacks = s.attacks.filter((a) => a.attackerId === "nexus");
    expect(nexusAttacks.length).toBe(1);
  });

  it("no attack on a target already covered by an active battle", async () => {
    const { nexus, kronos, vanguard, spectre, parcels } = basicFour();
    const s = makeScenario([nexus, kronos, vanguard, spectre], parcels, [
      { id: "ab1", attackerId: "someone", targetParcelId: "n_enemy", status: "pending" },
    ]);
    await runAITurn(s.db, s.ops);
    expect(s.attacks.some((a) => a.targetParcelId === "n_enemy")).toBe(false);
  });

  it("no self-attacks: a faction never attacks its own parcel", async () => {
    const nexus = playerRow({ id: "nexus", name: "NEXUS-7", aiBehavior: "expansionist", ownedParcels: ["n_own", "self_enemy"] });
    const s = makeScenario([nexus], [
      parcelRow({ id: "n_own", ownerId: "nexus", ownerType: "ai", lat: 10, lng: 10 }),
      parcelRow({ id: "self_enemy", ownerId: "nexus", ownerType: "ai", lat: 10.05, lng: 10, defenseLevel: 1 }),
    ]);
    await runAITurn(s.db, s.ops);
    expect(s.attacks).toHaveLength(0);
  });

  it("respects the global max-active-AI-battles cap", async () => {
    const { nexus, kronos, vanguard, spectre, parcels } = basicFour();
    const preloaded = Array.from({ length: AI_MAX_ACTIVE_BATTLES }, (_, i) => ({
      id: "ab" + i, attackerId: "nexus", targetParcelId: "pre" + i, status: "pending",
    }));
    const s = makeScenario([nexus, kronos, vanguard, spectre], parcels, preloaded);
    await runAITurn(s.db, s.ops);
    expect(s.attacks).toHaveLength(0);
  });

  it("applies a reasonable cooldown after an attack", async () => {
    const nexus = playerRow({ id: "nexus", name: "NEXUS-7", aiBehavior: "expansionist", iron: 100, fuel: 100, ownedParcels: ["n_own"] });
    const s = makeScenario([nexus], [
      parcelRow({ id: "n_own", ownerId: "nexus", ownerType: "ai", lat: 10, lng: 10 }),
      parcelRow({ id: "n_enemy", ownerId: "human1", ownerType: "player", lat: 10.05, lng: 10, defenseLevel: 1 }),
    ]);
    await runAITurn(s.db, s.ops);
    const cooldownSet = s.updates.find((u) => u.attackCooldownUntil != null);
    expect(cooldownSet).toBeDefined();
    expect(typeof cooldownSet.attackCooldownUntil).toBe("number");
    expect(cooldownSet.attackCooldownUntil).toBeGreaterThan(Date.now());
  });

  it("skips a faction that is on attack cooldown", async () => {
    const nexus = playerRow({ id: "nexus", name: "NEXUS-7", aiBehavior: "expansionist", iron: 100, fuel: 100,
      ownedParcels: ["n_own"], attackCooldownUntil: Date.now() + 100_000 });
    const s = makeScenario([nexus], [
      parcelRow({ id: "n_own", ownerId: "nexus", ownerType: "ai", lat: 10, lng: 10 }),
      parcelRow({ id: "n_enemy", ownerId: "human1", ownerType: "player", lat: 10.05, lng: 10, defenseLevel: 1 }),
    ]);
    await runAITurn(s.db, s.ops);
    expect(s.attacks).toHaveLength(0);
  });

  it("records an ai_action event with faction/action/target/reason/timestamp", async () => {
    const nexus = playerRow({ id: "nexus", name: "NEXUS-7", aiBehavior: "expansionist", iron: 100, fuel: 100, ownedParcels: ["n_own"] });
    const s = makeScenario([nexus], [
      parcelRow({ id: "n_own", ownerId: "nexus", ownerType: "ai", lat: 10, lng: 10 }),
      parcelRow({ id: "n_enemy", ownerId: "human1", ownerType: "player", lat: 10.05, lng: 10, defenseLevel: 1 }),
    ]);
    await runAITurn(s.db, s.ops);
    expect(s.events).toHaveLength(1);
    const e = s.events[0];
    expect(e.playerId).toBe("nexus");
    expect(e.parcelId).toBe("n_enemy");
    expect(e.type).toBe("ai_action");
    expect(typeof e.timestamp).toBe("number");
    expect(typeof e.description).toBe("string");
  });
});

describe("runAITurn — cost-control invariants", () => {
  it("parcel query uses a bounded projection, not SELECT *", async () => {
    // Spy on db.select so we can capture the projection object passed in.
    const seenProjections: any[] = [];
    const base = makeScenario(
      [playerRow({ id: "nexus", name: "NEXUS-7", aiBehavior: "expansionist", ownedParcels: ["n_own"] })],
      [
        parcelRow({ id: "n_own", ownerId: "nexus", ownerType: "ai", lat: 10, lng: 10 }),
        parcelRow({ id: "enemy", ownerId: "human", ownerType: "player", lat: 10.05, lng: 10, defenseLevel: 1 }),
      ],
    );
    const proxiedDb = new Proxy(base.db, {
      get(target, prop) {
        if (prop === "select") {
          return (...args: any[]) => {
            // Record the first argument (the projection or undefined).
            seenProjections.push(args[0]);
            return target.select(...args);
          };
        }
        return (target as any)[prop];
      },
    });
    await runAITurn(proxiedDb, base.ops);
    // Find the select that targeted parcels — it must have a projection (arg[0]),
    // i.e. NOT a bare `select()` which would mean SELECT *.
    const parcelSelects = seenProjections.filter((p) => p && typeof p === "object");
    expect(parcelSelects.length).toBeGreaterThan(0);
    // The projection must include the load-bearing columns used by the AI.
    const projection = parcelSelects[parcelSelects.length - 1] as Record<string, unknown>;
    expect(projection.id).toBe(parcelsTable.id);
    expect(projection.ownerId).toBe(parcelsTable.ownerId);
    expect(projection.plotId).toBe(parcelsTable.plotId);
    // Unused heavy columns must NOT be pulled.
    expect(projection.improvements).toBeUndefined();
    expect(projection.ascendAccumulated).toBeUndefined();
  });

  it("gameMeta.currentTurn advances on every runAITurn (preserved dependency)", async () => {
    const updates: any[] = [];
    const s = makeScenario(
      [playerRow({ id: "nexus", name: "NEXUS-7", aiBehavior: "expansionist", ownedParcels: ["n_own"] })],
      [
        parcelRow({ id: "n_own", ownerId: "nexus", ownerType: "ai", lat: 10, lng: 10 }),
      ],
    );
    // Intercept the unconditional gameMeta update.
    const origUpdate = s.db.update;
    s.db.update = (...args: any[]) => {
      const ret = origUpdate(...args);
      const origSet = ret.set;
      ret.set = (setObj: any) => {
        updates.push(setObj);
        return origSet(setObj);
      };
      return ret;
    };
    await runAITurn(s.db, s.ops);
    // The currentTurn +1 update must be present (the proven dependency).
    const turnUpdate = updates.find((u) => "currentTurn" in u);
    expect(turnUpdate).toBeDefined();
  });
});
