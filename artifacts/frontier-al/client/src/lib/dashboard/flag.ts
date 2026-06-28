/**
 * Feature flag for the draggable snap-grid dashboard.
 *
 * Default OFF so the live game's HUD is unchanged — the new widget canvas only
 * mounts when explicitly enabled, which keeps this first unit safe to ship
 * without on-device verification. Enable via either:
 *   - URL: `?dashboard=1` (sticky — persisted once seen), or `?dashboard=0` to disable
 *   - localStorage: `frontier_dashboard_enabled` = "1"
 *
 * Pure-ish: reads `window` defensively so it's SSR/test safe.
 */
const FLAG_KEY = "frontier_dashboard_enabled";

/** Decide enablement from a URL search string + a persisted flag. Pure for tests. */
export function resolveDashboardFlag(search: string, persisted: string | null): boolean {
  const params = new URLSearchParams(search);
  const q = params.get("dashboard");
  if (q === "1" || q === "true") return true;
  if (q === "0" || q === "false") return false;
  return persisted === "1";
}

/** True when the widget dashboard should mount. Sticks a `?dashboard=1` choice. */
export function isDashboardEnabled(): boolean {
  if (typeof window === "undefined") return false;
  let persisted: string | null = null;
  try {
    persisted = window.localStorage.getItem(FLAG_KEY);
  } catch {
    /* storage unavailable */
  }
  const enabled = resolveDashboardFlag(window.location.search, persisted);
  // Persist an explicit URL choice so it survives the in-app navigations.
  try {
    const q = new URLSearchParams(window.location.search).get("dashboard");
    if (q != null) window.localStorage.setItem(FLAG_KEY, enabled ? "1" : "0");
  } catch {
    /* best-effort */
  }
  return enabled;
}

/** Programmatic toggle (e.g. a HUD switch). */
export function setDashboardEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FLAG_KEY, on ? "1" : "0");
  } catch {
    /* best-effort */
  }
}
