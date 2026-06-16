// Runtime lookup for pre-rendered Aether voice-over.
//
// The generated companion module (`index.generated.ts`, written by
// `scripts/voice/generate-all.ts`) maps each manifest line id to a Vite-bundled
// asset URL. This wrapper resolves a line id to that URL, returning `null` when
// no clip has been generated yet — callers fall back to runtime Web Speech.
//
// Subtitles are always sourced from the dialogue script, never from here.
import { VOICE_URLS } from "./index.generated";

/** Bundled MP3 URL for a manifest line id, or `null` if none exists. */
export function getVoiceClip(lineId: string): string | null {
  return VOICE_URLS[lineId] ?? null;
}
