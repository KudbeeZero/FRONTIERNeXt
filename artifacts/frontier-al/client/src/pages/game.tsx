import { GameLayout } from "@/components/game/GameLayout";
import { FactionSelectGate } from "@/components/game/FactionSelectGate";
import { ObjectiveHud } from "@/components/game/ObjectiveHud";

export default function GamePage() {
  return (
    <>
      {/* Fun, fund-free entry gate: pick your faction (+ optional waitlist), then
          drop into the game. Page-level overlay — does not touch the globe/combat
          canvas. Shows once, then remembers your pick. */}
      <FactionSelectGate />
      <GameLayout />
      {/* Live AI Battle Test objective — top-center, pointer-events:none, so it
          overlays without intercepting input or touching the canvas. */}
      <ObjectiveHud />
    </>
  );
}
