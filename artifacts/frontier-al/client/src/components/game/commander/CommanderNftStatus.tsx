import { useQuery } from "@tanstack/react-query";
import { Gift, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function CommanderNftStatus({ commanderId, onClaim, isClaiming, walletConnected }: {
  commanderId: string; onClaim?: (id: string) => void; isClaiming?: boolean; walletConnected?: boolean;
}) {
  const { data, isLoading } = useQuery<{ exists: boolean; status?: string; assetId?: number | null }>({
    queryKey: ["/api/nft/commander", commanderId],
    queryFn: async () => {
      const res = await fetch(`/api/nft/commander/${commanderId}`);
      if (!res.ok) return { exists: false };
      return res.json();
    },
    staleTime: 5_000,
    retry: false,
    // Poll every 4s while minting is in-flight or NFT not yet found; stop once confirmed
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d?.exists || d?.status === "minting") return 4_000;
      return false;
    },
  });
  if (isLoading) return <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1"><Loader2 className="w-2.5 h-2.5 animate-spin" /><span>NFT…</span></div>;
  if (!data?.exists) return null;
  const isMinting  = data.status === "minting";
  const delivered  = data.status === "delivered";
  const inCustody  = data.status === "minted";
  return (
    <div className="mt-1 flex flex-col gap-1">
      {isMinting ? (
        <Badge variant="outline" className="text-[8px] text-blue-400 border-blue-500/30 gap-1 w-fit"><Loader2 className="w-2 h-2 animate-spin" />Minting NFT…</Badge>
      ) : delivered ? (
        <Badge className="text-[8px] bg-green-500/20 text-green-400 border-green-500/30 gap-1 w-fit"><Gift className="w-2 h-2" />NFT in Wallet</Badge>
      ) : inCustody ? (
        <>
          <Badge variant="outline" className="text-[8px] text-yellow-400 border-yellow-500/30 gap-1 w-fit"><Gift className="w-2 h-2" />NFT Ready · ASA {data.assetId}</Badge>
          {walletConnected && onClaim ? (
            <Button
              size="sm"
              variant="outline"
              className="text-[9px] h-6 px-2 border-yellow-500/60 text-yellow-300 bg-yellow-500/10 hover:bg-yellow-500/20 w-full font-semibold"
              onClick={() => onClaim(commanderId)}
              disabled={isClaiming}
            >
              {isClaiming ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Gift className="w-3 h-3 mr-1" />}
              {isClaiming ? "Claiming…" : "Claim NFT to Wallet"}
            </Button>
          ) : !walletConnected ? (
            <p className="text-[8px] text-yellow-400/70">Connect wallet to claim</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
