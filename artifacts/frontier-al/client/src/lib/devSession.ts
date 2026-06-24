/**
 * client/src/lib/devSession.ts
 *
 * Client half of the DEV / TEST entry. A "Developer / Test Mode" button on the
 * landing page (shown only when VITE_DEV_MODE === "true") calls
 * POST /api/dev/quick-auth, stores the returned dev address here, and enters the
 * game. `useWallet()` then presents that address as a connected+authenticated
 * identity, so the whole game works as a persistent test player — no wallet, no
 * signature — for testing battles + recording video.
 *
 * Gated twice: this client flag AND the server's DEV_LOGIN_ENABLED. Off by
 * default; never ship enabled to mainnet.
 */
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";

const SESSION_KEY = "frontier_dev_session";
const ADDRESS_KEY = "frontier_dev_address";

/** True when a dev/test session has been started in this browser (and DEV_MODE is on). */
export function devSessionActive(): boolean {
  if (!DEV_MODE || typeof window === "undefined") return false;
  return window.localStorage.getItem(SESSION_KEY) === "1";
}

export function devSessionAddress(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ADDRESS_KEY);
}

export function startDevSession(address: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, "1");
  window.localStorage.setItem(ADDRESS_KEY, address);
}

export function endDevSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(ADDRESS_KEY);
}
