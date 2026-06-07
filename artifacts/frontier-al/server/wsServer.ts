/**
 * server/wsServer.ts
 *
 * FRONTIER WebSocket broadcast server.
 *
 * Dirty-flag + debounce design:
 *   - Any part of the server calls markDirty() when game state changes.
 *   - A flush loop runs every FLUSH_INTERVAL_MS. If dirty, it fetches
 *     game state once and broadcasts to all clients. Then clears the flag.
 *   - Player action handlers call markDirty() instead of the old pattern
 *     of getGameState() + broadcastGameState() inline.
 *   - Result: no matter how many actions fire in one flush window, exactly
 *     one DB read and one broadcast round occurs per interval.
 *
 * Message envelope format:
 *   { type: "game_state_update", payload: GameState }
 *   { type: "ping" }
 *
 * Clients MUST respond to "ping" with "pong" within 30 seconds or they
 * are terminated.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import type { IStorage } from "./storage";
import type { GameState } from "@shared/schema";
import { getPoolStats } from "./db";
import { verifySession, isWalletAuthRequired, SESSION_COOKIE } from "./auth";
import { scopeGameStateFor } from "./stateScope";

const FLUSH_INTERVAL_MS = 1_500;

/** A connected socket annotated with the authenticated player (null = anon). */
type WsClient = WebSocket & { playerId?: string | null };

// ── Connection limits (DoS hardening) ────────────────────────────────────────
// Inbound frames are only small ping/pong JSON, so cap payload size well above
// that. Connection caps default to a generous per-IP limit (tune/disable via
// env: 0 = unlimited) so they protect against connection-spam without wrongly
// blocking legitimately NAT'd users.
const WS_MAX_PAYLOAD_BYTES = 64 * 1024;
// Guard against a non-numeric env value silently disabling the cap (NaN). 0 = disabled.
const _perIpRaw = Number(process.env.WS_MAX_CONN_PER_IP);
const WS_MAX_CONN_PER_IP = Number.isFinite(_perIpRaw) ? _perIpRaw : 25;
const _globalRaw = Number(process.env.WS_MAX_CONN);
const WS_MAX_CONN = Number.isFinite(_globalRaw) ? _globalRaw : 0;
const _connByIp = new Map<string, number>();

/** Real client IP, honouring the trust-proxy X-Forwarded-For first hop. */
function clientIpFromReq(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : (fwd ?? "").split(",")[0];
  return (first || req.socket.remoteAddress || "unknown").trim();
}

/**
 * Extract the session token from the upgrade request. Browsers cannot set
 * custom headers on a WebSocket, so the token arrives via the `?token=` query
 * param (primary) or the session cookie (same-/cross-site with SameSite=None).
 */
function tokenFromReq(req: IncomingMessage): string | null {
  try {
    const url = new URL(req.url ?? "", "http://localhost");
    const q = url.searchParams.get("token");
    if (q) return q;
  } catch { /* malformed url */ }
  const cookie = req.headers.cookie;
  if (cookie) {
    for (const part of cookie.split(";")) {
      const i = part.indexOf("=");
      if (i < 0) continue;
      if (part.slice(0, i).trim() === SESSION_COOKIE) {
        return decodeURIComponent(part.slice(i + 1).trim());
      }
    }
  }
  return null;
}

// ── Diagnostic counters ──────────────────────────────────────────────────────
let _flushCount = 0;
let _flushErrorCount = 0;
let _totalFlushTimeMs = 0;
let _maxFlushTimeMs = 0;
let _maxPayloadSize = 0;

let _wss: WebSocketServer | null = null;
let _storage: IStorage | null = null;
let _dirty = false;
let _flushTimer: ReturnType<typeof setInterval> | null = null;

