/**
 * GlobeBattleSequence — the resolution cinematic, on the globe.
 *
 * Mount INSIDE the <Canvas> scene. Self-subscribes to the rich `battle:resolved`
 * bus and, for each resolution, plays ONE timed sequence from the shared Battle
 * Sequence engine off a single clock: a telegraph/lock line and a strike
 * traveling the attacker→defender arc, an impact flash, a luck-swing pulse (only
 * when the swing decided it — now data-driven off the event's real randFactor),
 * and a victory/defense ring + capture burst at the target. This is the "lines
 * connecting everything together when there's a battle" — the connective tissue
 * `BattleArcs` (the persistent in-flight arc for *pending* battles) doesn't cover.
 *
 * The rich event carries randFactor + snapshot powers + names + biome; source
 * position, troops and commander come from the live `battles`+`parcels` props
 * (cached the moment a battle is seen, so they survive the battle leaving the
 * active list on resolve) — NO server change. If the source plot is unknown it
 * gracefully plays a target-only cinematic (no arc).
 *
 * All timing math is the tested pure engine + `battleSequencePlayback` +
 * `sequenceFromBattle`; this is a thin renderer. (R3F — typecheck/build-verified,
 * not browser-verified in CI, like the other globe layers.)
 */
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import type { Battle, LandParcel, Player, SlimParcel } from "@shared/schema";
import { onBattleResolved, type BattleResolvedEvent } from "@/hooks/useGameSocket";
import { GLOBE_RADIUS, ARC_TUBE_RADIUS, ARC_SEGMENTS } from "@/lib/globe/globeConstants";
import { latLngToVec3, buildArcCurve } from "@/lib/globe/globeUtils";
import { playbackAt } from "@/lib/globe/battleSequencePlayback";
import { buildSequenceFromFacts, factsFromResolvedEvent } from "@/lib/battle/sequenceFromBattle";
import { publishCinematic } from "@/lib/battle/cinematicBus";
import type { BattleSequence } from "@shared/battle-sequence";

// Match the living-map palette (liveEventDisplay): cyan victory, red defense.
const VICTORY_COLOR = "#22d3ee";
const DEFENSE_COLOR = "#f87171";
const SWING_COLOR = "#fbbf24";
/** Hard cap on how long a cinematic lingers before forced cleanup (ms). */
const MAX_LIFETIME_MS = 12_000;

interface ActiveCinematic {
  key: string;
  seq: BattleSequence;
  fromVec: THREE.Vector3 | null;
  toVec: THREE.Vector3;
  startMs: number;
}

