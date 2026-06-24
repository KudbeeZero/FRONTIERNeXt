/**
 * BattleSoundLayer — the audio half of the battle telegraphy.
 *
 * A headless DOM component (renders nothing). Subscribes to the cinematic bus
 * and, as a battle plays, fires a synth cue at the start of each punchy beat
 * (launch / impact / swing / resolve) off the SAME clock the globe + HUD use —
 * so the sound lands with the picture. Opt-in (`battleSound` pref, off by
 * default) and gated by the cinematics master toggle.
 *
 * Pure mapping is the tested `beatSound`; synthesis is `battleSoundPlayer`.
 */
import { useEffect, useRef } from "react";
import { onCinematic, type CinematicHandle } from "@/lib/battle/cinematicBus";
import { beatAt } from "@shared/battle-sequence";
import { beatSound } from "@/lib/battle/beatSound";
import { playBeatSpec } from "@/lib/battle/battleSoundPlayer";
import { useVisualPrefs } from "@/hooks/useVisualPrefs";

export function BattleSoundLayer() {
  const prefs = useVisualPrefs();
  const enabledRef = useRef(false);
  enabledRef.current = prefs.battleSound && prefs.battleCinematics;

  useEffect(() => {
    let raf = 0;
    let current: { handle: CinematicHandle; lastKind: string | null } | null = null;

    const tick = () => {
      if (current) {
        const elapsed = Date.now() - current.handle.startMs;
        const kind = beatAt(current.handle.seq, elapsed)?.beat.kind ?? null;
        if (kind && kind !== current.lastKind) {
          current.lastKind = kind;
          // The swing only sounds when it actually decided the battle.
          if (enabledRef.current && (kind !== "swing" || current.handle.seq.swingDecided)) {
            const spec = beatSound(kind);
            if (spec) playBeatSpec(spec);
          }
        }
        if (elapsed >= current.handle.seq.durationMs) current = null;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const unsub = onCinematic((handle) => {
      current = { handle, lastKind: null };
    });
    return () => {
      cancelAnimationFrame(raf);
      unsub();
    };
  }, []);

  return null;
}
