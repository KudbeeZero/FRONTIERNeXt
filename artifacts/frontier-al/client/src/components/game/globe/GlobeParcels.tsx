/**
 * GlobeParcels — InstancedMesh rendering of all 21,000 parcel tiles.
 * Handles hover, selection state, battle pulse, and biome coloring.
 *
 * SubParcelOverlay — 3×3 sub-tile grid for subdivided macro-plots.
 */

import * as THREE from "three";
import { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { LandParcel, Player } from "@shared/schema";
import {
  GLOBE_RADIUS,
  PLOT_COUNT,
  COLOR_BATTLE,
  COLOR_SELECTED,
  COLOR_BORDER_OWNED,
  COLOR_BORDER_UNOWNED,
  COLOR_SUBDIVIDED,
  ARCHETYPE_COLORS,
  FILL_SIZE,
  BORDER_SIZE,
  SUB_FILL_SIZE,
  SUB_BORDER_SIZE,
  SUB_SPACING,
  MAX_SUB_TILES,
  SUB_PARCEL_LOD_DISTANCE,
  FOG_REVEAL_RADIUS,
} from "@/lib/globe/globeConstants";
import { computeVisiblePlotIndices, FOG_DIM_HIDDEN } from "@shared/fog";
import {
  generateFibonacciSphere,
  latLngToVec3,
  getPlotColor,
  getPlotSizeVariant,
  tangentFrame,
} from "@/lib/globe/globeUtils";
import { buildPickIndex } from "@/lib/globe/pickIndex";
import { useVisualPrefs } from "@/hooks/useVisualPrefs";

// ── PlotOverlay ────────────────────────────────────────────────────────────────

// Faint near-white base for un-owned land — the "transparent crust" look (the
// fill material runs at low opacity). Owned/selected/battle tiles keep accents.
const COLOR_TILE_BASE = new THREE.Color(0xffffff);

interface PlotOverlayProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
  selectedPlotId: string | null;
  onPlotSelect: (parcelId: string) => void;
}

