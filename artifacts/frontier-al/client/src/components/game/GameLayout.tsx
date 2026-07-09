import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { TopBar } from "./TopBar";
import PlanetGlobe from "./PlanetGlobe";
import type { LivePulse } from "@/components/game/PlanetGlobe";
import { BattleWatchModal } from "./BattleWatchModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CommTerminal } from "./CommTerminal";
import { type NavTab } from "@/lib/panelNav";
import { HudShell } from "./hud/HudShell";
import { LandSheet } from "./LandSheet";
import { InventoryPanel } from "./InventoryPanel";
import { BattlesPanel } from "./BattlesPanel";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { TradeStationPanel } from "./TradeStation";
import { CommanderPanel } from "./CommanderPanel";
import { EconomicsPanel } from "./EconomicsPanel";
import { GamerTagModal } from "./GamerTagModal";
import { CommandCenterPanel } from "./CommandCenterPanel";
import { WarRoomPanel } from "./WarRoomPanel";
import { ArmoryPanel } from "./armory/ArmoryPanel";
import { UniversityPanel } from "./university/UniversityPanel";
import { WorldIntelPanel } from "./WorldIntelPanel";
import { FactionPanel } from "./FactionPanel";
import { PredictionMarketsPanel } from "./PredictionMarkets";
import { DashboardCanvas } from "./dashboard/DashboardCanvas";
import { useWidgetLayout } from "./dashboard/useWidgetLayout";
import { DEFAULT_DASHBOARD } from "./dashboard/defaults";
import { isDashboardEnabled, setDashboardEnabled } from "@/lib/dashboard/flag";
import { useWorldEvents } from "@/hooks/useWorldEvents";
import { WalletConnect } from "./WalletConnect";
import { OrbitalEventToast } from "./OrbitalEventToast";
import { useOrbitalEngine } from "@/hooks/useOrbitalEngine";
import { useWallet } from "@/hooks/useWallet";
import { useIsMobile } from "@/hooks/use-mobile";
import { TEST_GLOBE } from "@/lib/testMode";
import { useBlockchainActions } from "@/hooks/useBlockchainActions";
import { useGameSocket, useLiveWorldEvents } from "@/hooks/useGameSocket";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useGameState, useCurrentPlayer, useMine, useUpgrade, useAttack, useBuild, usePurchase, useCollectAll, useClaimAscend, useMintAvatar, useSwitchCommander, useSpecialAttack, useDeployDrone, useDeploySatellite, useOpenLootBox } from "@/hooks/useGameState";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, resolveApiUrl } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Coins, Shield, Globe, Trophy, ArrowLeftRight, AlertTriangle, Clock, Flag, Swords, Crosshair, GraduationCap, BarChart3, Radar, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeUuid } from "@/lib/safeUuid";
import { serverNow } from "@/lib/serverClock";
import type { ImprovementType, CommanderTier, SpecialAttackType } from "@shared/schema";
import { startSpaceAmbience, stopSpaceAmbience } from "@/audio/spaceAmbience";
import { StreamOverlay } from "./StreamOverlay";
import { NftClaimNotification } from "./NftClaimNotification";
import { SelectedPlotPanel } from "./SelectedPlotPanel";
import { sendPaymentTransaction, batchOptInToASAs } from "@/lib/algorand";
import algosdk from "algosdk";
import { ActivityFeed } from "./ActivityFeed";
import { DEV_MODE, devSessionActive } from "@/lib/devSession";
import { isRailTab, resolveRailTab, type RailTab } from "@/lib/panelNav";