export function initWsServer(httpServer: Server, storage: IStorage): WebSocketServer {
  _storage = storage;
  _wss = new WebSocketServer({ server: httpServer, path: "/ws", maxPayload: WS_MAX_PAYLOAD_BYTES });

  _wss.on("connection", (ws, req: IncomingMessage) => {
    const ip = clientIpFromReq(req);

    // ── Authentication ───────────────────────────────────────────────────────
    // Tie the realtime feed to a verified wallet session. The per-connection
    // playerId also drives broadcast scoping (below) so each client only ever
    // receives their own economic data.
    const auth = verifySession(tokenFromReq(req));
    if (isWalletAuthRequired() && !auth) {
      ws.close(1008, "authentication required");
      return;
    }
    (ws as WsClient).playerId = auth?.playerId ?? null;

    // Enforce connection caps before doing any work (0 = disabled).
    if (WS_MAX_CONN > 0 && _wss!.clients.size > WS_MAX_CONN) {
      ws.close(1013, "server connection limit reached");
      return;
    }
    const ipCount = _connByIp.get(ip) ?? 0;
    if (WS_MAX_CONN_PER_IP > 0 && ipCount >= WS_MAX_CONN_PER_IP) {
      ws.close(1013, "too many connections");
      return;
    }
    _connByIp.set(ip, ipCount + 1);

    let alive = true;
    console.log(`[ws] Client connected (total: ${_wss!.clients.size})`);

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "pong") alive = true;
      } catch { /* ignore malformed */ }
    });

    ws.on("error", () => ws.terminate());

    // Ping every 25 s to keep reverse-proxy connections alive
    const pingInterval = setInterval(() => {
      if (!alive) { clearInterval(pingInterval); ws.terminate(); return; }
      alive = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25_000);

    ws.on("close", () => {
      clearInterval(pingInterval);
      const remaining = (_connByIp.get(ip) ?? 1) - 1;
      if (remaining <= 0) _connByIp.delete(ip);
      else _connByIp.set(ip, remaining);
      console.log(`[ws] Client disconnected (total: ${_wss!.clients.size})`);
    });

    // Send current state immediately to the newly connected client
    markDirty();
  });

  // Flush loop — one DB read + broadcast per interval when dirty
  _flushTimer = setInterval(async () => {
    if (!_dirty || !_storage || !_wss) return;
    if (_wss.clients.size === 0) { _dirty = false; return; }
    _dirty = false;
    _flushCount++;

    const flushStart = Date.now();
    const clientCount = _wss.clients.size;

    try {
      const gameState = await _storage.getGameState();
      // Approximate payload size from the full (pre-scope) state for metrics.
      const payloadSize = JSON.stringify(gameState).length;

      // Track payload size metrics
      if (payloadSize > _maxPayloadSize) {
        _maxPayloadSize = payloadSize;
      }

      // Log large payloads (>500KB) as potential performance issues
      if (payloadSize > 500_000) {
        console.warn(`[ws] Large broadcast payload: ${(payloadSize / 1024).toFixed(1)} KB to ${clientCount} clients`);
      }

      // Per-connection scoped broadcast (fog of war / EPI protection).
      _broadcastGameState(gameState);

      const flushDuration = Date.now() - flushStart;
      _totalFlushTimeMs += flushDuration;
      if (flushDuration > _maxFlushTimeMs) {
        _maxFlushTimeMs = flushDuration;
      }

      // Log slow flushes (>500ms)
      if (flushDuration > 500) {
        console.warn(`[ws] Slow flush #${_flushCount}: ${flushDuration}ms (payload: ${(payloadSize / 1024).toFixed(1)} KB, clients: ${clientCount})`);
      }

      // Periodic stats dump every 100 flushes (~2.5 minutes)
      if (_flushCount % 100 === 0) {
        const avgFlushTime = _totalFlushTimeMs / _flushCount;
        console.log(`[ws] Stats: flushes=${_flushCount}, errors=${_flushErrorCount}, avg=${avgFlushTime.toFixed(0)}ms, max=${_maxFlushTimeMs}ms, maxPayload=${(_maxPayloadSize / 1024).toFixed(1)}KB`);
      }
    } catch (err) {
      _flushErrorCount++;
      const flushDuration = Date.now() - flushStart;
      console.error(`[ws] Flush #${_flushCount} FAILED after ${flushDuration}ms:`, err instanceof Error ? err.message : err);
      _dirty = true;
    }
  }, FLUSH_INTERVAL_MS);

  // ── Chain health broadcast — every 60 s ─────────────────────────────────────
  // Probes the Algorand node and DB pool, then pushes a compact `chain_health`
  // message to all connected clients for the in-game HUD indicator.
  const _broadcastChainHealth = async () => {
    if (!_wss || _wss.clients.size === 0) return;
    try {
      // Lazy import to avoid circular deps and to tolerate missing chain config
      const { getAlgodClient } = await import("./services/chain/client");
      const algod = getAlgodClient();
      const probeStart = Date.now();
      let algorand: Record<string, unknown>;
      try {
        const status = await Promise.race([
          algod.status().do(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4_000)),
        ]) as Record<string, unknown>;
        algorand = {
          connected: true,
          network: process.env.ALGORAND_NETWORK ?? "testnet",
          latencyMs: Date.now() - probeStart,
          lastRound: typeof status["last-round"] === "bigint" ? Number(status["last-round"]) : (status["last-round"] ?? null),
        };
      } catch {
        algorand = {
          connected: false,
          network: process.env.ALGORAND_NETWORK ?? "testnet",
          error: "unreachable",
        };
      }
      const pool = getPoolStats();
      _broadcastRaw({
        type: "chain_health",
        payload: {
          ok: (algorand.connected as boolean) && pool.errorCount === 0,
          timestamp: new Date().toISOString(),
          uptimeSeconds: Math.floor(process.uptime()),
          algorand,
          db: {
            connected: true,
            errorCount: pool.errorCount,
            totalCount: pool.totalCount,
          },
        },
      });
    } catch (err) {
      console.warn("[ws] chain_health probe failed:", err instanceof Error ? err.message : err);
    }
  };

  // Fire once 10 s after startup so the HUD has data quickly, then every 60 s
  setTimeout(_broadcastChainHealth, 10_000);
  setInterval(_broadcastChainHealth, 60_000);

  console.log(`[ws] WebSocket server attached to /ws (flush every ${FLUSH_INTERVAL_MS}ms)`);
  return _wss;
}

