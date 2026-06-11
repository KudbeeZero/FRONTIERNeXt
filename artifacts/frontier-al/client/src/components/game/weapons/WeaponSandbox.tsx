/**
 * client/src/components/game/weapons/WeaponSandbox.tsx
 *
 * A self-contained dev sandbox to iterate on the weapon FX without touching live
 * game routing. Pick an offensive weapon and (optionally) a defensive battery,
 * Fire, and watch the arc + particle trail + interception play out on a mini
 * globe. Drives visuals straight from the shared sim (positionAt / solveIntercept)
 * so it shares zero state with the server.
 *
 * Mount it from a dev-only route or a standalone Vite entry.
 */

import { useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import {
  OFFENSIVE_WEAPONS,
  DEFENSIVE_WEAPONS,
  getWeapon,
  timeOfFlightMs,
  greatCircleKm,
  solveIntercept,
  PLANET_RADIUS_KM,
  type GeoPoint,
} from "@shared/weapons";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";
import { WeaponScene } from "./WeaponScene";
import type { WeaponShot } from "./WeaponProjectile";

const LAUNCH_SITE: GeoPoint = { lat: 18, lng: -55 };
const MAX_SHOWN_KM = 1900;
const MAX_SHOTS = 16;

/** Great-circle destination point a given distance/bearing from an origin. */
function destinationPoint(from: GeoPoint, bearingDeg: number, distanceKm: number): GeoPoint {
  const d = distanceKm / PLANET_RADIUS_KM; // angular distance
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lng1 = (from.lng * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lng2 =
    lng1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

interface LastShotInfo {
  name: string;
  rangeKm: number;
  distanceKm: number;
  tofSec: number;
  defended: boolean;
  intercepted: boolean;
  pk: number;
}

export default function WeaponSandbox() {
  const [offId, setOffId] = useState(OFFENSIVE_WEAPONS[0].id);
  const [defId, setDefId] = useState<string>("");
  const [shots, setShots] = useState<WeaponShot[]>([]);
  const [last, setLast] = useState<LastShotInfo | null>(null);
  const [bearing, setBearing] = useState(95);

  const fire = useCallback(() => {
    const spec = getWeapon(offId);
    if (!spec) return;

    const distanceKm = Math.min(spec.rangeKm * 0.85, MAX_SHOWN_KM);
    const to = destinationPoint(LAUNCH_SITE, bearing, distanceKm);
    const tof = timeOfFlightMs(spec, greatCircleKm(LAUNCH_SITE, to));
    const launchTs = Date.now();

    let intercept: WeaponShot["intercept"];
    let interceptedFlag = false;
    let pk = 0;
    const defense = defId ? getWeapon(defId) : undefined;
    if (defense) {
      const res = solveIntercept({ incoming: spec, from: LAUNCH_SITE, to, defense, defenseAt: to });
      pk = res.pk;
      if (res.intercepted && res.timeToInterceptMs != null && res.interceptAt && Math.random() < res.pk) {
        intercept = { at: res.interceptAt, ts: launchTs + res.timeToInterceptMs };
        interceptedFlag = true;
      }
    }

    const shot: WeaponShot = {
      id: `${launchTs}-${Math.random().toString(36).slice(2, 7)}`,
      specId: spec.id,
      from: LAUNCH_SITE,
      to,
      launchTs,
      tof,
      intercept,
    };
    setShots((prev) => [...prev.slice(-(MAX_SHOTS - 1)), shot]);
    setLast({
      name: spec.name,
      rangeKm: spec.rangeKm,
      distanceKm: Math.round(distanceKm),
      tofSec: Math.round(tof / 100) / 10,
      defended: !!defense,
      intercepted: interceptedFlag,
      pk: Math.round(pk * 100),
    });
    // rotate the firing bearing so successive shots fan out
    setBearing((b) => (b + 24) % 360);
  }, [offId, defId, bearing]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#05070f" }}>
      <Canvas camera={{ position: [0, 1.5, 6], fov: 50 }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 3, 5]} intensity={1.1} />
        <Stars radius={60} depth={40} count={3000} factor={3} fade speed={0.5} />
        {/* mini planet */}
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
          <meshStandardMaterial color="#1b2a4a" roughness={0.85} metalness={0.1} emissive="#0a1326" emissiveIntensity={0.4} />
        </mesh>
        <WeaponScene shots={shots} />
        <OrbitControls enablePan={false} minDistance={3.5} maxDistance={12} />
      </Canvas>

      <div style={panelStyle}>
        <div style={{ fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>FRONTIER · Weapon Sandbox</div>

        <label style={labelStyle}>Offensive weapon</label>
        <select value={offId} onChange={(e) => setOffId(e.target.value)} style={selectStyle}>
          {OFFENSIVE_WEAPONS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} · {w.category} · {w.rangeKm}km
            </option>
          ))}
        </select>

        <label style={labelStyle}>Defensive battery (on target)</label>
        <select value={defId} onChange={(e) => setDefId(e.target.value)} style={selectStyle}>
          <option value="">— none —</option>
          {DEFENSIVE_WEAPONS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} · {w.intercept?.interceptRangeKm}km · Pk{Math.round((w.intercept?.basePk ?? 0) * 100)}
            </option>
          ))}
        </select>

        <button onClick={fire} style={fireStyle}>▶ FIRE</button>

        {last && (
          <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, opacity: 0.9 }}>
            <div><b>{last.name}</b></div>
            <div>flight {last.distanceKm}km / {last.rangeKm}km · {last.tofSec}s</div>
            {last.defended ? (
              <div style={{ color: last.intercepted ? "#5bf0ff" : "#ff7a4a" }}>
                {last.intercepted ? "INTERCEPTED" : "GOT THROUGH"} · Pk {last.pk}%
              </div>
            ) : (
              <div style={{ opacity: 0.6 }}>undefended</div>
            )}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 11, opacity: 0.5 }}>drag to orbit · scroll to zoom</div>
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: "absolute", top: 16, left: 16, width: 280, padding: 16,
  background: "rgba(8,12,24,0.82)", border: "1px solid rgba(120,160,255,0.25)",
  borderRadius: 12, color: "#dce6ff", fontFamily: "ui-sans-serif, system-ui", backdropFilter: "blur(6px)",
};
const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, opacity: 0.6, margin: "8px 0 3px" };
const selectStyle: React.CSSProperties = {
  width: "100%", padding: "6px 8px", borderRadius: 8, background: "#0d1530",
  color: "#dce6ff", border: "1px solid rgba(120,160,255,0.25)", fontSize: 12,
};
const fireStyle: React.CSSProperties = {
  width: "100%", marginTop: 12, padding: "9px 0", borderRadius: 8, border: "none",
  background: "linear-gradient(90deg,#ff5a1f,#ff9d2f)", color: "#0a0a0a", fontWeight: 800,
  letterSpacing: 1, cursor: "pointer",
};
