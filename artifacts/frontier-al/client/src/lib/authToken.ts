// Session-token storage for wallet-signature auth.
// Kept dependency-free so both queryClient (request layer) and auth (login flow)
// can import it without a circular dependency.

const TOKEN_KEY = "frontier_session_token";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable — cookie fallback still applies */
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
