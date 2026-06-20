/**
 * GlobeLiveEvents — transient "living map" telemetry boxes.
 *
 * Mount INSIDE the <Canvas> scene. Self-subscribes to the live `world_event` WS
 * bus (the same bus the ActivityFeed uses) and pops a short-lived `<Html>` box at
 * the event's lat/lng for events that carry coordinates but otherwise have no live
 * globe visual — battle resolutions and land claims (see `liveEventDisplay`).
 * Battle starts / weapon shots / mining / orbital events already draw their own
 * arcs/pulses, so they're intentionally not duplicated here.
 *
 * Additive + self-managing: no props, no server change. Each box auto-expires
 * after TTL_MS. (R3F component — exercised via the pure `liveEventDisplay` unit
 * test + typecheck/build; not browser-verified in CI.)
 */
import * as THREE from "three";
import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import type { WorldEvent } from "@shared/worldEvents";
import { onWorldEvent } from "@/hooks/useGameSocket";
import { liveEventDisplay, type LiveEventDisplay } from "@/lib/globe/liveEventDisplay";

const GLOBE_RADIUS = 2;
const TTL_MS = 6000;
const MAX_BOXES = 8;

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

interface ActiveEvent {
  key: string;
  pos: THREE.Vector3;
  display: LiveEventDisplay;
}

function TelemetryBox({ pos, display }: { pos: THREE.Vector3; display: LiveEventDisplay }) {
  return (
    <Html position={pos} center distanceFactor={4} zIndexRange={[12, 22]} occlude={false}>
      <div
        data-testid="live-event-box"
        style={{
          pointerEvents: "none",
          userSelect: "none",
          fontFamily: "monospace",
          fontSize: "9px",
          letterSpacing: "0.14em",
          whiteSpace: "nowrap",
          padding: "4px 8px",
          borderRadius: "3px",
          background: "rgba(2, 4, 14, 0.85)",
          border: `1px solid ${display.color}`,
          boxShadow: `0 0 14px ${display.color}66`,
          color: display.color,
          transform: "translateY(-6px)",
        }}
      >
        <span style={{ opacity: 0.6, marginRight: "5px" }}>◉ LIVE</span>
        {display.label}
      </div>
    </Html>
  );
}

export function GlobeLiveEvents() {
  const [active, setActive] = useState<ActiveEvent[]>([]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const unsub = onWorldEvent((event: WorldEvent) => {
      const display = liveEventDisplay(event);
      if (!display) return;
      const key = event.id;
      const pos = latLngToVec3(event.lat, event.lng, GLOBE_RADIUS * 1.06);
      setActive((prev) => [...prev.filter((e) => e.key !== key), { key, pos, display }].slice(-MAX_BOXES));
      const t = setTimeout(() => setActive((prev) => prev.filter((e) => e.key !== key)), TTL_MS);
      timers.push(t);
    });
    return () => {
      unsub();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <group>
      {active.map((e) => (
        <TelemetryBox key={e.key} pos={e.pos} display={e.display} />
      ))}
    </group>
  );
}
