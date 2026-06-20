/**
 * server/services/voice/elevenlabs.spec.ts
 *
 * Proves the optional voice helper degrades gracefully: no key / no voice id →
 * null with NO network call; a configured call returns a base64 clip; transport
 * failure or non-ok response → null (text-only). Voice is never load-bearing.
 */
import { describe, it, expect, vi } from "vitest";
import { synthesizeWhisper, isVoiceConfigured } from "./elevenlabs";

describe("synthesizeWhisper", () => {
  it("returns null and makes NO network call when unconfigured", async () => {
    const fetchImpl = vi.fn();
    expect(await synthesizeWhisper("hello", { apiKey: "", voiceId: "", fetchImpl: fetchImpl as any })).toBeNull();
    expect(await synthesizeWhisper("hello", { apiKey: "k", voiceId: "", fetchImpl: fetchImpl as any })).toBeNull();
    expect(await synthesizeWhisper("hello", { apiKey: "", voiceId: "v", fetchImpl: fetchImpl as any })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns null for empty text without calling out", async () => {
    const fetchImpl = vi.fn();
    expect(await synthesizeWhisper("   ", { apiKey: "k", voiceId: "v", fetchImpl: fetchImpl as any })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns a base64 clip on a successful synth", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    })) as any;
    const clip = await synthesizeWhisper("the sky was blue", { apiKey: "k", voiceId: "v", fetchImpl });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(clip).not.toBeNull();
    expect(clip!.mime).toBe("audio/mpeg");
    expect(Buffer.from(clip!.audioBase64, "base64")).toEqual(Buffer.from([1, 2, 3, 4]));
  });

  it("returns null on a non-ok response", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) })) as any;
    expect(await synthesizeWhisper("x", { apiKey: "k", voiceId: "v", fetchImpl })).toBeNull();
  });

  it("returns null when the transport throws (fail-open)", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("network"); }) as any;
    expect(await synthesizeWhisper("x", { apiKey: "k", voiceId: "v", fetchImpl })).toBeNull();
  });

  it("isVoiceConfigured reflects both env vars", () => {
    expect(isVoiceConfigured({} as any)).toBe(false);
    expect(isVoiceConfigured({ ELEVENLABS_API_KEY: "k" } as any)).toBe(false);
    expect(isVoiceConfigured({ ELEVENLABS_API_KEY: "k", COMM_TERMINAL_VOICE_ID: "v" } as any)).toBe(true);
  });
});
