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
import { getAuthToken, clearAuthToken } from "@/lib/authToken";
import { setServerTime } from "@/lib/serverClock";
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

/**
 * WS close codes that mean "your session token was rejected" (auth failure) —
 * as opposed to a transient network drop. The server closes with 1008
 * ("authentication required"); 4001 is reserved for an explicit auth reject.
 * On these we must NOT blindly reconnect (that just hammers the server with a
 * dead token) — clear the token and re-authenticate instead.
 */
export function isAuthRejectClose(code: number): boolean {
  return code === 1008 || code === 4001;
}

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

// ── Global battle-tick bus (server-authoritative active-battle set) ───────────
export interface BattleTickEntry { id: string; resolveTs: number; }
export interface BattleTickState { activeIds: Set<string>; receivedAt: number; }
type BattleTickCallback = (state: BattleTickState) => void;
const _battleTickCallbacks: Map<number, BattleTickCallback> = new Map();
let _battleTickCallbackId = 0;
let _latestBattleTick: BattleTickState | null = null;

/** Register a callback to receive battle ticks in real-time. */
export function onBattleTick(cb: BattleTickCallback): () => void {
  const id = ++_battleTickCallbackId;
  _battleTickCallbacks.set(id, cb);
  return () => _battleTickCallbacks.delete(id);
}

function dispatchBattleTick(entries: BattleTickEntry[]): void {
  const state: BattleTickState = {
    activeIds: new Set(entries.map((e) => e.id)),
    receivedAt: Date.now(),
  };
  _latestBattleTick = state;
  for (const cb of _battleTickCallbacks.values()) {
    try { cb(state); } catch { /* ignore */ }
  }
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
export function useGameSocket(authTrigger?: unknown, onAuthReject?: () => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  // Keep the latest reject handler in a ref so its identity never re-runs the
  // effect (which would needlessly tear down / reopen the socket = "flash").
  const onAuthRejectRef = useRef(onAuthReject);
  onAuthRejectRef.current = onAuthReject;

  useEffect(() => {
    // Auth state changed — restart the attempt budget so a re-auth (new token)
    // reconnects cleanly.
    reconnectCount.current = 0;
    let stopped = false;

    function connect() {
      if (stopped || reconnectCount.current >= WS_MAX_RECONNECTS) return;

      // Only open an AUTHENTICATED socket. The server rejects token-less sockets
      // with close 1008 when wallet-auth is on, and `authTrigger` is falsy until
      // the first successful auth — so connecting earlier (or without a token)
      // would just death-loop on a doomed/stale connection. Until then, game
      // data still flows via the useGameState polling fallback.
      const token = getAuthToken();
      if (!authTrigger || !token) return;

      // WebSocket URL driven by VITE_WS_URL; token passed as a query param
      // (browsers can't set WS headers) so the server can authenticate.
      const wsBase = import.meta.env.VITE_WS_URL;
      const base = wsBase
        ? `${wsBase}/ws`
        : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
      const ws = new WebSocket(`${base}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectCount.current = 0;
        setAuthFailed(false);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
            return;
          }
          // Server-authoritative clock sync — keeps battle countdowns drift-free.
          if (msg.type === "time_sync" && typeof msg.serverTime === "number") {
            setServerTime(msg.serverTime);
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
          // Server-authoritative active-battle set (drops resolved battles promptly)
          if (msg.type === "battle_tick" && Array.isArray(msg.battles)) {
            if (typeof msg.serverTime === "number") setServerTime(msg.serverTime);
            dispatchBattleTick(msg.battles as BattleTickEntry[]);
            return;
          }
        } catch { /* ignore malformed */ }
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        if (stopped) return;
        // Auth reject (stale token / rotated SESSION_SECRET): DON'T hammer the
        // server with a dead token. Clear it and ask the consumer to re-auth —
        // a fresh token + bumped authTrigger re-runs this effect to reconnect.
        if (isAuthRejectClose(event.code)) {
          clearAuthToken();
          setAuthFailed(true);
          onAuthRejectRef.current?.();
          return;
        }
        // Transient network drop: bounded backoff reconnect.
        reconnectCount.current += 1;
        reconnectTimer.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [authTrigger]);

  return { authFailed };
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
 * Latest server `battle_tick` (active-battle id set), or null until one arrives.
 * Lets the battles UI drop a just-resolved battle promptly, between flushes.
 */
export function useBattleTick(): BattleTickState | null {
  const [state, setState] = useState<BattleTickState | null>(_latestBattleTick);
  useEffect(() => {
    if (_latestBattleTick) setState(_latestBattleTick);
    const unsub = onBattleTick((s) => setState(s));
    return unsub;
  }, []);
  return state;
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
