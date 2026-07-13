/**
 * PlanetGlobe — FRONTIER 3D globe orchestrator.
 * Wires props, mounts sub-components, and renders the Canvas.
 * Scene internals live in ./globe/ and hooks in @/hooks/.
 */

import * as THREE from "three";
import { useRef, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useQuery } from "@tanstack/react-query";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { LandParcel, Player, Battle, OrbitalEvent } from "@shared/schema";
import type { WorldEvent } from "@shared/worldEvents";
import { GlobeEventOverlays } from "./GlobeEventOverlays";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";
import { resolveApiUrl } from "@/lib/queryClient";
import { StarField }           from "./globe/StarField";
import { GlobeTerrain }        from "./globe/GlobeTerrain";
import { PlotOverlay, SubParcelOverlay } from "./globe/GlobeParcels";
import { ObserverLayer } from "./globe/ObserverLayer";
import { useVisualPrefs } from "@/hooks/useVisualPrefs";
import { BattleArcs, MiningPulseLayer, OrbitalZoneLayer, SatelliteOrbitLayer } from "./globe/GlobeEvents";
import { LiveWeaponLayer } from "./globe/LiveWeaponLayer";
import { GlobeLiveEvents } from "./globe/GlobeLiveEvents";
import { GlobeBattleSequence } from "./globe/GlobeBattleSequence";
import { GlobeShieldDome } from "./globe/GlobeShieldDome";
import { GlobeBattleScars } from "./globe/GlobeBattleScars";
import { BattleCalloutHUD } from "./globe/BattleCalloutHUD";
import { GlobeIncomingTelegraph } from "./globe/GlobeIncomingTelegraph";
import { GlobeMusterLayer } from "./globe/GlobeMusterLayer";
import { GlobeCinematicCamera } from "./globe/GlobeCinematicCamera";
import { BattleSoundLayer } from "./globe/BattleSoundLayer";
import { GlobeHUD, GlobeCompass, PlayerLegend, ParcelHUD } from "./globe/GlobeHUD";
import { GlobeColorSettings } from "./globe/GlobeColorSettings";
import { CameraController } from "@/hooks/useGlobeCamera";
import { factionColor } from "@/lib/battle/factionColor";
import type { BattleScarRecord } from "@/lib/battle/battleScars";

interface BattleHistoryRecord {
  id: string;
  attackerName: string;
  defenderName: string;
  plotId: number;
  outcome: "attacker_wins" | "defender_wins";
  attackerPower: number;
  defenderPower: number;
  resolvedAt: number;
}

/** Seeds GlobeBattleScars from the existing public battle-history endpoint. */
function useBattleScarSeed(): BattleScarRecord[] {
  const { data } = useQuery<{ battles: BattleHistoryRecord[] }>({
    queryKey: ["/api/battles/history", "scars-seed"],
    queryFn: () =>
      fetch(resolveApiUrl("/api/battles/history?limit=50")).then((r) => r.json()),
    staleTime: 60_000,
  });
  return useMemo(() => {
    if (!data?.battles) return [];
    return data.battles.map((b): BattleScarRecord => {
      const captured = b.outcome === "attacker_wins";
      return {
        battleId: b.id,
        plotId: b.plotId,
        outcome: b.outcome,
        attackerPower: b.attackerPower,
        defenderPower: b.defenderPower,
        resolvedAt: b.resolvedAt,
        color: captured
          ? factionColor(b.attackerName)
          : factionColor(b.defenderName === "Unclaimed" ? null : b.defenderName),
      };
    });
  }, [data]);
}

export type { LivePulse } from "@/lib/globe/globeTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

import type { LivePulse } from "@/lib/globe/globeTypes";

interface SceneProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
  selectedPlotId: string | null;
  onPlotSelect: (parcelId: string) => void;
  controlsRef: React.RefObject<OrbitControlsImpl>;
  targetLat: number | null;
  targetLng: number | null;
  battles: Battle[];
  livePulses: LivePulse[];
  orbitalEvents: OrbitalEvent[];
  replayEvents?: WorldEvent[];
  replayTime?: number;
  replayVisibleTypes?: Set<string>;
  streamMode?: boolean;
  flyRequestId?: number;
  onObserverOffset?: (ms: number) => void;
  battleScarSeed: BattleScarRecord[];
}

// ── Scene ─────────────────────────────────────────────────────────────────────

