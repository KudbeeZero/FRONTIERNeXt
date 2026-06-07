/**
 * ObserverLayer — experimental "look into the past" mode (LUT E9, scoped).
 *
 * Opt-in. While enabled, the camera's distance maps to a look-back time:
 * zoomed all the way in = the present; pulled all the way out = up to
 * OBSERVER_LOOKBACK_MS ago. It drives the EXISTING world-event replay overlay
 * (GlobeEventOverlays) from that derived time — no Redis, no schema, purely a
 * client reinterpretation of camera distance. Distance = latency = past.
 */

import { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { WorldEvent, WorldEventType } from "@shared/worldEvents";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";
import { GlobeEventOverlays } from "../GlobeEventOverlays";

const OBSERVER_LOOKBACK_MS = 24 * 60 * 60 * 1000; // matches the 24h replay window
const MIN_DIST = GLOBE_RADIUS * 1.8;              // OrbitControls minDistance (present)
const MAX_DIST = GLOBE_RADIUS * 6.0;              // OrbitControls maxDistance (deepest past)
const UPDATE_THRESHOLD_MS = 20_000;               // throttle re-renders to ~20s steps

const ALL_EVENT_TYPES: WorldEventType[] = [
  "land_claimed", "battle_started", "battle_resolved", "commander_deployed",
  "commander_minted", "scan_ping", "jammer_zone", "faction_movement",
  "resource_pulse", "mine_action",
];
const ALL_TYPES: Set<string> = new Set(ALL_EVENT_TYPES);

/** Maps camera distance to a look-back offset in ms (0 = now). */
function offsetFromDistance(dist: number): number {
  const t = Math.min(1, Math.max(0, (dist - MIN_DIST) / (MAX_DIST - MIN_DIST)));
  return t * OBSERVER_LOOKBACK_MS;
}

export function ObserverLayer({
  events,
  onOffsetChange,
}: {
  events: WorldEvent[];
  onOffsetChange?: (offsetMs: number) => void;
}) {
  const { camera } = useThree();
  const [observedTime, setObservedTime] = useState(() => Date.now());
  const lastOffsetRef = useRef(0);

  useFrame(() => {
    const offset = offsetFromDistance(camera.position.length());
    if (Math.abs(offset - lastOffsetRef.current) >= UPDATE_THRESHOLD_MS) {
      lastOffsetRef.current = offset;
      setObservedTime(Date.now() - offset);
      onOffsetChange?.(offset);
    }
  });

  return (
    <GlobeEventOverlays events={events} replayTime={observedTime} visibleTypes={ALL_TYPES} />
  );
}
