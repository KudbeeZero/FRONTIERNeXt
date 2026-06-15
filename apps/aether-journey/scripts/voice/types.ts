// Shared types for the Aether voice pipeline.

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export interface Speaker {
  description: string;
  voice_id: string;
  voice_name: string;
  model_id: "eleven_v3" | "eleven_turbo_v2_5" | "eleven_multilingual_v2";
  voice_settings: VoiceSettings;
  output_format: string; // e.g. 'mp3_44100_128'
}

export interface Speakers {
  [key: string]: Speaker;
}

export interface Line {
  id: string; // ch1_s11_aether_01 — must match /^[a-z0-9_]+$/
  chapter: string; // ch1
  speaker: string; // key into Speakers
  text: string; // exact line spoken (also the subtitle source)
  notes?: string; // director notes — never sent to the API
  beat?: string; // scene/beat reference
}

export interface Manifest {
  schema_version: 1;
  lines: Line[];
}

export interface Sidecar {
  line_id: string;
  chapter: string;
  speaker: string;
  voice_id: string;
  voice_name: string;
  model_id: string;
  voice_settings: VoiceSettings;
  text: string;
  content_hash: string; // sha256(text + settings + voice_id + model_id)
  generated_at: string; // ISO
  duration_seconds: number | null; // ffprobe if available, else null
  version: number;
}

export interface LineResult {
  line_id: string;
  status: "generated" | "skipped" | "archived_and_regenerated" | "failed";
  reason?: string;
  bytes?: number;
  path?: string;
}

export interface GenerationLog {
  run_id: string;
  started_at: string;
  finished_at: string;
  total: number;
  generated: number;
  skipped: number;
  archived_and_regenerated: number;
  failed: number;
  results: LineResult[];
}