function Scene({
  parcels, players, currentPlayerId, selectedPlotId, onPlotSelect,
  controlsRef, targetLat, targetLng, battles, livePulses, orbitalEvents,
  replayEvents, replayTime, replayVisibleTypes, streamMode, flyRequestId,
  onObserverOffset, battleScarSeed,
}: SceneProps) {
  const prefs = useVisualPrefs();
  const battleHotspots = useMemo(() => {
    if (!streamMode) return [];
    const parcelMap = new Map(parcels.map(p => [p.id, p]));
    return battles
      .filter(b => b.status === "pending")
      .map(b => parcelMap.get(b.targetParcelId))
      .filter((p): p is LandParcel => !!p)
      .map(p => ({ lat: p.lat, lng: p.lng }));
  }, [streamMode, battles, parcels]);

  return (
    <>
      <CameraController
        targetLat={targetLat}
        targetLng={targetLng}
        controlsRef={controlsRef}
        streamMode={streamMode}
        battleHotspots={battleHotspots}
        flyRequestId={flyRequestId}
      />
      <StarField />
      <ambientLight intensity={1.8} color="#d8eaff" />
      <directionalLight position={[8, 4, 5]}   intensity={1.6} color="#fff4e0" />
      <directionalLight position={[-6, -2, -4]} intensity={1.2} color="#c0d4ff" />
      <directionalLight position={[0, 8, 0]}   intensity={0.7} color="#e0eeff" />
      <group>
        <GlobeTerrain />
        <PlotOverlay
          parcels={parcels}
          players={players}
          currentPlayerId={currentPlayerId}
          selectedPlotId={selectedPlotId}
          onPlotSelect={onPlotSelect}
        />
        {/* Sub-parcel 3×3 grids — archetype-colored, LOD-gated (only visible when zoomed in) */}
        {!streamMode && (
          <SubParcelOverlay
            parcels={parcels}
            players={players}
            currentPlayerId={currentPlayerId}
          />
        )}
        {prefs.observerMode ? (
          <ObserverLayer events={replayEvents ?? []} onOffsetChange={onObserverOffset} />
        ) : (
          replayEvents && replayEvents.length > 0 && replayVisibleTypes && replayTime !== undefined && (
            <GlobeEventOverlays
              events={replayEvents}
              replayTime={replayTime}
              visibleTypes={replayVisibleTypes}
            />
          )
        )}
      </group>
      <BattleArcs battles={battles} parcels={parcels} players={players} currentPlayerId={currentPlayerId} />
      <GlobeIncomingTelegraph battles={battles} parcels={parcels} />
      <GlobeMusterLayer battles={battles} parcels={parcels} players={players} />
      <GlobeBattleScars seedRecords={battleScarSeed} parcels={parcels} />
      <MiningPulseLayer pulses={livePulses} />
      <OrbitalZoneLayer events={orbitalEvents} />
      <SatelliteOrbitLayer players={players} />
      <LiveWeaponLayer />
      <GlobeBattleSequence battles={battles} parcels={parcels} players={players} currentPlayerId={currentPlayerId} />
      <GlobeShieldDome />
      <GlobeCinematicCamera controlsRef={controlsRef} />
      <GlobeLiveEvents />
      <OrbitControls
        ref={controlsRef as any}
        enablePan={false}
        enableDamping={true}
        dampingFactor={0.08}
        rotateSpeed={0.45}
        zoomSpeed={0.9}
        minDistance={GLOBE_RADIUS * 1.8}
        maxDistance={GLOBE_RADIUS * 6.0}
        // TWO-finger pinch should zoom only (dolly). DOLLY_ROTATE made the globe
        // spin unexpectedly during pinch gestures, and the rotation often moved
        // the user’s finger onto UI elements (dock, buttons) which then opened
        // menus/sheets. With enablePan={false}, DOLLY_PAN is effectively a
        // pure zoom, matching mobile user expectations.
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        makeDefault
      />
    </>
  );
}

