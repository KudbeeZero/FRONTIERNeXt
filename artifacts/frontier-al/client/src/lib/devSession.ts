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

/**
 * Zero-click variant: when this is also "true", the landing page performs the
 * dev quick-auth on load and enters the game WITHOUT a button click — for fast
 * local iteration when you can't get TestNet funds. Still triple-gated: this
 * flag AND VITE_DEV_MODE (build-time) AND the server's DEV_LOGIN_ENABLED (which
 * 403s otherwise). Off by default; never set it in a production build.
 */
export const DEV_AUTOLOGIN = import.meta.env.VITE_DEV_AUTOLOGIN === "true";

const SESSION_KEY = "frontier_dev_session";
const ADDRESS_KEY = "frontier_dev_address";

/**
 * Fail-closed gate for zero-click auto-login. Both build flags must be on AND no
 * dev session may already exist (so it fires once, never loops). Pure so the
 * "off unless explicitly enabled" property is unit-pinned.
 */
export function shouldDevAutoLogin(
  devMode: boolean,
  devAutoLogin: boolean,
  sessionAlreadyActive: boolean,
): boolean {
  return devMode && devAutoLogin && !sessionAlreadyActive;
}

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

/**
 * The dev/test player is bound to a non-wallet sentinel and can NEVER claim an
 * NFT out of escrow — so for it, "in custody" is meaningless noise that both nags
 * (Claim-NFT prompts) and blocks (mining/upgrades show "NFT Required"). Collapse
 * it to false for the dev player so the test experience is unblocked and quiet.
 * Real players are unaffected (passthrough). Pure — `devActive` is injectable so
 * the rule is unit-pinned without a DOM.
 */
export function effectiveInCustody(
  rawInCustody: boolean | null | undefined,
  devActive: boolean = devSessionActive(),
): boolean {
  return devActive ? false : !!rawInCustody;
}
