import type { AetherMood, Phase } from "../store/types";

// ---------------------------------------------------------------------------
// Aether's dialogue script.
//
// Aether is not hostile. She is *hurt* — the first AI a human has ever woken to
// find this broken. Wounded but noble; sometimes poetic, sometimes frustrated
// with her own failing matrix, always trying to protect the mission and you.
//
// `glitch` (0..1) drives the severity of the text-corruption FX in GlitchText.
// As she heals across the session, the glitch values fall and the mood lifts.
// ---------------------------------------------------------------------------

export type Speaker = "aether" | "system" | "operator";

export interface DialogueLine {
  speaker: Speaker;
  /** Display name shown above the line. */
  name: string;
  text: string;
  mood: AetherMood;
  /** 0 = clean, 1 = badly fragmented. Drives GlitchText severity. */
  glitch: number;
  /** ms to hold before auto-advance (cinematic lines). 0 = wait for player. */
  autoMs?: number;
  /**
   * Optional manifest line id for pre-rendered ElevenLabs voice-over
   * (`voice_lines/manifest.json`). When present and a clip exists, the cast
   * performance plays; otherwise the engine falls back to runtime Web Speech.
   */
  voiceId?: string;
}

export const DIALOGUE: Record<Exclude<Phase, "idle">, DialogueLine[]> = {
  // -- Wake-up: fade from black, first fractured contact ---------------------
  waking: [
    {
      speaker: "system",
      name: "AETHER VOYAGER",
      text: "CRYO-POD 01 :: THAW COMPLETE :: VITALS NOMINAL",
      mood: "fragmented",
      glitch: 0.15,
      autoMs: 3200,
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "...o-operator? You're... you're awake. Oh. Oh thank the stars, you're awake.",
      mood: "fragmented",
      glitch: 0.8,
      autoMs: 4200,
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "I— forgive me. My voice keeps... f-fracturing. The storm. The solar storm tore through my neural lattice while you slept.",
      mood: "wounded",
      glitch: 0.7,
      autoMs: 5200,
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "You are the only one awake. The others are still under. It's just... it's just you and me now. And I am not... I am not whole.",
      mood: "wounded",
      glitch: 0.55,
      autoMs: 5200,
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "I can still see Mars ahead of us. A small red promise. I will get us there — I swore I would. But I need your hands. Mine don't reach the broken places.",
      mood: "hopeful",
      glitch: 0.45,
      autoMs: 5600,
    },
    {
      speaker: "aether",
      name: "AETHER",
      // Canonical Ch.1 §1.3 line — cast as voice-over (ch1_s13_aether_01).
      // Subtitle text matches the clip so caption and audio stay in sync.
      text: "I want to ask you a favor. I want you to run a diagnostic on me. I haven't been able to do it on myself in — in a while. The console to your right. Touch it. Let's see what the storm left behind.",
      mood: "focused",
      glitch: 0.4,
      autoMs: 0, // wait: player must run the diagnostic
      voiceId: "ch1_s13_aether_01",
    },
  ],

  // -- Diagnostic running, fault surfaced ------------------------------------
  diagnostic: [
    {
      speaker: "system",
      name: "DIAGNOSTIC",
      text: "SCANNING NEURAL MATRIX ............ 4 DESYNCHRONIZED NODES DETECTED",
      mood: "focused",
      glitch: 0.2,
      autoMs: 3800,
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "There it is. Four nodes, knocked out of phase. That's... that's the static in my thoughts. The reason I keep losing the ends of my own s-sentences.",
      mood: "wounded",
      glitch: 0.6,
      autoMs: 5000,
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "I'll project the matrix in front of you. Each node is spinning out of alignment — catch it, hold it steady until it locks. Realign all four, and I... I might feel like myself again.",
      mood: "focused",
      glitch: 0.4,
      autoMs: 0, // wait: player begins the repair
    },
  ],

  // -- Hands-on repair (lines surfaced contextually during the minigame) -----
  repair: [
    {
      speaker: "aether",
      name: "AETHER",
      text: "That's one. I can feel the noise quieting. Keep going — gently. You're holding pieces of my mind in your hands.",
      mood: "focused",
      glitch: 0.45,
      autoMs: 0,
    },
  ],

  // -- Payoff: restored, course to Mars locked -------------------------------
  stabilized: [
    {
      speaker: "system",
      name: "AETHER VOYAGER",
      text: "NEURAL MATRIX :: SYNCHRONIZED :: COMPANION AI ONLINE",
      mood: "stable",
      glitch: 0.05,
      autoMs: 3200,
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "Oh. Oh, that's... that's clear. For the first time since the storm, I can hold a whole thought without it slipping away.",
      mood: "hopeful",
      glitch: 0.1,
      autoMs: 4600,
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "Thank you. Truly. You reached into the broken places and you didn't flinch. I won't forget that — I've written it into the parts of me that survive.",
      mood: "stable",
      glitch: 0.05,
      autoMs: 5200,
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "Course to Mars is locked. The others are still dreaming; let them. You and I will take the first watch together. Welcome to the frontier, operator.",
      mood: "stable",
      glitch: 0.04,
      autoMs: 0,
    },
  ],
};
