/**
 * client/src/lib/factionGateSound.ts
 *
 * Tiny WebAudio synth for the faction-select gate: a continuous low ambient
 * hum plus a short "spacey" beep on faction-card hover. No audio assets —
 * everything is synthesised, same approach as
 * client/src/lib/battle/battleSoundPlayer.ts (kept as a separate context here
 * since the gate and a live battle never play at once — no benefit to
 * sharing, and this keeps the gate fully self-contained).
 *
 * Browsers gate audio behind a user gesture, so startAmbientHum() is meant to
 * be called from a gesture handler (e.g. the gate's first pointerdown) — it
 * no-ops safely if called before that and is idempotent, so callers don't
 * need to track whether it already started.
 */

let ctx: AudioContext | null = null;
let humNodes: { oscA: OscillatorNode; oscB: OscillatorNode; gain: GainNode } | null = null;

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

/** Start the low ambient drone. Idempotent and safe to call from every
 *  qualifying gesture until the browser actually allows audio. */
export function startAmbientHum(): void {
  const ac = getCtx();
  if (!ac || humNodes) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0.035, ac.currentTime + 2.5); // slow fade-in, stays subtle
  gain.connect(ac.destination);

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 200;
  filter.connect(gain);

  const oscA = ac.createOscillator();
  oscA.type = "sine";
  oscA.frequency.value = 52;
  const oscB = ac.createOscillator();
  oscB.type = "sine";
  oscB.frequency.value = 55.5; // slightly detuned — a slow shimmering beat, not a flat tone

  oscA.connect(filter);
  oscB.connect(filter);
  oscA.start();
  oscB.start();
  humNodes = { oscA, oscB, gain };
}

/** Fade out and stop the ambient drone — call when the gate is dismissed. */
export function stopAmbientHum(): void {
  if (!ctx || !humNodes) return;
  const { oscA, oscB, gain } = humNodes;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + 0.6);
  oscA.stop(now + 0.65);
  oscB.stop(now + 0.65);
  humNodes = null;
}

/** A short "spacey" beep — for hovering a faction card. Vary `freq` per card
 *  for a little sonic character between factions. */
export function playHoverBeep(freq = 1200): void {
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});

  const now = ac.currentTime;
  const dur = 0.09;
  const gainNode = ac.createGain();
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(0.11, now + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  gainNode.connect(ac.destination);

  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq * 0.75, now);
  osc.frequency.exponentialRampToValueAtTime(freq, now + dur);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + dur);
}
