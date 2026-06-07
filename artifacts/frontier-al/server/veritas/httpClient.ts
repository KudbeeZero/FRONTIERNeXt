/**
 * server/veritas/httpClient.ts
 *
 * Minimal JSON HTTP client VERITAS uses to hit the live backend the way a real client
 * would. Adds the admin key header for privileged endpoints. No retries — a flaky call
 * is itself a signal the harness should surface.
 */

export interface HttpResponse<T = unknown> {
  ok: boolean;
  status: number;
  body: T;
}

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly adminKey?: string,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async get<T = unknown>(path: string): Promise<HttpResponse<T>> {
    return this.request<T>("GET", path);
  }

  async post<T = unknown>(path: string, body?: unknown, admin = false): Promise<HttpResponse<T>> {
    return this.request<T>("POST", path, body, admin);
  }

  private async request<T>(method: string, path: string, body?: unknown, admin = false): Promise<HttpResponse<T>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (admin && this.adminKey) headers["x-admin-key"] = this.adminKey;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let parsed: T;
    try {
      parsed = (await res.json()) as T;
    } catch {
      parsed = undefined as T;
    }
    return { ok: res.ok, status: res.status, body: parsed };
  }
}
