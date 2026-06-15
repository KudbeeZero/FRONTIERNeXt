import { useEffect, useState } from "react";
import { audio } from "../lib/audioEngine";
import { useSettingsStore } from "../store/settingsStore";

// ---------------------------------------------------------------------------
// The menu shell: a pause overlay reachable in-flight (☰ / Esc) plus the
// reusable settings toggles, which the start screen also embeds. Pausing
// suspends the soundscape; resuming restarts it. No game state is touched —
// "restart" is a clean page reload.
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

/** In-flight pause button + overlay. Render only while the scene is playing. */
export function MenuLayer() {
  const [open, setOpen] = useState(false);

  const openMenu = () => {
    audio.suspend();
    setOpen(true);
  };
  const closeMenu = () => {
    audio.resume();
    setOpen(false);
  };

  // Esc toggles the pause menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") (open ? closeMenu : openMenu)();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={openMenu}
        aria-label="Open menu"
        className="holo-panel pointer-events-auto absolute right-4 top-4 z-30 rounded-md px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-aether-core text-glow transition hover:bg-aether-core/10"
      >
        ☰ Menu
      </button>

      {open && (
        <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#03060d]/85 px-6 text-center backdrop-blur-sm">
          <div className="mb-1 font-mono text-xs uppercase tracking-[0.5em] text-aether-core">
            paused
          </div>
          <h2 className="font-display text-3xl font-black uppercase tracking-[0.2em] text-[#e7f4ff] text-glow">
            Systems Menu
          </h2>

          <div className="mt-8">
            <SettingsToggles />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={closeMenu}
              className="rounded border border-aether-core/60 bg-aether-core/15 px-8 py-3 font-display text-sm uppercase tracking-[0.3em] text-aether-core text-glow transition hover:bg-aether-core/25"
            >
              Resume
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded border border-white/15 bg-white/5 px-6 py-3 font-display text-sm uppercase tracking-[0.3em] text-[#9fb4c9] transition hover:bg-white/10"
            >
              ↻ Restart
            </button>
          </div>
        </div>
      )}
    </>
  );
}
