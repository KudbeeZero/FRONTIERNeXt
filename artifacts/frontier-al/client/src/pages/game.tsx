import { GameLayout } from "@/components/game/GameLayout";
import { IntroCinematic } from "@/components/game/IntroCinematic";
import { FactionSelectGate } from "@/components/game/FactionSelectGate";
import { ObjectiveHud } from "@/components/game/ObjectiveHud";

export default function GamePage() {
  return (
    <>
      {/* Entry cinematic (replaces the old launch counter) → faction-select gate →
          game. All three are page-level overlays; none touch the globe/combat
          canvas. The cinematic and gate each show once and remember. */}
      <IntroCinematic />
      <FactionSelectGate />
      <GameLayout />
      {/* Live AI Battle Test objective — top-center, pointer-events:none, so it
          overlays without intercepting input or touching the canvas. */}
      <ObjectiveHud />
    </>
  );
}
