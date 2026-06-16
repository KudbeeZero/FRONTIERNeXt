import { useState } from "react";
import { useGameStore } from "../store/gameStore";

// ---------------------------------------------------------------------------
// On-chain action ledger (Phase 1: client-side).
//
// Every player-meaningful action is recorded as an OnchainEvent. This panel
// makes that audit trail visible — and previews the "this will live on Algorand"
// promise. The event shape (seq + ts + kind + payload) is already the shape a
// later phase will flush to an Algorand box / mint as ASA rewards.
// ---------------------------------------------------------------------------

export function OnchainLedger() {
  const ledger = useGameStore((s) => s.ledger);
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2">
      {open && (
        <div className="holo-panel relative max-h-[42vh] w-72 overflow-y-auto rounded-md px-4 py-3 sm:w-80">
          <span className="holo-corner left-0 top-0 border-b-0 border-r-0" />
          <span className="holo-corner right-0 top-0 border-b-0 border-l-0" />
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-aether-core">
            ⛓ Algorand-ready ledger
          </div>
          {ledger.length === 0 ? (
            <p className="py-3 text-center font-mono text-xs text-[#5f7da0]">
              no events committed yet
            </p>
          ) : (
            <ul className="space-y-2">
              {[...ledger].reverse().map((e) => (
                <li
                  key={e.seq}
                  className="border-l-2 border-aether-core/40 pl-2.5 font-mono text-[11px]"
                >
                  <div className="flex items-center justify-between text-[#7fe7ff]">
                    <span>#{String(e.seq).padStart(3, "0")}</span>
                    <span className="text-[9px] text-[#5f7da0]">{e.kind}</span>
                  </div>
                  <div className="text-[#bcd3e8]">{e.label}</div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-[#1c3147] pt-2 text-[9px] leading-snug text-[#5f7da0]">
            Phase 1 logs locally. These records are shaped to commit to Algorand
            (boxes / ASA rewards) in a later phase.
          </p>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="holo-panel pointer-events-auto rounded-md px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-aether-core text-glow transition hover:bg-aether-core/10"
      >
        ⛓ ledger · {ledger.length}
      </button>
    </div>
  );
}
