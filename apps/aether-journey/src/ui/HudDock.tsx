import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { audio } from "../lib/audioEngine";
import type { Phase, ShipSystems } from "../store/types";
import { boardForStage } from "../data/circuits";
import { SettingsToggles } from "./MenuLayer";

// ---------------------------------------------------------------------------
// HudDock — the single, mobile-first HUD.
//
// One slim bar pinned to the bottom shows the current objective and three tabs
// (Ship / Ledger / System). Each opens a smooth collapsible bottom sheet that
// covers only the lower portion of the screen, so the centered in-world boards
// and the cockpit stay fully tappable. This replaces the old scattered overlays
// (StatusHUD, ObjectiveTracker, OnchainLedger, the ☰ pause menu) that fought for
// the corners and made the game unplayable on a phone.
// ---------------------------------------------------------------------------

type Tab = "ship" | "ledger" | "system";

const OBJECTIVE: Record<Exclude<Phase, "idle">, { title: string; detail: string }> = {
  waking: { title: "ORIENT YOURSELF", detail: "Listen to Aether. Drag to look around the cabin." },
  diagnostic: { title: "DIAGNOSE AETHER", detail: "Run the neural matrix diagnostic to isolate the fault." },
  repair: { title: "REALIGN NEURAL NODES", detail: "Press & hold each desynced node until it locks into phase." },
  stabilized: { title: "COURSE LOCKED", detail: "Aether is stable. Resume the journey to Mars." },
  approach: { title: "BRACE FOR THE FIELD", detail: "The nav computer is blind. Get to the core with Aether." },
  rewiring: { title: "REROUTE THE NAV CORE", detail: "Wire both boards to restore the trajectory. Shorts cost drift." },
  transit: { title: "THREAD THE FIELD", detail: "Hold steady as Aether flies the restored course." },
  mutiny: { title: "TAKE THE POWER BUS", detail: "VESTA is clamping power from Aether. Step in and arbitrate the bus." },
  triage: { title: "TRIAGE THE POWER", detail: "Split the bus across life-support, comms, and Aether's core. You can't keep all three whole." },
  aftermath: { title: "LIVE WITH THE CHOICE", detail: "The bus is set. See what it cost — and what it kept." },
  blackout: { title: "FIND THE SIGNAL", detail: "Comms are blind in Mars's shadow. A beacon is out there — go read it." },
  decode: { title: "DECODE THE BEACON", detail: "Probe the code; the beacon tells you how close. Trust Aether's read, or work it yourself." },
  fix: { title: "POSITION FIXED", detail: "The beacon is decoded. Steady on for the descent." },
  descent: { title: "FLY THE DESCENT", detail: "Manual insertion — clear each stage before its window closes. Miss one and you retry it." },
  arrival: { title: "TOUCHDOWN", detail: "You're down. See how the journey resolved." },
};

const SYS_LABELS: Record<keyof ShipSystems, string> = {
  power: "POWER",
  navigation: "NAVIGATION",
  lifeSupport: "LIFE SUPPORT",
  aetherStability: "AETHER STABILITY",
};

const gradeColor = (v: number) => (v < 30 ? "#ff5a5a" : v < 60 ? "#ffb347" : "#7fe7ff");

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
          style={{ width: `${Math.max(2, value)}%`, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
    </div>
  );
}

