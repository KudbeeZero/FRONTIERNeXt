import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthToken, clearAuthToken } from "./authToken";
import { BACKEND_ORIGIN } from "./backendOrigin";
import { toast } from "@/hooks/use-toast";

// Server-side code for the 403 "session does not own this player" branch of
// evaluateOwnership() (server/routeOwnership.ts) — a stale/mismatched session
// (e.g. after a wallet reconnect/switch) rather than a genuine permission
// error. Recovered here instead of leaving every call site to show a raw,
// unrecoverable error toast.
const SESSION_MISMATCH_CODE = "SESSION_MISMATCH";

// Guards against a burst of concurrent requests all triggering recovery at once.
let sessionRecoveryTriggered = false;

function recoverFromSessionMismatch() {
  if (sessionRecoveryTriggered) return;
  sessionRecoveryTriggered = true;
  clearAuthToken();
  toast({
    title: "Session out of sync",
    description: "Your wallet session was reset — reconnecting…",
    variant: "destructive",
  });
  setTimeout(() => window.location.reload(), 1500);
}

/** Attach the wallet session token (if any) as a Bearer header. */
function withAuthHeaders(base: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

// ── API base URL ──────────────────────────────────────────────────────────────
// VITE_API_URL (build-time) wins; otherwise resolved at runtime so the branded
// Cloudflare host (frontierprotocol.app) talks to the Fly backend cross-origin
// instead of dead-ending on static files. Same-origin ("") on localhost /
// *.fly.dev, where the Vite dev proxy or the Fly server handles /api/*.
const _API_BASE: string = BACKEND_ORIGIN;

/** Resolve a relative /api (or /nft, /faction) path to an absolute URL. */
export function resolveApiUrl(path: string): string {
  return `${_API_BASE}${path}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    if (res.status === 403) {
      try {
        if (JSON.parse(text)?.code === SESSION_MISMATCH_CODE) {
          recoverFromSessionMismatch();
        }
      } catch {
        /* not JSON — not a coded response, fall through to generic error */
      }
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(resolveApiUrl(url), {
    method,
    headers: withAuthHeaders(data ? { "Content-Type": "application/json" } : {}),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = resolveApiUrl(queryKey[0] as string);
    const res = await fetch(url, {
      headers: withAuthHeaders(),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
