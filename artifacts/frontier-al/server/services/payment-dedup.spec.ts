import { describe, it, expect, vi, beforeEach } from "vitest";

// consumePaymentTxid is the replay guard (HARD RULE #3). The real uniqueness is
// enforced by the consumed_payment_txids PK; here we mock ../db with an in-memory
// set that mimics INSERT … ON CONFLICT DO NOTHING RETURNING (row on first insert,
// empty array on a duplicate) and assert the won/replay decision.

const store = vi.hoisted(() => ({ seen: new Set<string>() }));

vi.mock("../db", () => ({
  db: {
    insert: () => ({
      values: (v: { txId: string }) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (store.seen.has(v.txId)) return [];
            store.seen.add(v.txId);
            return [{ txId: v.txId }];
          },
        }),
      }),
    }),
  },
}));

import { consumePaymentTxid } from "./payment-dedup";

const base = { purpose: "plot" as const, refId: "parcel-1", playerId: "player-1", amountMicroAlgo: 500_000 };

beforeEach(() => {
  store.seen.clear();
});

describe("consumePaymentTxid — replay guard", () => {
  it("wins the claim on first consume of a txid", async () => {
    const won = await consumePaymentTxid({ txId: "TX_A", ...base });
    expect(won).toBe(true);
  });

  it("rejects a replay of an already-consumed txid", async () => {
    expect(await consumePaymentTxid({ txId: "TX_B", ...base })).toBe(true);
    expect(await consumePaymentTxid({ txId: "TX_B", ...base })).toBe(false);
  });

  it("treats distinct txids independently", async () => {
    expect(await consumePaymentTxid({ txId: "TX_C", ...base })).toBe(true);
    expect(await consumePaymentTxid({ txId: "TX_D", ...base })).toBe(true);
    expect(await consumePaymentTxid({ txId: "TX_C", ...base })).toBe(false);
  });
});
