import { useGameStore } from "../store/gameStore";
import type { ShipSystems } from "../store/types";
import { boardForStage } from "../data/circuits";

// ---------------------------------------------------------------------------
// Top-left ship status panel: the four load-bearing subsystems + the journey
// progress toward Mars. Bars are colour-graded by health so a glance tells you
// the ship is wounded — Aether Stability starts critically low.
// ---------------------------------------------------------------------------

const LABELS: Record<keyof ShipSystems, string> = {
  power: "POWER",
  navigation: "NAVIGATION",
  lifeSupport: "LIFE SUPPORT",
  aetherStability: "AETHER STABILITY",
};

function gradeColor(v: number): string {
  if (v < 30) return "#ff5a5a";
  if (v < 60) return "#ffb347";
  return "#7fe7ff";
}

function Bar({ label, value }: { label: string; value: number }) {
  const color = gradeColor(value);
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
        <span className="text-[#9fb4c9]">{label}</span>
        <span style={{ color }}>{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0c1826]">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.max(2, value)}%`,
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>
    </div>
  );
}

export function StatusHUD() {
  const systems = useGameStore((s) => s.systems);
  const journeyProgress = useGameStore((s) => s.journeyProgress);
  const phase = useGameStore((s) => s.phase);
  const navStage = useGameStore((s) => s.navStage);
  const navFuel = useGameStore((s) => s.navFuel);
  // During the nav-circuit reroute, show the drift buffer (shorts erode it).
  const driftPct =
    phase === "rewiring" ? (navFuel / boardForStage(navStage).fuelBudget) * 100 : null;

  return (
    <div className="holo-panel pointer-events-none absolute left-4 top-4 z-30 w-60 rounded-md px-4 py-3.5 sm:w-72">
      <span className="holo-corner left-0 top-0 border-b-0 border-r-0" />
      <span className="holo-corner right-0 top-0 border-b-0 border-l-0" />

      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-sm font-semibold uppercase tracking-[0.25em] text-aether-core text-glow">
          Aether Voyager
        </span>
        <span className="animate-breathe font-mono text-[9px] uppercase tracking-widest text-[#7fe7ff]">
          ● live
        </span>
      </div>

      {(Object.keys(LABELS) as (keyof ShipSystems)[]).map((k) => (
        <Bar key={k} label={LABELS[k]} value={systems[k]} />
      ))}

      {driftPct !== null && (
        <div className="mt-3 border-t border-[#1c3147] pt-2.5">
          <Bar label={`NAV DRIFT BUFFER · STAGE ${navStage}`} value={driftPct} />
        </div>
      )}

      <div className="mt-3 border-t border-[#1c3147] pt-2.5">
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
          <span className="text-[#9fb4c9]">Earth ▸ Mars</span>
          <span className="text-[#ffd9a0]">{Math.round(journeyProgress * 100)}%</span>
        </div>
        <div className="relative h-1 w-full rounded-full bg-[#0c1826]">
          <div
            className="h-full rounded-full bg-[#ffd9a0] transition-all duration-1000"
            style={{ width: `${journeyProgress * 100}%`, boxShadow: "0 0 8px #ffd9a0" }}
          />
          <div
            className="absolute -top-[3px] h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-white"
            style={{ left: `${journeyProgress * 100}%`, boxShadow: "0 0 8px #fff" }}
          />
        </div>
      </div>
    </div>
  );
}
