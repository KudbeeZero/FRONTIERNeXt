/**
 * server/services/chain/chainEventLog.ts
 *
 * PURE logic for the on-chain purchase audit trail — no I/O, no DB import, so it
 * is unit-testable without a live Postgres. The DB write/read path lives in
 * `chainEventStore.ts` (which imports `db`); it builds on these functions.
 */
import { randomUUID } from "node:crypto";

/** Lifecycle states a purchase attempt moves through (server-observable). */
export type PurchaseState =
  | "submitting"
  | "confirmed"
  | "inventory_syncing"
  | "complete"
  | "failed"
  | "timeout"
  | "duplicate_detected"
  | "user_rejected";

/** Canonical display order for the funnel / transaction-status charts. */
export const PURCHASE_STATE_ORDER: PurchaseState[] = [
  "submitting",
  "confirmed",
  "inventory_syncing",
  "complete",
  "duplicate_detected",
  "failed",
  "timeout",
  "user_rejected",
];

/** States that represent an in-flight (not yet terminal) attempt. */
const PENDING_STATES: ReadonlySet<PurchaseState> = new Set([
  "submitting",
  "confirmed",
  "inventory_syncing",
]);

export interface TransitionInput {
  intentId: string;
  playerId: string;
  kind: "plot" | "commander";
  state: PurchaseState;
  refId?: string | null;
  txId?: string | null;
  amount?: number | null;
  /** chain_events.event label; defaults to the state name. */
  event?: string;
  metadata?: Record<string, unknown>;
  lastError?: string | null;
  /** Injectable for tests; defaults to Date.now(). */
  now?: number;
}

export interface ChainEventRow {
  id: string;
  event: string;
  status: PurchaseState;
  txId: string | null;
  playerId: string;
  itemType: string;
  itemId: string | null;
  network: string;
  amount: number | null;
  metadataJson: string | null;
  createdAt: number;
}

