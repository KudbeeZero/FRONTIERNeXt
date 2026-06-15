// Runtime lookup for pre-rendered ElevenLabs background music.
//
// The generated companion (`index.generated.ts`, written by
// `scripts/voice/generate-music.ts`) maps each track id to a Vite-bundled URL
// plus whether it should loop. Returns `null` when no track has been generated.
import { MUSIC_TRACKS, type MusicTrack } from "./index.generated";

/** Bundled track (url + loop) for an id, or `null` if none exists. */
export function getMusicTrack(id: string): MusicTrack | null {
  return MUSIC_TRACKS[id] ?? null;
}
