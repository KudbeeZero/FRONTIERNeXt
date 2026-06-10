import { describe, it, expect, vi, beforeEach } from "vitest";

// verifyAlgoPayment reads finality from ALGOD (HARD RULE #2) and only falls back
// to the indexer for older txns. We mock ./client so both clients are
// controllable and assert algod is preferred, the indexer fallback works, and
// closeRemainderTo/rekeyTo riders are rejected.

const ADMIN = "ADMINWALLETADDRESS_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const BUYER = "BUYERWALLETADDRESS_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

const h = vi.hoisted(() => ({
  pendingImpl: vi.fn(),
  indexerImpl: vi.fn(),
}));

vi.mock("./client", () => ({
  getAlgodClient: () => ({
    pendingTransactionInformation: (txId: string) => ({ do: () => h.pendingImpl(txId) }),
  }),
  getIndexerClient: () => ({
    lookupTransactionByID: (txId: string) => ({ do: () => h.indexerImpl(txId) }),
  }),
  getAdminAddress: () => ADMIN,
  getAdminAccount: () => ({ addr: { toString: () => ADMIN } }),
  getNetwork: () => "testnet",
}));

import { verifyAlgoPayment } from "./commander";

// algod's pending-txn shape: nested under txn.txn, Address OBJECTS (toString).
function algodPay(opts: {
  sender?: string; receiver?: string; amount?: bigint; confirmedRound?: bigint;
  type?: string; rekeyTo?: string; closeRemainderTo?: string;
} = {}) {
  const { sender = BUYER, receiver = ADMIN, amount = 500_000n, confirmedRound = 100n,
          type = "pay", rekeyTo, closeRemainderTo } = opts;
  return {
    confirmedRound,
    txn: { txn: {
      type,
      sender: { toString: () => sender },
      payment: {
        receiver: { toString: () => receiver },
        amount,
        ...(closeRemainderTo ? { closeRemainderTo: { toString: () => closeRemainderTo } } : {}),
      },
      ...(rekeyTo ? { rekeyTo: { toString: () => rekeyTo } } : {}),
    } },
  };
}

// indexer shape: flat camelCase, STRING sender/receiver (algosdk-v3-indexer-shape).
function indexerPay(opts: {
  sender?: string; receiver?: string; amount?: bigint; confirmedRound?: bigint; txType?: string;
} = {}) {
  const { sender = BUYER, receiver = ADMIN, amount = 500_000n, confirmedRound = 100n, txType = "pay" } = opts;
  return { transaction: { txType, sender, confirmedRound, paymentTransaction: { receiver, amount } } };
}

const PARAMS = { txId: "TXID123", expectedSender: BUYER, minMicroAlgo: 500_000 };

beforeEach(() => {
  h.pendingImpl.mockReset();
  h.indexerImpl.mockReset();
});

describe("verifyAlgoPayment — algod finality", () => {
  it("accepts a valid payment from algod without touching the indexer", async () => {
    h.pendingImpl.mockResolvedValue(algodPay());
    const result = await verifyAlgoPayment(PARAMS);
    expect(result.amountMicroAlgo).toBe(500_000);
    expect(h.indexerImpl).not.toHaveBeenCalled();
  });

  it("rejects a payment below the required amount", async () => {
    h.pendingImpl.mockResolvedValue(algodPay({ amount: 499_999n }));
    await expect(verifyAlgoPayment(PARAMS)).rejects.toThrow(/Insufficient payment/);
  });

  it("rejects a wrong receiver", async () => {
    h.pendingImpl.mockResolvedValue(algodPay({ receiver: "SOMEONE_ELSE" }));
    await expect(verifyAlgoPayment(PARAMS)).rejects.toThrow(/receiver mismatch/);
  });

  it("rejects a sender that is not the expected payer", async () => {
    h.pendingImpl.mockResolvedValue(algodPay({ sender: "IMPOSTER" }));
    await expect(verifyAlgoPayment(PARAMS)).rejects.toThrow(/sender mismatch/);
  });

  it("rejects a non-payment txn type", async () => {
    h.pendingImpl.mockResolvedValue(algodPay({ type: "axfer" }));
    await expect(verifyAlgoPayment(PARAMS)).rejects.toThrow(/is not a payment txn/);
  });

  it("rejects a payment carrying a closeRemainderTo rider", async () => {
    h.pendingImpl.mockResolvedValue(algodPay({ closeRemainderTo: "DRAIN_TARGET" }));
    await expect(verifyAlgoPayment(PARAMS)).rejects.toThrow(/closeRemainderTo/);
  });

  it("rejects a payment carrying a rekeyTo rider", async () => {
    h.pendingImpl.mockResolvedValue(algodPay({ rekeyTo: "HIJACK_KEY" }));
    await expect(verifyAlgoPayment(PARAMS)).rejects.toThrow(/rekeyTo/);
  });

  it("treats an unconfirmed pool txn as not-yet-confirmed and does NOT fall back to the indexer", async () => {
    h.pendingImpl.mockResolvedValue(algodPay({ confirmedRound: 0n }));
    await expect(verifyAlgoPayment(PARAMS)).rejects.toThrow(/not yet confirmed/);
    expect(h.indexerImpl).not.toHaveBeenCalled();
  });

  it("falls back to the indexer when algod has flushed the txn (404)", async () => {
    h.pendingImpl.mockRejectedValue(new Error("404 not found"));
    h.indexerImpl.mockResolvedValue(indexerPay());
    const result = await verifyAlgoPayment(PARAMS);
    expect(result.amountMicroAlgo).toBe(500_000);
    expect(h.indexerImpl).toHaveBeenCalledOnce();
  });

  it("throws when neither algod nor the indexer has the txn", async () => {
    h.pendingImpl.mockRejectedValue(new Error("404"));
    h.indexerImpl.mockRejectedValue(new Error("404"));
    await expect(verifyAlgoPayment(PARAMS)).rejects.toThrow(/not found \(algod \+ indexer\)/);
  });
});