/** Mark game state as changed. Next flush tick will broadcast. */
export function markDirty(): void {
  _dirty = true;
}

/** Send a pre-serialized object to all open clients. Internal use only. */
function _broadcastRaw(obj: unknown): void {
  if (!_wss) return;
  const msg = JSON.stringify(obj);
  for (const client of _wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

/**
 * Broadcast the game state, scoped per connection. Each client receives full
 * detail only for their own player/parcels; everyone else's stored resources
 * and balances are redacted (see scopeGameStateFor). Cost is O(clients) state
 * copies per flush — fine at current scale; revisit with a shared public base
 * if the connected-client count grows large.
 */
function _broadcastGameState(full: GameState): void {
  if (!_wss) return;
  for (const client of _wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    const pid = (client as WsClient).playerId ?? null;
    const scoped = scopeGameStateFor(full, pid);
    client.send(JSON.stringify({ type: "game_state_update", payload: scoped }));
  }
}

/**
 * broadcastRaw — send any custom message envelope to all connected clients.
 * Use for non-game-state events such as TRADE_FILLED notifications.
 */
export function broadcastRaw(obj: unknown): void {
  _broadcastRaw(obj);
}

/**
 * broadcastGameState — kept for backward compatibility.
 * Callers that already have a fresh gameState object can push it immediately
 * without waiting for the flush tick. Used by routes that need instant feedback
 * (e.g. purchase confirmation). Clears the dirty flag since state is now fresh.
 */
export function broadcastGameState(payload: unknown): void {
  _dirty = false;
  // Scope per connection — the caller passes the FULL state; each client gets
  // only their own economic detail.
  _broadcastGameState(payload as GameState);
}

/**
 * broadcastWorldEvent — send a single world event to all connected clients
 * immediately (not waiting for the flush tick). Used by appendWorldEvent()
 * to stream real-time activity to the client Activity Feed overlay.
 * Message format: { type: "world_event", payload: WorldEvent }
 */
export function broadcastWorldEvent(event: unknown): void {
  _broadcastRaw({ type: "world_event", payload: event });
}
