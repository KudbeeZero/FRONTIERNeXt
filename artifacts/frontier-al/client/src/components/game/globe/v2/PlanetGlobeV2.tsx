/**
 * PlanetGlobeV2 — the v2 globe orchestrator.
 *
 * Owns the ONE shared world-space sun direction (sunDirRef) and mounts the layer
 * stack, each independently toggleable from the debug panel:
 *
 *   0  Starfield        (reuses the existing StarField)
 *   1  Planet surface   PlanetSurfaceV2  — one shader, day→night across one terminator
 *   2  Plot tiles       PlotTilesV2      — 21k instanced, terminator on the GPU
 *   3  Atmosphere       AtmosphereV2     — one blue/cyan fresnel rim
 *   4  Sun + light      SunV2            — visible disc + directional light, the writer
 *
 * Drop-in prop shape with the old PlanetGlobe (parcels / currentPlayerId /
 * onParcelSelect). With no parcels it renders deterministic mock biomes, so it can
 * be previewed before it is wired into the app. Nothing here modifies the old globe.
 */

import * as THREE from "three";
import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { LandParcel } from "@shared/schema";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";
import { StarField } from "../StarField";
import { buildPlanetDataV2 } from "./planetDataV2";
import { PlanetSurfaceV2 } from "./PlanetSurfaceV2";
import { PlotTilesV2 } from "./PlotTilesV2";
import { AtmosphereV2 } from "./AtmosphereV2";
import { SunV2 } from "./SunV2";

interface LayerToggles {
  starfield: boolean;
  surface: boolean;
  tiles: boolean;
  atmosphere: boolean;
  sunDisc: boolean;
}

export interface PlanetGlobeV2Props {
  /** Live parcels. Omit/empty → deterministic mock biomes for preview. */
  parcels?: LandParcel[];
  currentPlayerId?: string | null;
  onParcelSelect?: (parcelId: string) => void;
  className?: string;
  /** Show the layer-by-layer debug panel (default on for the standalone preview). */
  showDebug?: boolean;
}

export default function PlanetGlobeV2({
  parcels = [],
  currentPlayerId = null,
  onParcelSelect,
  className,
  showDebug = true,
}: PlanetGlobeV2Props) {
  const sunDirRef = useRef(new THREE.Vector3(1, 0.35, 0).normalize());

  const [layers, setLayers] = useState<LayerToggles>({
    starfield: true,
    surface: true,
    tiles: true,
    atmosphere: true,
    sunDisc: true,
  });
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState(0);

  const data = useMemo(
    () => buildPlanetDataV2(parcels, currentPlayerId),
    [parcels, currentPlayerId],
  );

  const toggle = (k: keyof LayerToggles) =>
    setLayers((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
      <Canvas
        camera={{ position: [0, 0, GLOBE_RADIUS * 3.8], fov: 45, near: 0.5, far: 200 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        style={{ background: "#000", touchAction: "none" }}
      >
        {/* SunV2 is the single writer of sunDirRef — mount it first. */}
        <SunV2 sunDirRef={sunDirRef} phase={phase} paused={paused} showDisc={layers.sunDisc} />

        {layers.starfield && <StarField />}

        {/* The planet group never rotates → world-space sun → stable terminator. */}
        <group>
          <Suspense fallback={null}>
            {layers.surface && <PlanetSurfaceV2 sunDirRef={sunDirRef} />}
          </Suspense>
          {layers.tiles && (
            <PlotTilesV2 data={data} sunDirRef={sunDirRef} parcels={parcels} onParcelSelect={onParcelSelect} />
          )}
          {layers.atmosphere && <AtmosphereV2 sunDirRef={sunDirRef} />}
        </group>

        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.45}
          zoomSpeed={0.9}
          minDistance={GLOBE_RADIUS * 1.8}
          maxDistance={GLOBE_RADIUS * 6.0}
          makeDefault
        />
      </Canvas>

      {showDebug && (
        <div
          style={{
            position: "absolute", top: 12, left: 12, zIndex: 30,
            background: "rgba(4,8,20,0.78)", border: "1px solid rgba(79,195,247,0.3)",
            borderRadius: 8, padding: "10px 12px", fontFamily: "monospace",
            fontSize: 11, color: "rgba(190,225,255,0.95)", letterSpacing: "0.06em",
            display: "flex", flexDirection: "column", gap: 6, minWidth: 160,
          }}
        >
          <div style={{ color: "#4fc3f7", letterSpacing: "0.18em" }}>GLOBE V2 · LAYERS</div>
          {([
            ["starfield", "0 · Starfield"],
            ["surface", "1 · Surface"],
            ["tiles", "2 · Plot tiles"],
            ["atmosphere", "3 · Atmosphere"],
            ["sunDisc", "4 · Sun disc"],
          ] as const).map(([key, label]) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={layers[key]} onChange={() => toggle(key)} />
              {label}
            </label>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginTop: 4 }}>
            <input type="checkbox" checked={paused} onChange={() => setPaused((p) => !p)} />
            pause sun
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span>sun scrub</span>
            <input
              type="range" min={-Math.PI} max={Math.PI} step={0.01}
              value={phase} onChange={(e) => setPhase(parseFloat(e.target.value))}
            />
          </label>
          <div style={{ color: "rgba(120,160,200,0.7)" }}>{data.isMock ? "mock data" : `${data.count} plots`}</div>
        </div>
      )}
    </div>
  );
}
