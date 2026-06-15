// ---------------------------------------------------------------------------
// AudioEngine — procedural cockpit soundscape (Web Audio API) + voice-over.
//
// The cockpit hum, beeps and glitch bursts are fully synthesized so the app
// runs from a clean clone. Aether's dialogue prefers pre-rendered ElevenLabs
// voice-over when a clip exists for the line, and falls back to runtime Web
// Speech otherwise (see `speakLine`).
//
// AudioContext can only start after a user gesture, so callers must invoke
// `start()` from a click/tap (the BEGIN gate handles this).
// ---------------------------------------------------------------------------

import { getVoiceClip } from "./voice";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private started = false;
  private _muted = false;
  private _voiceEnabled = true;
  private _volume = 1;
  /** Currently-playing pre-rendered voice-over clip, if any. */
  private currentVoiceEl: HTMLAudioElement | null = null;

  get muted() {
    return this._muted;
  }

  get voiceEnabled() {
    return this._voiceEnabled;
  }

  get volume() {
    return this._volume;
  }

  /** Master gain target — 0 when muted, else base 0.5 scaled by volume. */
  private targetGain() {
    return this._muted ? 0 : 0.5 * this._volume;
  }

  private applyGain() {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.targetGain(), this.ctx.currentTime, 0.05);
    }
  }

  /** Lazily create the context (must be called from a user gesture). */
  start() {
    if (this.started) {
      void this.ctx?.resume();
      return;
    }
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;

    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.targetGain();
    this.master.connect(this.ctx.destination);

    this.buildAmbient();
    this.started = true;
  }

  /** Two low detuned saws + a slow LFO → a tense, breathing engine hum. */
  private buildAmbient() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.12;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 420;

    const oscA = ctx.createOscillator();
    oscA.type = "sawtooth";
    oscA.frequency.value = 55;
    const oscB = ctx.createOscillator();
    oscB.type = "sawtooth";
    oscB.frequency.value = 55.4; // detune for beating

    // Slow amplitude wobble — the ship "breathing" under stress.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.18;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain).connect(this.ambientGain.gain);

    oscA.connect(lowpass);
    oscB.connect(lowpass);
    lowpass.connect(this.ambientGain).connect(this.master);

    oscA.start();
    oscB.start();
    lfo.start();
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    this.applyGain();
    if (muted) this.stopSpeaking();
  }

  /** 0..1 master volume (independent of mute). */
  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    this.applyGain();
    if (this.currentVoiceEl) this.currentVoiceEl.volume = this.voiceClipVolume();
  }

  /** Voice-over element volume — tracks master volume, mirrors `speak`'s 0.9 ceiling. */
  private voiceClipVolume() {
    return Math.max(0, Math.min(1, 0.9 * this._volume));
  }

  /** Toggle Aether's spoken dialogue (Web Speech) without muting sound FX. */
  setVoiceEnabled(enabled: boolean) {
    this._voiceEnabled = enabled;
    if (!enabled) this.stopSpeaking();
  }

  /** Pause/resume the whole soundscape (used by the pause menu). */
  suspend() {
    this.stopSpeaking();
    void this.ctx?.suspend();
  }

  resume() {
    void this.ctx?.resume();
  }

  /** Short tonal beep — used for confirms / UI ticks. */
  beep(freq = 880, duration = 0.09, type: OscillatorType = "square", vol = 0.18) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = 0;
    g.gain.setTargetAtTime(vol, ctx.currentTime, 0.005);
    g.gain.setTargetAtTime(0, ctx.currentTime + duration, 0.03);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.15);
  }

  /** A rising two-tone "success" chime for a completed repair. */
  confirm() {
    this.beep(660, 0.1, "sine", 0.16);
    window.setTimeout(() => this.beep(990, 0.16, "sine", 0.16), 110);
  }

  /** A stressed alert blip. */
  alert() {
    this.beep(220, 0.18, "sawtooth", 0.12);
  }

  /** A burst of filtered noise — Aether's matrix sputtering. */
  glitchBurst(intensity = 0.6) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const dur = 0.12 + intensity * 0.18;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 800 + Math.random() * 2200;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.value = 0.08 * intensity;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
  }

  /**
   * Speak a dialogue line. If a pre-rendered voice-over clip exists for
   * `voiceId`, play that (the cast performance); otherwise fall back to runtime
   * Web Speech. Subtitles come from `text`, never from the clip.
   */
  speakLine(voiceId: string | undefined, text: string, glitch = 0.3) {
    if (this._muted || !this._voiceEnabled) return;
    const url = voiceId ? getVoiceClip(voiceId) : null;
    if (!url) {
      this.speak(text, glitch);
      return;
    }
    // Stop whatever's currently sounding (prior clip and/or synth).
    this.stopSpeaking();
    try {
      const el = new Audio(url);
      el.volume = this.voiceClipVolume();
      this.currentVoiceEl = el;
      el.addEventListener("ended", () => {
        if (this.currentVoiceEl === el) this.currentVoiceEl = null;
      });
      void el.play().catch(() => {
        // Autoplay blocked or decode failed — degrade to Web Speech.
        if (this.currentVoiceEl === el) this.currentVoiceEl = null;
        this.speak(text, glitch);
      });
    } catch {
      this.speak(text, glitch);
    }
  }

  /**
   * Speak a line via the Web Speech API, modulated by Aether's damage level.
   * Higher `glitch` → lower, more unsteady pitch. Best-effort; silently no-ops
   * where SpeechSynthesis is unavailable.
   */
  speak(text: string, glitch = 0.3) {
    if (this._muted || !this._voiceEnabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(
        // Strip glitch glyphs so the synth reads cleanly.
        text.replace(/[▓▒░#@%&*<>/\\|=+×÷¦‡†§¤]/g, ""),
      );
      u.rate = 0.96 - glitch * 0.12;
      u.pitch = 1.05 - glitch * 0.45;
      u.volume = 0.9;
      // Prefer a softer / female-leaning voice if present.
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) =>
        /female|samantha|victoria|zira|google uk english female|aria/i.test(v.name),
      );
      if (preferred) u.voice = preferred;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      /* speech is a nice-to-have; never block the game on it */
    }
  }

  stopSpeaking() {
    if (this.currentVoiceEl) {
      this.currentVoiceEl.pause();
      this.currentVoiceEl = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const audio = new AudioEngine();
