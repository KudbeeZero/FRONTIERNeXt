// Where the "Enter Game" / "Join" CTAs send players.
//
// The game runs on WHATEVER origin served this bundle: API + WebSocket resolve
// to the Fly backend at runtime (`lib/backendOrigin.ts`) when the host has no
// backend of its own (e.g. frontierprotocol.app on Cloudflare Pages). Staying
// same-origin keeps localStorage (auth token, wallet pairings) intact — the
// old cross-origin jump to fly.dev dropped both, forcing a fresh wallet
// connect and resurfacing stale WalletConnect pairings (the multi-popup storm).
//
//   - VITE_GAME_URL (build-time) → explicit override, always wins.
//   - Otherwise → relative `/game` on the current origin.
function resolveGameUrl(): string {
  const envUrl = (import.meta.env.VITE_GAME_URL as string | undefined)?.trim();
  if (envUrl) return envUrl;
  return "/game";
}

export const GAME_URL = resolveGameUrl();

/**
 * Navigate to the game. Full-page navigation (not the SPA router) so an
 * absolute VITE_GAME_URL override works exactly like the relative `/game`.
 */
export function goToGame(): void {
  window.location.href = GAME_URL;
}
