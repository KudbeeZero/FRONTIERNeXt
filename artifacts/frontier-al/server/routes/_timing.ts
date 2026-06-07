// AUTO-SPLIT from server/routes.ts (feat/routes-refactor, MASTER A2).
// API route timing diagnostics — module-level state shared by the orchestrator
// (periodic logging) and the admin metrics route. Verbatim logic, zero change.

import type { Request, Response } from "express";

// ── API Route Timing Diagnostics ──────────────────────────────────────────────
export const _apiRouteTimings: Record<string, { count: number; totalTimeMs: number; maxTimeMs: number; slowCount: number }> = {};
export const SLOW_API_THRESHOLD_MS = 1000; // Log warnings for routes taking >1s

/**
 * Wrap an async route handler with timing diagnostics.
 * Logs slow requests and tracks aggregate stats per route.
 */
export function withTiming(
  routeName: string,
  handler: (req: Request, res: Response) => Promise<void | Response>
): (req: Request, res: Response) => Promise<void | Response> {
  if (!_apiRouteTimings[routeName]) {
    _apiRouteTimings[routeName] = { count: 0, totalTimeMs: 0, maxTimeMs: 0, slowCount: 0 };
  }

  return async (req: Request, res: Response) => {
    const start = Date.now();
    _apiRouteTimings[routeName].count++;

    try {
      const result = await handler(req, res);
      const duration = Date.now() - start;
      _apiRouteTimings[routeName].totalTimeMs += duration;
      if (duration > _apiRouteTimings[routeName].maxTimeMs) {
        _apiRouteTimings[routeName].maxTimeMs = duration;
      }

      // Log slow requests
      if (duration > SLOW_API_THRESHOLD_MS) {
        _apiRouteTimings[routeName].slowCount++;
        console.warn(
          `[api] SLOW: ${req.method} ${routeName} took ${duration}ms ` +
          `(avg: ${(_apiRouteTimings[routeName].totalTimeMs / _apiRouteTimings[routeName].count).toFixed(0)}ms, ` +
          `max: ${_apiRouteTimings[routeName].maxTimeMs}ms, slow: ${_apiRouteTimings[routeName].slowCount})`
        );
      }

      return result;
    } catch (err) {
      const duration = Date.now() - start;
      _apiRouteTimings[routeName].totalTimeMs += duration;
      console.error(`[api] ERROR: ${req.method} ${routeName} failed after ${duration}ms:`, err instanceof Error ? err.message : err);
      throw err;
    }
  };
}

/**
 * Log aggregate API route timing stats. Call periodically.
 */
export function logApiRouteStats(): void {
  const entries = Object.entries(_apiRouteTimings).filter(([, stats]) => stats.count > 0);
  if (entries.length === 0) return;

  console.log("[api] Route timing stats:");
  for (const [route, stats] of entries) {
    const avg = stats.totalTimeMs / stats.count;
    console.log(
      `  ${route}: calls=${stats.count}, avg=${avg.toFixed(0)}ms, ` +
      `max=${stats.maxTimeMs}ms, slow=${stats.slowCount}`
    );
  }
}

// Log API stats every 120 seconds
setInterval(() => {
  logApiRouteStats();
}, 120_000);
