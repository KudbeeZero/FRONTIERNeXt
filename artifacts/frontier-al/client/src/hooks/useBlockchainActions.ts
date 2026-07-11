import { useState, useCallback, useEffect } from "react";
import { useWallet } from "./useWallet";
import {
  createGameActionTransaction,
  createPurchaseWithAlgoTransaction,
  createClaimAscendTransaction,
  createCommanderMintTransaction,
  registerTxnQueueAddress,
  registerBatchStatusCallback,
  enqueueGameAction,
  fetchBlockchainStatus,
  getCachedTreasuryAddress,
  getCachedAsaId,
  optInToASA,
  algodClient,
  hasOptedIn,
  type BatchStatusCallback,
} from "@/lib/algorand";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { withWalletOperation, isWalletOperationInProgress } from "@/lib/walletOperationLock";

type ActionType =
  | "mine"
  | "upgrade"
  | "attack"
  | "claim"
  | "build"
  | "purchase"
  | "claim_ascend"
  | "mint_avatar"
  | "special_attack"
  | "deploy_drone"
  | "deploy_satellite"
  | "switch_commander";

export function useBlockchainActions() {
  const { isConnected, isReady, address } = useWallet();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [ascendAsaId, setAscendAsaId] = useState<number | null>(null);
  // tri-state: undefined = checking, true = opted in, false = not opted in
  const [isOptedIn, setIsOptedIn] = useState<boolean | undefined>(undefined);
  const [treasuryAddress, setTreasuryAddress] = useState<string>("");
  // TestNet testing toggle: when true, plot/commander purchases skip the wallet
  // ALGO payment entirely (server skips verification too). Server-authoritative.
  const [freePurchases, setFreePurchases] = useState<boolean>(false);

  /**
   * Wrap a signing action with the application-wide operation lock.
   * - Same id → same promise (deduplicates rapid clicks).
   * - Different id while busy → rejects with a user-facing toast.
   * Always releases the lock in `finally`.
   */
  const guardSigningOperation = useCallback(
    async <T,>(operationId: string, run: () => Promise<T>): Promise<T | null> => {
      try {
        return await withWalletOperation(operationId, run);
      } catch (err) {
        const msg = (err as Error)?.message ?? "";
        if (msg.includes("already in progress")) {
          toast({
            title: "Wallet Busy",
            description: "Another wallet operation is still pending. Please finish or cancel it first.",
            variant: "destructive",
          });
          return null;
        }
        throw err;
      }
    },
    [toast]
  );

  // Derived busy flag that reflects the global signing lock, not just this
  // hook instance's local state. This is what controls should disable on.
  const isSigningBusy = isWalletOperationInProgress() || isPending;

  useEffect(() => {
    fetchBlockchainStatus().then((status) => {
      if (status.ascendAsaId) setAscendAsaId(status.ascendAsaId);
      if (status.adminAddress) setTreasuryAddress(status.adminAddress);
      setFreePurchases(status.freePurchases === true);
    });
  }, []);

  useEffect(() => {
    setIsOptedIn(undefined);
  }, [address, ascendAsaId]);

  // Once we have both address and ASA id, read the per-wallet+ASA cache first
  // (so opted-in users never see the banner flash), then verify on-chain in
  // the background to keep the cache accurate.
  useEffect(() => {
    if (!address || !ascendAsaId) return;

    const network = import.meta.env.VITE_ALGORAND_NETWORK ?? "testnet";
    const cacheKey = `frontier_optin_${network}_${address}_${ascendAsaId}`;
    if (localStorage.getItem(cacheKey) === "true") {
      setIsOptedIn(true);
    }

    algodClient
      .accountInformation(address)
      .do()
      .then((accountInfo) => {
        const result = hasOptedIn(accountInfo as unknown as Record<string, unknown>, ascendAsaId);
        setIsOptedIn(result);
        if (result) {
          localStorage.setItem(cacheKey, "true");
        } else {
          localStorage.removeItem(cacheKey);
        }
      })
      .catch(() => {
        // Keep existing cached state if algod is temporarily unreachable
      });
  }, [address, ascendAsaId]);

  useEffect(() => {
    if (!address || !isReady) return;
    registerTxnQueueAddress(address);

    const statusHandler: BatchStatusCallback = (event, detail) => {
      switch (event) {
        case "bundling":
          // bundling event is informational only — no toast needed
          break;
        case "submitting":
          toast({
            title: "Logging to Chain",
            description: `Recording ${detail.count} game action${detail.count !== 1 ? "s" : ""} to Algorand...`,
            duration: 3000,
          });
          break;
        case "confirmed":
          toast({
            title: "Actions Logged",
            description: `${detail.count} game action${detail.count !== 1 ? "s" : ""} recorded on Algorand${detail.txIds?.[0] ? `. TX: ${detail.txIds[0].slice(0, 8)}...` : ""}`,
          });
          break;
        case "error": {
          const msg = detail.message || "Unknown error";
          if (!msg.includes("cancelled") && !msg.includes("rejected")) {
            toast({
              title: "Chain Log Failed",
              description: msg.slice(0, 100),
              variant: "destructive",
            });
          } else {
            toast({
              title: "Cancelled",
              description: "You cancelled the wallet transaction.",
            });
          }
          break;
        }
      }
    };
    registerBatchStatusCallback(statusHandler);
  }, [address, isReady, toast]);

  const queueMineAction = useCallback(
    (plotId: number, minerals?: { iron: number; fuel: number; crystal: number }) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueMineAction | path: enqueueGameAction→batch | plotId: ${plotId} | ts: ${Date.now()}`);
        const mineralData = minerals
          ? { fe: minerals.iron, fu: minerals.fuel, cr: minerals.crystal }
          : undefined;
        enqueueGameAction("mine", plotId, undefined, mineralData);
      }
    },
    [isReady, address]
  );

  const queueUpgradeAction = useCallback(
    (plotId: number, upgradeType: string) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueUpgradeAction | path: enqueueGameAction→batch | plotId: ${plotId} | type: ${upgradeType} | ts: ${Date.now()}`);
        enqueueGameAction("upgrade", plotId, { upgradeType });
      }
    },
    [isReady, address]
  );

  const queueAttackAction = useCallback(
    (plotId: number, troops: number, iron: number, fuel: number, crystal: number = 0) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueAttackAction | path: enqueueGameAction→batch | plotId: ${plotId} | troops: ${troops} | crystal: ${crystal} | ts: ${Date.now()}`);
        enqueueGameAction("attack", plotId, { troops, iron, fuel, crystal });
      }
    },
    [isReady, address]
  );

  const queueBuildAction = useCallback(
    (plotId: number, improvementType: string) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueBuildAction | path: enqueueGameAction→batch | plotId: ${plotId} | type: ${improvementType} | ts: ${Date.now()}`);
        enqueueGameAction("build", plotId, { improvementType });
      }
    },
    [isReady, address]
  );

  const queueMintAvatarAction = useCallback(
    (tier: string) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueMintAvatarAction | path: enqueueGameAction→batch | tier: ${tier} | ts: ${Date.now()}`);
        enqueueGameAction("mint_avatar", 0, { tier });
      }
    },
    [isReady, address]
  );

  // Direct wallet-sign for Commander mint — opens wallet immediately (like land purchase),
  // NOT queued to the batch relay. Returns txId on success, "cancelled" if rejected, null on error.
  const signCommanderMintAction = useCallback(
    async (tier: string, ascendCost: number): Promise<string | null | "cancelled"> => {
      if (!isReady || !address) {
        toast({ title: "Wallet Not Ready", description: "Connect your wallet first.", variant: "destructive" });
        return null;
      }
      const result = await guardSigningOperation(`mint-commander:${tier}:${ascendCost}`, async () => {
        setIsPending(true);
        try {
          console.log(`[ACTION-DEBUG] signCommanderMintAction | path: direct wallet sign | tier: ${tier} | ascendCost: ${ascendCost} | ts: ${Date.now()}`);
          const txId = await createCommanderMintTransaction(address, tier, ascendCost);
          setLastTxId(txId);
          return txId;
        } catch (err: unknown) {
          const msg = (err as Error)?.message ?? String(err);
          if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("reject")) {
            toast({ title: "Mint Cancelled", description: "Transaction rejected in wallet.", variant: "destructive" });
            return "cancelled";
          }
          toast({ title: "Wallet Error", description: msg, variant: "destructive" });
          return null;
        } finally {
          setIsPending(false);
        }
      });
      // guardSigningOperation returns null on "busy"; preserve "cancelled" sentinel.
      return result === null ? null : result;
    },
    [isReady, address, toast, guardSigningOperation]
  );

  const queueSpecialAttackAction = useCallback(
    (targetPlotId: number, attackType: string) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueSpecialAttackAction | path: enqueueGameAction→batch | plotId: ${targetPlotId} | type: ${attackType} | ts: ${Date.now()}`);
        enqueueGameAction("special_attack", targetPlotId, { attackType });
      }
    },
    [isReady, address]
  );

  const queueSwitchCommanderAction = useCallback(
    (commanderIndex: number) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueSwitchCommanderAction | path: enqueueGameAction→batch | idx: ${commanderIndex} | ts: ${Date.now()}`);
        enqueueGameAction("switch_commander", 0, { commanderIndex });
      }
    },
    [isReady, address]
  );

  const queueDeployDroneAction = useCallback(
    (targetPlotId?: number) => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueDeployDroneAction | path: enqueueGameAction→batch | plotId: ${targetPlotId ?? 0} | ts: ${Date.now()}`);
        enqueueGameAction("deploy_drone", targetPlotId ?? 0);
      }
    },
    [isReady, address]
  );

  const queueDeploySatelliteAction = useCallback(
    () => {
      if (isReady && address) {
        console.log(`[ACTION-DEBUG] queueDeploySatelliteAction | path: enqueueGameAction→batch | ts: ${Date.now()}`);
        enqueueGameAction("deploy_satellite", 0);
      }
    },
    [isReady, address]
  );

  const signGameAction = useCallback(
    async (
      actionType: ActionType,
      plotId: number,
      metadata?: Record<string, unknown>
    ): Promise<string | null> => {
      if (!isReady || !address) {
        toast({
          title: "Wallet Not Ready",
          description: "Connect your wallet and wait for initialization to record actions on-chain.",
          variant: "destructive",
        });
        return null;
      }

      return guardSigningOperation(`game-action:${actionType}:${plotId}`, async () => {
        setIsPending(true);
        try {
          console.log(`[ACTION-DEBUG] signGameAction | path: createGameActionTransaction (single txn) | action: ${actionType} | plotId: ${plotId} | ts: ${Date.now()}`);
          const txId = await createGameActionTransaction(
            address,
            actionType,
            plotId,
            metadata
          );
          setLastTxId(txId);
          toast({
            title: "Transaction Confirmed",
            description: `Action recorded on Algorand TestNet. TX: ${txId.slice(0, 8)}...`,
          });
          return txId;
        } catch (error: unknown) {
          const err = error as { message?: string };
          console.error("Blockchain action failed:", error);

          if (err?.message?.includes("cancelled") || err?.message?.includes("rejected")) {
            toast({
              title: "Transaction Cancelled",
              description: "You cancelled the transaction in your wallet.",
            });
          } else {
            toast({
              title: "Transaction Failed",
              description: err?.message || "Failed to sign transaction",
              variant: "destructive",
            });
          }
          return null;
        } finally {
          setIsPending(false);
        }
      });
    },
    [isReady, address, toast, guardSigningOperation]
  );

  const signMineAction = useCallback(
    async (plotId: number) => {
      // Server-side only, no wallet signature required.
      return null;
    },
    []
  );

  const signUpgradeAction = useCallback(
    async (plotId: number, upgradeType: string) => {
      // Server-side only, no wallet signature required.
      return null;
    },
    []
  );

  const signBuildAction = useCallback(
    async (plotId: number, improvementType: string) => {
      // Server-side only, no wallet signature required.
      return null;
    },
    []
  );

  const signCollectAction = useCallback(
    async () => {
      // Server-side only, no wallet signature required.
      return null;
    },
    []
  );

  const signAttackAction = useCallback(
    (plotId: number, troops: number, iron: number, fuel: number) =>
      signGameAction("attack", plotId, { troops, iron, fuel }),
    [signGameAction]
  );

  const signPurchaseAction = useCallback(
    async (plotId: number, algoAmount: number): Promise<string | null | "cancelled"> => {
      if (!isReady || !address) {
        toast({
          title: "Wallet Not Ready",
          description: "Connect your wallet to purchase land.",
          variant: "destructive",
        });
        return null;
      }

      const result = await guardSigningOperation(`purchase:${plotId}:${algoAmount}`, async () => {
        setIsPending(true);
        try {
          console.log(`[ACTION-DEBUG] signPurchaseAction | path: createPurchaseWithAlgoTransaction (single txn) | plotId: ${plotId} | algo: ${algoAmount} | ts: ${Date.now()}`);
          let targetAddress = treasuryAddress || getCachedTreasuryAddress();
          if (!targetAddress) {
            const fresh = await fetchBlockchainStatus();
            targetAddress = fresh.adminAddress || "";
          }
          if (!targetAddress) {
            toast({ title: "On-Chain Payment Skipped", description: "Blockchain not initialized yet — land claimed in-game only.", variant: "default" });
            setIsPending(false);
            return null;
          }
          const txId = await createPurchaseWithAlgoTransaction(
            address,
            targetAddress,
            plotId,
            algoAmount
          );
          setLastTxId(txId);
          toast({
            title: "Purchase Confirmed",
            description: `Land purchased for ${algoAmount} ALGO. TX: ${txId.slice(0, 8)}...`,
          });
          return txId;
        } catch (error: unknown) {
          const err = error as { message?: string };
          if (err?.message?.includes("cancelled") || err?.message?.includes("rejected")) {
            toast({ title: "Transaction Cancelled", description: "Purchase cancelled." });
            return "cancelled";
          }
          toast({ title: "On-Chain Payment Failed", description: `${err?.message || "Network error"} — land claimed in-game only.`, variant: "default" });
          return null;
        } finally {
          setIsPending(false);
        }
      });
      return result === null ? null : result;
    },
    [isReady, address, toast, treasuryAddress, guardSigningOperation]
  );

  const signClaimAscendAction = useCallback(
    async (ascendAmount: number): Promise<string | null> => {
      if (!isReady || !address) {
        toast({
          title: "Wallet Not Ready",
          description: "Connect your wallet to claim ASCEND tokens.",
          variant: "destructive",
        });
        return null;
      }

      return guardSigningOperation(`claim-ascend:${ascendAmount}`, async () => {
        setIsPending(true);
        try {
          console.log(`[ACTION-DEBUG] signClaimAscendAction | path: createClaimAscendTransaction (single txn) | amount: ${ascendAmount} | ts: ${Date.now()}`);
          const txId = await createClaimAscendTransaction(address, ascendAmount);
          setLastTxId(txId);
          toast({
            title: "ASCEND Claimed",
            description: `Claimed ${ascendAmount.toFixed(2)} ASCEND tokens. TX: ${txId.slice(0, 8)}...`,
          });
          return txId;
        } catch (error: unknown) {
          const err = error as { message?: string };
          if (err?.message?.includes("cancelled") || err?.message?.includes("rejected")) {
            toast({ title: "Claim Cancelled", description: "Claim cancelled." });
          } else {
            toast({ title: "Claim Failed", description: err?.message || "Failed", variant: "destructive" });
          }
          return null;
        } finally {
          setIsPending(false);
        }
      });
    },
    [isReady, address, toast, guardSigningOperation]
  );

  const signOptInToAscend = useCallback(
    async (): Promise<string | null> => {
      if (!isReady || !address) {
        toast({ title: "Wallet Not Ready", description: "Connect wallet first.", variant: "destructive" });
        return null;
      }
      if (!ascendAsaId) {
        toast({ title: "Not Ready", description: "ASCEND token not created yet.", variant: "destructive" });
        return null;
      }
      if (isOptedIn === true) {
        toast({ title: "Already Opted In", description: "You're already opted into ASCEND." });
        return null;
      }

      return guardSigningOperation(`optin-ascend:${ascendAsaId}`, async () => {
        setIsPending(true);
        try {
          console.log(`[ACTION-DEBUG] signOptInToAscend | path: optInToASA (single txn) | asaId: ${ascendAsaId} | ts: ${Date.now()}`);
          const txId = await optInToASA(address, ascendAsaId);
          setLastTxId(txId);
          const cacheKey = `frontier_optin_testnet_${address}_${ascendAsaId}`;
          setIsOptedIn(true);
          localStorage.setItem(cacheKey, "true");
          queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
          toast({ title: "Opt-In Confirmed", description: `Opted into ASCEND ASA. TX: ${txId.slice(0, 8)}...` });
          return txId;
        } catch (error: unknown) {
          const err = error as { message?: string };
          if (err?.message?.includes("cancelled") || err?.message?.includes("rejected")) {
            toast({ title: "Opt-In Cancelled", description: "You cancelled the opt-in." });
          } else {
            toast({ title: "Opt-In Failed", description: err?.message || "Failed", variant: "destructive" });
          }
          return null;
        } finally {
          setIsPending(false);
        }
      });
    },
    [isReady, address, ascendAsaId, isOptedIn, toast, guardSigningOperation]
  );

  const signOptInToPlotNft = useCallback(
    async (assetId: number): Promise<boolean> => {
      if (!address) {
        toast({ title: "Wallet Required", description: "Connect your wallet first.", variant: "destructive" });
        return false;
      }
      const result = await guardSigningOperation(`optin-plot:${assetId}`, async () => {
        try {
          await optInToASA(address, assetId);
          toast({ title: "Opt-In Complete", description: `Opted into ASA ${assetId}. Claiming your NFT...` });
          return true;
        } catch (err: any) {
          if (err?.message?.includes("cancelled") || err?.message?.includes("rejected")) {
            toast({ title: "Opt-In Cancelled", description: "You cancelled the opt-in." });
          } else {
            toast({ title: "Opt-In Failed", description: err instanceof Error ? err.message : "Opt-in failed", variant: "destructive" });
          }
          return false;
        }
      });
      return result ?? false;
    },
    [address, toast, guardSigningOperation]
  );

  return {
    isPending,
    isSigningBusy,
    lastTxId,
    freePurchases,
    signMineAction,
    signUpgradeAction,
    signBuildAction,
    signCollectAction,
    signAttackAction,
    signPurchaseAction,
    signClaimAscendAction,
    signOptInToAscend,
    signOptInToPlotNft,
    queueMineAction,
    queueUpgradeAction,
    queueAttackAction,
    queueBuildAction,
    queueMintAvatarAction,
    signCommanderMintAction,
    queueSpecialAttackAction,
    queueSwitchCommanderAction,
    queueDeployDroneAction,
    queueDeploySatelliteAction,
    isWalletConnected: isConnected,
    ascendAsaId,
    isOptedInToAscend: isOptedIn,
    treasuryAddress,
  };
}
