/**
 * usePrefersReducedMotion — reactive read of the OS "reduce motion" setting.
 *
 * Returns true when the user has asked the system to minimise non-essential
 * motion. Used to suppress the battle cinematics (flashing combat FX) in favour
 * of their static fallbacks. SSR-safe (returns false when matchMedia is absent).
 */
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function getSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
