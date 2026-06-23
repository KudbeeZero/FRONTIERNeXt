import { useSettingsStore } from "../store/settingsStore";

// ---------------------------------------------------------------------------
// Reusable settings toggles, embedded by both the start screen (StartGate) and
// the in-flight HudDock's System sheet. The in-flight pause/menu shell now lives
// in HudDock; this module is just the shared settings rows.
// ---------------------------------------------------------------------------

function Toggle({
  label,
  on,
  hint,
  onToggle,
}: {
  label: string;
  on: boolean;
  hint?: string;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      onClick={() => onToggle(!on)}
      role="switch"
      aria-checked={on}
      className="flex w-full items-center justify-between gap-6 rounded border border-aether-core/20 bg-aether-core/5 px-4 py-3 text-left transition hover:bg-aether-core/10"
    >
      <span className="flex flex-col">
        <span className="font-display text-sm uppercase tracking-widest text-[#cfe3f5]">
          {label}
        </span>
        {hint && <span className="mt-0.5 font-mono text-[10px] text-[#5f7da0]">{hint}</span>}
      </span>
      <span
        className={
          "rounded px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest " +
          (on
            ? "bg-aether-core/20 text-aether-core text-glow"
            : "bg-white/5 text-[#5f7da0]")
        }
      >
        {on ? "On" : "Off"}
      </span>
    </button>
  );
}

/** Reusable settings rows — used by both the pause menu and the start screen. */
export function SettingsToggles() {
  const muted = useSettingsStore((s) => s.muted);
  const volume = useSettingsStore((s) => s.volume);
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const subtitles = useSettingsStore((s) => s.subtitles);
  const setMuted = useSettingsStore((s) => s.setMuted);
  const setVolume = useSettingsStore((s) => s.setVolume);
  const setVoiceEnabled = useSettingsStore((s) => s.setVoiceEnabled);
  const setReducedMotion = useSettingsStore((s) => s.setReducedMotion);
  const setSubtitles = useSettingsStore((s) => s.setSubtitles);

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Toggle label="Sound" hint="Ambient hum + effects" on={!muted} onToggle={(v) => setMuted(!v)} />

      {/* Master volume. Disabled-looking (dimmed) while muted. */}
      <div
        className={
          "flex items-center justify-between gap-4 rounded border border-aether-core/20 bg-aether-core/5 px-4 py-3 " +
          (muted ? "opacity-40" : "")
        }
      >
        <span className="font-display text-sm uppercase tracking-widest text-[#cfe3f5]">
          Volume
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          disabled={muted}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          aria-label="Master volume"
          className="h-1 w-40 cursor-pointer accent-aether-core"
        />
      </div>

      <Toggle
        label="Aether's Voice"
        hint="Spoken dialogue (Web Speech)"
        on={voiceEnabled}
        onToggle={setVoiceEnabled}
      />
      <Toggle
        label="Subtitles"
        hint="Clean captions for dialogue"
        on={subtitles}
        onToggle={setSubtitles}
      />
      <Toggle
        label="Reduced Motion"
        hint="Calmer hologram + node motion"
        on={reducedMotion}
        onToggle={setReducedMotion}
      />
    </div>
  );
}
