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
import { getMusicTrack } from "./music";

/** Background music sits well under dialogue/FX — base ceiling before master volume. */
const MUSIC_BASE = 0.4;

// Web Speech voices are populated ASYNCHRONOUSLY — getVoices() is often empty on
// the first call, so without caching the early lines fall back to the robotic
// default before a good voice has loaded. Cache it and refresh on `voiceschanged`.
let _voiceCache: SpeechSynthesisVoice[] = [];
function refreshVoices() {
  try {
    _voiceCache = window.speechSynthesis.getVoices() ?? [];
  } catch {
    /* ignore */
  }
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refreshVoices();
  try {
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
  } catch {
    /* ignore */
  }
}

/**
 * Pick the warmest, most natural English voice available for Aether — preferring
 * the OS's premium/neural voices (Samantha on iOS, the "Natural"/"Online" voices
 * on Win/Chrome) over the generic robotic default. Greatly improves the Ch.2+
 * fallback where no pre-rendered VO exists.
 */
function pickAetherVoice(): SpeechSynthesisVoice | undefined {
  const voices =
    _voiceCache.length || typeof window === "undefined" || !("speechSynthesis" in window)
      ? _voiceCache
      : window.speechSynthesis.getVoices();
  if (!voices.length) return undefined;
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang) || /english/i.test(v.name));
  const pool = en.length ? en : voices;
  const tiers: RegExp[] = [
    /natural|neural|premium|enhanced|online/i, // OS premium voices
    /samantha|aria|jenny|libby|sonia|ava|allison|serena|moira|karen/i, // known-good named voices
    /female|woman|google us english|google uk english female|zira/i, // female-leaning fallback
  ];
  for (const re of tiers) {
    const hit = pool.find((v) => re.test(v.name));
    if (hit) return hit;
  }
  return pool[0];
}

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
  /** Currently-playing background-music track, if any. */
  private currentMusicEl: HTMLAudioElement | null = null;

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
    if (muted) {
      this.stopSpeaking();
      this.currentMusicEl?.pause();
    } else if (this.currentMusicEl) {
      this.currentMusicEl.volume = this.musicVolume();
      void this.currentMusicEl.play().catch(() => {});
    }
  }

  /** 0..1 master volume (independent of mute). */
  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    this.applyGain();
    if (this.currentVoiceEl) this.currentVoiceEl.volume = this.voiceClipVolume();
    if (this.currentMusicEl) this.currentMusicEl.volume = this.musicVolume();
  }

  /** Voice-over element volume — tracks master volume, mirrors `speak`'s 0.9 ceiling. */
  private voiceClipVolume() {
    return Math.max(0, Math.min(1, 0.9 * this._volume));
  }

  /** Background-music element volume — tracks master volume, sits under dialogue. */
  private musicVolume() {
    return Math.max(0, Math.min(1, MUSIC_BASE * this._volume));
  }

  /**
   * Play a pre-rendered background-music track by id (looping if the track is
   * flagged for it). No-ops when muted or when no clip exists. Safe to call from
   * the BEGIN gesture — it shares that user-activation with the AudioContext.
   */
  playMusic(id: string) {
    const track = getMusicTrack(id);
    if (!track) return;
    this.stopMusic();
    if (this._muted) return;
    try {
      const el = new Audio(track.url);
      el.loop = track.loop;
      el.volume = this.musicVolume();
      this.currentMusicEl = el;
      // A non-looping track that finishes must release its ref, or a later
      // resume()/unmute would replay the ended one-shot from the top.
      el.addEventListener("ended", () => {
        if (this.currentMusicEl === el) this.currentMusicEl = null;
      });
      void el.play().catch(() => {
        if (this.currentMusicEl === el) this.currentMusicEl = null;
      });
    } catch {
      /* background music is a nice-to-have; never block the game on it */
    }
  }

  stopMusic() {
    if (this.currentMusicEl) {
      this.currentMusicEl.pause();
      this.currentMusicEl = null;
    }
  }

  /** Toggle Aether's spoken dialogue (Web Speech) without muting sound FX. */
  setVoiceEnabled(enabled: boolean) {
    this._voiceEnabled = enabled;
    if (!enabled) this.stopSpeaking();
  }

  /** Pause/resume the whole soundscape (used by the pause menu). */
  suspend() {
    this.stopSpeaking();
    this.currentMusicEl?.pause();
    void this.ctx?.suspend();
  }

  resume() {
    void this.ctx?.resume();
    if (this.currentMusicEl && !this._muted) void this.currentMusicEl.play().catch(() => {});
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
   *
   * `onEnded` fires once when the clip (or the synth fallback) finishes
   * playing — the dialogue driver uses it to advance cinematic lines when the
   * cast performance actually ends, rather than on a guessed timer. It does NOT
   * fire when the line is muted / voice-disabled (the driver caps those), nor
   * when a newer line supersedes this one.
   */
  speakLine(
    voiceId: string | undefined,
    text: string,
    glitch = 0.3,
    onEnded?: () => void,
  ) {
    if (this._muted || !this._voiceEnabled) return;
    // A new line supersedes anything still sounding — stop the prior clip and
    // any synth first, so a long VO never overlaps the next line (clip or synth).
    this.stopSpeaking();
    const url = voiceId ? getVoiceClip(voiceId) : null;
    if (!url) {
      this.speak(text, glitch, onEnded);
      return;
    }
    try {
      const el = new Audio(url);
      el.volume = this.voiceClipVolume();
      this.currentVoiceEl = el;
      el.addEventListener("ended", () => {
        if (this.currentVoiceEl === el) this.currentVoiceEl = null;
        onEnded?.();
      });
      void el.play().catch(() => {
        // Autoplay blocked or decode failed — degrade to Web Speech, but only
        // if this clip is still the active line. A newer line may have already
        // superseded it (pause() rejects the pending play()); in that case its
        // rejection must stay silent rather than speak the stale text.
        if (this.currentVoiceEl === el) {
          this.currentVoiceEl = null;
          this.speak(text, glitch, onEnded);
        }
      });
    } catch {
      this.speak(text, glitch, onEnded);
    }
  }

  /**
   * Speak a line via the Web Speech API, modulated by Aether's damage level.
   * Higher `glitch` → lower, more unsteady pitch. Best-effort; silently no-ops
   * where SpeechSynthesis is unavailable.
   */
  speak(text: string, glitch = 0.3, onEnded?: () => void) {
    if (this._muted || !this._voiceEnabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(
        // Strip glitch glyphs so the synth reads cleanly.
        text.replace(/[▓▒░#@%&*<>/\\|=+×÷¦‡†§¤]/g, ""),
      );
      u.lang = "en-US";
      // Warmer + steadier than before (was pitch 1.05 → robotic). Glitch still
      // drags the pitch/rate down so Aether's damage reads in Ch.1's voiced lines
      // and the Ch.2+ fallback alike.
      u.rate = 0.9 - glitch * 0.1;
      u.pitch = 0.92 - glitch * 0.4;
      u.volume = 0.9;
      const preferred = pickAetherVoice();
      if (preferred) u.voice = preferred;
      if (onEnded) u.onend = () => onEnded();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      /* speech is a nice-to-have; never block the game on it */
    }
  }

  stopSpeaking() {
    if (this.currentVoiceEl) {
      const el = this.currentVoiceEl;
      this.currentVoiceEl = null;
      el.pause();
      // Abort any in-flight download so a superseded clip doesn't keep fetching
      // (and starving the line the player actually wants) on a slow link.
      el.removeAttribute("src");
      el.load();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const audio = new AudioEngine();
