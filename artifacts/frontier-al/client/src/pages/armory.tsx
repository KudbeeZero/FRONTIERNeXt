/**
 * client/src/pages/armory.tsx
 *
 * Authenticated Armory route. Resolves the current player from the connected
 * wallet (same hooks GameLayout uses) and renders the Armory panel against the
 * live /api/weapons/* API.
 */

import { Link } from "wouter";
import { useWallet } from "@/hooks/useWallet";
import { useCurrentPlayer } from "@/hooks/useGameState";
import { ArmoryPanel } from "@/components/game/armory/ArmoryPanel";

export default function ArmoryPage() {
  const wallet = useWallet();
  const player = useCurrentPlayer(wallet.address);

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <span className="text-sm font-bold tracking-widest text-cyan-300">FRONTIER · ARMORY</span>
        <Link href="/game" className="text-xs text-slate-400 hover:text-slate-200">← Back to globe</Link>
      </header>
      {player ? (
        <ArmoryPanel playerId={player.id} />
      ) : (
        <div className="mx-auto max-w-3xl p-8 text-center text-slate-400">
          Connect your wallet on the <Link href="/game" className="text-cyan-400 underline">game</Link> screen to access the Armory.
        </div>
      )}
    </div>
  );
}
