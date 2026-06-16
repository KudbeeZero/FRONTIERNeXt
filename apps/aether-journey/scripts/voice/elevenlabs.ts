import type { Speaker } from "./types";

const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const MUSIC_ENDPOINT = "https://api.elevenlabs.io/v1/music";
const TIMEOUT_MS = 60_000;
const BACKOFFS_MS = [2_000, 8_000, 30_000]; // up to 3 retries on transient failures

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const redact = (msg: string, key: string) => (key ? msg.split(key).join("***") : msg);

/** 429 (rate limit), 408 (request timeout) and 5xx are transient → retry. */
const isRetryable = (status: number) => status === 429 || status === 408 || status >= 500;

interface ElevenRequest {
  url: string;
  body: string;
  timeoutMs: number;
  errPrefix: string; // distinguishes TTS vs music errors; also gates retry of thrown API errors
}

/**
 * Shared POST → mp3 ArrayBuffer with retry/backoff, per-attempt timeout, and
 * API-key redaction. Centralized so the key never leaks via error text in only
 * one of the two endpoints. Throws a (redacted) Error on terminal failure.
 */
async function elevenRequest({ url, body, timeoutMs, errPrefix }: ElevenRequest): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

  let lastErr: unknown;
  for (let attempt = 0; attempt <= BACKOFFS_MS.length; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body,
        signal: controller.signal,
      });
      if (res.ok) return await res.arrayBuffer();

      const status = res.status;
      const detail = redact((await res.text()).slice(0, 500), apiKey);
      // Non-retryable 4xx (bad request, bad model, quota, auth) -> fail fast.
      if (!isRetryable(status)) throw new Error(`${errPrefix} ${status}: ${detail}`);
      if (attempt < BACKOFFS_MS.length) {
        lastErr = new Error(`${errPrefix} ${status}: ${detail}`);
        await sleep(BACKOFFS_MS[attempt]);
        continue;
      }
      throw new Error(`${errPrefix} ${status}: ${detail}`);
    } catch (err) {
      const isApiErr = err instanceof Error && err.message.startsWith(`${errPrefix} `);
      if (!isApiErr && attempt < BACKOFFS_MS.length) {
        lastErr = err;
        await sleep(BACKOFFS_MS[attempt]);
        continue;
      }
      throw err instanceof Error ? new Error(redact(err.message, apiKey)) : err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${errPrefix} request failed`);
}

/** POST text -> raw mp3 ArrayBuffer. Throws (redacted) on failure. */
export async function synthesize(text: string, speaker: Speaker): Promise<ArrayBuffer> {
  const url = `${ENDPOINT}/${speaker.voice_id}?output_format=${encodeURIComponent(speaker.output_format)}`;
  const body = JSON.stringify({
    text,
    model_id: speaker.model_id,
    voice_settings: speaker.voice_settings,
  });
  return elevenRequest({ url, body, timeoutMs: TIMEOUT_MS, errPrefix: "ElevenLabs" });
}

export interface MusicRequest {
  prompt: string;
  music_length_ms: number;
  model_id: string;
  output_format: string;
}

/** POST a text prompt -> raw mp3 ArrayBuffer of generated music. Throws (redacted) on failure. */
export async function composeMusic(req: MusicRequest): Promise<ArrayBuffer> {
  const url = `${MUSIC_ENDPOINT}?output_format=${encodeURIComponent(req.output_format)}`;
  const body = JSON.stringify({
    prompt: req.prompt,
    music_length_ms: req.music_length_ms,
    model_id: req.model_id,
  });
  // Music generation is slower than TTS — give it a longer ceiling.
  return elevenRequest({ url, body, timeoutMs: TIMEOUT_MS * 3, errPrefix: "ElevenLabs music" });
}