function ShipPanel() {
  const systems = useGameStore((s) => s.systems);
  const journeyProgress = useGameStore((s) => s.journeyProgress);
  const phase = useGameStore((s) => s.phase);
  const navStage = useGameStore((s) => s.navStage);
  const navFuel = useGameStore((s) => s.navFuel);
  const trust = useGameStore((s) => s.trust);
  const driftPct =
    phase === "rewiring" ? (navFuel / boardForStage(navStage).fuelBudget) * 100 : null;

  return (
    <div>
      {(Object.keys(SYS_LABELS) as (keyof ShipSystems)[]).map((k) => (
        <Bar key={k} label={SYS_LABELS[k]} value={systems[k]} />
      ))}

      {driftPct !== null && (
        <div className="mt-2 border-t border-[#1c3147] pt-2.5">
          <Bar label={`NAV DRIFT · STAGE ${navStage}`} value={driftPct} />
        </div>
      )}

      <div className="mt-2 border-t border-[#1c3147] pt-2.5">
        <Bar label="TRUST IN AETHER" value={trust} />
        <div className="mb-1 mt-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
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

function LedgerPanel() {
  const ledger = useGameStore((s) => s.ledger);
  if (ledger.length === 0) {
    return (
      <p className="py-6 text-center font-mono text-xs text-[#5f7da0]">
        no events committed yet
      </p>
    );
  }
  return (
    <>
      <ul className="space-y-2">
        {[...ledger].reverse().map((e) => (
          <li key={e.seq} className="border-l-2 border-aether-core/40 pl-2.5 font-mono text-[11px]">
            <div className="flex items-center justify-between text-[#7fe7ff]">
              <span>#{String(e.seq).padStart(3, "0")}</span>
              <span className="text-[9px] text-[#5f7da0]">{e.kind}</span>
            </div>
            <div className="text-[#bcd3e8]">{e.label}</div>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-[#1c3147] pt-2 text-[9px] leading-snug text-[#5f7da0]">
        Phase 1 logs locally. These records are shaped to commit to Algorand (boxes / ASA
        rewards) in a later phase.
      </p>
    </>
  );
}

function SystemPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <SettingsToggles />
      <div className="flex w-full max-w-sm gap-3">
        <button
          onClick={onClose}
          className="flex-1 rounded border border-aether-core/60 bg-aether-core/15 px-4 py-3 font-display text-sm uppercase tracking-[0.25em] text-aether-core text-glow transition hover:bg-aether-core/25"
        >
          Resume
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded border border-white/15 bg-white/5 px-5 py-3 font-display text-sm uppercase tracking-[0.25em] text-[#9fb4c9] transition hover:bg-white/10"
        >
          ↻ Restart
        </button>
      </div>
    </div>
  );
}

const TAB_META: Record<Tab, { label: string; title: string }> = {
  ship: { label: "▤", title: "Ship Status" },
  ledger: { label: "⛓ Ledger", title: "Algorand-ready Ledger" },
  system: { label: "⚙", title: "Paused · System" },
};

export function HudDock() {
  const phase = useGameStore((s) => s.phase);
  const journeyResumed = useGameStore((s) => s.journeyResumed);
  const ledgerCount = useGameStore((s) => s.ledger.length);
  const nodesAligned = useGameStore((s) => s.nodesAligned);
  const totalNodes = useGameStore((s) => s.totalNodes);
  const [tab, setTab] = useState<Tab | null>(null);

  // Pause the soundscape while the System sheet is open (= the pause menu).
  useEffect(() => {
    if (tab === "system") audio.suspend();
    else audio.resume();
  }, [tab]);

  // Esc closes any open sheet, or opens the System (pause) sheet when none is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setTab((cur) => (cur ? null : "system"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Hidden before wake (idle) and behind the full-screen EndCard (journeyResumed).
  if (phase === "idle" || journeyResumed) return null;
  const obj = OBJECTIVE[phase];
  const toggle = (t: Tab) => setTab((cur) => (cur === t ? null : t));

  const tabBtn = (t: Tab) => {
    const active = tab === t;
    return (
      <button
        key={t}
        onClick={() => toggle(t)}
        aria-pressed={active}
        className={
          "pointer-events-auto whitespace-nowrap rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition " +
          (active
            ? "bg-aether-core/20 text-aether-core text-glow"
            : "text-[#9fb4c9] hover:bg-aether-core/10")
        }
      >
        {t === "ledger" ? `⛓ ${ledgerCount}` : TAB_META[t].label}
      </button>
    );
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40">
      <div className="mx-auto w-full max-w-xl px-2">
        {/* Collapsible sheet — expands ABOVE the bar (clipped max-height slide), so it
            only ever covers the lower portion and never the centered play area. */}
        <div
          className={
            "overflow-hidden transition-all duration-300 ease-out " +
            (tab ? "max-h-[58vh] opacity-100" : "max-h-0 opacity-0")
          }
        >
          <div className="frosted pointer-events-auto rounded-t-2xl px-4 pb-3 pt-2">
            {/* grab handle */}
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-aether-core/30" />
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-aether-core">
                {tab ? TAB_META[tab].title : ""}
              </span>
              <button
                onClick={() => setTab(null)}
                aria-label="Close panel"
                className="rounded px-2 py-1 font-mono text-xs text-[#9fb4c9] transition hover:text-aether-core"
              >
                ✕
              </button>
            </div>
            <div key={tab} className="anim-fade-in max-h-[42vh] overflow-y-auto pr-1">
              {tab === "ship" && <ShipPanel />}
              {tab === "ledger" && <LedgerPanel />}
              {tab === "system" && <SystemPanel onClose={() => setTab(null)} />}
            </div>
          </div>
        </div>

        {/* Always-visible bar — a compact frosted pill, just the objective title +
            icon tabs, centered so it stays out of the way. The detailed instruction
            lives on the in-world board + dialogue, not here. */}
        <div
          className="flex justify-center"
          style={{ marginBottom: "calc(0.5rem + env(safe-area-inset-bottom))", marginTop: "0.375rem" }}
        >
          <div className="frosted pointer-events-auto flex max-w-[94vw] items-center gap-2 rounded-full py-1 pl-3 pr-1.5">
            <div key={phase} className="anim-line-in flex min-w-0 items-center gap-1.5">
              <span className="text-[10px] text-[#ffd9a0]">◇</span>
              <span className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-[#cfe3f5]">
                {obj.title}
                {phase === "repair" && (
                  <span className="text-aether-core"> · {nodesAligned}/{totalNodes}</span>
                )}
              </span>
            </div>
            <span className="h-3.5 w-px shrink-0 bg-aether-core/20" />
            <div className="flex shrink-0 items-center gap-0.5">
              {(["ship", "ledger", "system"] as Tab[]).map(tabBtn)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