export function PlotOverlay({ parcels, currentPlayerId, selectedPlotId, onPlotSelect }: PlotOverlayProps) {
  const fillMeshRef   = useRef<THREE.InstancedMesh>(null!);
  const borderMeshRef = useRef<THREE.InstancedMesh>(null!);
  const readyRef      = useRef(false);
  const pulseRef      = useRef(0);
  const hoveredIndexRef = useRef<number | null>(null);
  const prevHoveredRef  = useRef<number | null>(null);
  const prevSelectedRef = useRef<string | null>(null);
  // Hovered plot index for the on-hover popup (only set when the plot changes,
  // so pointer-move doesn't spam re-renders).
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hoveredPlotRef = useRef<number | null>(null);

  const plotCoords = useMemo(() => generateFibonacciSphere(PLOT_COUNT), []);

  // Player-customisable territory / enemy colours (localStorage-backed).
  const prefs = useVisualPrefs();
  const customColors = useMemo(
    () => ({
      player: new THREE.Color(prefs.territoryColor),
      enemy: new THREE.Color(prefs.enemyColor),
    }),
    [prefs.territoryColor, prefs.enemyColor],
  );

  const plotIdToParcel = useMemo(() => {
    const m = new Map<number, LandParcel>();
    parcels.forEach(p => m.set(p.plotId, p));
    return m;
  }, [parcels]);

  const plotIdToParcelRef = useRef(plotIdToParcel);
  plotIdToParcelRef.current = plotIdToParcel;

  // Prefixed with currentPlayerId so the base-color pass re-runs when the
  // session resolves (own plots must flip from enemy-red to player-green).
  const plotVisualFingerprint = useMemo(() => {
    return (currentPlayerId ?? "") + "|" + prefs.territoryColor + ":" + prefs.enemyColor + ":" + Number(prefs.fogOfWar) + "|" + parcels
      .filter(p => p.ownerId || p.activeBattleId || p.isSubdivided)
      .map(p => `${p.plotId}:${p.ownerId ?? ""}:${p.activeBattleId ?? ""}:${Number(!!p.isSubdivided)}`)
      .sort()
      .join("|");
  }, [parcels, currentPlayerId, prefs.territoryColor, prefs.enemyColor, prefs.fogOfWar]);

  // Flat Float32Array of every plot's 3D position — feeds the spatial pick index (below) for click/hover selection
  const plotPositions3D = useMemo(() => {
    const arr = new Float32Array(plotCoords.length * 3);
    for (let i = 0; i < plotCoords.length; i++) {
      const v = latLngToVec3(plotCoords[i].lat, plotCoords[i].lng, GLOBE_RADIUS);
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
    }
    return arr;
  }, [plotCoords]);

  // Spatial nearest-plot index — built once from plotPositions3D (not per render
  // or per pointer event). Returns the SAME index the old O(n) brute scan did
  // (proven in globe-pickindex.spec.ts), just without 21k compares per event.
  const pickIndex = useMemo(() => buildPickIndex(plotPositions3D), [plotPositions3D]);
  const nearestPlot = useCallback(
    (px: number, py: number, pz: number): number => pickIndex.nearest(px, py, pz),
    [pickIndex],
  );

  // O(1) reverse-lookup: plotId → index in plotCoords array — built once, never changes
  const plotIdToIndex = useMemo(() => {
    const m = new Map<number, number>();
    plotCoords.forEach((c, i) => m.set(c.plotId, i));
    return m;
  }, [plotCoords]);

  // Fog of war (opt-in): set of plot indices visible to the current player —
  // owned plots + anything within FOG_REVEAL_RADIUS of them. null = fog off.
  const fogVisibleSet = useMemo(() => {
    if (!prefs.fogOfWar) return null;
    const owned: number[] = [];
    plotIdToParcel.forEach((parcel, plotId) => {
      if (parcel.ownerId && parcel.ownerId === currentPlayerId) {
        const idx = plotIdToIndex.get(plotId);
        if (idx !== undefined) owned.push(idx);
      }
    });
    return computeVisiblePlotIndices(plotPositions3D, owned, FOG_REVEAL_RADIUS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.fogOfWar, plotVisualFingerprint, plotIdToParcel, plotIdToIndex, plotPositions3D, currentPlayerId]);

  // Quickly derive which indices need per-frame animation WITHOUT looping 21k entries
  const animatedIndices = useMemo(() => {
    const idxSet = new Set<number>();
    const currentMap = plotIdToParcelRef.current;
    // Add the selected plot
    if (selectedPlotId) {
      currentMap.forEach((parcel, plotId) => {
        if (parcel.id === selectedPlotId) {
          const idx = plotIdToIndex.get(plotId);
          if (idx !== undefined) idxSet.add(idx);
        }
      });
    }
    // Add owned and battle plots
    currentMap.forEach((parcel, plotId) => {
      if (parcel.ownerId === currentPlayerId || parcel.activeBattleId) {
        const idx = plotIdToIndex.get(plotId);
        if (idx !== undefined) idxSet.add(idx);
      }
    });
    return Array.from(idxSet);
  }, [plotIdToIndex, plotVisualFingerprint, selectedPlotId, currentPlayerId]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Hug the surface: tiles sat ~3.6% above the globe (a visibly floating shell);
  // dropped close to the terrain so they read as the planet's crust. Fill stays
  // just above the border so the outline reads under it; both safely clear of the
  // R=GLOBE_RADIUS terrain sphere to avoid z-fighting.
  const fillPositions3D = useMemo(() => {
    return plotCoords.map(c => latLngToVec3(c.lat, c.lng, GLOBE_RADIUS * 1.008));
  }, [plotCoords]);

  const borderPositions3D = useMemo(() => {
    return plotCoords.map(c => latLngToVec3(c.lat, c.lng, GLOBE_RADIUS * 1.005));
  }, [plotCoords]);

  const applyInstance = (
    mesh: THREE.InstancedMesh,
    i: number,
    pos: THREE.Vector3,
    size: number,
    color: THREE.Color
  ) => {
    dummy.position.copy(pos);
    dummy.lookAt(pos.clone().multiplyScalar(2));
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color);
  };

  useFrame((_, delta) => {
    if (!fillMeshRef.current || !borderMeshRef.current || !readyRef.current) return;
    pulseRef.current += delta * 2.5;

    const currentHovered = hoveredIndexRef.current;
    const prevHovered    = prevHoveredRef.current;
    prevHoveredRef.current = currentHovered;

    const toProcess = new Set<number>(animatedIndices);
    if (currentHovered !== null) toProcess.add(currentHovered);
    if (prevHovered !== null && prevHovered !== currentHovered) toProcess.add(prevHovered);

    // When selection changes, reset the old selected plot using O(1) lookup
    if (prevSelectedRef.current !== selectedPlotId) {
      const oldSelected = prevSelectedRef.current;
      prevSelectedRef.current = selectedPlotId;
      if (oldSelected) {
        const currentMap = plotIdToParcelRef.current;
        currentMap.forEach((parcel, plotId) => {
          if (parcel.id === oldSelected) {
            const idx = plotIdToIndex.get(plotId);
            if (idx !== undefined) toProcess.add(idx);
          }
        });
      }
    }

    let colorDirty  = false;
    let matrixDirty = false;

    for (const i of toProcess) {
      const coord   = plotCoords[i];
      const parcel  = plotIdToParcel.get(coord.plotId);
      const sizeVar = getPlotSizeVariant(coord.plotId);

      const isSelected = parcel?.id === selectedPlotId;
      const isHovered  = currentHovered === i;
      const isOwned    = !!parcel?.ownerId;
      const isOwnedByMe = !!parcel?.ownerId && parcel.ownerId === currentPlayerId;
      const isSubdivided = !!(parcel as LandParcel)?.isSubdivided;

      const fillPos   = fillPositions3D[i];
      const borderPos = borderPositions3D[i];

      let fillColor: THREE.Color;

      if (isSelected && isHovered) {
        const pulse = 1.0 + Math.sin(pulseRef.current * 3) * 0.12;
        fillColor = COLOR_SELECTED.clone().multiplyScalar(pulse * 1.1);
      } else if (isSelected) {
        const pulse = 1.0 + Math.sin(pulseRef.current * 2.5) * 0.15;
        fillColor = COLOR_SELECTED.clone().multiplyScalar(pulse);
      } else if (isHovered) {
        fillColor = COLOR_SELECTED.clone().multiplyScalar(0.65);
      } else if (parcel?.activeBattleId) {
        const bp = 0.75 + Math.sin(pulseRef.current * 3) * 0.25;
        fillColor = COLOR_BATTLE.clone().multiplyScalar(bp);
      } else if (isSubdivided) {
        fillColor = COLOR_SUBDIVIDED.clone();
      } else if (isOwned) {
        fillColor = getPlotColor(parcel, currentPlayerId, customColors);
        // Owned territory pops: brighten player tiles (breathing) and faction/enemy tiles.
        if (isOwnedByMe) {
          fillColor.multiplyScalar(1.4 + Math.sin(pulseRef.current + i * 0.1) * 0.12);
        } else {
          fillColor.multiplyScalar(1.25);
        }
      } else {
        // Un-owned land: faint near-white "crust" (low material opacity).
        fillColor = COLOR_TILE_BASE.clone();
      }

      // Your own plots get a breathing border-glow so ownership reads as motion,
      // not just color. Enemy-owned plots keep a static white border.
      const ownPulse = 0.55 + 0.45 * Math.sin(pulseRef.current * 2.2);
      const borderColor = isSelected
        ? COLOR_SELECTED.clone().multiplyScalar(1.5)
        : isHovered
          ? COLOR_SELECTED.clone()
          : isOwnedByMe
            ? customColors.player.clone().multiplyScalar(0.7 + ownPulse * 0.8)
            : isOwned
              ? COLOR_BORDER_OWNED.clone()
              : COLOR_BORDER_UNOWNED.clone();

      // Fog of war: dim hidden plots (but never the active selection/hover).
      if (fogVisibleSet && !isSelected && !isHovered && !fogVisibleSet.has(i)) {
        fillColor.multiplyScalar(FOG_DIM_HIDDEN);
        borderColor.multiplyScalar(FOG_DIM_HIDDEN);
      }

      const fillScale   = isSelected ? 1.12 : isHovered ? 1.06 : isOwned ? 1.0 : 0.85;
      const borderScale = isSelected ? 1.15 : isHovered ? 1.08 : isOwned ? 1.0 : 0.85;

      applyInstance(fillMeshRef.current,   i, fillPos,   FILL_SIZE   * sizeVar * fillScale,   fillColor);
      applyInstance(borderMeshRef.current, i, borderPos, BORDER_SIZE * sizeVar * borderScale, borderColor);

      colorDirty  = true;
      matrixDirty = true;
    }

    if (matrixDirty) {
      fillMeshRef.current.instanceMatrix.needsUpdate   = true;
      borderMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (colorDirty) {
      if (fillMeshRef.current.instanceColor)   fillMeshRef.current.instanceColor.needsUpdate   = true;
      if (borderMeshRef.current.instanceColor) borderMeshRef.current.instanceColor.needsUpdate = true;
    }
  });

  useEffect(() => {
    if (!fillMeshRef.current || !borderMeshRef.current) return;

    const idToParcel = plotIdToParcelRef.current;

    for (let i = 0; i < plotCoords.length; i++) {
      const coord  = plotCoords[i];
      const parcel = idToParcel.get(coord.plotId);
      const sizeVar = getPlotSizeVariant(coord.plotId);

      const fillPos   = fillPositions3D[i];
      const borderPos = borderPositions3D[i];

      const isOwned      = !!parcel?.ownerId;
      const isSubdivided = !!(parcel as LandParcel)?.isSubdivided;

      // Base colors only — selection/hover handled in useFrame so clicking never triggers this loop
      let fillColor: THREE.Color;
      if (parcel?.activeBattleId) {
        fillColor = COLOR_BATTLE.clone();
      } else if (isSubdivided) {
        fillColor = COLOR_SUBDIVIDED.clone();
      } else if (isOwned) {
        fillColor = getPlotColor(parcel, currentPlayerId, customColors);
        // Owned territory pops (static base pass — faction/enemy tiles aren't animated).
        const isOwnedByMe = !!parcel?.ownerId && parcel.ownerId === currentPlayerId;
        if (isOwnedByMe) fillColor.multiplyScalar(1.4);
        else fillColor.multiplyScalar(1.25);
      } else {
        // Un-owned land: faint near-white "crust" (low material opacity).
        fillColor = COLOR_TILE_BASE.clone();
      }

      const borderColor = isOwned ? COLOR_BORDER_OWNED.clone() : COLOR_BORDER_UNOWNED.clone();

      // Fog of war: dim plots outside your revealed area.
      if (fogVisibleSet && !fogVisibleSet.has(i)) {
        fillColor.multiplyScalar(FOG_DIM_HIDDEN);
        borderColor.multiplyScalar(FOG_DIM_HIDDEN);
      }

      const fillScale   = isOwned ? 1.0 : 0.85;
      const borderScale = isOwned ? 1.0 : 0.85;
      applyInstance(fillMeshRef.current,   i, fillPos,   FILL_SIZE   * sizeVar * fillScale,   fillColor);
      applyInstance(borderMeshRef.current, i, borderPos, BORDER_SIZE * sizeVar * borderScale, borderColor);
    }

    fillMeshRef.current.instanceMatrix.needsUpdate   = true;
    borderMeshRef.current.instanceMatrix.needsUpdate = true;
    if (fillMeshRef.current.instanceColor)   fillMeshRef.current.instanceColor.needsUpdate   = true;
    if (borderMeshRef.current.instanceColor) borderMeshRef.current.instanceColor.needsUpdate = true;

    if (idToParcel.size > 0) readyRef.current = true;
  }, [plotVisualFingerprint, currentPlayerId, plotCoords,
      fillPositions3D, borderPositions3D, fogVisibleSet]);

  const handlePointerMove = useCallback((e: any) => {
    const p = e.point as THREE.Vector3;
    const len = p.length();
    const scale = len > 0 ? GLOBE_RADIUS / len : 1;
    const idx = nearestPlot(p.x * scale, p.y * scale, p.z * scale);
    hoveredIndexRef.current = idx;
    // Surface the hovered plot number for the popup — only on change (no spam).
    if (idx !== hoveredPlotRef.current) {
      hoveredPlotRef.current = idx;
      setHoveredIdx(idx >= 0 ? idx : null);
    }
  }, [nearestPlot]);

  const handlePointerLeave = useCallback(() => {
    hoveredIndexRef.current = null;
    hoveredPlotRef.current = null;
    setHoveredIdx(null);
  }, []);

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    if ((e.delta as number) > 6) return;
    const p = e.point as THREE.Vector3;
    const len = p.length();
    const scale = len > 0 ? GLOBE_RADIUS / len : 1;
    const nx = p.x * scale, ny = p.y * scale, nz = p.z * scale;
    const idx = nearestPlot(nx, ny, nz);
    const coord = plotCoords[idx];
    const parcel = plotIdToParcel.get(coord.plotId);
    if (parcel) onPlotSelect(parcel.id);
  }, [nearestPlot, plotCoords, plotIdToParcel, onPlotSelect]);

  return (
    <>
      {/* Invisible coverage sphere — catches every pointer event reliably */}
      <mesh
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      >
        <sphereGeometry args={[GLOBE_RADIUS * 1.01, 48, 24]} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} side={THREE.FrontSide} />
      </mesh>

      {/* Border frame — thin square outline for grid tile look */}
      <instancedMesh ref={borderMeshRef} args={[undefined, undefined, PLOT_COUNT]} renderOrder={1}>
        <planeGeometry args={[1.0, 1.0]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.75}
          depthWrite={false}
          depthTest={false}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Fill layer — square tile. Low opacity = faint "transparent crust" so the
          planet reads through; owned/selected tiles still carry their accent. */}
      <instancedMesh ref={fillMeshRef} args={[undefined, undefined, PLOT_COUNT]} renderOrder={2}>
        <planeGeometry args={[1.0, 1.0]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.45}
          depthWrite={false}
          depthTest={false}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Hover popup — shows the plot number over the tile under the cursor. */}
      {hoveredIdx !== null && fillPositions3D[hoveredIdx] && (
        <Html
          position={fillPositions3D[hoveredIdx]}
          center
          distanceFactor={8}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              padding: "2px 7px",
              borderRadius: 5,
              background: "rgba(4,10,22,0.82)",
              border: "1px solid rgba(120,200,255,0.6)",
              color: "#dff1ff",
              fontFamily: "monospace",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
              transform: "translateY(-14px)",
            }}
          >
            PLOT #{plotCoords[hoveredIdx]?.plotId}
          </div>
        </Html>
      )}
    </>
  );
}

