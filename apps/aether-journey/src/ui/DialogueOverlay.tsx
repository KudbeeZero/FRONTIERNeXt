import { useGameStore } from "../store/gameStore";
import { DIALOGUE } from "../data/dialogue";
import { GlitchText } from "./GlitchText";
import { audio } from "../lib/audioEngine";

// ---------------------------------------------------------------------------
// Aether's dialogue box. Purely presentational — the driver hook handles timing
// and speech. Cinematic lines can be click-skipped; *waiting* lines surface the
// gating control (run diagnostic / initiate repair / continue the journey).
// ---------------------------------------------------------------------------

const NAME_COLOR: Record<string, string> = {
  aether: "#7fe7ff",
  system: "#9fb4c9",
  operator: "#ffd9a0",
};

export function DialogueOverlay() {
  const phase = useGameStore((s) => s.phase);
  const dialogueIndex = useGameStore((s) => s.dialogueIndex);
  const advanceDialogue = useGameStore((s) => s.advanceDialogue);
  const enterDiagnostic = useGameStore((s) => s.enterDiagnostic);
  const enterRepair = useGameStore((s) => s.enterRepair);
  const resumeJourney = useGameStore((s) => s.resumeJourney);

  if (phase === "idle") return null;
  const track = DIALOGUE[phase];
  if (!track) return null;

  const idx = Math.min(dialogueIndex, track.length - 1);
  const line = track[idx];
  const isLast = dialogueIndex >= track.length - 1;
  const waiting = isLast && (line.autoMs ?? 0) === 0;
  const canSkip = !waiting && (line.autoMs ?? 0) > 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-6 sm:pb-10">
      <div
        className="holo-panel pointer-events-auto relative w-full max-w-3xl rounded-md px-6 py-5"
        onClick={() => {
          if (canSkip) {
            audio.beep(600, 0.04, "sine", 0.06);
            advanceDialogue();
          }
        }}
        style={{ cursor: canSkip ? "pointer" : "default" }}
      >
        {/* corner brackets */}
        <span className="holo-corner left-0 top-0 border-b-0 border-r-0" />
        <span className="holo-corner right-0 top-0 border-b-0 border-l-0" />
        <span className="holo-corner bottom-0 left-0 border-r-0 border-t-0" />
        <span className="holo-corner bottom-0 right-0 border-l-0 border-t-0" />

        <div
          className="mb-2 font-mono text-xs uppercase tracking-[0.3em]"
          style={{ color: NAME_COLOR[line.speaker] ?? "#9fb4c9" }}
        >
          {line.name}
        </div>

        <p className="font-display text-lg leading-relaxed text-[#e7f4ff] sm:text-xl">
          <GlitchText text={line.text} severity={line.glitch} />
        </p>

        {/* Gating controls on waiting lines. */}
        {waiting && phase === "waking" && (
          <CTAButton
            label="▸ RUN DIAGNOSTIC"
            hint="…or touch the glowing control to your right"
            onClick={() => {
              audio.beep(740, 0.12, "sine", 0.18);
              audio.glitchBurst(0.4);
              enterDiagnostic();
            }}
          />
        )}
        {waiting && phase === "diagnostic" && (
          <CTAButton
            label="▸ INITIATE NEURAL REPAIR"
            onClick={() => {
              audio.confirm();
              enterRepair();
            }}
          />
        )}
        {waiting && phase === "stabilized" && (
          <CTAButton
            label="▸ CONTINUE THE JOURNEY"
            onClick={() => {
              audio.confirm();
              resumeJourney();
            }}
          />
        )}

        {canSkip && (
          <div className="mt-3 text-right font-mono text-[10px] uppercase tracking-widest text-[#5f7da0]">
            click to continue ▸
          </div>
        )}
      </div>
    </div>
  );
}

function CTAButton({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="rounded border border-aether-core/60 bg-aether-core/10 px-5 py-2 font-mono text-sm uppercase tracking-widest text-aether-core text-glow transition hover:bg-aether-core/25"
      >
        {label}
      </button>
      {hint && (
        <span className="font-mono text-[11px] uppercase tracking-wider text-[#5f7da0]">
          {hint}
        </span>
      )}
    </div>
  );
}
