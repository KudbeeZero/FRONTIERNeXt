import { useState, useEffect, useMemo } from "react";
import { BattlePlanner } from "@/components/game/BattlePlanner";
import { useGameState, useAttack, useCurrentPlayer } from "@/hooks/useGameState";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/use-toast";
import { readDraft, writeDraft, clearDraft } from "@/hooks/usePlannerDraft";
import { serverNow } from "@/lib/serverClock";
import { safeUuid } from "@/lib/safeUuid";
import type { Player, LandParcel, Battle } from "@shared/schema";

export default function BattlePlannerPage() {
  const { data: gameState, isLoading: gameLoading } = useGameState();
  const player = useCurrentPlayer();
  const attackMutation = useAttack();
  const { isConnected } = useWallet();
  const { toast } = useToast();

  const [sourceParcelId, setSourceParcelId] = useState<string | null>(null);
  const [troops, setTroops] = useState(1);
  const [extraIron, setExtraIron] = useState(0);
  const [extraFuel, setExtraFuel] = useState(0);
  const [extraCrystal, setExtraCrystal] = useState(0);
  const [isAttacking, setIsAttacking] = useState(false);

  const allParcels: LandParcel[] = gameState?.parcels ?? [];
  const ownedParcels: LandParcel[] = useMemo(
    () => allParcels.filter((p) => p.ownerId === player?.id),
    [allParcels, player?.id],
  );
  const battles: Battle[] = gameState?.battles ?? [];

  useEffect(() => {
    if (!sourceParcelId && ownedParcels.length > 0) {
      setSourceParcelId(ownedParcels[0].id);
    }
  }, [sourceParcelId, ownedParcels]);

  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      if (draft.plannerSourceParcelId) setSourceParcelId(draft.plannerSourceParcelId);
      if (draft.selectedCommanderId) {
        const cmd = player?.commanders?.find((c) => c.id === draft.selectedCommanderId);
        if (cmd) {
          setTroops(1);
        }
      }
    }
  }, [readDraft, player]);

  const selectedParcel: LandParcel | null = useMemo(
    () => allParcels.find((p) => p.id === sourceParcelId) ?? null,
    [allParcels, sourceParcelId],
  );

  const handleAttack = async (
    attackTroops: number,
    iron: number,
    fuel: number,
    crystal: number,
    commanderId?: string,
    sourceId?: string,
  ) => {
    if (!isConnected) {
      toast({ title: "Authorization Required", description: "Connect your wallet to perform game actions.", variant: "destructive" });
      return;
    }
    if (!player || !selectedParcel) return;

    setIsAttacking(true);
    const idempotencyKey = safeUuid();

    attackMutation.mutate(
      {
        attackerId: player.id,
        targetParcelId: selectedParcel.id,
        troopsCommitted: attackTroops,
        resourcesBurned: { iron, fuel },
        crystalBurned: crystal,
        commanderId,
        sourceParcelId: sourceId,
        idempotencyKey,
      },
      {
        onSuccess: () => {
          toast({ title: "Attack Deployed", description: "Battle will resolve in 10 minutes." });
          clearDraft();
        },
        onError: (error: any) => {
          toast({ title: "Attack Failed", description: error?.message ?? "Unknown error", variant: "destructive" });
        },
        onSettled: () => setIsAttacking(false),
      },
    );
  };

  const handleTroopsChange = (n: number) => {
    setTroops(n);
    const draft = readDraft();
    writeDraft({ ...draft, selectedCommanderId: draft?.selectedCommanderId ?? null, selectedParcelId: selectedParcel?.id ?? null, plannerSourceParcelId: sourceParcelId });
  };

  if (gameLoading || !player) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-400 text-xs">
        {gameLoading ? "Loading battle planner…" : "Connect your wallet to access the battle planner."}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <BattlePlanner
        player={player}
        allParcels={allParcels}
        ownedParcels={ownedParcels}
        selectedParcel={selectedParcel}
        onSelectTarget={(id) => {
          const p = allParcels.find((p) => p.id === id);
          if (p) {
            setSourceParcelId(ownedParcels[0]?.id ?? null);
            const draft = readDraft();
            writeDraft({ ...draft, selectedParcelId: id, plannerSourceParcelId: ownedParcels[0]?.id ?? null, selectedCommanderId: draft?.selectedCommanderId ?? null });
          }
        }}
        sourceParcelId={sourceParcelId}
        onSourceParcelChange={(id) => {
          setSourceParcelId(id);
          const draft = readDraft();
          writeDraft({ ...draft, plannerSourceParcelId: id, selectedParcelId: selectedParcel?.id ?? null, selectedCommanderId: draft?.selectedCommanderId ?? null });
        }}
        troops={troops}
        onTroopsChange={handleTroopsChange}
        extraIron={extraIron}
        onExtraIronChange={setExtraIron}
        extraFuel={extraFuel}
        onExtraFuelChange={setExtraFuel}
        extraCrystal={extraCrystal}
        onExtraCrystalChange={setExtraCrystal}
        battles={battles}
        onAttack={handleAttack}
        isAttacking={isAttacking}
      />
    </div>
  );
}