function SingleCinematic({ cin, onDone }: { cin: ActiveCinematic; onDone: (key: string) => void }) {
  const { seq, fromVec, toVec } = cin;

  const curve = useMemo(
    () => (fromVec ? buildArcCurve(fromVec, toVec) : null),
    [fromVec, toVec],
  );
  const tubeGeo = useMemo(
    () => (curve ? new THREE.TubeGeometry(curve, ARC_SEGMENTS, ARC_TUBE_RADIUS, 6, false) : null),
    [curve],
  );
  const ringLookAt = useMemo(() => toVec.clone().multiplyScalar(2), [toVec]);

  const tubeRef = useRef<THREE.Mesh>(null);
  const strikeRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const swingRef = useRef<THREE.Mesh>(null);
  const captureRef = useRef<THREE.Mesh>(null);

  const ringColor = seq.captured ? VICTORY_COLOR : DEFENSE_COLOR;
  const captureColor = seq.victorColor ?? VICTORY_COLOR;
  const arcColor = seq.captured ? VICTORY_COLOR : DEFENSE_COLOR;

  useFrame(() => {
    const elapsed = Date.now() - cin.startMs;
    const s = playbackAt(seq, elapsed);

    if (tubeRef.current) {
      (tubeRef.current.material as THREE.MeshBasicMaterial).opacity = s.telegraphOpacity * 0.6;
      tubeRef.current.visible = s.telegraphOpacity > 0.01;
    }
    if (strikeRef.current && curve) {
      strikeRef.current.position.copy(curve.getPoint(s.arcProgress));
      (strikeRef.current.material as THREE.MeshBasicMaterial).opacity = s.strikeOpacity;
      strikeRef.current.visible = s.strikeOpacity > 0.01;
    }
    if (flashRef.current) {
      flashRef.current.scale.setScalar(0.04 + s.impactFlash * 0.2);
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = s.impactFlash;
      flashRef.current.visible = s.impactFlash > 0.01;
    }
    if (swingRef.current) {
      swingRef.current.scale.setScalar(1 + s.swingPulse * 3);
      (swingRef.current.material as THREE.MeshBasicMaterial).opacity = s.swingPulse * 0.8;
      swingRef.current.visible = s.swingPulse > 0.01;
      swingRef.current.lookAt(ringLookAt);
    }
    if (ringRef.current) {
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = s.ringOpacity * 0.85;
      ringRef.current.visible = s.ringOpacity > 0.01;
      ringRef.current.lookAt(ringLookAt);
    }
    if (captureRef.current) {
      captureRef.current.scale.setScalar(0.03 + s.captureProgress * 0.14);
      (captureRef.current.material as THREE.MeshBasicMaterial).opacity =
        (1 - s.captureProgress) * 0.5 * (seq.captured ? 1 : 0);
      captureRef.current.visible = seq.captured && s.captureProgress > 0.01 && s.captureProgress < 1;
    }

    if (s.settled || elapsed > MAX_LIFETIME_MS) onDone(cin.key);
  });

  return (
    <group>
      {tubeGeo && (
        <mesh ref={tubeRef} geometry={tubeGeo}>
          <meshBasicMaterial color={arcColor} transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {curve && (
        <mesh ref={strikeRef} position={fromVec ?? toVec}>
          <sphereGeometry args={[0.02, 10, 10]} />
          <meshBasicMaterial color={arcColor} transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {/* Impact flash */}
      <mesh ref={flashRef} position={toVec}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color={VICTORY_COLOR} transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Swing pulse ring */}
      <mesh ref={swingRef} position={toVec}>
        <ringGeometry args={[0.05, 0.075, 32]} />
        <meshBasicMaterial color={SWING_COLOR} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Outcome ring */}
      <mesh ref={ringRef} position={toVec}>
        <ringGeometry args={[0.06, 0.09, 40]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Capture burst */}
      <mesh ref={captureRef} position={toVec}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color={captureColor} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

interface GlobeBattleSequenceProps {
  battles: Battle[];
  parcels: (LandParcel | SlimParcel)[];
  players: Player[];
  currentPlayerId: string | null;
}

export function GlobeBattleSequence({ battles, parcels, players, currentPlayerId }: GlobeBattleSequenceProps) {
  const [active, setActive] = useState<ActiveCinematic[]>([]);

  // Caches kept current from props so a resolution can be choreographed even
  // after the battle drops off the active list.
  const battleCache = useRef<Map<string, Battle>>(new Map());
  const parcelById = useRef<Map<string, LandParcel | SlimParcel>>(new Map());
  const parcelByPlotId = useRef<Map<number, LandParcel | SlimParcel>>(new Map());
  const firstParcelOf = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    for (const b of battles) battleCache.current.set(b.id, b);
  }, [battles]);

  useEffect(() => {
    parcelById.current = new Map(parcels.map((p) => [p.id, p]));
    parcelByPlotId.current = new Map(parcels.map((p) => [p.plotId, p]));
  }, [parcels]);

  useEffect(() => {
    const fp = new Map<string, string>();
    for (const p of players) if (p.ownedParcels?.length) fp.set(p.id, p.ownedParcels[0]);
    firstParcelOf.current = fp;
  }, [players]);

  const remove = useCallback((key: string) => {
    setActive((prev) => prev.filter((c) => c.key !== key));
  }, []);

  useEffect(() => {
    const unsub = onBattleResolved((event: BattleResolvedEvent) => {
      const target = { lat: event.lat, lng: event.lng };
      const battle = battleCache.current.get(event.battleId);
      const targetParcel = parcelByPlotId.current.get(event.plotId);
      const improvements =
        targetParcel && "improvements" in targetParcel ? targetParcel.improvements : undefined;

      // Resolve the attacker (source) position from the cached battle, if known.
      let source = target;
      let hasSource = false;
      if (battle) {
        const srcId = battle.sourceParcelId ?? firstParcelOf.current.get(battle.attackerId);
        const srcParcel = srcId ? parcelById.current.get(srcId) : undefined;
        if (srcParcel && (srcParcel.lat !== target.lat || srcParcel.lng !== target.lng)) {
          source = { lat: srcParcel.lat, lng: srcParcel.lng };
          hasSource = true;
        }
      }

      const facts = factsFromResolvedEvent(
        { ...event, defenderName: event.defenderName === "Unclaimed" ? null : event.defenderName },
        {
          source,
          target,
          improvements: improvements as { type: string; level: number }[] | undefined,
          troopsCommitted: battle?.troopsCommitted,
          hasCommander: !!battle?.commanderId,
          attackerColor: VICTORY_COLOR,
          defenderColor: DEFENSE_COLOR,
        },
      );

      const fromVec = hasSource ? latLngToVec3(source.lat, source.lng, GLOBE_RADIUS * 1.01) : null;
      const toVec = latLngToVec3(target.lat, target.lng, GLOBE_RADIUS * 1.01);
      const seq = buildSequenceFromFacts(facts);
      const startMs = Date.now();

      // Let the DOM HUD speak the same beats off the same clock.
      publishCinematic({ seq, startMs });

      setActive((prev) => {
        const next = prev.filter((c) => c.key !== event.battleId);
        return [...next, { key: event.battleId, seq, fromVec, toVec, startMs }].slice(-6);
      });
    });
    return () => unsub();
  }, []);

  void currentPlayerId; // available for future faction-colour theming

  if (active.length === 0) return null;
  return (
    <group>
      {active.map((cin) => (
        <SingleCinematic key={cin.key} cin={cin} onDone={remove} />
      ))}
    </group>
  );
}
