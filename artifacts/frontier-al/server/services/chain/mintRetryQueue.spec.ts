/**
 * server/services/chain/mintRetryQueue.spec.ts
 *
 * Unit tests for the Plot NFT mint retry queue (M1-5).
 *
 * Tests the core logic without requiring a real database:
 *  - enqueuePlotMintRetry inserts correct row shape
 *  - drainPlotMintRetries handles mint success + delivery success
 *  - drainPlotMintRetries handles mint failure and retries
 *  - drainPlotMintRetries escalates to refund after MAX_ATTEMPTS
 *  - drainPlotMintRetries handles idempotency hits (already minted)
 *
 * All DB and chain interactions are mocked.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the database
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock("../../db", () => ({
  db: {
    select: () => mockSelect(),
    insert: (table: any) => mockInsert(table),
    update: (table: any) => mockUpdate(table),
  },
}));

// Mock the chain services
vi.mock("./land", () => ({
  mintLandNft: vi.fn(),
  attemptDelivery: vi.fn(),
}));

vi.mock("./refund", () => ({
  refundAlgoPayment: vi.fn(),
}));

import { db } from "../../db";
import { mintLandNft, attemptDelivery } from "./land";
import { refundAlgoPayment } from "./refund";
import { enqueuePlotMintRetry, drainPlotMintRetries } from "./mintRetryQueue";
import { plotMintRetryQueue } from "../../db-schema";

describe("mintRetryQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set required env vars
    process.env.PUBLIC_BASE_URL = "https://test.frontieralgo.xyz";
    
    // Setup default mock chains
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    });
    
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  describe("enqueuePlotMintRetry", () => {
    it("inserts a pending row with correct shape", async () => {
      const params = {
        plotId: 42,
        playerId: "player-123",
        buyerAddress: "BUYER_ADDR",
        algoPaymentTxId: "TX123",
        amountMicroAlgos: 1000000,
      };

      await enqueuePlotMintRetry(params);

      expect(mockInsert).toHaveBeenCalledWith(plotMintRetryQueue);
      const valuesCall = mockInsert.mock.results[0].value.values;
      expect(valuesCall).toHaveBeenCalledWith(
        expect.objectContaining({
          plotId: 42,
          playerId: "player-123",
          buyerAddress: "BUYER_ADDR",
          status: "pending",
          attempts: 0,
        })
      );
    });
  });

  describe("drainPlotMintRetries", () => {
    it("handles mint success + delivery success", async () => {
      const mockRow = {
        id: "retry-1",
        plotId: 42,
        playerId: "player-123",
        buyerAddress: "BUYER_ADDR",
        algoPaymentTxId: "TX123",
        amountMicroAlgos: 1000000,
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Mock query chain: select pending rows (no .limit())
      mockSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockRow]),
          }),
        })
        // Mock query chain: check idempotency (has .limit())
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        })
        // Mock query chain: check plotNfts (has .limit())
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      // Mock mint success
      (mintLandNft as any).mockResolvedValue({
        assetId: 777,
        createTxId: "MINT_TX",
        mintedToAddress: "ADMIN_ADDR",
      });

      // Mock delivery success
      (attemptDelivery as any).mockResolvedValue({ delivered: true });

      await drainPlotMintRetries();

      expect(mintLandNft).toHaveBeenCalledWith(
        expect.objectContaining({ plotId: 42, receiverAddress: "BUYER_ADDR" })
      );
      expect(attemptDelivery).toHaveBeenCalledWith(777, "BUYER_ADDR", 42);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("handles mint failure and increments attempts", async () => {
      const mockRow = {
        id: "retry-1",
        plotId: 42,
        playerId: "player-123",
        buyerAddress: "BUYER_ADDR",
        algoPaymentTxId: "TX123",
        amountMicroAlgos: 1000000,
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Mock query chain
      mockSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockRow]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      // Mock mint failure
      (mintLandNft as any).mockRejectedValue(new Error("Network error"));

      await drainPlotMintRetries();

      expect(mintLandNft).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
      const setCall = mockUpdate.mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          attempts: 1,
          lastError: expect.stringContaining("Network error"),
        })
      );
    });

    it("escalates to refund after MAX_ATTEMPTS", async () => {
      const mockRow = {
        id: "retry-1",
        plotId: 42,
        playerId: "player-123",
        buyerAddress: "BUYER_ADDR",
        algoPaymentTxId: "TX123",
        amountMicroAlgos: 1000000,
        status: "pending",
        attempts: 4, // one below MAX_ATTEMPTS (5)
        lastError: "Previous error",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Mock query chain
      mockSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockRow]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      // Mock mint failure
      (mintLandNft as any).mockRejectedValue(new Error("Network error"));

      // Mock refund success
      (refundAlgoPayment as any).mockResolvedValue("REFUND_TX");

      await drainPlotMintRetries();

      expect(mintLandNft).toHaveBeenCalled();
      expect(refundAlgoPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          toAddress: "BUYER_ADDR",
          amountMicroAlgos: 1000000,
        })
      );
    });

    it("handles idempotency hit (already minted)", async () => {
      const mockRow = {
        id: "retry-1",
        plotId: 42,
        playerId: "player-123",
        buyerAddress: "BUYER_ADDR",
        algoPaymentTxId: "TX123",
        amountMicroAlgos: 1000000,
        status: "pending",
        attempts: 0,
        lastError: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const idempotencyRow = {
        status: "confirmed",
        assetId: 777,
      };

      // Mock query chain
      mockSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockRow]),
          }),
        })
        // Mock idempotency check returning confirmed
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([idempotencyRow]),
            }),
          }),
        });

      // Mock delivery success
      (attemptDelivery as any).mockResolvedValue({ delivered: true });

      await drainPlotMintRetries();

      // Should not call mintLandNft since already minted
      expect(mintLandNft).not.toHaveBeenCalled();
      expect(attemptDelivery).toHaveBeenCalledWith(777, "BUYER_ADDR", 42);
    });

    it("does nothing when no pending rows", async () => {
      // Mock query chain: select pending rows returns empty
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await drainPlotMintRetries();

      expect(mintLandNft).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});