export function GameLayout() {
  const wallet = useWallet();
  const { isConnected, balance, walletStatus, requestConnection } = wallet;
  const {
    freePurchases,
    signPurchaseAction,
    signOptInToAscend,
    signOptInToPlotNft,
    signCommanderMintAction,
    queueMineAction,
    queueUpgradeAction,
    queueAttackAction,
    queueBuildAction,
    queueMintAvatarAction,
    queueSpecialAttackAction,
    queueSwitchCommanderAction,
    queueDeployDroneAction,
    queueDeploySatelliteAction,
    isWalletConnected,
    ascendAsaId,
    isOptedInToAscend,
    treasuryAddress,
  } = useBlockchainActions();
  // Drive the socket off authVersion (bumps on every fresh token) so a re-auth
  // reconnects cleanly; onSessionRejected self-heals a rejected/stale token
  // instead of the old silent retry-to-death loop.
  useGameSocket(wallet.authVersion, wallet.onSessionRejected);
  const { data: gameState, isLoading, error } = useGameState();
  const player = useCurrentPlayer(wallet.address);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { events: orbitalEvents, impactEvents } = useOrbitalEngine();
  const handleParcelSelect = useCallback((id: string) => {
    setSelectedParcelId(id);
    setShowFullLandSheet(false); // Always open lightweight panel first
  }, []);

  const initializedAddressRef = useRef<string | null>(null);
  const ambienceStartedRef = useRef(false);

  useEffect(() => {
    if (isConnected && !ambienceStartedRef.current) {
      ambienceStartedRef.current = true;
      startSpaceAmbience();
    }
    return () => {
      if (ambienceStartedRef.current) {
        stopSpaceAmbience();
        ambienceStartedRef.current = false;
      }
    };
  }, [isConnected]);

  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  /** Controls whether the full LandSheet is open (vs. the lightweight SelectedPlotPanel) */
  const [showFullLandSheet, setShowFullLandSheet] = useState(false);
  /** Bumped each time the player requests an attack — signals the Commander
   *  Battlefront to open (replaces the retired global AttackModal). */
  const [attackIntent, setAttackIntent] = useState(0);
  const [watchingBattleId, setWatchingBattleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>("map");
  // Single source of truth for "what panel is showing" — shared by mobile's
  // fullscreen panel and the desktop rail. The rail has no "map" equivalent
  // (it's always visible), so it derives its own tab via resolveRailTab()
  // below instead of keeping a second, independent piece of state.
  const lastRailTabRef = useRef<RailTab>("battles");
  useEffect(() => {
    if (isRailTab(activeTab)) lastRailTabRef.current = activeTab;
  }, [activeTab]);
  const desktopRightTab = resolveRailTab(activeTab, lastRailTabRef.current);
  // Draggable snap-grid dashboard. Lives in state so the TopBar toggle can flip
  // it live; seeded from the flag (?dashboard=1 / persisted). When on, the fixed
  // desktop rails are replaced by a movable widget canvas.
  const [dashboardOn, setDashboardOn] = useState(() => isDashboardEnabled());
  const toggleDashboard = useCallback(() => {
    setDashboardOn((on) => {
      const next = !on;
      setDashboardEnabled(next);
      return next;
    });
  }, []);
  const dashboard = useWidgetLayout(DEFAULT_DASHBOARD);
  const [showGamerTag, setShowGamerTag] = useState(false);
  const [newPlayerId, setNewPlayerId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [miningParcelIds, setMiningParcelIds] = useState<Set<string>>(new Set());
  const [livePulses, setLivePulses] = useState<LivePulse[]>([]);
  const [flyRequestId, setFlyRequestId] = useState(0);
  const [mapTransitioning, setMapTransitioning] = useState(false);

  // ── Stream mode & season countdown ────────────────────────────────────────
  /** Detect ?stream=1 in URL to enable the fullscreen streaming HUD. */
  const streamMode = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("stream") === "1";
    } catch {
      return false;
    }
  }, []);

  /** Tick `now` every second to drive the live season countdown display. */
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(tick);
  }, []);

  const seasonEndsAt = (gameState as any)?.seasonEndsAt as number | null | undefined;
  const seasonName   = (gameState as any)?.seasonName as string | null | undefined;

  const seasonCountdown = useMemo(() => {
    if (!seasonEndsAt) return null;
    const ms = seasonEndsAt - now;
    if (ms <= 0) return "SEASON ENDED";
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }, [seasonEndsAt, now]);

  useEffect(() => {
    if (livePulses.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setLivePulses(prev => prev.filter(p => now - p.startMs < 700));
    }, 700);
    return () => clearTimeout(timer);
  }, [livePulses]);

  const lastLocatedOwnedId = useRef<string | null>(null);
  const lastLocatedEnemyId = useRef<string | null>(null);
  const [replayTime, setReplayTime] = useState<number>(Date.now());
  const [replayVisibleTypes, setReplayVisibleTypes] = useState<Set<string>>(new Set());
  const replayWindowStart = useMemo(() => Date.now() - 24 * 60 * 60_000, []);
  const { data: replayEvents = [] } = useWorldEvents({ start: replayWindowStart, limit: 500 });
  const handleReplayStateChange = useCallback(({ replayTime: rt, visibleTypes: vt }: { replayTime: number; visibleTypes: Set<string> }) => {
    setReplayTime(rt);
    setReplayVisibleTypes(vt);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const mineMutation = useMine();
  const openLootBoxMutation = useOpenLootBox();
  const [openingLootBoxId, setOpeningLootBoxId] = useState<string | null>(null);
  const upgradeMutation = useUpgrade();
  const attackMutation = useAttack();
  const buildMutation = useBuild();
  const purchaseMutation = usePurchase();
  const collectMutation = useCollectAll();
  const claimAscendMutation = useClaimAscend();
  const mintAvatarMutation = useMintAvatar();
  const specialAttackMutation = useSpecialAttack();
  const switchCommanderMutation = useSwitchCommander();
  const deployDroneMutation = useDeployDrone();
  const deploySatelliteMutation = useDeploySatellite();


  useEffect(() => {
    if (!wallet.address || !wallet.isConnected) return;
    if (initializedAddressRef.current === wallet.address) return;

    initializedAddressRef.current = wallet.address;

    fetch(resolveApiUrl(`/api/game/player-by-address/${encodeURIComponent(wallet.address)}`))
      .then((r) => r.json())
      .then((data) => {
        if (data.welcomeBonus) {
          setNewPlayerId(data.id);
          setShowGamerTag(true);
          toast({
            title: "Welcome Commander!",
            description: "You've received 500 ASCEND tokens as a welcome bonus. Use them to build facilities and grow your empire!",
          });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
      })
      .catch((err) => console.error("Failed to initialise player for address:", err));
  }, [wallet.address, wallet.isConnected]);


  const selectedParcel = gameState?.parcels.find((p) => p.id === selectedParcelId) || null;
  const activeBattleCount = gameState?.battles.filter(b => b.status === "pending").length || 0;

  const handleMine = async () => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to perform game actions.", variant: "destructive" });
      return;
    }
    if (!player || !selectedParcelId || !selectedParcel) return;
    if (miningParcelIds.has(selectedParcelId)) return;
    setMiningParcelIds((prev) => new Set([...prev, selectedParcelId]));
    mineMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId },
      {
        onSuccess: (data: any) => {
          const yields = data?.yield as { iron: number; fuel: number; crystal: number } | undefined;
          queueMineAction(selectedParcel.plotId, yields);
          const desc = yields
            ? `+${yields.iron} Iron, +${yields.fuel} Fuel, +${yields.crystal} Crystal`
            : "Resources extracted successfully.";
          toast({ title: "Mining Complete", description: desc });
          if (selectedParcel) {
            const pulse: LivePulse = {
              id: `pulse-${Date.now()}-${Math.random()}`,
              lat: selectedParcel.lat,
              lng: selectedParcel.lng,
              startMs: Date.now(),
            };
            setLivePulses(prev => [...prev, pulse]);
          }
        },
        onError: (error: unknown) => toast({ title: "Mining Failed", description: (error as Error).message, variant: "destructive" }),
        onSettled: () => {
          setMiningParcelIds((prev) => {
            const next = new Set(prev);
            next.delete(selectedParcelId);
            return next;
          });
        },
      }
    );
  };

  const handleMineParcel = async (parcelId: string) => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to perform game actions.", variant: "destructive" });
      return;
    }
    if (!player) return;
    if (miningParcelIds.has(parcelId)) return;
    const parcel = gameState?.parcels.find(p => p.id === parcelId);
    if (!parcel) return;
    setMiningParcelIds((prev) => new Set([...prev, parcelId]));
    mineMutation.mutate(
      { playerId: player.id, parcelId },
      {
        onSuccess: (data: any) => {
          const yields = data?.yield as { iron: number; fuel: number; crystal: number } | undefined;
          queueMineAction(parcel.plotId, yields);
          const desc = yields
            ? `+${yields.iron} Iron, +${yields.fuel} Fuel, +${yields.crystal} Crystal`
            : "Resources extracted successfully.";
          toast({ title: "Mining Complete", description: desc });
          const pulse: LivePulse = {
            id: `pulse-${Date.now()}-${Math.random()}`,
            lat: parcel.lat,
            lng: parcel.lng,
            startMs: Date.now(),
          };
          setLivePulses(prev => [...prev, pulse]);
        },
        onError: (error: unknown) => toast({ title: "Mining Failed", description: (error as Error).message, variant: "destructive" }),
        onSettled: () => {
          setMiningParcelIds((prev) => {
            const next = new Set(prev);
            next.delete(parcelId);
            return next;
          });
        },
      }
    );
  };

  const MINERAL_LABELS: Record<string, string> = {
    xenorite: "Xenorite", void_shard: "Void Shard", plasma_core: "Plasma Core", dark_matter: "Dark Matter",
  };

  const handleOpenLootBox = async (lootBoxId: string) => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to perform game actions.", variant: "destructive" });
      return;
    }
    if (!player || openingLootBoxId) return;
    setOpeningLootBoxId(lootBoxId);
    openLootBoxMutation.mutate(
      { playerId: player.id, lootBoxId },
      {
        onSuccess: (data: any) => {
          const reward = data?.reward as { mineral: string; amount: number } | undefined;
          toast({
            title: "Loot Box Opened",
            description: reward
              ? `+${reward.amount} ${MINERAL_LABELS[reward.mineral] ?? reward.mineral}`
              : "Reward credited to your vault.",
          });
        },
        onError: (error: unknown) => toast({ title: "Open Failed", description: (error as Error).message, variant: "destructive" }),
        onSettled: () => setOpeningLootBoxId(null),
      },
    );
  };

  const handleUpgrade = async (type: string) => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to perform game actions.", variant: "destructive" });
      return;
    }
    if (!player || !selectedParcelId || !selectedParcel) return;
    // One nonce per logical action — reused if React-Query retries this mutate().
    upgradeMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId, upgradeType: type as any, idempotencyKey: safeUuid() },
      {
        onSuccess: () => {
          queueUpgradeAction(selectedParcel.plotId, type);
          toast({ title: "Upgrade Complete", description: `${type} upgraded.` });
        },
        onError: (error) => toast({ title: "Upgrade Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  /**
   * Route an attack request to the Commander flow instead of the (retired)
   * global AttackModal. Prefills the target from the selected parcel, surfaces
   * the Commander panel (right rail on desktop, fullscreen on mobile), and
   * signals the Battlefront to open. The on-chain attack still fires via
   * handleAttackConfirm → attackMutation (unchanged).
   */
  const handleRequestAttack = (parcelId?: string) => {
    if (parcelId) setSelectedParcelId(parcelId);
    setActiveTab("commander");
    setAttackIntent((n) => n + 1);
  };

  const handleAttackConfirm = async (troops: number, iron: number, fuel: number, crystal: number, commanderId?: string, sourceParcelId?: string) => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to perform game actions.", variant: "destructive" });
      return;
    }
    if (!player || !selectedParcelId || !selectedParcel) return;
    attackMutation.mutate(
      { attackerId: player.id, targetParcelId: selectedParcelId, troopsCommitted: troops, resourcesBurned: { iron, fuel }, crystalBurned: crystal, commanderId, sourceParcelId },
      {
        onSuccess: (data: any) => {
          queueAttackAction(selectedParcel.plotId, troops, iron, fuel, crystal);
          const battleId = data?.id as string | undefined;
          toast({ title: "Attack Deployed", description: "Battle will resolve in 10 minutes." });
          if (battleId) setWatchingBattleId(battleId);
        },
        onError: (error) => toast({ title: "Attack Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleBuild = (type: ImprovementType) => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to perform game actions.", variant: "destructive" });
      return;
    }
    if (!player || !selectedParcelId || !selectedParcel) return;
    // One nonce per logical action — reused if React-Query retries this mutate().
    buildMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId, improvementType: type, idempotencyKey: safeUuid() },
      {
        onSuccess: () => {
          queueBuildAction(selectedParcel.plotId, type);
          toast({ title: "Construction Complete", description: `${type} has been built.` });
        },
        onError: (error) => toast({ title: "Build Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handlePurchase = async () => {
    if (!player || !selectedParcelId || !selectedParcel) return;

    // Ensure wallet is connected before proceeding — triggers connect flow if needed
    if (!isWalletConnected) {
      const connected = await requestConnection();
      if (!connected) {
        toast({
          title: "Wallet Required",
          description: "Connect your Algorand wallet to purchase territory.",
          variant: "destructive",
        });
        return;
      }
    }

    const algoAmount = selectedParcel.purchasePriceAlgo;
    if (algoAmount === null || algoAmount === undefined) {
      toast({ title: "Price Unavailable", description: "This plot has no purchase price set.", variant: "destructive" });
      return;
    }

    // FREE_PURCHASES (TestNet testing toggle): skip the wallet ALGO payment
    // entirely and let the server claim the plot for free. Otherwise sign + pay.
    let algoPaymentTxId: string | undefined;
    if (!freePurchases) {
      const result = await signPurchaseAction(selectedParcel.plotId, algoAmount);
      if (result === "cancelled") return;
      if (typeof result !== "string") {
        toast({ title: "Payment Required", description: "ALGO payment must be confirmed to purchase territory.", variant: "destructive" });
        return;
      }
      algoPaymentTxId = result;
    }

    const purchasedPlotId = selectedParcel.plotId;
    purchaseMutation.mutate(
      { playerId: player.id, parcelId: selectedParcelId, algoPaymentTxId },
      {
        onSuccess: () => {
          toast({ title: "Territory Acquired", description: "New land is now yours — delivering your Plot NFT..." });
          setSelectedParcelId(null);
          void pollAndAutoClaimPlotNft(purchasedPlotId);
        },
        onError: (error) => toast({ title: "Purchase Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleCollectAll = () => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to perform game actions.", variant: "destructive" });
      return;
    }
    if (!player) return;
    collectMutation.mutate(player.id, {
      onSuccess: (data: any) => {
        const c = data.collected;
        queueMineAction(0, c);
        toast({ title: "Resources Collected", description: `+${c.iron} Iron, +${c.fuel} Fuel, +${c.crystal} Crystal` });
      },
      onError: (error) => toast({ title: "Collection Failed", description: error.message, variant: "destructive" }),
    });
  };

  // Total unclaimed ASCEND accumulated across the player's owned land — drives the
  // always-visible TopBar "Claim ASCEND" button.
  const totalClaimableAscend = Math.floor(
    (gameState?.parcels ?? [])
      .filter((p) => p.ownerId === player?.id)
      .reduce((sum, p) => sum + (p.ascendAccumulated ?? 0), 0),
  );

  // Claim accumulated ASCEND from owned land (server-authoritative, idempotent).
  const handleClaimAscend = () => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to claim ASCEND.", variant: "destructive" });
      return;
    }
    if (!player) return;
    claimAscendMutation.mutate(player.id, {
      onSuccess: (data: any) => {
        const amt = typeof data?.claimed === "number" ? data.claimed : totalClaimableAscend;
        toast({ title: "ASCEND Claimed", description: `+${Math.floor(amt)} ASCEND added to your balance.` });
      },
      onError: (error) => toast({ title: "Claim Failed", description: (error as Error).message, variant: "destructive" }),
    });
  };

  const [isClaimingCommanderNft, setIsClaimingCommanderNft] = useState(false);
  const [isRetryingCommanderMintId, setIsRetryingCommanderMintId] = useState<string | null>(null);
  const [isRetryingPlotMintId, setIsRetryingPlotMintId] = useState<number | null>(null);
  const [isDeliveringPlotNftId, setIsDeliveringPlotNftId] = useState<number | null>(null);

  // Land NFTs mint server-side as a distinct ASA per plot; Algorand asset
  // transfers are pull-only, so the buyer's wallet must opt in before the
  // admin-custody NFT can be handed over. This mirrors handleClaimCommanderNft's
  // opt-in → retry → deliver pattern for /api/nft/deliver/:plotId.
  const handleDeliverPlotNft = async (plotId: number, assetId: number) => {
    if (!wallet.address) return;
    setIsDeliveringPlotNftId(plotId);
    try {
      const attemptDeliver = async (): Promise<boolean> => {
        const res = await fetch(resolveApiUrl(`/api/nft/deliver/${plotId}`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: wallet.address }),
        });
        const data = await res.json();

        if (data.success) {
          toast({ title: "Land NFT Delivered!", description: `Plot #${plotId} is now in your wallet. TX: ${data.txId?.slice(0, 8)}...` });
          queryClient.invalidateQueries({ queryKey: ["nft-plot", plotId] });
          return true;
        }

        if (data.reason === "not_in_custody") {
          toast({ title: "Already In Your Wallet", description: data.message || "NFT has already been delivered." });
          queryClient.invalidateQueries({ queryKey: ["nft-plot", plotId] });
          return true;
        }

        if (data.reason === "not_opted_in") {
          // Prompt user to opt-in to this plot's ASA first (a real wallet signature).
          const optedIn = await signOptInToPlotNft(data.assetId ?? assetId);
          if (!optedIn) return false;

          // Algorand block time is ~3.3s — retry up to 3 times with 4s gaps
          // to give the opt-in transaction time to be confirmed on-chain.
          for (let attempt = 1; attempt <= 3; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 4000));
            const retryRes = await fetch(resolveApiUrl(`/api/nft/deliver/${plotId}`), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address: wallet.address }),
            });
            const retryData = await retryRes.json();
            if (retryData.success) {
              toast({ title: "Land NFT Delivered!", description: `Plot #${plotId} is now in your wallet. TX: ${retryData.txId?.slice(0, 8)}...` });
              queryClient.invalidateQueries({ queryKey: ["nft-plot", plotId] });
              return true;
            }
            if (retryData.reason !== "not_opted_in") break;
          }
          toast({
            title: "Opt-In Confirmed",
            description: "Your opt-in was approved. Click 'Claim NFT' one more time to complete the transfer.",
          });
          return false;
        }

        toast({ title: "Claim Info", description: data.message || "Unexpected state — try again.", variant: "destructive" });
        return false;
      };

      await attemptDeliver();
    } catch (err) {
      toast({ title: "Claim Failed", description: err instanceof Error ? err.message : "Unexpected error", variant: "destructive" });
    } finally {
      setIsDeliveringPlotNftId(null);
    }
  };

  // Land NFTs mint asynchronously (fire-and-forget) server-side after a
  // purchase confirms, so the ASA doesn't exist yet at the moment the purchase
  // response returns. Poll briefly for it to appear, then immediately run the
  // same claim flow as the manual "Claim NFT" button — so every purchase,
  // even a free (0 ALGO) TestNet one, still prompts a real wallet signature
  // and ends with the NFT actually delivered, instead of silently sitting in
  // admin custody until the player notices the "awaiting claim" banner.
  const pollAndAutoClaimPlotNft = async (plotId: number) => {
    for (let attempt = 1; attempt <= 8; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      try {
        const res = await fetch(resolveApiUrl(`/api/nft/plot/${plotId}`));
        if (res.ok) {
          const data = await res.json();
          if (data?.assetId) {
            await handleDeliverPlotNft(plotId, data.assetId);
            return;
          }
        }
      } catch {
        // Transient network hiccup — keep polling.
      }
    }
    toast({
      title: "NFT Still Minting",
      description: `Plot #${plotId}'s NFT is taking longer than usual — claim it from the Commander tab once it's ready.`,
    });
  };

  const [isClaimingAllPlotNfts, setIsClaimingAllPlotNfts] = useState(false);

  // Claiming N pending plots one at a time means N separate wallet opt-in
  // popups (owner feedback: "why don't you have a queue system for claiming
  // NFTs?"). Algorand can't merge distinct opt-ins into one transaction, but
  // it CAN group them into one atomic group the wallet signs in a SINGLE
  // approval (batchOptInToASAs, chunked at the 16-txn group cap) — so this
  // turns N popups into ceil(N/16). Delivery itself is admin-signed (no
  // wallet needed), so once opted in every plot can be delivered concurrently.
  const handleClaimAllPlotNfts = async (plots: { plotId: number; assetId: number }[]) => {
    if (!wallet.address || plots.length === 0) return;
    setIsClaimingAllPlotNfts(true);
    try {
      await batchOptInToASAs(wallet.address, plots.map(p => p.assetId));
      const results = await Promise.all(
        plots.map(async (p) => {
          const res = await fetch(resolveApiUrl(`/api/nft/deliver/${p.plotId}`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: wallet.address }),
          });
          const data = await res.json();
          return { plotId: p.plotId, ok: !!data.success };
        })
      );
      const delivered = results.filter(r => r.ok).length;
      queryClient.invalidateQueries({ queryKey: ["nft-plot"] });
      if (delivered === plots.length) {
        toast({ title: "All Land NFTs Delivered!", description: `${delivered} plot${delivered === 1 ? "" : "s"} now in your wallet.` });
      } else {
        toast({
          title: "Partially Delivered",
          description: `${delivered}/${plots.length} delivered — retry the rest from the Claim list.`,
          variant: delivered === 0 ? "destructive" : "default",
        });
      }
    } catch (err) {
      toast({
        title: "Batch Claim Failed",
        description: err instanceof Error ? err.message : "Opt-in was cancelled or failed — try again.",
        variant: "destructive",
      });
    } finally {
      setIsClaimingAllPlotNfts(false);
    }
  };

  const handleRetryCommanderMint = async (commanderId: string) => {
    if (!player) return;
    setIsRetryingCommanderMintId(commanderId);
    try {
      // apiRequest attaches the session (Bearer token + credentials); the
      // retry endpoint is session-bound, so a raw fetch would be rejected 401.
      const res = await apiRequest("POST", `/api/nft/retry-commander/${commanderId}`, { playerId: player.id });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Mint Restarted", description: "Your Commander NFT is being minted. The badge will update when it's ready to claim." });
        queryClient.invalidateQueries({ queryKey: ["/api/nft/commander", commanderId] });
      } else if (data.reason === "already_minted") {
        toast({ title: "Already Minted", description: `ASA ${data.assetId} — check your badge to claim.` });
        queryClient.invalidateQueries({ queryKey: ["/api/nft/commander"] });
      } else {
        toast({ title: "Retry Failed", description: data.error || "Could not restart mint.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Retry Failed", description: err instanceof Error ? err.message : "Unexpected error", variant: "destructive" });
    } finally {
      setIsRetryingCommanderMintId(null);
    }
  };

  const handleRetryPlotMint = async (plotId: number) => {
    if (!player) return;
    setIsRetryingPlotMintId(plotId);
    try {
      const res = await apiRequest("POST", `/api/nft/retry-plot/${plotId}`, { playerId: player.id });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Mint Restarted", description: "Your Plot NFT is being minted. The badge will update when it's ready to claim." });
        queryClient.invalidateQueries({ queryKey: ["nft-plot-notification", plotId] });
      } else if (data.reason === "already_minted") {
        toast({ title: "Already Minted", description: `ASA ${data.assetId} — check your badge to claim.` });
        queryClient.invalidateQueries({ queryKey: ["nft-plot-notification", plotId] });
      } else {
        toast({ title: "Retry Failed", description: data.error || "Could not restart mint.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Retry Failed", description: err instanceof Error ? err.message : "Unexpected error", variant: "destructive" });
    } finally {
      setIsRetryingPlotMintId(null);
    }
  };

  const handleMintAvatar = async (tier: CommanderTier) => {
    if (!player) return;

    // Fetch pricing — response now returns ascendCost (primary currency) and
    // algoNetworkFee (unavoidable Algorand tx fee, ~0.001 ALGO, wallet handles automatically).
    let ascendCost = 0;
    try {
      const priceRes = await fetch(resolveApiUrl(`/api/nft/commander-price/${tier}`));
      if (!priceRes.ok) throw new Error("Could not fetch commander price");
      const priceData: { ascendCost: number; algoNetworkFee: number; note: string; economyMode: string } = await priceRes.json();
      ascendCost = priceData.ascendCost;

      toast({
        title: "Minting Commander",
        description: `Cost: ${ascendCost} ASCEND${priceData.economyMode === "testing" ? " (testing price)" : ""}. The Algorand network fee (~${priceData.algoNetworkFee} ALGO) is handled by your wallet automatically.`,
      });
    } catch (fetchErr) {
      toast({
        title: "Price Fetch Failed",
        description: fetchErr instanceof Error ? fetchErr.message : "Could not load commander pricing",
        variant: "destructive",
      });
      return;
    }

    // Step 1: Open wallet for confirmation BEFORE touching the server.
    // This matches the land purchase flow (wallet → confirm → success popup).
    if (!wallet.address) {
      toast({ title: "Wallet Required", description: "Connect your wallet to mint a Commander.", variant: "destructive" });
      return;
    }
    // FREE_PURCHASES (TestNet testing toggle): skip the wallet ALGO payment for
    // the commander mint; the server skips the ALGO + ASCEND charge to match.
    let algoPaymentTxId: string | undefined;
    if (!freePurchases) {
      const txResult = await signCommanderMintAction(tier, ascendCost);
      if (!txResult || txResult === "cancelled") return; // wallet rejected or closed
      if (typeof txResult === "string") algoPaymentTxId = txResult;
    }

    // Step 2: Server creates avatar + fires async NFT mint (ASCEND deducted via clawback).
    mintAvatarMutation.mutate(
      { playerId: player.id, tier, algoPaymentTxId },
      {
        onSuccess: (data: any) => {
          const nft = data.nft;
          if (nft?.assetId) {
            toast({
              title: "Commander Minted + NFT Created!",
              description: `${data.avatar?.name || tier} Commander is ready. ${ascendCost} ASCEND spent. NFT ASA ${nft.assetId} held in custody — open Commander Panel to claim.`,
            });
          } else {
            toast({
              title: "Commander Minted!",
              description: `${data.avatar?.name || tier} — NFT claim coming to bottom-left panel.`,
            });
          }
          // Invalidate the NFT status query so CommanderNftStatus begins polling
          // for the on-chain confirmation (fire-and-forget mint in progress).
          if (data.avatar?.id) {
            queryClient.invalidateQueries({ queryKey: ["/api/nft/commander", data.avatar.id] });
          }
        },
        onError: (error: unknown) => toast({ title: "Mint Failed", description: (error as Error).message, variant: "destructive" }),
      }
    );
  };

  const handleClaimCommanderNft = async (commanderId: string) => {
    if (!wallet.address) return;
    setIsClaimingCommanderNft(true);
    try {
      const attemptCommanderDeliver = async (): Promise<boolean> => {
        const res = await fetch(resolveApiUrl(`/api/nft/deliver-commander/${commanderId}`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: wallet.address }),
        });
        const data = await res.json();

        if (data.success) {
          toast({ title: "Commander NFT Delivered!", description: `Your Commander NFT is now in your wallet. TX: ${data.txId?.slice(0, 8)}...` });
          queryClient.invalidateQueries({ queryKey: ["/api/nft/commander"] });
          return true;
        }

        if (data.reason === "not_in_custody") {
          toast({ title: "Already In Your Wallet", description: data.message || "NFT has already been delivered." });
          queryClient.invalidateQueries({ queryKey: ["/api/nft/commander"] });
          return true;
        }

        if (data.reason === "not_opted_in") {
          // Prompt user to opt-in to the ASA first
          const optedIn = await signOptInToPlotNft(data.assetId);
          if (!optedIn) return false;

          // Algorand block time is ~3.3s — retry up to 3 times with 4s gaps
          // to give the opt-in transaction time to be confirmed on-chain
          for (let attempt = 1; attempt <= 3; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 4000));
            const retryRes = await fetch(resolveApiUrl(`/api/nft/deliver-commander/${commanderId}`), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address: wallet.address }),
            });
            const retryData = await retryRes.json();
            if (retryData.success) {
              toast({ title: "Commander NFT Delivered!", description: `Your Commander NFT is now in your wallet. TX: ${retryData.txId?.slice(0, 8)}...` });
              queryClient.invalidateQueries({ queryKey: ["/api/nft/commander"] });
              return true;
            }
            if (retryData.reason !== "not_opted_in") break;
          }
          // Opt-in confirmed but delivery still pending — badge stays visible for retry
          toast({
            title: "Opt-In Confirmed",
            description: "Your opt-in was approved. Click 'Claim NFT' one more time to complete the transfer.",
          });
          return false;
        }

        toast({ title: "Claim Info", description: data.message || "Unexpected state — try again.", variant: "destructive" });
        return false;
      };

      await attemptCommanderDeliver();
    } catch (err) {
      toast({ title: "Claim Failed", description: err instanceof Error ? err.message : "Unexpected error", variant: "destructive" });
    } finally {
      setIsClaimingCommanderNft(false);
    }
  };

  const handleSpecialAttack = (attackType: SpecialAttackType) => {
    if (!player || !selectedParcelId || !selectedParcel) return;
    specialAttackMutation.mutate(
      { playerId: player.id, attackType, targetParcelId: selectedParcelId },
      {
        onSuccess: (data: any) => {
          queueSpecialAttackAction(selectedParcel.plotId, attackType);
          const result = data.result;
          toast({ title: "Special Attack Launched", description: `${result?.effect || "Attack successful"} - ${result?.damage || 0} damage dealt` });
        },
        onError: (error) => toast({ title: "Attack Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleSwitchCommander = (index: number) => {
    if (!player) return;
    switchCommanderMutation.mutate(
      { playerId: player.id, commanderIndex: index },
      {
        onSuccess: () => {
          queueSwitchCommanderAction(index);
          toast({ title: "Commander Switched", description: "Active commander updated." });
        },
        onError: (error) => toast({ title: "Switch Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleDeployDrone = (targetParcelId?: string) => {
    if (!player) return;
    const targetParcel = targetParcelId
      ? gameState?.parcels.find((p) => p.id === targetParcelId)
      : null;
    deployDroneMutation.mutate(
      { playerId: player.id, targetParcelId },
      {
        onSuccess: () => {
          queueDeployDroneAction(targetParcel?.plotId);
          toast({ title: "Drone Deployed", description: "Recon Drone is now scouting enemy territory." });
        },
        onError: (error) => toast({ title: "Deploy Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleDeploySatellite = () => {
    if (!player) return;
    deploySatelliteMutation.mutate(
      { playerId: player.id },
      {
        onSuccess: () => {
          queueDeploySatelliteAction();
          toast({ title: "Satellite Launched", description: "+25% mining yield on all your territories for 1 hour." });
        },
        onError: (error) => toast({ title: "Launch Failed", description: error.message, variant: "destructive" }),
      }
    );
  };

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab !== "map") setShowFullLandSheet(false);
    if (tab === "map") setSelectedParcelId(selectedParcelId);
  };

  /** Navigate to a parcel on the globe, forcing a camera fly-to and showing a brief transition overlay. */
  const flyToParcelOnMap = (parcelId: string) => {
    setSelectedParcelId(parcelId);
    setFlyRequestId(prev => prev + 1);
    if (activeTab !== "map") {
      setMapTransitioning(true);
      setTimeout(() => setMapTransitioning(false), 600);
    }
    setActiveTab("map");
  };

  const handleParcelSelectFromInventory = (id: string) => {
    flyToParcelOnMap(id);
  };

  const handleLocateTerritory = () => {
    if (!player || !gameState) return;
    const ownedPlots = gameState.parcels.filter(p => p.ownerId === player.id);
    if (ownedPlots.length > 0) {
      let candidates = ownedPlots.filter(p => p.id !== lastLocatedOwnedId.current);
      if (candidates.length === 0) candidates = ownedPlots;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      lastLocatedOwnedId.current = pick.id;
      flyToParcelOnMap(pick.id);
    }
  };

  const handleFindEnemyTarget = () => {
    if (!gameState) return;
    const enemyPlots = gameState.parcels.filter(p => p.ownerId && p.ownerId !== player?.id);
    if (enemyPlots.length > 0) {
      let candidates = enemyPlots.filter(p => p.id !== lastLocatedEnemyId.current);
      if (candidates.length === 0) candidates = enemyPlots;
      const randomEnemy = candidates[Math.floor(Math.random() * candidates.length)];
      lastLocatedEnemyId.current = randomEnemy.id;
      flyToParcelOnMap(randomEnemy.id);
      toast({ title: "Enemy Located", description: `Plot #${randomEnemy.plotId} owned by ${randomEnemy.ownerType === "ai" ? "AI Faction" : "Player"} — tap to attack!` });
    } else {
      toast({ title: "No Enemies Found", description: "No enemy territories detected yet." });
    }
  };

  const handleViewOnGlobe = (parcelId: string) => {
    flyToParcelOnMap(parcelId);
  };

  const playerHasOwnedPlots = player && gameState ? gameState.parcels.some(p => p.ownerId === player.id) : false;

  // Only show the full-screen connection error on the INITIAL load (no data yet).
  // Once gameState is cached, a transient refetch failure (flaky mobile signal,
  // the 30s poll blipping) must NOT blow the whole game away and snap back — that
  // read as the wallet/screen "flashing". Keep rendering the game with last-good
  // state; the next successful refetch recovers silently.
  if (error && !gameState) {
    return (
      <div className="flex items-center justify-center h-screen bg-background" data-testid="game-error">
        <div className="text-center p-8">
          <p className="text-destructive font-display text-xl uppercase tracking-wide">Connection Error</p>
          <p className="text-muted-foreground mt-2">Failed to connect to game server</p>
        </div>
      </div>
    );
  }

  if (showGamerTag && newPlayerId) {
    return (
      <GamerTagModal
        playerId={newPlayerId}
        walletAddress={wallet.address || ""}
        onComplete={(name) => {
          setShowGamerTag(false);
          setNewPlayerId(null);
          queryClient.invalidateQueries({ queryKey: ["/api/game/state"] });
          toast({ title: `Welcome, ${name}!`, description: "Your commander tag has been set." });
        }}
        onSkip={() => {
          setShowGamerTag(false);
          setNewPlayerId(null);
        }}
      />
    );
  }

  if (walletStatus === "restoring") {
    return (
      <div className="flex items-center justify-center h-screen bg-background" data-testid="wallet-restoring">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-display text-lg uppercase tracking-wide text-muted-foreground">Reconnecting Wallet...</p>
        </div>
      </div>
    );
  }

  if (!isConnected && !TEST_GLOBE) {
    // Dev/playtest builds: if no session is active, redirect to the landing page
    // where the auto-login fires and sends the player back into the game as the
    // test commander. Covers the case where someone lands on /game directly
    // (bypassing the landing) or their session was cleared. DEV_MODE=false on
    // mainnet/Cloudflare builds, so this branch never fires there.
    if (DEV_MODE && !devSessionActive()) {
      window.location.replace("/");
      return null;
    }
    return (
      <div className="min-h-screen overflow-y-auto bg-background flex flex-col" data-testid="wallet-gate">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <div className="text-center w-full max-w-sm space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Globe className="w-10 h-10 text-primary" />
              </div>
            </div>
            <h1 className="font-display text-3xl uppercase tracking-wide text-primary">FRONTIER</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Connect your Algorand wallet to enter the game. Compete for 21,000 land plots on a 3D globe, build facilities, and earn ASCEND tokens.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
              <Shield className="w-4 h-4" />
              <span>New players receive 500 ASCEND tokens</span>
            </div>
            <WalletConnect className="w-full" />
            <p className="text-[10px] text-muted-foreground/60">Algorand TestNet | Pera Wallet & LUTE Wallet Supported</p>
          </div>
        </div>
      </div>
    );
  }

  const isMiningParcel = (parcelId: string) => miningParcelIds.has(parcelId);

  const commandCenterProps = {
    player,
    parcels: gameState?.parcels ?? [],
    selectedParcel,
    onSelectParcel: (id: string) => {
      setSelectedParcelId(id);
    },
    onCollectAll: handleCollectAll,
    onMine: handleMine,
    onMineParcel: handleMineParcel,
    isMiningParcel,
    onUpgrade: handleUpgrade,
    onAttack: () => handleRequestAttack(),
    isMining: mineMutation.isPending,
    isUpgrading: upgradeMutation.isPending,
    isCollecting: collectMutation.isPending,
  };

  const mobileMenuContent = (
    <CommandCenterPanel {...commandCenterProps} className="h-full" />
  );

  const showFullscreenPanel = activeTab !== "map";

  // ── Panel registry ──────────────────────────────────────────────────────────
  // Single source of truth for "what panels exist and what they render." Only
  // the flag-gated (off-by-default) dashboard-canvas widget map is built from
  // this today — the desktop rail and mobile fullscreen panel below still have
  // their own hand-written blocks. Migrating those is tracked as a follow-up;
  // this proves the registry shape before touching the two live-by-default
  // rendering paths every player actually uses.
  const dashboardPanelRegistry: { id: string; title: string; content: React.ReactNode }[] = [
    { id: "commandcenter", title: "Command Center", content: <CommandCenterPanel {...commandCenterProps} className="h-full" /> },
    {
      id: "warroom",
      title: "War Room",
      content: gameState ? (
        <WarRoomPanel
          battles={gameState.battles}
          events={gameState.events}
          players={gameState.players}
          onWatchBattle={setWatchingBattleId}
          onViewOnGlobe={handleViewOnGlobe}
          onPlotSelect={setSelectedParcelId}
          onAttackTarget={handleRequestAttack}
          className="h-full border-0 rounded-none overflow-auto"
        />
      ) : null,
    },
    {
      id: "rankings",
      title: "Rankings",
      content: gameState ? (
        <LeaderboardPanel
          entries={gameState.leaderboard}
          currentPlayerId={player?.id || null}
          className="h-full border-0 rounded-none overflow-auto"
        />
      ) : null,
    },
    {
      id: "armory",
      title: "Armory",
      content: player ? (
        <ArmoryPanel playerId={player.id} />
      ) : (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Connect your wallet to access the Armory.
        </div>
      ),
    },
    { id: "university", title: "Academy", content: <UniversityPanel playerId={player?.id} /> },
    {
      id: "commander",
      title: "Commander",
      content: (
        <CommanderPanel
          player={player}
          onMintAvatar={handleMintAvatar}
          onDeployDrone={handleDeployDrone}
          onDeploySatellite={handleDeploySatellite}
          onSwitchCommander={handleSwitchCommander}
          onClaimCommanderNft={handleClaimCommanderNft}
          onDeliverPlotNft={handleDeliverPlotNft}
          isDeliveringPlotNftId={isDeliveringPlotNftId}
          onClaimAllPlotNfts={handleClaimAllPlotNfts}
          isClaimingAllPlotNfts={isClaimingAllPlotNfts}
          onAttack={handleAttackConfirm}
          isMinting={mintAvatarMutation.isPending}
          isDeployingDrone={deployDroneMutation.isPending}
          isDeployingSatellite={deploySatelliteMutation.isPending}
          isClaimingCommanderNft={isClaimingCommanderNft}
          isAttacking={attackMutation.isPending}
          openBattlefrontSignal={attackIntent}
          selectedParcel={selectedParcel}
          ownedParcels={gameState?.parcels.filter(p => p.ownerId === player?.id) ?? []}
          wallet={{ isConnected: wallet.isConnected, address: wallet.address }}
          className="h-full border-0 rounded-none overflow-auto"
        />
      ),
    },
    {
      id: "trade",
      title: "Trade",
      content: (
        <TradeStationPanel
          currentPlayerId={player?.id ?? ""}
          currentPlayerName={player?.name ?? ""}
          className="h-full border-0 rounded-none overflow-hidden"
        />
      ),
    },
    { id: "factions", title: "Factions", content: <FactionPanel player={player} className="h-full border-0 rounded-none overflow-hidden" /> },
    {
      id: "markets",
      title: "Markets",
      content: (
        <ErrorBoundary>
          <PredictionMarketsPanel
            currentPlayerId={player?.id ?? ""}
            currentPlayerAscend={player?.ascend ?? 0}
            className="h-full border-0 rounded-none overflow-hidden"
          />
        </ErrorBoundary>
      ),
    },
  ];
  const dashboardWidgets = Object.fromEntries(
    dashboardPanelRegistry.map(({ id, title, content }) => [id, { title, content }])
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black" data-testid="game-layout">
      {gameState ? (
        <>
          <div className="absolute inset-0 w-full h-full">
            <PlanetGlobe
              parcels={gameState.parcels}
              players={gameState.players}
              currentPlayerId={player?.id || null}
              selectedParcelId={selectedParcelId}
              onParcelSelect={handleParcelSelect}
              onAttack={() => handleRequestAttack()}
              onMine={handleMine}
              onBuild={() => { /* LandSheet handles upgrades — stay on map */ }}
              onPurchase={handlePurchase}
              className="absolute inset-0 w-full h-full"
              battles={gameState.battles}
              livePulses={livePulses}
              orbitalEvents={orbitalEvents}
              replayEvents={replayEvents}
              replayTime={replayTime}
              replayVisibleTypes={replayVisibleTypes}
              streamMode={streamMode}
              flyRequestId={flyRequestId}
              nftInfo={null}
              onDeliverNft={undefined}
              isDeliveringNft={false}
            />
          </div>

          {/* Brief overlay when transitioning from a panel to the map */}
          {mapTransitioning && (
            <div
              className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center pointer-events-none transition-opacity duration-500"
              style={{ animation: "fadeOut 600ms ease-out forwards" }}
            >
              <p className="text-muted-foreground font-display text-sm uppercase tracking-wide">Locating plot...</p>
            </div>
          )}
        </>
      ) : null}

      <div className="absolute top-0 left-0 right-0 z-40">
        <TopBar
          isConnected={isConnected}
          mobileMenuContent={mobileMenuContent}
          playerFactionId={player?.playerFactionId ?? null}
          dashboardOn={dashboardOn}
          onToggleDashboard={toggleDashboard}
          claimableAscend={totalClaimableAscend}
          onClaimAscend={handleClaimAscend}
          isClaimingAscend={claimAscendMutation.isPending}
        />
        {/* Season countdown badge — shown when a season is active */}
        {seasonCountdown && (
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 pointer-events-none select-none flex items-center gap-2 px-3 py-1 rounded-full z-50"
            style={{
              background: "rgba(4,8,20,0.85)",
              border: "1px solid rgba(0,229,255,0.25)",
              backdropFilter: "blur(8px)",
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "rgba(0,229,255,0.8)",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5ff", display: "inline-block", boxShadow: "0 0 6px #00e5ff" }} />
            {seasonName ? `${seasonName.toUpperCase()} · ` : "SEASON · "}
            {seasonCountdown}
          </div>
        )}
      </div>

      {impactEvents.length > 0 && <OrbitalEventToast events={impactEvents} />}


      {/* Morale debuff warning badge */}
      {player?.moraleDebuffUntil && player.moraleDebuffUntil > serverNow() && (
        <div
          className="absolute top-16 right-4 mt-1 z-40 flex items-center gap-1.5 px-3 py-1 rounded-full pointer-events-none select-none"
          style={{
            background: "rgba(20,4,4,0.88)",
            border: "1px solid rgba(255,60,60,0.4)",
            backdropFilter: "blur(8px)",
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.15em",
            color: "rgba(255,100,100,0.9)",
          }}
          data-testid="morale-debuff-badge"
        >
          <AlertTriangle style={{ width: 10, height: 10 }} />
          MORALE LOW · {Math.ceil((player.moraleDebuffUntil - serverNow()) / 60000)}m
          {(player.consecutiveLosses ?? 0) > 1 && (
            <span style={{ color: "rgba(255,60,60,0.7)", marginLeft: 4 }}>
              ×{player.consecutiveLosses} LOSSES
            </span>
          )}
        </div>
      )}

      {/* Attack cooldown warning badge */}
      {player?.attackCooldownUntil && player.attackCooldownUntil > serverNow() && (
        <div
          className="absolute top-16 right-4 mt-8 z-40 flex items-center gap-1.5 px-3 py-1 rounded-full pointer-events-none select-none"
          style={{
            background: "rgba(8,8,20,0.88)",
            border: "1px solid rgba(255,165,0,0.4)",
            backdropFilter: "blur(8px)",
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.15em",
            color: "rgba(255,180,80,0.9)",
          }}
          data-testid="attack-cooldown-badge"
        >
          <Clock style={{ width: 10, height: 10 }} />
          ATK COOLDOWN · {Math.ceil((player.attackCooldownUntil - serverNow()) / 60000)}m
        </div>
      )}

      {isConnected && ascendAsaId && isOptedInToAscend === false && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30" data-testid="opt-in-banner">
          <Button
            onClick={signOptInToAscend}
            className="gap-2 font-display uppercase tracking-wide text-xs animate-pulse"
            data-testid="button-opt-in-frontier"
          >
            <Coins className="w-4 h-4" />
            Opt-In to ASCEND Token (ASA #{ascendAsaId})
          </Button>
        </div>
      )}


      {!dashboardOn && (
      <aside className="hidden md:flex flex-col w-60 lg:w-72 absolute top-16 left-0 bottom-0 z-30 backdrop-blur-md bg-background/70 border-r border-border overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <CommandCenterPanel {...commandCenterProps} className="h-full" />
        )}
      </aside>
      )}

      {!dashboardOn && (
      <aside
        className="hidden md:flex flex-col w-60 lg:w-72 absolute top-16 right-0 bottom-0 z-30 backdrop-blur-md bg-background/70 border-l border-border overflow-hidden"
        style={{ "--right-menu-width": "18rem" } as React.CSSProperties}
      >
        <div
          className="grid border-b border-border shrink-0"
          style={{ gridTemplateColumns: "repeat(5, 1fr)", gap: 1 }}
        >
          {(
            [
              { id: "battles",     icon: Swords,          label: "War"      },
              { id: "armory",      icon: Crosshair,       label: "Armory"   },
              { id: "university",  icon: GraduationCap,   label: "Academy"  },
              { id: "commander",   icon: Shield,          label: "Commander"},
              { id: "inventory",   icon: Package,         label: "Inventory"},
              { id: "leaderboard", icon: Trophy,          label: "Rankings" },
              { id: "trade",       icon: ArrowLeftRight,  label: "Trade"    },
              { id: "factions",    icon: Flag,            label: "Factions" },
              { id: "markets",     icon: Coins,           label: "Markets"  },
              { id: "economics",   icon: BarChart3,       label: "Economy" },
              { id: "intel",       icon: Radar,            label: "Intel"    },
            ] as const satisfies readonly { id: RailTab; icon: React.ElementType; label: string }[]
          ).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              title={label}
              aria-label={label}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 px-0.5 min-w-0 transition-colors border-b-2",
                desktopRightTab === id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[8px] font-display uppercase tracking-wide leading-none truncate max-w-full">{label}</span>
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : desktopRightTab === "armory" ? (
          <div className="flex-1 overflow-y-auto">
            {player ? (
              <ArmoryPanel playerId={player.id} />
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                Connect your wallet to access the Armory.
              </div>
            )}
          </div>
        ) : desktopRightTab === "university" ? (
          <div className="flex-1 overflow-y-auto">
            <UniversityPanel playerId={player?.id} />
          </div>
        ) : desktopRightTab === "trade" ? (
          <TradeStationPanel
            currentPlayerId={player?.id ?? ""}
            currentPlayerName={player?.name ?? ""}
            className="flex-1 border-0 rounded-none overflow-hidden"
          />
        ) : desktopRightTab === "factions" ? (
          <FactionPanel
            player={player}
            className="flex-1 border-0 rounded-none overflow-hidden"
          />
        ) : desktopRightTab === "markets" ? (
          <PredictionMarketsPanel
            currentPlayerId={player?.id ?? ""}
            currentPlayerAscend={player?.ascend ?? 0}
            className="flex-1 border-0 rounded-none overflow-hidden"
          />
        ) : desktopRightTab === "commander" ? (
          <CommanderPanel
            player={player}
            onMintAvatar={handleMintAvatar}
            onDeployDrone={handleDeployDrone}
            onDeploySatellite={handleDeploySatellite}
            onSwitchCommander={handleSwitchCommander}
            onClaimCommanderNft={handleClaimCommanderNft}
          onDeliverPlotNft={handleDeliverPlotNft}
          isDeliveringPlotNftId={isDeliveringPlotNftId}
          onClaimAllPlotNfts={handleClaimAllPlotNfts}
          isClaimingAllPlotNfts={isClaimingAllPlotNfts}
            onAttack={handleAttackConfirm}
            isMinting={mintAvatarMutation.isPending}
            isDeployingDrone={deployDroneMutation.isPending}
            isDeployingSatellite={deploySatelliteMutation.isPending}
            isClaimingCommanderNft={isClaimingCommanderNft}
            isAttacking={attackMutation.isPending}
            openBattlefrontSignal={attackIntent}
            selectedParcel={selectedParcel}
            ownedParcels={gameState?.parcels.filter(p => p.ownerId === player?.id) ?? []}
            wallet={{ isConnected: wallet.isConnected, address: wallet.address }}
            className="flex-1 border-0 rounded-none overflow-auto"
          />
        ) : desktopRightTab === "inventory" && gameState ? (
          <InventoryPanel
            player={player}
            parcels={gameState.parcels}
            onCollectAll={handleCollectAll}
            onSelectParcel={handleParcelSelectFromInventory}
            onMineParcel={handleMineParcel}
            isMiningParcel={isMiningParcel}
            isCollecting={collectMutation.isPending}
            onOpenLootBox={handleOpenLootBox}
            openingLootBoxId={openingLootBoxId}
          />
        ) : desktopRightTab === "economics" ? (
          <EconomicsPanel className="flex-1 border-0 rounded-none overflow-auto" />
        ) : desktopRightTab === "intel" ? (
          <div className="flex-1 overflow-y-auto">
            <WorldIntelPanel className="h-full" onReplayStateChange={handleReplayStateChange} />
          </div>
        ) : gameState ? (
          desktopRightTab === "battles" ? (
            <WarRoomPanel
              battles={gameState.battles}
              events={gameState.events}
              players={gameState.players}
              onWatchBattle={setWatchingBattleId}
              onViewOnGlobe={handleViewOnGlobe}
              onPlotSelect={setSelectedParcelId}
              onAttackTarget={handleRequestAttack}
              className="flex-1 border-0 rounded-none overflow-auto"
            />
          ) : (
            <LeaderboardPanel
              entries={gameState.leaderboard}
              currentPlayerId={player?.id || null}
              className="flex-1 border-0 rounded-none overflow-auto"
            />
          )
        ) : null}
      </aside>
      )}

      {/* Draggable snap-grid dashboard — desktop, flag-gated. Hosts the same
          panels as the rails, but movable. Default off → rails render as before. */}
      {dashboardOn && !isLoading && (
        <div className="hidden md:block absolute top-16 left-0 right-0 bottom-0 z-30" data-testid="dashboard-canvas-region">
          <DashboardCanvas
            controller={dashboard}
            className="relative w-full h-full"
            widgets={dashboardWidgets}
          />
        </div>
      )}

      {showFullscreenPanel && (
        <div className="md:hidden absolute inset-0 z-30 bg-background pt-16 pb-16 overflow-hidden" data-testid="fullscreen-panel">
          {activeTab === "inventory" && gameState && (
            <InventoryPanel
              player={player}
              parcels={gameState.parcels}
              onCollectAll={handleCollectAll}
              onSelectParcel={handleParcelSelectFromInventory}
              onMineParcel={handleMineParcel}
              isMiningParcel={isMiningParcel}
              isCollecting={collectMutation.isPending}
              onOpenLootBox={handleOpenLootBox}
              openingLootBoxId={openingLootBoxId}
            />
          )}
          {activeTab === "battles" && gameState && (
            <BattlesPanel
              battles={gameState.battles}
              events={gameState.events}
              players={gameState.players}
              onWatchBattle={setWatchingBattleId}
              onViewOnGlobe={handleViewOnGlobe}
            />
          )}
          {activeTab === "armory" && (
            <div className="h-full overflow-y-auto">
              {player ? (
                <ArmoryPanel playerId={player.id} />
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  Connect your wallet to access the Armory.
                </div>
              )}
            </div>
          )}
          {activeTab === "commander" && gameState && (
            <CommanderPanel
              player={player}
              onMintAvatar={handleMintAvatar}
              onDeployDrone={handleDeployDrone}
              onDeploySatellite={handleDeploySatellite}
              onSwitchCommander={handleSwitchCommander}
              onClaimCommanderNft={handleClaimCommanderNft}
          onDeliverPlotNft={handleDeliverPlotNft}
          isDeliveringPlotNftId={isDeliveringPlotNftId}
          onClaimAllPlotNfts={handleClaimAllPlotNfts}
          isClaimingAllPlotNfts={isClaimingAllPlotNfts}
              onAttack={handleAttackConfirm}
              isMinting={mintAvatarMutation.isPending}
              isDeployingDrone={deployDroneMutation.isPending}
              isDeployingSatellite={deploySatelliteMutation.isPending}
              isClaimingCommanderNft={isClaimingCommanderNft}
              isAttacking={attackMutation.isPending}
              openBattlefrontSignal={attackIntent}
              selectedParcel={selectedParcel}
              ownedParcels={gameState.parcels.filter(p => p.ownerId === player?.id)}
              wallet={{ isConnected: wallet.isConnected, address: wallet.address }}
            />
          )}
          {activeTab === "leaderboard" && gameState && (
            <LeaderboardPanel
              entries={gameState.leaderboard}
              currentPlayerId={player?.id || null}
            />
          )}
          {activeTab === "university" && (
            <div className="h-full overflow-y-auto">
              <UniversityPanel playerId={player?.id} />
            </div>
          )}
          {activeTab === "economics" && (
            <EconomicsPanel className="h-full" />
          )}
          {activeTab === "trade" && (
            <TradeStationPanel
              currentPlayerId={player?.id ?? ""}
              currentPlayerName={player?.name ?? ""}
              className="h-full"
            />
          )}
          {activeTab === "factions" && (
            <FactionPanel
              player={player}
              className="h-full"
            />
          )}
          {activeTab === "markets" && (
            <PredictionMarketsPanel
              currentPlayerId={player?.id ?? ""}
              currentPlayerAscend={player?.ascend ?? 0}
              className="h-full"
            />
          )}
          <div
            className={activeTab === "intel" ? "h-full" : "hidden"}
            style={{ display: activeTab === "intel" ? undefined : "none" }}
          >
            <WorldIntelPanel
              className="h-full"
              onReplayStateChange={handleReplayStateChange}
            />
          </div>
        </div>
      )}

      {/* ── Plot Action Surface ─────────────────────────────────────────────────
           Shown for ANY selected plot (mobile + desktop). Real parcel data + the
           live claim CTA (no mock/demo values). SelectedPlotPanel portals to body
           with its own stacking context and clamps clear of the right rail, so it
           can never sit behind a menu.
           Mobile → MobilePlotSheet (above BottomNav). Desktop → floating card.
           The full LandSheet opens separately when the player taps "Manage Plot".
      ────────────────────────────────────────────────────────────────────────── */}
      {/* Was mobile-gated on the theory that the globe's PLOT #N popup
          (ParcelHUD) would be the mobile entry point instead — but ParcelHUD's
          "Develop" action was never wired up (a no-op), so mobile had NO
          working plot-action surface at all. SelectedPlotPanel already
          delegates to MobilePlotSheet internally on mobile (see its own
          isMobile switch), so enabling it here is what actually makes the
          mobile terminal-readout and LandSheet fixes (above) reachable. */}
      {activeTab === "map" && selectedParcel && (
        <SelectedPlotPanel
          parcel={selectedParcel}
          player={player}
          isOpen={!showFullLandSheet}
          onClaim={handlePurchase}
          isClaiming={purchaseMutation.isPending}
          isWalletConnected={isWalletConnected}
          onOpenFullSheet={() => setShowFullLandSheet(true)}
          onClose={() => setSelectedParcelId(null)}
        />
      )}

      {/* ── Full LandSheet — plot management (mine/upgrade/build/attack) ─────
          Was desktop-only ("!isMobile" gate) — the layout itself is already
          responsive (fixed bottom-0 left-0 right-0 on mobile, same pattern
          as MobilePlotSheet), it was just never enabled on mobile. Owner:
          "there's like a whole secondary menu that doesn't exist on mobile." */}
      {activeTab === "map" && selectedParcel && showFullLandSheet && (
        <LandSheet
          parcel={selectedParcel}
          player={player}
          onMine={handleMine}
          onUpgrade={handleUpgrade}
          onAttack={() => handleRequestAttack()}
          onBuild={handleBuild}
          onPurchase={handlePurchase}
          onSpecialAttack={handleSpecialAttack}
          onClose={() => {
            setShowFullLandSheet(false);
            setSelectedParcelId(null);
          }}
          onNavigateToPlot={selectedParcel ? () => flyToParcelOnMap(selectedParcel.id) : undefined}
          isMining={mineMutation.isPending}
          isUpgrading={upgradeMutation.isPending}
          isBuilding={buildMutation.isPending}
          isPurchasing={purchaseMutation.isPending}
          isWalletConnected={isWalletConnected}
          isSpecialAttacking={specialAttackMutation.isPending}
          nftInfo={null}
          onDeliverNft={undefined}
          isDeliveringNft={false}
        />
      )}

      <HudShell activeTab={activeTab} onTabChange={handleTabChange} battleCount={activeBattleCount} />

      <ErrorBoundary>
        <BattleWatchModal
          open={!!watchingBattleId}
          onOpenChange={(o) => { if (!o) setWatchingBattleId(null); }}
          battle={watchingBattleId ? (gameState?.battles.find((b) => b.id === watchingBattleId) ?? null) : null}
          players={gameState?.players ?? []}
          targetParcel={
            watchingBattleId && gameState
              ? (gameState.parcels.find(
                  (p) => p.id === gameState.battles.find((b) => b.id === watchingBattleId)?.targetParcelId
                ) ?? null)
              : null
          }
          sourceParcel={
            watchingBattleId && gameState
              ? (gameState.parcels.find(
                  (p) => p.id === gameState.battles.find((b) => b.id === watchingBattleId)?.sourceParcelId
                ) ?? null)
              : null
          }
        />
      </ErrorBoundary>

      {/* Comm Terminal — purchasable whisper widget; self-hides for non-owners */}
      <CommTerminal playerId={player?.id} />

      {/* Stream overlay — rendered only when ?stream=1 is in the URL */}
      {streamMode && (
        <StreamOverlay
          gameState={gameState ?? null}
          seasonCountdown={seasonCountdown}
          seasonName={seasonName ?? null}
        />
      )}

      {/* Live Activity Feed overlay — streams world events in real-time */}
      <ActivityFeed />

      {/* NFT claim notifications — floating cards for minted/failed NFTs */}
      {player && (
        <ErrorBoundary>
          <NftClaimNotification
            commanders={player.commanders ?? []}
            ownedParcels={(gameState?.parcels ?? []).filter(p => player.ownedParcels?.includes(p.id))}
            walletAddress={wallet?.address ?? null}
            walletConnected={wallet?.isConnected ?? false}
            playerId={player.id}
            onClaimCommander={handleClaimCommanderNft}
            onRetryCommanderMint={handleRetryCommanderMint}
            onDeliverPlotNft={handleDeliverPlotNft}
            onRetryPlotMint={handleRetryPlotMint}
            isClaimingCommander={isClaimingCommanderNft}
            isRetryingCommanderMint={isRetryingCommanderMintId}
            isDeliveringPlotId={isDeliveringPlotNftId}
            isRetryingPlotMint={isRetryingPlotMintId}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
