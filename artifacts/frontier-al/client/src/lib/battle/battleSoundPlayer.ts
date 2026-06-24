/**
 * client/src/lib/battle/battleSoundPlayer.ts
 *
 * Thin WebAudio synth for the battle cues. Lazily creates one shared
 * AudioContext, best-effort resumes it (browsers gate audio behind a user
 * gesture — by the time a battle resolves the player has clicked plenty), and
 * synthesises each `BeatSoundSpec` with a short gain envelope. No assets, no
 * network. SSR-/unsupported-safe (no-ops when there's no AudioContext).
 */
import type { BeatSoundSpec } from "./beatSound";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function playBeatSpec(spec: BeatSoundSpec): void {
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});

  const now = ac.currentTime;
  const dur = Math.max(0.02, spec.durationMs / 1000);

  const gainNode = ac.createGain();
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(spec.gain, now + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  gainNode.connect(ac.destination);

  if (spec.wave === "noise") {
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len); // decaying noise
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.connect(gainNode);
    src.start(now);
    src.stop(now + dur);
  } else {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(spec.freq, now);
    if (spec.sweepTo && spec.sweepTo > 0) osc.frequency.exponentialRampToValueAtTime(spec.sweepTo, now + dur);
    osc.connect(gainNode);
    osc.start(now);
    osc.stop(now + dur);
  }
}
