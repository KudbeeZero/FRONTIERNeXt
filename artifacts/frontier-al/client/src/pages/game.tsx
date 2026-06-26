import { GameLayout } from "@/components/game/GameLayout";
import { FactionSelectGate } from "@/components/game/FactionSelectGate";

export default function GamePage() {
  return (
    <>
      {/* Fun, fund-free entry gate: pick your faction (+ optional waitlist), then
          drop into the game. Page-level overlay — does not touch the globe/combat
          canvas. Shows once, then remembers your pick. */}
      <FactionSelectGate />
      <GameLayout />
    </>
  );
}
