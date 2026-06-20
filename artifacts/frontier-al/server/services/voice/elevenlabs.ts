/**
 * server/services/voice/elevenlabs.ts
 *
 * Thin, OPTIONAL ElevenLabs text-to-speech helper for the Comm Terminal.
 *
 * Voice is a bonus layer: if no `ELEVENLABS_API_KEY` (or no `COMM_TERMINAL_VOICE_ID`)
 * is configured, this returns `null` and the terminal runs text-only — it never
 * throws and never makes a network call without a key. Mirrors the existing aether
 * pipeline (`apps/aether-journey/scripts/voice/elevenlabs.ts`) but server-side and
 * fail-open. No secrets are committed — keys live only in the host env.
 */

export interface VoiceClip {
  /** base64-encoded MP3 the client can play via a data: URL. */
  audioBase64: string;
  mime: "audio/mpeg";
}

export interface SynthOpts {
  /** Override the key (tests). Defaults to process.env.ELEVENLABS_API_KEY. */
  apiKey?: string;
  /** Override the voice id (tests). Defaults to process.env.COMM_TERMINAL_VOICE_ID. */
  voiceId?: string;
  /** Injectable fetch for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Synthesize a whisper to speech. Returns `null` (text-only) when unconfigured or
 * on any failure — callers should treat audio as best-effort.
 */
export async function synthesizeWhisper(text: string, opts: SynthOpts = {}): Promise<VoiceClip | null> {
  const apiKey = opts.apiKey ?? process.env.ELEVENLABS_API_KEY ?? "";
  const voiceId = opts.voiceId ?? process.env.COMM_TERMINAL_VOICE_ID ?? "";
  // Graceful no-op: no key / no voice / no text → text-only (no network call).
  if (!apiKey || !voiceId || !text.trim()) return null;

  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        // Low stability + raised style → a wavering, emotional, "lost" delivery.
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.25, similarity_boost: 0.7, style: 0.6 },
        }),
      },
    );
    if (!res || !res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    return { audioBase64: buf.toString("base64"), mime: "audio/mpeg" };
  } catch {
    return null; // fail-open: voice is never load-bearing
  }
}

/** True when voice synthesis is configured (key + voice id present). */
export function isVoiceConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!env.ELEVENLABS_API_KEY && !!env.COMM_TERMINAL_VOICE_ID;
}