/** Formats an observer look-back offset (ms) as "LIVE" / "T-MINUS Xh Ym". */
function formatLookback(offsetMs: number): string {
  if (offsetMs < 60_000) return "LIVE";
  const totalMin = Math.round(offsetMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `T-MINUS ${h > 0 ? `${h}h ` : ""}${m}m`;
}

// ── PlanetGlobe ───────────────────────────────────────────────────────────────

interface PlanetGlobeProps {
  parcels: LandParcel[];
  players: Player[];
  currentPlayerId: string | null;
  selectedParcelId: string | null;
  onParcelSelect: (parcelId: string) => void;
  onAttack?: () => void;
  onMine?: () => void;
  onBuild?: () => void;
  onPurchase?: () => void;
  className?: string;
  battles?: Battle[];
  livePulses?: LivePulse[];
  orbitalEvents?: OrbitalEvent[];
  replayEvents?: WorldEvent[];
  replayTime?: number;
  replayVisibleTypes?: Set<string>;
  activeBattleCount?: number;
  /** Enable stream mode: fullscreen hotspot camera + no HUD chrome. */
  streamMode?: boolean;
  /** Increment to force a camera re-fly even when coordinates haven't changed. */
  flyRequestId?: number;
  /** NFT claim props forwarded to ParcelHUD */
  nftInfo?: { assetId: number; inCustody: boolean } | null;
  onDeliverNft?: () => void;
  isDeliveringNft?: boolean;
}

export default function PlanetGlobe({
  parcels,
  players,
  currentPlayerId,
  selectedParcelId,
  onParcelSelect,
  onAttack,
  onMine,
  onBuild,
  onPurchase,
  className,
  battles = [],
  livePulses = [],
  orbitalEvents = [],
  replayEvents,
  replayTime,
  replayVisibleTypes,
  activeBattleCount = 0,
  streamMode = false,
  flyRequestId,
  nftInfo,
  onDeliverNft,
  isDeliveringNft,
}: PlanetGlobeProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null!);
  const prefs = useVisualPrefs();
  const [observerOffset, setObserverOffset] = useState(0);
  const battleScarSeed = useBattleScarSeed();

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const selectedParcel = useMemo(
    () => parcels.find(p => p.id === selectedParcelId),
    [parcels, selectedParcelId]
  );

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%", background: "#000000" }}>
      <Canvas
        camera={{ position: [0, 0, GLOBE_RADIUS * 3.8], fov: 45, near: 0.5, far: 200 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        style={{ background: "#000000", touchAction: "none" }}
      >
        <Scene
          parcels={parcels}
          players={players}
          currentPlayerId={currentPlayerId}
          selectedPlotId={selectedParcelId}
          onPlotSelect={onParcelSelect}
          controlsRef={controlsRef}
          targetLat={selectedParcel?.lat ?? null}
          targetLng={selectedParcel?.lng ?? null}
          battles={battles}
          livePulses={livePulses}
          orbitalEvents={orbitalEvents}
          replayEvents={replayEvents}
          replayTime={replayTime}
          replayVisibleTypes={replayVisibleTypes}
          streamMode={streamMode}
          flyRequestId={flyRequestId}
          onObserverOffset={setObserverOffset}
          battleScarSeed={battleScarSeed}
        />
      </Canvas>

      {prefs.observerMode && !streamMode && (
        <div style={{
          position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
          zIndex: 30, pointerEvents: "none",
          background: "rgba(4,8,20,0.72)", border: "1px solid rgba(167,139,250,0.4)",
          borderRadius: 6, padding: "5px 12px", fontFamily: "monospace",
          fontSize: 11, letterSpacing: "0.15em", color: "rgba(190,170,255,0.95)",
          textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ color: "#a78bfa" }}>◎ OBSERVER</span>
          <span style={{ color: "rgba(190,170,255,0.7)" }}>{formatLookback(observerOffset)}</span>
        </div>
      )}

      <GlobeHUD activeBattleCount={activeBattleCount} replayTime={replayTime} />

      <BattleCalloutHUD />
      <BattleSoundLayer />

      <GlobeCompass controlsRef={controlsRef} />

      {/* Zoom buttons */}
      <div style={{
        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
        zIndex: 30, display: "flex", flexDirection: "column", gap: 4,
      }}>
        {(["+", "−"] as const).map((label, i) => (
          <button
            key={label}
            onClick={() => {
              const cam = controlsRef.current?.object;
              if (!cam) return;
              const d = (cam as THREE.PerspectiveCamera).position.length();
              const next = i === 0
                ? Math.max(GLOBE_RADIUS * 1.8, d * 0.82)
                : Math.min(GLOBE_RADIUS * 6.0, d * 1.20);
              (cam as THREE.PerspectiveCamera).position.setLength(next);
              controlsRef.current.update();
            }}
            style={{
              width: 32, height: 32,
              background: "rgba(4,8,20,0.7)",
              border: "1px solid rgba(79,195,247,0.3)",
              borderRadius: 6, color: "rgba(0,229,255,0.85)",
              fontSize: 18, lineHeight: 1, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "monospace",
            }}
          >{label}</button>
        ))}
      </div>

      <PlayerLegend />

      {!streamMode && <GlobeColorSettings />}

      {selectedParcel && (
        <ParcelHUD
          parcel={selectedParcel}
          currentPlayerId={currentPlayerId}
          playerMap={playerMap}
          onAttack={onAttack}
          onMine={onMine}
          onBuild={onBuild}
          onPurchase={onPurchase}
          onParcelSelect={onParcelSelect}
          nftInfo={nftInfo}
          onDeliverNft={onDeliverNft}
          isDeliveringNft={isDeliveringNft}
        />
      )}

      <button
        onClick={() => controlsRef.current?.reset()}
        className="absolute bottom-24 right-4 z-20 backdrop-blur-xl text-white/50 hover:text-white/90 px-3 py-2 rounded-lg transition-all"
        style={{ background: "rgba(4, 8, 20, 0.6)", border: "1px solid rgba(79, 195, 247, 0.15)", fontSize: 10, fontFamily: "monospace", letterSpacing: "0.2em" }}
      >
        RESET
      </button>
    </div>
  );
}
