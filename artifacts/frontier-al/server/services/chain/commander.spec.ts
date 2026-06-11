/**
 * server/services/chain/commander.spec.ts
 *
 * Tripwire tests for verifyAlgoPayment — the trust boundary where the backend
 * decides "this user paid". This decision table is the blast radius for any
 * change near the payment path: every acceptance/rejection below must keep
 * deciding the same way.
 *
 * All chain interaction is mocked — no indexer, no network, no real keys.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";

vi.mock("./client", async () => {
  const { default: sdk } = await import("algosdk");
  const admin = sdk.generateAccount(); // throwaway in-memory test key
  const state: { response: unknown; lookupError: Error | null } = {
    response: null,
    lookupError: null,
  };
  const indexer = {
    lookupTransactionByID: (_txId: string) => ({
      do: async () => {
        if (state.lookupError) throw state.lookupError;
        return state.response;
      },
    }),
  };
  return {
    getIndexerClient: () => indexer,
    getAdminAddress: () => admin.addr.toString(),
    getAlgodClient: () => {
      throw new Error("algod must not be used by verifyAlgoPayment");
    },
    getAdminAccount: () => admin,
    getNetwork: () => "testnet",
    __indexerState: state,
  };
});

import algosdk from "algosdk";
import { verifyAlgoPayment } from "./commander";
import * as clientMock from "./client";

const indexerState = (clientMock as any).__indexerState as {
  response: unknown;
  lookupError: Error | null;
};
const ADMIN = (clientMock as any).getAdminAddress() as string;
const BUYER = algosdk.generateAccount().addr.toString();
const STRANGER = algosdk.generateAccount().addr.toString();

/** Indexer JSON shape (kebab-case) for a confirmed ALGO payment. */
function paymentTxn(overrides: Record<string, unknown> = {}) {
  return {
    transaction: {
      "tx-type": "pay",
      "confirmed-round": 12345,
      sender: BUYER,
      "payment-transaction": { receiver: ADMIN, amount: 500_000 },
      ...overrides,
    },
  };
}

beforeEach(() => {
  indexerState.response = paymentTxn();
  indexerState.lookupError = null;
});

describe("verifyAlgoPayment — acceptance decision table", () => {
  const params = { txId: "TXID1", expectedSender: BUYER, minMicroAlgo: 500_000 };

  it("accepts a confirmed payment of exactly the required amount", async () => {
    await expect(verifyAlgoPayment(params)).resolves.toEqual({ amountMicroAlgo: 500_000 });
  });

  it("accepts an overpayment", async () => {
    indexerState.response = paymentTxn({ "payment-transaction": { receiver: ADMIN, amount: 750_000 } });
    await expect(verifyAlgoPayment(params)).resolves.toEqual({ amountMicroAlgo: 750_000 });
  });

  it("rejects when the txn is not found on the indexer", async () => {
    indexerState.lookupError = new Error("404");
    await expect(verifyAlgoPayment(params)).rejects.toThrow(/not found on indexer/);
  });

  it("rejects an unconfirmed txn", async () => {
    indexerState.response = paymentTxn({ "confirmed-round": 0 });
    await expect(verifyAlgoPayment(params)).rejects.toThrow(/not yet confirmed/);
  });

  it("rejects a non-payment txn (asset transfer is not ALGO)", async () => {
    indexerState.response = paymentTxn({ "tx-type": "axfer" });
    await expect(verifyAlgoPayment(params)).rejects.toThrow(/not a payment txn/);
  });

  it("rejects when the sender is not the buyer (someone else's payment)", async () => {
    indexerState.response = paymentTxn({ sender: STRANGER });
    await expect(verifyAlgoPayment(params)).rejects.toThrow(/sender mismatch/);
  });

  it("rejects when the receiver is not the admin wallet", async () => {
    indexerState.response = paymentTxn({ "payment-transaction": { receiver: STRANGER, amount: 500_000 } });
    await expect(verifyAlgoPayment(params)).rejects.toThrow(/receiver mismatch/);
  });

  it("rejects an underpayment", async () => {
    indexerState.response = paymentTxn({ "payment-transaction": { receiver: ADMIN, amount: 499_999 } });
    await expect(verifyAlgoPayment(params)).rejects.toThrow(/Insufficient payment/);
  });

  it("rejects a zero/absent amount", async () => {
    indexerState.response = paymentTxn({ "payment-transaction": { receiver: ADMIN } });
    await expect(verifyAlgoPayment(params)).rejects.toThrow(/Insufficient payment/);
  });

  // algosdk v3 indexer clients return camelCase models, not raw kebab-case
  // JSON. The verifier must accept both shapes (and reject both shapes).
  it("accepts a valid payment in algosdk v3 camelCase model shape", async () => {
    indexerState.response = {
      transaction: {
        txType: "pay",
        confirmedRound: 12345n,
        sender: BUYER,
        paymentTransaction: { receiver: ADMIN, amount: 500_000n },
      },
    };
    await expect(verifyAlgoPayment(params)).resolves.toEqual({ amountMicroAlgo: 500_000 });
  });

  it("rejects a camelCase non-payment txn", async () => {
    indexerState.response = {
      transaction: {
        txType: "axfer",
        confirmedRound: 12345n,
        sender: BUYER,
        paymentTransaction: { receiver: ADMIN, amount: 500_000n },
      },
    };
    await expect(verifyAlgoPayment(params)).rejects.toThrow(/not a payment txn/);
  });
});
