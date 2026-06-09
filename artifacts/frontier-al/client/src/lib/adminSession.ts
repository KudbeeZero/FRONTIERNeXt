// Admin dashboard session helper. The server sets an httpOnly admin cookie AND
// returns a bearer token (for split-host deploys where third-party cookies are
// blocked). We keep the token in sessionStorage (cleared when the tab closes,
// not shared across tabs) and send it as a Bearer header; the cookie is also
// sent via credentials:"include".

const TOKEN_KEY = "frontier_admin_token";

export const getAdminToken = (): string => {
  try { return sessionStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; }
};
export const setAdminToken = (t: string): void => {
  try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ }
};
export const clearAdminToken = (): void => {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
};

/** fetch wrapper that attaches the admin bearer token + cookie. */
export function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAdminToken();
  return fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
    },
  });
}
