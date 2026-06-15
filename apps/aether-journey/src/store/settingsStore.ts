import { create } from "zustand";
import { useEffect, useRef } from "react";
import { audio } from "../lib/audioEngine";
import { useGameStore } from "./gameStore";

// ---------------------------------------------------------------------------
// Player-facing preferences + local (on-device) run stats.
//
// Deliberately SEPARATE from gameStore: gameStore is the canonical session /
// on-chain ledger and stays untouched. This store holds menu settings (audio,
// voice, reduced motion) and best-run stats, persisted to localStorage. No
// backend, no accounts — just a personal scoreboard.
// ---------------------------------------------------------------------------

const SETTINGS_KEY = "aether.settings.v1";
const STATS_KEY = "aether.stats.v1";

export interface Settings {
  muted: boolean;
  /** 0..1 master volume. */
  volume: number;
  voiceEnabled: boolean;
  reducedMotion: boolean;
  /** Always-on clean captions for spoken dialogue. */
  subtitles: boolean;
}

export interface RunStats {
  /** Fastest full repair (all nodes realigned), in ms. null until first run. */
  bestRepairMs: number | null;
  /** Highest Aether stability reached at journey resume (%). */
  bestStability: number | null;
  /** Completed runs on this device. */
  runs: number;
  /** The most recent run, for the end card. */
  lastRepairMs: number | null;
  lastStability: number | null;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function load<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as object) } : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — settings just won't persist, no big deal */
  }
}

const defaultSettings: Settings = {
  muted: false,
  volume: 1,
  voiceEnabled: true,
  reducedMotion: prefersReducedMotion(),
  subtitles: false,
};

const defaultStats: RunStats = {
  bestRepairMs: null,
  bestStability: null,
  runs: 0,
  lastRepairMs: null,
  lastStability: null,
};

interface SettingsState extends Settings {
  stats: RunStats;
  setMuted: (v: boolean) => void;
  setVolume: (v: number) => void;
  setVoiceEnabled: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
  setSubtitles: (v: boolean) => void;
  recordRun: (repairMs: number, stability: number) => void;
}

const initialSettings = load<Settings>(SETTINGS_KEY, defaultSettings);

// Apply the persisted audio prefs to the engine up front.
audio.setMuted(initialSettings.muted);
audio.setVolume(initialSettings.volume);
audio.setVoiceEnabled(initialSettings.voiceEnabled);

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...initialSettings,
  stats: load<RunStats>(STATS_KEY, defaultStats),

  setMuted: (v) => {
    audio.setMuted(v);
    set({ muted: v });
    persistSettings(get);
  },
  setVolume: (v) => {
    audio.setVolume(v);
    set({ volume: v });
    persistSettings(get);
  },
  setVoiceEnabled: (v) => {
    audio.setVoiceEnabled(v);
    set({ voiceEnabled: v });
    persistSettings(get);
  },
  setReducedMotion: (v) => {
    set({ reducedMotion: v });
    persistSettings(get);
  },
  setSubtitles: (v) => {
    set({ subtitles: v });
    persistSettings(get);
  },

  recordRun: (repairMs, stability) => {
    set((s) => {
      const stats: RunStats = {
        runs: s.stats.runs + 1,
        lastRepairMs: repairMs,
        lastStability: stability,
        bestRepairMs:
          s.stats.bestRepairMs == null
            ? repairMs
            : Math.min(s.stats.bestRepairMs, repairMs),
        bestStability:
          s.stats.bestStability == null
            ? stability
            : Math.max(s.stats.bestStability, stability),
      };
      save(STATS_KEY, stats);
      return { stats };
    });
  },
}));

function persistSettings(get: () => SettingsState) {
  const { muted, volume, voiceEnabled, reducedMotion, subtitles } = get();
  save(SETTINGS_KEY, { muted, volume, voiceEnabled, reducedMotion, subtitles });
}

/** Cheap per-frame read for the R3F loops (no React re-render). */
export const isReducedMotion = () => useSettingsStore.getState().reducedMotion;

/**
 * Records a local run when the player completes Phase 1. Timing starts when the
 * repair phase begins and is captured the moment the journey resumes. Mount once
 * (App root). Recording is guarded so a run is logged exactly once.
 */
export function useRunStats() {
  const phase = useGameStore((s) => s.phase);
  const journeyResumed = useGameStore((s) => s.journeyResumed);
  const recordRun = useSettingsStore((s) => s.recordRun);
  const repairStart = useRef<number | null>(null);
  const recorded = useRef(false);

  useEffect(() => {
    if (phase === "repair" && repairStart.current === null) {
      repairStart.current = performance.now();
    }
  }, [phase]);

  useEffect(() => {
    if (journeyResumed && !recorded.current) {
      recorded.current = true;
      const start = repairStart.current ?? performance.now();
      const repairMs = Math.max(0, Math.round(performance.now() - start));
      const stability = useGameStore.getState().systems.aetherStability;
      recordRun(repairMs, stability);
    }
  }, [journeyResumed, recordRun]);
}
