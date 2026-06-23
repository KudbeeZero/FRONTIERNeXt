import { useGameStore } from "../store/gameStore";
import type { Phase } from "../store/types";

// ---------------------------------------------------------------------------
// Top-right objective panel — always tells the player the one thing to do next.
// ---------------------------------------------------------------------------

const OBJECTIVE: Record<Exclude<Phase, "idle">, { title: string; detail: string }> = {
  waking: {
    title: "ORIENT YOURSELF",
    detail: "Listen to Aether. Look around the cabin (drag to look).",
  },
  diagnostic: {
    title: "DIAGNOSE AETHER",
    detail: "Run the neural matrix diagnostic to isolate the fault.",
  },
  repair: {
    title: "REALIGN NEURAL NODES",
    detail: "Press & hold each desynced node until it locks into phase.",
  },
  stabilized: {
    title: "COURSE LOCKED",
    detail: "Aether is stable. Resume the journey to Mars.",
  },
  approach: {
    title: "BRACE FOR THE FIELD",
    detail: "The nav computer is blind. Get to the core with Aether.",
  },
  rewiring: {
    title: "REROUTE THE NAV CORE",
    detail: "Wire both boards to restore the trajectory. Avoid burned traces — shorts cost drift.",
  },
  transit: {
    title: "THREAD THE FIELD",
    detail: "Hold steady as Aether flies the restored course.",
  },
  mutiny: {
    title: "TAKE THE POWER BUS",
    detail: "VESTA is clamping power from Aether. Step in and arbitrate the bus.",
  },
  triage: {
    title: "TRIAGE THE POWER",
    detail: "Allocate the bus across life-support, comms, and Aether's core. You can't keep all three whole.",
  },
  aftermath: {
    title: "LIVE WITH THE CHOICE",
    detail: "The bus is set. See what it cost — and what it kept.",
  },
  blackout: {
    title: "FIND THE SIGNAL",
    detail: "Comms are blind in Mars's shadow. A beacon is out there — go read it.",
  },
  decode: {
    title: "DECODE THE BEACON",
    detail: "Probe the code; the beacon tells you how close. Trust Aether's read, or work it yourself.",
  },
  fix: {
    title: "POSITION FIXED",
    detail: "The beacon is decoded. Steady on for the descent.",
  },
  descent: {
    title: "FLY THE DESCENT",
    detail: "Manual insertion — clear each stage before its window closes. Miss one and you retry it.",
  },
  arrival: {
    title: "TOUCHDOWN",
    detail: "You're down. See how the journey resolved.",
  },
};

export function ObjectiveTracker() {
  const phase = useGameStore((s) => s.phase);
  const nodesAligned = useGameStore((s) => s.nodesAligned);
  const totalNodes = useGameStore((s) => s.totalNodes);
  if (phase === "idle") return null;

  const obj = OBJECTIVE[phase];

  return (
    <div className="holo-panel pointer-events-none absolute right-4 top-4 z-30 w-60 rounded-md px-4 py-3.5 sm:w-72">
      <span className="holo-corner left-0 top-0 border-b-0 border-r-0" />
      <span className="holo-corner right-0 top-0 border-b-0 border-l-0" />

      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#ffd9a0]">
        ◇ Objective
      </div>
      <div className="font-display text-base font-semibold uppercase tracking-wider text-[#e7f4ff] text-glow">
        {obj.title}
      </div>
      <p className="mt-1 text-sm leading-snug text-[#9fb4c9]">{obj.detail}</p>

      {phase === "repair" && (
        <div className="mt-2 font-mono text-xs uppercase tracking-widest text-aether-core">
          nodes locked: {nodesAligned}/{totalNodes}
        </div>
      )}
    </div>
  );
}