// ── SubParcelOverlay ───────────────────────────────────────────────────────────

interface SubParcelOverlayProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
}

/** Renders a 3×3 grid of 9 sub-tiles for every subdivided macro-plot. */
export function SubParcelOverlay({ parcels, currentPlayerId }: SubParcelOverlayProps) {
  const fillMeshRef   = useRef<THREE.InstancedMesh>(null!);
  const borderMeshRef = useRef<THREE.InstancedMesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const { camera } = useThree();

  // LOD: only show the 3×3 sub-grids when the camera is zoomed in close, so the
  // planet-wide view stays clean (mirrors the prior "table only" behavior at
  // far zoom while revealing archetype colors as you fly toward a region).
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = camera.position.length() < SUB_PARCEL_LOD_DISTANCE;
    }
  });

  const parcelsRef = useRef(parcels);
  parcelsRef.current = parcels;

  // Only changes when subdivision data actually changes
  const subParcelFingerprint = useMemo(() => {
    const parts: string[] = [];
    for (const p of parcels) {
      if (!p.isSubdivided) continue;
      parts.push(`${p.plotId}:${(p.subParcelOwnerIds ?? []).join(",")}:${(p.subParcelArchetypes ?? []).join(",")}`);
    }
    return parts.join("|");
  }, [parcels]);

  useEffect(() => {
    if (!fillMeshRef.current || !borderMeshRef.current) return;

    const currentParcels = parcelsRef.current;
    let instanceIdx = 0;

    for (const parcel of currentParcels) {
      if (!parcel.isSubdivided || !parcel.subParcelOwnerIds) continue;

      const center = latLngToVec3(parcel.lat, parcel.lng, GLOBE_RADIUS);
      const normal = center.clone().normalize();
      const { right, up } = tangentFrame(normal);

      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const subIndex = row * 3 + col;
          const ownerId  = parcel.subParcelOwnerIds[subIndex] ?? null;

          const offsetRight = (col - 1) * SUB_SPACING;
          const offsetUp    = (1 - row) * SUB_SPACING;

          const worldPos = center.clone()
            .addScaledVector(right, offsetRight)
            .addScaledVector(up, offsetUp)
            .normalize()
            .multiplyScalar(GLOBE_RADIUS * 1.028); // above main tiles (1.012/1.018)

          // Fill = archetype color when assigned; otherwise ownership color.
          const archetype = parcel.subParcelArchetypes?.[subIndex] ?? null;
          const isOwn = currentPlayerId && ownerId === currentPlayerId;
          const archColor = archetype ? ARCHETYPE_COLORS[archetype] : undefined;
          const fillColor = archColor
            ? archColor.clone()
            : new THREE.Color(
                !ownerId ? 0x0055aa    // unowned: bright blue
                : isOwn  ? 0x00ff88   // your sub-parcel: bright green
                : 0xff3300            // enemy sub-parcel: bright red
              );
          const borderColor = new THREE.Color(ownerId ? 0xffffff : 0x44aaff);

          dummy.position.copy(worldPos);
          dummy.lookAt(worldPos.clone().multiplyScalar(2));
          dummy.scale.setScalar(SUB_FILL_SIZE);
          dummy.updateMatrix();
          fillMeshRef.current.setMatrixAt(instanceIdx, dummy.matrix);
          fillMeshRef.current.setColorAt(instanceIdx, fillColor);

          dummy.scale.setScalar(SUB_BORDER_SIZE);
          dummy.updateMatrix();
          borderMeshRef.current.setMatrixAt(instanceIdx, dummy.matrix);
          borderMeshRef.current.setColorAt(instanceIdx, borderColor);

          instanceIdx++;
        }
      }
    }

    fillMeshRef.current.instanceMatrix.needsUpdate   = true;
    borderMeshRef.current.instanceMatrix.needsUpdate = true;
    if (fillMeshRef.current.instanceColor)   fillMeshRef.current.instanceColor.needsUpdate   = true;
    if (borderMeshRef.current.instanceColor) borderMeshRef.current.instanceColor.needsUpdate = true;
    fillMeshRef.current.count   = instanceIdx;
    borderMeshRef.current.count = instanceIdx;
  }, [subParcelFingerprint, currentPlayerId, dummy]);

  return (
    <group ref={groupRef} visible={false}>
      {/* renderOrder 3/4 so sub-tiles render above main plot layer (1/2) */}
      <instancedMesh ref={borderMeshRef} args={[undefined, undefined, MAX_SUB_TILES]} renderOrder={3}>
        <planeGeometry args={[1.0, 1.0]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.80}
          depthTest={false}
          depthWrite={false}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={fillMeshRef} args={[undefined, undefined, MAX_SUB_TILES]} renderOrder={4}>
        <planeGeometry args={[1.0, 1.0]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.90}
          depthTest={false}
          depthWrite={false}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