export interface PurchaseIntentRow {
  id: string;
  playerId: string;
  kind: string;
  refId: string | null;
  txId: string | null;
  state: PurchaseState;
  amount: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

/** A fresh purchase-intent id (one per attempt). */
export function newIntentId(): string {
  return randomUUID();
}

/** Configured Algorand network label (no chain call). */
export function currentNetwork(): string {
  return process.env.ALGORAND_NETWORK || "testnet";
}

/**
 * PURE: derive the chain_events row + the purchase_intents upsert values for a
 * single transition. No I/O — the unit of behavior the tests pin down.
 */
export function buildTransitionRows(input: TransitionInput): {
  event: ChainEventRow;
  intent: PurchaseIntentRow;
} {
  const now = input.now ?? Date.now();
  const itemType = input.kind === "plot" ? "parcel" : "commander";
  const txId = input.txId ?? null;
  const refId = input.refId ?? null;
  const amount = input.amount ?? null;
  const network = currentNetwork();

  return {
    event: {
      id: randomUUID(),
      event: input.event ?? input.state,
      status: input.state,
      txId,
      playerId: input.playerId,
      itemType,
      itemId: refId,
      network,
      amount,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt: now,
    },
    intent: {
      id: input.intentId,
      playerId: input.playerId,
      kind: input.kind,
      refId,
      txId,
      state: input.state,
      amount,
      lastError: input.lastError ?? null,
      createdAt: now,
      updatedAt: now,
    },
  };
}

/** PURE: count intents by state, zero-filling every known state in order. */
export function summarizePurchaseFunnel(
  intents: Array<{ state: string }>,
): Array<{ state: PurchaseState; count: number }> {
  const counts = new Map<PurchaseState, number>();
  for (const s of PURCHASE_STATE_ORDER) counts.set(s, 0);
  for (const row of intents) {
    if (counts.has(row.state as PurchaseState)) {
      counts.set(row.state as PurchaseState, counts.get(row.state as PurchaseState)! + 1);
    }
  }
  return PURCHASE_STATE_ORDER.map((state) => ({ state, count: counts.get(state)! }));
}

export interface ChainHealth {
  total: number;
  pending: number;
  complete: number;
  failed: number;
  timeout: number;
  duplicate: number;
  network: string;
  lastConfirmedAt: number | null;
}

/** PURE: roll intents (+ events) into the chain-health card numbers. */
export function summarizeChainHealth(
  intents: Array<{ state: string; updatedAt?: number }>,
  events: Array<{ status: string; createdAt: number }> = [],
): ChainHealth {
  let pending = 0;
  let complete = 0;
  let failed = 0;
  let timeout = 0;
  let duplicate = 0;
  for (const row of intents) {
    const s = row.state as PurchaseState;
    if (PENDING_STATES.has(s)) pending += 1;
    else if (s === "complete") complete += 1;
    else if (s === "failed") failed += 1;
    else if (s === "timeout") timeout += 1;
    else if (s === "duplicate_detected") duplicate += 1;
  }
  let lastConfirmedAt: number | null = null;
  for (const e of events) {
    if (e.status === "confirmed" || e.status === "complete") {
      if (lastConfirmedAt === null || e.createdAt > lastConfirmedAt) lastConfirmedAt = e.createdAt;
    }
  }
  return {
    total: intents.length,
    pending,
    complete,
    failed,
    timeout,
    duplicate,
    network: currentNetwork(),
    lastConfirmedAt,
  };
}

// ── Stale-intent timeout reaper (pure selection) ────────────────────────────
// A purchase_intent that never reaches a terminal state (the buyer abandons the
// flow, the tab closes mid-opt-in, a crash orphans an in-flight row) sits in a
// PENDING_STATES value forever, skewing the dashboard funnel. The reaper flips
// such rows to `timeout` once they are clearly abandoned. This is PURELY an
// off-chain telemetry/audit transition — it touches no payment, wallet, chain,
// NFT, token, or settlement state (the duplicate guard keys off redeemed_payments,
// not intents, so a stale intent blocks nothing). Selection is pure + deterministic
// here; the DB write lives in chainEventStore.ts.

/** Lower bound for any configured timeout/interval — guards against an unsafely
 * tiny production value AND keeps tests deterministic. */
export const PURCHASE_INTENT_TTL_FLOOR_MS = 60_000; // 1 minute

/**
 * PURE: resolve a millisecond duration from an env string, falling back to
 * `fallbackMs` for unset/invalid/≤0 input, then clamping up to the floor.
 * Deterministic — the unit of behavior the env-override / floor tests pin down.
 */
export function resolveTimeoutMs(raw: string | undefined, fallbackMs: number): number {
  const n = Number(raw);
  const chosen = Number.isFinite(n) && n > 0 ? n : fallbackMs;
  return Math.max(PURCHASE_INTENT_TTL_FLOOR_MS, chosen);
}

/**
 * PURE: ids of intents still in a PENDING (non-terminal) state whose age
 * (`now - createdAt`) STRICTLY exceeds `ttlMs` — the rows the reaper times out.
 *
 * Safety properties (tested):
 *  - only pending states (`submitting`/`confirmed`/`inventory_syncing`) qualify;
 *  - terminal states (`complete`/`failed`/`timeout`/`duplicate_detected`/
 *    `user_rejected`) are never selected → idempotent (a re-run skips rows it
 *    already timed out) and never disturbs completed/failed history;
 *  - recently-created pending rows (age ≤ ttl) stay pending.
 */
export function identifyStaleIntents(
  intents: Array<{ id: string; state: string; createdAt: number }>,
  now: number,
  ttlMs: number,
): string[] {
  const out: string[] = [];
  for (const i of intents) {
    if (PENDING_STATES.has(i.state as PurchaseState) && now - i.createdAt > ttlMs) {
      out.push(i.id);
    }
  }
  return out;
}
