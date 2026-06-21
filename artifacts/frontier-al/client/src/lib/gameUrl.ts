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
//   - Default `/game` (relative) → correct when the app is already served by its
//     own backend (Fly): the CTA stays on the same origin.
//   - On Cloudflare Pages set `VITE_GAME_URL=https://frontiernext.fly.dev/game`
//     so "Enter Game" leaves the static homepage and lands on the backend game.
export const GAME_URL =
  (import.meta.env.VITE_GAME_URL as string | undefined)?.trim() || "/game";

/**
 * Navigate to the game. Uses a full-page navigation (not the SPA router) so an
 * absolute cross-origin URL (Cloudflare → Fly) works exactly like a relative
 * same-origin one (`/game`).
 */
export function goToGame(): void {
  window.location.href = GAME_URL;
}
