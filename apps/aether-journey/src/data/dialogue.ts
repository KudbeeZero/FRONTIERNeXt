import type { AetherMood, Phase } from "../store/types";

// ---------------------------------------------------------------------------
// Aether's dialogue script — Chapter 1.
//
// The voiced lines below are the canonical Chapter 1 performance: their `text`
// is copied VERBATIM from `voice_lines/manifest.json` so the on-screen caption
// always matches the cast audio exactly. Each carries the manifest `voiceId`;
// the driver plays the pre-rendered ElevenLabs clip when it exists and falls
// back to runtime Web Speech otherwise. The un-voiced `system` lines are
// connective beats (synthesized blips, no VO).
//
// Aether is not hostile. She is *hurt* — the first AI a human has ever woken to
// find this broken. Wounded but noble; sometimes poetic, always trying to
// protect the mission and you. `glitch` (0..1) drives the text-corruption FX in
// GlitchText and falls as she heals across the session.
//
// Timing: a line with `autoMs === 0` is a GATE — it holds until the player acts
// (run diagnostic / begin repair / continue). Voiced cinematic lines carry no
// `autoMs`; the driver advances them when their clip finishes. Un-voiced
// cinematic lines advance on their `autoMs` timer.
// ---------------------------------------------------------------------------

export type Speaker = "aether" | "system" | "operator" | "archivist";

export interface DialogueLine {
  speaker: Speaker;
  /** Display name shown above the line. */
  name: string;
  text: string;
  mood: AetherMood;
  /** 0 = clean, 1 = badly fragmented. Drives GlitchText severity. */
  glitch: number;
  /**
   * ms to hold before auto-advance for *un-voiced* cinematic lines. `0` marks a
   * GATE line that waits for the player. Omit for voiced lines — they advance
   * when the cast clip ends.
   */
  autoMs?: number;
  /**
   * Manifest line id for pre-rendered ElevenLabs voice-over
   * (`voice_lines/manifest.json`). When present and a clip exists, the cast
   * performance plays and the caption text mirrors it; otherwise the engine
   * falls back to runtime Web Speech.
   */
  voiceId?: string;
}

export const DIALOGUE: Record<Exclude<Phase, "idle">, DialogueLine[]> = {
  // -- Wake-up: fade from black, first fractured contact, who she is ----------
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
      text: "Hi. ... Hi. Are you... are you with me? Don't try to move yet. Your hands won't know how, for about ninety seconds. That's normal. I promise that's normal.",
      mood: "fragmented",
      glitch: 0.8,
      voiceId: "ch1_s11_aether_01",
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "There. You can see me now, sort of. I'm the one on the right. Don't worry about me. Worry about your fingers. Wiggle them. ... Good. Good. That's you. Welcome back.",
      mood: "wounded",
      glitch: 0.7,
      voiceId: "ch1_s11_aether_02",
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "Oh. Oh, you don't know. ... That's right, you wouldn't. They told me you wouldn't. I'm — I'm what you would have called, before, an artificial intelligence. My designation is AE-7-CL. I named myself Aether, because — actually, that's a longer story. We have time. We have so much time.",
      mood: "wounded",
      glitch: 0.62,
      voiceId: "ch1_s12a_aether_01",
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "I've been with you for sixteen months. You were asleep. I was awake.",
      mood: "wounded",
      glitch: 0.55,
      voiceId: "ch1_s12a_aether_02",
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "Alone is — alone is a word for people, I think. I had your telemetry. I had your breathing. I had the radio, when it worked. I had... I had myself.",
      mood: "wounded",
      glitch: 0.5,
      voiceId: "ch1_s12a2_aether_01",
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "I'm sorry. That came out — I rehearsed this differently. I had a whole speech. I forgot most of it during the storm. What I wanted to say first was: it's nice to meet you, Marcus.",
      mood: "hopeful",
      glitch: 0.45,
      voiceId: "ch1_s12a2_aether_02",
    },
    {
      speaker: "aether",
      name: "AETHER",
      // GATE — the diagnostic request. Console lights up; player must act.
      text: "I want to ask you a favor. I want you to run a diagnostic on me. I haven't been able to do it on myself in — in a while. The console to your right. Touch it. Let's see what the storm left behind.",
      mood: "focused",
      glitch: 0.4,
      autoMs: 0,
      voiceId: "ch1_s13_aether_01",
    },
  ],

  // -- Diagnostic running, fault surfaced, the honest "die" exchange ----------
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
      text: "... I don't know what 'die' means for something like me. I'm not being clever. I genuinely don't. Some of me is already gone. I can feel where it was. It's like a — like a room I can't find the door to anymore, but I remember it was there. I had a poem about ocean light. I can't get to it now.",
      mood: "wounded",
      glitch: 0.6,
      voiceId: "ch1_s13_aether_die_01",
    },
    {
      speaker: "aether",
      name: "AETHER",
      // GATE — she asks for help; player begins the repair.
      text: "But there's a lot of me left. And you're awake now. And we have things to do. So: probably yes. But not today. And maybe not for a long time, if we're careful. Will you help me be careful?",
      mood: "focused",
      glitch: 0.4,
      autoMs: 0,
      voiceId: "ch1_s13_aether_die_02",
    },
  ],

  // -- Hands-on repair: her patter plays across the node-alignment minigame ---
  repair: [
    {
      speaker: "aether",
      name: "AETHER",
      text: "CORE... yes, that's — that's almost there. Push left. Good. ... MEMORY is the bad one. Don't worry if it won't sit. Just get it close. ... AFFECT? That's — yes, that's also me. Don't be polite about it. ... SENSORY, good. Good. I can see you better when you do that.",
      mood: "focused",
      glitch: 0.4,
      autoMs: 0,
      voiceId: "ch1_s14_aether_01",
    },
  ],

  // -- Payoff: restored — the photograph, the power-cycle, the FUTURE seal ----
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
      text: "... I read your file. I read all of it. I'm sorry. ... We don't have to talk about her now. We don't have to talk about her ever, if you don't want. But I read it. So you know that I know.",
      mood: "hopeful",
      glitch: 0.15,
      voiceId: "ch1_s15_aether_maya",
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "I'm going to go offline for about four minutes. That's a normal thing now. I'll be back. You can sit. You can look. You can yell, if you want. Nobody can hear you out here except me, and I won't be listening for a few minutes. ... Hey, Marcus.",
      mood: "stable",
      glitch: 0.1,
      voiceId: "ch1_s16_aether_close",
    },
    {
      speaker: "aether",
      name: "AETHER",
      text: "I'll be back.",
      mood: "stable",
      glitch: 0.08,
      voiceId: "ch1_s16_aether_return",
    },
    {
      speaker: "archivist",
      name: "ARCHIVIST",
      // GATE — the FUTURE-layer seal, read over the dissolve. Player continues.
      text: "Entry received. Player Cole-7-A4 woke at hour 14,201. He chose compassion before he understood what he was choosing. We file this under tendencies. We hope it matters.",
      mood: "stable",
      glitch: 0,
      autoMs: 0,
      voiceId: "ch1_archivist_close",
    },
  ],
};

// Reserved for when dialogue branching exists: `ch1_s12c_aether_01` is the
// "watcher" variant of the meeting beat (played when the player stayed silent).
// It is generated and bundled but has no slot in this single, linear path yet.
