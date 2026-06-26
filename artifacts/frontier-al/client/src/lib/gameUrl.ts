// Where the "Enter Game" / "Join" CTAs send players.
//
// Two-host architecture:
//   • The static homepage (landing page) is hosted on Cloudflare Pages. It has
//     NO backend, so it must never try to run the game itself.
//   • The full game (client + WebSocket + REST) is served by the backend (Fly,
//     `frontiernext.fly.dev`) — client and server SAME-ORIGIN, so wallet/WS/CORS
//     all "just work".
//
// So "Enter Game" must jump to the backend that serves the live game.
//
//   - VITE_GAME_URL (build-time) → explicit override, always wins.
//   - On localhost / *.fly.dev → use relative `/game` (same-origin backend).
//   - Any other host (e.g. frontierprotocol.app on Cloudflare) → cross-origin
//     to the Fly backend so dev/session flags work. No dashboard config required.
const FLY_GAME_URL = "https://frontiernext.fly.dev/game";

function resolveGameUrl(): string {
  const envUrl = (import.meta.env.VITE_GAME_URL as string | undefined)?.trim();
  if (envUrl) return envUrl;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1" && !host.endsWith("fly.dev")) {
      return FLY_GAME_URL;
    }
  }
  return "/game";
}

export const GAME_URL = resolveGameUrl();

/**
 * Navigate to the game. Uses a full-page navigation (not the SPA router) so an
 * absolute cross-origin URL (Cloudflare → Fly) works exactly like a relative
 * same-origin one (`/game`).
 */
export function goToGame(): void {
  window.location.href = GAME_URL;
}
