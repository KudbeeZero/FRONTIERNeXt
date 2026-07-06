/**
 * server/services/economicsSnapshotSampler.ts
 *
 * Unit D3 (docs/BATTLE_MAP_CINEMATICS_AND_DATAVIZ_PLAN.md): hourly samples of
 * the economics computation into `economics_snapshots`, so the tokenomics page
 * can chart real supply-flow history instead of the fake sine-wave trend it
 * used to ship (removed in D1). No economics history existed anywhere before
 * this — `GET /api/economics` is snapshot-only and burns are cumulative
 * per-player floats.
 *
 * The pure sample-gate and row-shaping live in `economicsSnapshotShape.ts`
 * (zero DB/chain imports, so it — and its tests — load without
 * `DATABASE_URL` set). This file is the DB/chain integration: not unit
 * tested, same as the rest of this codebase's chain/DB code
 * (docs/COVERAGE_GATE.md's "blocked" rows).
 *
 * `computeEconomicsSnapshotValues()` intentionally duplicates (does not
 * import) the on-chain/DB aggregation `GET /api/economics` already performs
 * (routes.ts) rather than refactoring that existing, funds-adjacent route to
 * share it. This is a deliberate risk trade for a first-of-its-kind migration
 * unit: zero chance of an accidental behavior change to the live endpoint
 * other pages already depend on. A future cleanup can consolidate the two.
 *
 * Fail-open by design: `sampleEconomicsSnapshotOnce()` never throws — a
 * missing table, a chain hiccup, or a DB error just skips this hour's sample
 * and logs. Wire it into the existing server tick the same way
 * `pruneActionNonces`/`timeoutStalePurchaseIntents` already are (server/index.ts).
 */
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { economicsSnapshots, players as playersTable } from "../db-schema";
import { getAscendAsaId } from "./chain/asa";
import { getAdminAddress, getAlgodClient, getIndexerClient } from "./chain/client";
import { storage } from "../storage";
import { fromMicroASCEND } from "../storage/game-rules";
import {
  shouldSampleNow,
  buildSnapshotRow,
  type EconomicsSnapshotValues,
} from "./economicsSnapshotShape";

export { SAMPLE_INTERVAL_MS, shouldSampleNow, buildSnapshotRow } from "./economicsSnapshotShape";

/**
 * Compute the current economics snapshot values. Chain/DB integration — not
 * unit tested here; mirrors GET /api/economics's own computation.
 */
async function computeEconomicsSnapshotValues(): Promise<EconomicsSnapshotValues | null> {
  const asaId = getAscendAsaId();
  const adminAddr = getAdminAddress();
  if (!asaId || !adminAddr) return null;

  const ASA_DECIMALS = 6;
  const divisor = Math.pow(10, ASA_DECIMALS);
  const algodClient = getAlgodClient();
  const indexerClient = getIndexerClient();

  const [assetLookup, adminAccountInfo] = await Promise.all([
    indexerClient.lookupAssetByID(asaId).do() as Promise<any>,
    algodClient.accountInformation(adminAddr).do() as Promise<any>,
  ]);

  const assetParams = assetLookup?.asset?.params ?? assetLookup?.params ?? assetLookup;
  const totalSupply = Number(assetParams.total ?? 0) / divisor;

  const assets: any[] = Array.isArray((adminAccountInfo as any).assets) ? (adminAccountInfo as any).assets : [];
  const adminAsset = assets.find((a: any) => Number(a.assetId ?? a["asset-id"] ?? a.assetIndex) === asaId);
  const treasury = Number(adminAsset?.amount ?? 0) / divisor;

  let totalBurned = 0;
  let inGameCirculating = Math.round((totalSupply - treasury) * 100) / 100;
  try {
    const [metrics] = await db
      .select({
        burned: sql<number>`COALESCE(SUM(${playersTable.totalAscendBurned}), 0)`,
        balanceMicro: sql<number>`COALESCE(SUM(${playersTable.ascendBalanceMicro}), 0)`,
      })
      .from(playersTable);
    totalBurned = Math.round(Number(metrics?.burned ?? 0) * 100) / 100;
    inGameCirculating = Math.round((Number(metrics?.balanceMicro ?? 0) / divisor) * 100) / 100;
  } catch {
    /* non-fatal — fall back to the on-chain-derived circulating figure above */
  }

  let protocolTreasuryTotal = 0;
  try {
    const bal = await storage.getTreasuryBalance();
    protocolTreasuryTotal = Math.round(fromMicroASCEND(bal.totalMicro) * 100) / 100;
  } catch {
    /* non-fatal */
  }

  return {
    totalSupply,
    inGameCirculating,
    totalBurned,
    treasury: Math.round(treasury * 100) / 100,
    protocolTreasuryTotal,
  };
}

let _lastSampledAt: number | null = null;

/**
 * Take one sample if the interval has elapsed. Never throws — logs and
 * returns on any failure (chain not initialized, DB error, missing table).
 */
export async function sampleEconomicsSnapshotOnce(now: number = Date.now()): Promise<void> {
  try {
    if (!shouldSampleNow(_lastSampledAt, now)) return;
    const values = await computeEconomicsSnapshotValues();
    if (!values) return; // chain not initialized yet — try again next tick
    const row = buildSnapshotRow(values, now, randomUUID());
    await db.insert(economicsSnapshots).values(row);
    _lastSampledAt = now;
  } catch (err) {
    console.error("[economicsSnapshotSampler] sample failed (non-fatal):", err);
  }
}
