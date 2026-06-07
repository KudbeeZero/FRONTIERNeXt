/**
 * Globe visual preferences — player-customisable territory / enemy colours.
 *
 * Pure client state: persisted to localStorage, no server. A minimal external
 * store (useSyncExternalStore) so any component can read/update and the globe
 * re-paints when colours change (the prefs feed into plotVisualFingerprint).
 */

const STORAGE_KEY = "frontier_globe_prefs";

export interface VisualPrefs {
  /** Your territory colour (hex). */
  territoryColor: string;
  /** Enemy territory colour (hex). */
  enemyColor: string;
}

export const DEFAULT_PREFS: VisualPrefs = {
  territoryColor: "#00ffaa", // matches COLOR_PLAYER
  enemyColor: "#ff4400",     // matches COLOR_ENEMY
};

function load(): VisualPrefs {
  if (typeof localStorage === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<VisualPrefs>;
    return {
      territoryColor: parsed.territoryColor || DEFAULT_PREFS.territoryColor,
      enemyColor: parsed.enemyColor || DEFAULT_PREFS.enemyColor,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

// Single cached snapshot object — its reference only changes on a real update,
// so useSyncExternalStore stays stable (no render loops).
let state: VisualPrefs = load();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getVisualPrefs(): VisualPrefs {
  return state;
}

export function setVisualPref<K extends keyof VisualPrefs>(key: K, value: VisualPrefs[K]): void {
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / unavailable */
  }
  emit();
}

export function resetVisualPrefs(): void {
  state = { ...DEFAULT_PREFS };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  emit();
}

export function subscribeVisualPrefs(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
