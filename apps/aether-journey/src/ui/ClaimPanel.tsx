import { useCallback, useEffect, useRef, useState } from "react";
import type { OnchainEvent } from "../store/types";
import { audio } from "../lib/audioEngine";
import { explorerTxUrl, goToFrontierAl, FRONTIER_AL_URL } from "../lib/chain/handoff";

// ---------------------------------------------------------------------------
// The end-of-prologue on-chain claim.
//
// Connect Pera Wallet (testnet) → commit the run's ledger as one atomic group
// of 0-ALGO self-payments → hand off to the main FRONTIER-AL game. The heavy
// wallet/signing stack is dynamically imported on first use so it never weighs
// down the prologue's initial load. A "continue without committing" escape is
// always present, so the player can never be hard-locked at this screen.
// ---------------------------------------------------------------------------

type Stage = "idle" | "connecting" | "connected" | "claiming" | "claimed" | "error";

// Lazily-resolved handle to the wallet module (keeps algosdk/Pera out of the
// initial bundle and contains any wallet-lib init failure to this step).
type ClaimModule = typeof import("../lib/chain/claim");
let _mod: Promise<ClaimModule> | null = null;
const claimModule = () => (_mod ??= import("../lib/chain/claim"));

export function ClaimPanel({ events }: { events: OnchainEvent[] }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [txIds, setTxIds] = useState<string[]>([]);
  const [round, setRound] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState("testnet");
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const connect = useCallback(async () => {
    setError(null);
    setStage("connecting");
    try {
      const mod = await claimModule();
      setNetwork(mod.NETWORK_LABEL);
      const addr = await mod.connectWallet();
      if (!mounted.current) return;
      setAddress(addr);
      setStage("connected");
      mod.getBalanceAlgo(addr).then((b) => mounted.current && setBalance(b));
      // Reset to idle if the wallet drops the session out from under us.
      mod.onWalletDisconnect(() => {
        if (!mounted.current) return;
        setAddress(null);
        setBalance(null);
        setStage("idle");
      });
    } catch (err) {
      if (!mounted.current) return;
      const e = err as { message?: string; cancelled?: boolean };
      if (e?.cancelled) { setStage("idle"); return; } // user dismissed — not an error
      setError(e?.message || "Could not connect the wallet.");
      setStage("error");
    }
  }, []);

  const commit = useCallback(async () => {
    if (!address) return;
    setError(null);
    setStage("claiming");
    audio.beep(660, 0.08, "sine", 0.12);
    try {
      const mod = await claimModule();
      const res = await mod.claimLedgerOnChain(address, events);
      if (!mounted.current) return;
      setTxIds(res.txIds);
      setRound(res.confirmedRound);
      setStage("claimed");
      audio.confirm();
    } catch (err) {
      if (!mounted.current) return;
      const e = err as { message?: string; cancelled?: boolean };
      if (e?.cancelled) { setStage("connected"); return; }
      setError(e?.message || "The on-chain commit failed.");
      setStage("error");
    }
  }, [address, events]);

  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

  return (
    <div className="mt-8 flex w-full max-w-md flex-col items-center gap-3">
      {/* Headline state line. */}
      <div className="holo-panel w-full rounded-md px-5 py-4 text-center font-mono text-xs uppercase tracking-widest text-[#9fb4c9]">
        <span className="text-aether-core">{events.length}</span> actions recorded ·{" "}
        {stage === "claimed" ? (
          <span className="text-emerald-300">committed to Algorand ✓</span>
        ) : (
          <>commit to Algorand <span className="text-[#5f7da0]">({network})</span></>
        )}

        {/* --- Connect ----------------------------------------------------- */}
        {(stage === "idle" || stage === "connecting") && (
          <button
            onClick={connect}
            disabled={stage === "connecting"}
            className="mt-3 w-full rounded border border-aether-core/60 bg-aether-core/10 px-5 py-2.5 font-mono text-sm uppercase tracking-widest text-aether-core text-glow transition hover:bg-aether-core/25 disabled:opacity-60"
          >
            {stage === "connecting" ? "Opening wallet…" : "⛓ Connect Wallet"}
          </button>
        )}

        {/* --- Connected → commit ------------------------------------------ */}
        {(stage === "connected" || stage === "claiming") && address && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="text-[10px] normal-case tracking-normal text-[#7d93a8]">
              {short(address)}
              {balance != null && <> · {balance.toFixed(3)} ALGO</>}
            </div>
            <button
              onClick={commit}
              disabled={stage === "claiming"}
              className="w-full rounded border border-aether-core/60 bg-aether-core/10 px-5 py-2.5 font-mono text-sm uppercase tracking-widest text-aether-core text-glow transition hover:bg-aether-core/25 disabled:opacity-60"
            >
              {stage === "claiming"
                ? "Sign in your wallet…"
                : `Commit ${events.length} actions on-chain`}
            </button>
          </div>
        )}

        {/* --- Claimed → handoff ------------------------------------------- */}
        {stage === "claimed" && (
          <div className="mt-3 flex flex-col gap-2">
            <a
              href={txIds[0] ? explorerTxUrl(txIds[0]) : "#"}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] normal-case tracking-normal text-aether-core underline decoration-dotted hover:text-[#bfeeff]"
            >
              {txIds.length} txn{txIds.length === 1 ? "" : "s"} confirmed
              {round != null && <> · round {round}</>} — view on explorer ↗
            </a>
            <button
              onClick={() => { audio.confirm(); goToFrontierAl(); }}
              className="w-full rounded border border-emerald-400/60 bg-emerald-400/10 px-5 py-2.5 font-mono text-sm uppercase tracking-widest text-emerald-200 text-glow transition hover:bg-emerald-400/25"
            >
              ▸ Continue to FRONTIER-AL
            </button>
          </div>
        )}

        {/* --- Error ------------------------------------------------------- */}
        {stage === "error" && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-[10px] normal-case leading-snug tracking-normal text-rose-300">
              {error}
            </p>
            <button
              onClick={address ? commit : connect}
              className="w-full rounded border border-aether-core/50 bg-aether-core/10 px-5 py-2 font-mono text-xs uppercase tracking-widest text-aether-core transition hover:bg-aether-core/25"
            >
              ↻ Try again
            </button>
          </div>
        )}
      </div>

      {/* Always-available escape — the player can proceed even if they don't
          want to (or can't) commit on-chain. Prevents any hard-lock here. */}
      {stage !== "claimed" && (
        <button
          onClick={goToFrontierAl}
          className="font-mono text-[10px] uppercase tracking-widest text-[#5f7da0] underline decoration-dotted transition hover:text-aether-core"
        >
          continue without committing →
        </button>
      )}

      <p className="max-w-sm text-center text-[9px] leading-snug text-[#46627d]">
        Testnet only — these are 0-ALGO self-transactions that record your run; no
        real funds move. Handoff target: <span className="text-[#5f7da0]">{FRONTIER_AL_URL}</span>
      </p>
    </div>
  );
}
