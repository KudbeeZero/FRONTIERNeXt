import { createHash } from "node:crypto";
import type { Speaker, VoiceSettings } from "./types";

/** Stable: sort keys so serialization is deterministic across runs. */
function stableSettings(s: VoiceSettings): string {
  const keys = Object.keys(s).sort() as (keyof VoiceSettings)[];
  return JSON.stringify(s, keys as string[]);
}

/** sha256(text + sorted(voice_settings) + voice_id + model_id), hex. */
export function contentHash(text: string, speaker: Speaker): string {
  const input = `${text}${stableSettings(speaker.voice_settings)}${speaker.voice_id}${speaker.model_id}`;
  return createHash("sha256").update(input, "utf8").digest("hex");
}
