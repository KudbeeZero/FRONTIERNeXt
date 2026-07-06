import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthToken } from "./authToken";
import { BACKEND_ORIGIN } from "./backendOrigin";

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
