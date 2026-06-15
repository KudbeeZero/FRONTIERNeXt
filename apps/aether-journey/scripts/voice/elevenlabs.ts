import type { Speaker } from "./types";

const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const TIMEOUT_MS = 60_000;
const BACKOFFS_MS = [2_000, 8_000, 30_000]; // up to 3 retries on 429/5xx

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const redact = (msg: string, key: string) => (key ? msg.split(key).join("***") : msg);

/** POST text -> raw mp3 ArrayBuffer. Throws (redacted) on failure. */
export async function synthesize(text: string, speaker: Speaker): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

  const url = `${ENDPOINT}/${speaker.voice_id}?output_format=${encodeURIComponent(speaker.output_format)}`;
  const body = JSON.stringify({
    text,
    model_id: speaker.model_id,
    voice_settings: speaker.voice_settings,
  });

  let lastErr: unknown;
  for (let attempt = 0; attempt <= BACKOFFS_MS.length; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
      // 4xx other than 429 -> fail fast (bad request, bad model, quota, etc.).
      if (status !== 429 && status < 500) throw new Error(`ElevenLabs ${status}: ${detail}`);
      if (attempt < BACKOFFS_MS.length) {
        lastErr = new Error(`ElevenLabs ${status}: ${detail}`);
        await sleep(BACKOFFS_MS[attempt]);
        continue;
      }
      throw new Error(`ElevenLabs ${status}: ${detail}`);
    } catch (err) {
      const isApiErr = err instanceof Error && err.message.startsWith("ElevenLabs ");
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
  throw lastErr instanceof Error ? lastErr : new Error("ElevenLabs request failed");
}
