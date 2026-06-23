import { useGameStore } from "../store/gameStore";
import { useSettingsStore } from "../store/settingsStore";
import { DIALOGUE } from "../data/dialogue";

// ---------------------------------------------------------------------------
// Optional always-on captions. The main dialogue box renders Aether's lines
// with glitch corruption (intentionally hard to read when she's fragmented);
// subtitles mirror the *clean* current line at the bottom for accessibility.
// Off by default; toggled in Settings.
// ---------------------------------------------------------------------------

export function Subtitles() {
  const subtitles = useSettingsStore((s) => s.subtitles);
  const phase = useGameStore((s) => s.phase);
  const dialogueIndex = useGameStore((s) => s.dialogueIndex);

  if (!subtitles || phase === "idle") return null;
  const track = DIALOGUE[phase];
  const line = track?.[Math.min(dialogueIndex, track.length - 1)];
  if (!line) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-44 z-30 flex justify-center px-6">
      <p className="max-w-2xl rounded bg-black/70 px-4 py-2 text-center text-sm leading-relaxed text-[#dfeefc] backdrop-blur-sm">
        <span className="font-mono text-xs uppercase tracking-widest text-aether-core">
          {line.name}:
        </span>{" "}
        {line.text}
      </p>
    </div>
  );
}
