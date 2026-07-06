// Where the backend (REST + WebSocket) lives, resolved at runtime.
//
// Two-host architecture:
//   • Cloudflare Pages serves this same client bundle on the branded domain
//     (frontierprotocol.app) — static only, NO backend behind it. Same-origin
//     /api calls there hit static files (HTML 200s / 405s) and break login.
//   • Fly (frontiernext.fly.dev) serves the backend (and its own copy of the
//     client), same-origin.
//
// Build-time env always wins; otherwise: on localhost / *.fly.dev the backend
// is same-origin (empty base), on any other host (branded domain, Pages
// previews) fall back to the Fly backend cross-origin. The Fly server already
// allows the branded origin via CORS (CLIENT_ORIGIN) with Bearer-token auth.

const FLY_BACKEND = "https://frontiernext.fly.dev";

/** True when the given hostname serves its own backend (same-origin works). */
export function hostServesBackend(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".fly.dev")
  );
}

/**
 * Resolve the backend HTTP origin. Empty string = same-origin.
 * Pure — pass hostname explicitly for tests.
 */
export function resolveBackendOrigin(
  envApiUrl: string | undefined,
  hostname: string | undefined,
): string {
  const env = envApiUrl?.trim().replace(/\/$/, "");
  if (env) return env;
  if (hostname && !hostServesBackend(hostname)) return FLY_BACKEND;
  return "";
}

/** Resolve the WebSocket base (no path). Empty envWsUrl falls back like HTTP. */
export function resolveBackendWsBase(
  envWsUrl: string | undefined,
  hostname: string | undefined,
  sameOriginBase: string,
): string {
  const env = envWsUrl?.trim().replace(/\/$/, "");
  if (env) return env;
  if (hostname && !hostServesBackend(hostname)) {
    return FLY_BACKEND.replace(/^https:/, "wss:");
  }
  return sameOriginBase;
}

/** The backend HTTP origin for this page load ("" = same-origin). */
export const BACKEND_ORIGIN: string = resolveBackendOrigin(
  import.meta.env.VITE_API_URL as string | undefined,
  typeof window !== "undefined" ? window.location.hostname : undefined,
);
