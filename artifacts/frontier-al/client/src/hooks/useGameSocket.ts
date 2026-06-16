/**
 * useGameSocket.ts
 *
 * Connects to the FRONTIER WebSocket server and listens for game_state_update
 * and world_event messages. On game_state_update, invalidates the /api/game/state
 * TanStack Query cache so all components re-render with fresh data without polling.
 * On world_event, pushes the event into a global callback system for the Activity Feed.
 *
 * Falls back gracefully: if WebSocket fails to connect or is not supported,
 * the existing 30-second refetchInterval in useGameState remains active.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { queryClient } from "@/lib/queryClient";
import { getAuthToken } from "@/lib/authToken";
import type { GameState } from "@shared/schema";
import type { WorldEvent } from "@shared/worldEvents";

// ── Chain health types ────────────────────────────────────────────────────────
export interface ChainHealth {
  ok: boolean;
  timestamp: string;
  uptimeSeconds: number;
  algorand: {
    connected: boolean;
    network: string;
    latencyMs?: number;
    lastRound?: number;
    error?: string;
  };
  db: {
    connected: boolean;
    errorCount: number;
    totalCount: number;
  };
}

const WS_RECONNECT_DELAY_MS = 3_000;
const WS_MAX_RECONNECTS = 10;

// ── Global event bus for world events (Activity Feed) ────────────────────────
type WorldEventCallback = (event: WorldEvent) => void;
const _worldEventCallbacks: Map<number, WorldEventCallback> = new Map();
let _callbackId = 0;

/** Register a callback to receive world events in real-time. */
export function onWorldEvent(cb: WorldEventCallback): () => void {
  const id = ++_callbackId;
  _worldEventCallbacks.set(id, cb);
  return () => _worldEventCallbacks.delete(id);
}

/** Dispatch a world event to all registered callbacks. */
function dispatchWorldEvent(event: WorldEvent): void {
  for (const cb of _worldEventCallbacks.values()) {
    try { cb(event); } catch { /* ignore */ }
  }
}

// ── Global chain health bus ───────────────────────────────────────────────────
type ChainHealthCallback = (health: ChainHealth) => void;
const _chainHealthCallbacks: Map<number, ChainHealthCallback> = new Map();
let _chainHealthCallbackId = 0;
let _latestChainHealth: ChainHealth | null = null;

/** Register a callback to receive chain health updates. */
export function onChainHealth(cb: ChainHealthCallback): () => void {
  const id = ++_chainHealthCallbackId;
  _chainHealthCallbacks.set(id, cb);
  return () => _chainHealthCallbacks.delete(id);
}

function dispatchChainHealth(health: ChainHealth): void {
  _latestChainHealth = health;
  for (const cb of _chainHealthCallbacks.values()) {
    try { cb(health); } catch { /* ignore */ }
  }
}

// ── Global weapon-engagement bus (live missile/intercept FX) ──────────────────
/** Serialized runtime engagement streamed from the server on `weapon_engagement`. */
export interface WeaponEngagementEvent {
  id: string;
  weaponSpecId: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  launchTs: number;
  tof: number;
  status: "in_flight" | "intercepted" | "impacted";
  interceptAt?: { lat: number; lng: number };
  interceptTs?: number;
}
type WeaponEngagementCallback = (e: WeaponEngagementEvent) => void;
const _weaponCallbacks: Map<number, WeaponEngagementCallback> = new Map();
let _weaponCallbackId = 0;

/** Register a callback to receive live weapon engagements in real-time. */
export function onWeaponEngagement(cb: WeaponEngagementCallback): () => void {
  const id = ++_weaponCallbackId;
  _weaponCallbacks.set(id, cb);
  return () => _weaponCallbacks.delete(id);
}

function dispatchWeaponEngagement(e: WeaponEngagementEvent): void {
  for (const cb of _weaponCallbacks.values()) {
    try { cb(e); } catch { /* ignore */ }
  }
}

/**
 * @param authTrigger Pass a value that changes when wallet auth completes (e.g.
 * `isAuthenticated`). The socket reconnects — now carrying the session token —
 * so the server can authenticate it and scope broadcasts to this player.
 */
export function useGameSocket(authTrigger?: unknown) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Auth state changed — restart the attempt budget so a previously
    // exhausted (unauthenticated) loop reconnects with the new token.
    reconnectCount.current = 0;

    function connect() {
      if (reconnectCount.current >= WS_MAX_RECONNECTS) return;

      // MIGRATION: WebSocket URL now driven by VITE_WS_URL env var
      const wsBase = import.meta.env.VITE_WS_URL;
      const base = wsBase
        ? `${wsBase}/ws`
        : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
      // Browsers can't set headers on a WebSocket — pass the session token as a
      // query param so the server can authenticate the connection.
      const token = getAuthToken();
      const url = token ? `${base}?token=${encodeURIComponent(token)}` : base;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectCount.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
            return;
          }
          if (msg.type === "game_state_update" && msg.payload) {
            // Directly set the cache — no refetch round-trip needed
            queryClient.setQueryData<GameState>(
              ["/api/game/state"],
              msg.payload as GameState
            );
          }
          // Stream individual world events to Activity Feed
          if (msg.type === "world_event" && msg.payload) {
            dispatchWorldEvent(msg.payload as WorldEvent);
          }
          // Chain health broadcast (60s interval from server)
          if (msg.type === "chain_health" && msg.payload) {
            dispatchChainHealth(msg.payload as ChainHealth);
          }
          // Live weapon engagement (missile launch / interception / impact)
          if (msg.type === "weapon_engagement" && msg.payload) {
            dispatchWeaponEngagement(msg.payload as WeaponEngagementEvent);
          }
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        wsRef.current = null;
        reconnectCount.current += 1;
        reconnectTimer.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [authTrigger]);
}

/**
 * Hook that subscribes to chain health broadcasts from the WebSocket server.
 * The server sends a `chain_health` message every 60 seconds.
 * Returns null until the first message arrives.
 */
export function useChainHealth(): ChainHealth | null {
  const [health, setHealth] = useState<ChainHealth | null>(_latestChainHealth);

  useEffect(() => {
    // Immediately reflect any value that arrived before this hook mounted
    if (_latestChainHealth) setHealth(_latestChainHealth);
    const unsub = onChainHealth((h) => setHealth(h));
    return unsub;
  }, []);

  return health;
}

/**
 * Hook that subscribes to world events from the WebSocket connection.
 * Returns the latest N events (most recent first).
 */
export function useLiveWorldEvents(maxEvents = 50): WorldEvent[] {
  const eventsRef = useRef<WorldEvent[]>([]);
  const [, setTick] = useState(0);

  const update = useCallback(() => {
    setTick(t => t + 1);
  }, []);

  useEffect(() => {
    const unsub = onWorldEvent((event: WorldEvent) => {
      eventsRef.current = [event, ...eventsRef.current].slice(0, maxEvents);
      update();
    });
    return unsub;
  }, [maxEvents, update]);

  return eventsRef.current;
}
