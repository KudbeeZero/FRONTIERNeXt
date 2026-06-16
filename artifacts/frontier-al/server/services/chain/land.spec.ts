/**
 * server/services/chain/land.spec.ts
 *
 * Tripwire tests for the Plot NFT mint/transfer service.
 *
 * These encode the blast radius of any change near the NFT delivery path:
 *  - the asset-transfer transaction constructed for identical inputs must not
 *    change (sender, receiver, amount, assetIndex, fee, note),
 *  - the asset-create (mint) transaction for identical inputs must not change,
 *  - attemptDelivery() keeps its not_opted_in / transfer_failed / delivered
 *    semantics and never submits a transfer for a non-opted-in receiver.
 *
 * All chain interaction is mocked — no algod, no network, no real keys.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";
import algosdk from "algosdk";

vi.mock("./client", async () => {
  const { default: sdk } = await import("algosdk");
  const account = sdk.generateAccount(); // throwaway in-memory test key
  const state = {
    sent: [] as Uint8Array[],
    failNextSend: false,
  };
  const fixedParams = {
    flatFee: false,
    fee: 0n,
    minFee: 1000n,
    firstValid: 1000n,
    lastValid: 2000n,
    genesisID: "testnet-v1.0",
    genesisHash: new Uint8Array(32),
  };
  const algod = {
    getTransactionParams: () => ({ do: async () => ({ ...fixedParams }) }),
    sendRawTransaction: (bytes: Uint8Array) => ({
      do: async () => {
        if (state.failNextSend) {
          state.failNextSend = false;
          throw new Error("mock: send rejected");
        }
        state.sent.push(bytes);
        return { txid: "MOCKTXID" };
      },
    }),
    status: () => ({ do: async () => ({ lastRound: 1n }) }),
    statusAfterBlock: (_round: bigint) => ({ do: async () => ({ lastRound: 2n }) }),
    pendingTransactionInformation: (_txid: string) => ({
      do: async () => ({ confirmedRound: 5n, poolError: "", assetIndex: 777n }),
    }),
  };
  return {
    getAlgodClient: () => algod,
    getAdminAccount: () => account,
    getAdminAddress: () => account.addr.toString(),
    getNetwork: () => "testnet",
    __testState: state,
  };
});

vi.mock("./asa", () => {
  const state = { optedIn: true };
  return {
    isAddressOptedIn: async (_addr: string, _assetId?: number) => state.optedIn,
    __optInState: state,
  };
});

import { transferLandNft, mintLandNft, attemptDelivery } from "./land";
import * as clientMock from "./client";
import * as asaMock from "./asa";

const chainState = (clientMock as any).__testState as { sent: Uint8Array[]; failNextSend: boolean };
const optInState = (asaMock as any).__optInState as { optedIn: boolean };
const adminAddr = (clientMock as any).getAdminAddress() as string;

const RECEIVER = algosdk.generateAccount().addr.toString();

beforeEach(() => {
  chainState.sent.length = 0;
  chainState.failNextSend = false;
  optInState.optedIn = true;
});

describe("transferLandNft — transaction construction snapshot", () => {
  it("builds the exact asset-transfer txn for fixed inputs", async () => {
    const { txId } = await transferLandNft({ assetId: 4242, toAddress: RECEIVER });

    expect(txId).toBe("MOCKTXID");
    expect(chainState.sent).toHaveLength(1);

    const decoded = algosdk.decodeSignedTransaction(chainState.sent[0]);
    const txn = decoded.txn;

    expect(txn.type).toBe("axfer");
    expect(txn.sender.toString()).toBe(adminAddr);
    expect(txn.assetTransfer).toBeDefined();
    expect(txn.assetTransfer!.receiver.toString()).toBe(RECEIVER);
    expect(txn.assetTransfer!.amount).toBe(1n);
    expect(txn.assetTransfer!.assetIndex).toBe(4242n);
    // flatFee=false, fee=0 ⇒ per-byte fee floored at minFee
    expect(txn.fee).toBe(1000n);
    expect(txn.firstValid).toBe(1000n);
    expect(txn.lastValid).toBe(2000n);
    expect(new TextDecoder().decode(txn.note)).toBe(
      `FRONTIER Land NFT transfer to ${RECEIVER}`
    );
  });

  it("uses the caller-supplied note verbatim when provided", async () => {
    await transferLandNft({ assetId: 7, toAddress: RECEIVER, note: "FRONTIER Plot #7 delivery" });
    const txn = algosdk.decodeSignedTransaction(chainState.sent[0]).txn;
    expect(new TextDecoder().decode(txn.note)).toBe("FRONTIER Plot #7 delivery");
  });
});

describe("mintLandNft — asset-create construction snapshot", () => {
  it("creates a 1-of-1 PLOT ASA held in admin custody", async () => {
    const result = await mintLandNft({
      plotId: 123,
      receiverAddress: RECEIVER,
      metadataBaseUrl: "https://game.example.com/",
    });

    expect(result.assetId).toBe(777);
    expect(result.custodyHeld).toBe(true);
    expect(result.mintedToAddress).toBe(adminAddr);
    expect(result.transferTxId).toBeUndefined();

    expect(chainState.sent).toHaveLength(1);
    const txn = algosdk.decodeSignedTransaction(chainState.sent[0]).txn;

    expect(txn.type).toBe("acfg");
    expect(txn.sender.toString()).toBe(adminAddr);
    expect(txn.assetConfig).toBeDefined();
    expect(txn.assetConfig!.total).toBe(1n);
    expect(txn.assetConfig!.decimals).toBe(0);
    expect(txn.assetConfig!.defaultFrozen).toBe(false);
    expect(txn.assetConfig!.unitName).toBe("PLOT");
    expect(txn.assetConfig!.assetName).toBe("Frontier Plot #123");
    // trailing slash stripped — no double slash in the metadata URL
    expect(txn.assetConfig!.assetURL).toBe("https://game.example.com/nft/metadata/123#arc3");
    expect(txn.assetConfig!.manager?.toString()).toBe(adminAddr);
    expect(txn.assetConfig!.reserve?.toString()).toBe(adminAddr);
    // testnet: freeze + clawback kept for recovery
    expect(txn.assetConfig!.freeze?.toString()).toBe(adminAddr);
    expect(txn.assetConfig!.clawback?.toString()).toBe(adminAddr);
  });
});

describe("attemptDelivery — semantics", () => {
  it("does NOT submit a transfer when the receiver is not opted in", async () => {
    optInState.optedIn = false;
    const result = await attemptDelivery(4242, RECEIVER, 99);
    expect(result).toEqual({ delivered: false, reason: "not_opted_in" });
    expect(chainState.sent).toHaveLength(0);
  });

  it("delivers when the receiver is opted in", async () => {
    const result = await attemptDelivery(4242, RECEIVER, 99);
    expect(result).toEqual({ delivered: true });
    expect(chainState.sent).toHaveLength(1);
  });

  it("reports transfer_failed (without throwing) when the chain rejects", async () => {
    chainState.failNextSend = true;
    const result = await attemptDelivery(4242, RECEIVER, 99);
    expect(result).toEqual({ delivered: false, reason: "transfer_failed" });
  });
});
