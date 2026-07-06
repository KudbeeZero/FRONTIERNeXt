import { resolveApiUrl } from "@/lib/queryClient";
import { useEffect, useRef, useState } from "react";
import { Radio, X, Volume2, VolumeX, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CommTerminal — a salvaged listening post widget.
 *
 * A purchasable facility (`comm_terminal`) that lets its owner hear the world's
 * ambient transmissions — eerie "lost souls" whispers only they receive. Polls
 * GET /api/comm-terminal/whispers; self-hides for non-owners. Voice is optional
 * (plays an ElevenLabs clip if the server returned one; text-only otherwise).
 *
 * NOTE: not visually verified in a browser in this environment — typecheck +
 * build + an SSR smoke test back it; the deterministic logic lives server-side.
 */

type Intensity = "faint" | "clear" | "surge";

interface WhisperWire {
  id: string;
  text: string;
  intensity: Intensity;
  audioUrl: string | null;
}
interface CommResponse {
  unlocked: boolean;
  level: number;
  voiceConfigured: boolean;
  whisper: WhisperWire | null;
}

const POLL_MS = 15_000;

const INTENSITY_STYLE: Record<Intensity, { text: string; ring: string; glow: string; label: string }> = {
  faint: { text: "text-cyan-200/50", ring: "stroke-cyan-300/30", glow: "drop-shadow-[0_0_6px_rgba(103,232,249,0.25)]", label: "faint" },
  clear: { text: "text-teal-100/90", ring: "stroke-teal-300/70", glow: "drop-shadow-[0_0_10px_rgba(45,212,191,0.5)]", label: "clear" },
  surge: { text: "text-fuchsia-200", ring: "stroke-fuchsia-400/90", glow: "drop-shadow-[0_0_16px_rgba(232,121,249,0.8)]", label: "surge" },
};

/** The "entity" — an animated signal orb (placeholder presence, not a stock avatar). */
function SignalEntity({ intensity }: { intensity: Intensity }) {
  const s = INTENSITY_STYLE[intensity];
  const dur = intensity === "surge" ? "1.1s" : intensity === "clear" ? "2.2s" : "3.6s";
  return (
    <svg viewBox="0 0 64 64" className={cn("w-10 h-10 shrink-0", s.glow)} aria-hidden>
      <circle cx="32" cy="32" r="6" className={cn("fill-current", s.text)}>
        <animate attributeName="r" values="5;8;5" dur={dur} repeatCount="indefinite" />
      </circle>
      {[12, 20, 28].map((r, i) => (
        <circle key={r} cx="32" cy="32" r={r} fill="none" strokeWidth="1.5" className={s.ring}>
          <animate attributeName="opacity" values="0.15;0.7;0.15" dur={dur} begin={`${i * 0.25}s`} repeatCount="indefinite" />
          <animate attributeName="r" values={`${r - 2};${r + 2};${r - 2}`} dur={dur} begin={`${i * 0.25}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

export function CommTerminal({ playerId }: { playerId?: string | null }) {
  const [unlocked, setUnlocked] = useState(false);
  const [level, setLevel] = useState(0);
  const [voiceConfigured, setVoiceConfigured] = useState(false);
  const [log, setLog] = useState<Array<{ id: string; text: string; intensity: Intensity }>>([]);
  const [open, setOpen] = useState(true);
  const [muted, setMuted] = useState(false);

  const seenRef = useRef<Set<string>>(new Set());
  const lastIdRef = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        // Pass the last whisper id so the server only sends (and synthesizes) a new
        // one when the window actually flips — no redundant audio/credits per poll.
        const since = seenRef.current.size ? `&since=${encodeURIComponent(lastIdRef.current)}` : "";
        const r = await fetch(resolveApiUrl(`/api/comm-terminal/whispers?playerId=${encodeURIComponent(playerId)}${since}`));
        if (!r.ok || cancelled) return;
        const data: CommResponse = await r.json();
        if (cancelled) return;
        setUnlocked(data.unlocked);
        setLevel(data.level);
        setVoiceConfigured(data.voiceConfigured);
        const w = data.whisper;
        if (data.unlocked && w && !seenRef.current.has(w.id)) {
          seenRef.current.add(w.id);
          lastIdRef.current = w.id;
          setLog((prev) => [{ id: w.id, text: w.text, intensity: w.intensity }, ...prev].slice(0, 12));
          if (w.audioUrl && !mutedRef.current && audioRef.current) {
            audioRef.current.src = w.audioUrl;
            audioRef.current.play().catch(() => {/* autoplay may be blocked */});
          }
        }
      } catch {
        /* best-effort */
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [playerId]);

  // Non-owners (and pre-purchase) see nothing at all.
  if (!playerId || !unlocked) return null;

  const latest = log[0];
  const intensity: Intensity = latest?.intensity ?? "faint";

  return (
    <div
      data-testid="comm-terminal"
      className="fixed bottom-20 left-3 z-40 w-[270px] max-w-[80vw] select-none font-mono"
    >
      <audio ref={audioRef} className="hidden" />
      <div className="rounded-lg border border-cyan-400/20 bg-black/80 backdrop-blur-md shadow-[0_0_24px_rgba(0,0,0,0.6)] overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 border-b border-cyan-400/10 hover:bg-cyan-400/5 transition-colors"
        >
          <Radio className="w-3.5 h-3.5 text-cyan-300/80" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">Comm Terminal</span>
          <span className="text-[9px] text-cyan-400/40 ml-auto">ECHO · lvl {level}</span>
          <ChevronDown className={cn("w-3.5 h-3.5 text-cyan-300/50 transition-transform", !open && "-rotate-90")} />
        </button>

        {open && (
          <div className="p-3 space-y-2">
            {/* Entity + status */}
            <div className="flex items-center gap-3">
              <SignalEntity intensity={intensity} />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-cyan-200/70">lost signal</p>
                <p className={cn("text-[9px]", INTENSITY_STYLE[intensity].text)}>
                  reception: {INTENSITY_STYLE[intensity].label}
                </p>
              </div>
              <button
                onClick={() => setMuted((m) => !m)}
                title={voiceConfigured ? (muted ? "Unmute" : "Mute") : "Voice not configured"}
                className="ml-auto text-cyan-300/50 hover:text-cyan-200 transition-colors"
              >
                {muted || !voiceConfigured ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Whisper feed */}
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {log.length === 0 && (
                <p className="text-[10px] italic text-cyan-200/30 py-3 text-center">…scanning the ether…</p>
              )}
              {log.map((w) => (
                <p key={w.id} className={cn("text-[11px] leading-snug", INTENSITY_STYLE[w.intensity].text)}>
                  <span className="text-cyan-400/30 mr-1">›</span>
                  {w.text}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
