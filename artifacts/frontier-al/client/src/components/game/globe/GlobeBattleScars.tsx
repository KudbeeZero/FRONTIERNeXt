/**
 * GlobeBattleScars — persistent aftermath decals, on the globe.
 *
 * Unit B3 from the battle-visuals plan. Mount INSIDE the <Canvas> scene.
 * Today a battle's cinematic (`GlobeBattleSequence`) fades ~12s after
 * resolution and the map forgets it happened. This renders a slowly fading
 * mark for every recent battle — a scorch ring where the attacker captured
 * the plot (victor's faction color), or a shield glint where the defense
 * held — sized by the real power differential and decaying with age, so the
 * globe reads as a live map of the recent front lines.
 *
 * Seeded on load from the `seedRecords` prop (built by the caller from the
 * existing public `GET /api/battles/history`, fetched OUTSIDE the Canvas
 * tree — react-query's context does not reliably reach components mounted by
 * @react-three/fiber's own reconciler, so every data-fetching hook in this
 * codebase runs above `<Canvas>` and flows in as props) and appended live
 * here off the existing `battle:resolved` WS bus — the same event
 * `GlobeBattleSequence` already consumes for the resolution cinematic. NO new
 * server endpoint.
 *
 * All derivation (dedupe/decay/sizing/cap) is the pure, tested
 * `deriveBattleScars`; this is a thin renderer. (R3F —
 * typecheck/build-verified, not browser-verified in CI, like the other globe
 * layers.)
 */
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LandParcel, SlimParcel } from "@shared/schema";
import { onBattleResolved, type BattleResolvedEvent } from "@/hooks/useGameSocket";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";
import { latLngToVec3 } from "@/lib/globe/globeUtils";
import { deriveBattleScars, MAX_SCARS, type BattleScarRecord } from "@/lib/battle/battleScars";
import { factionColor } from "@/lib/battle/factionColor";
import { shouldPlayBattleCinematics } from "@/lib/battle/cinematicsEnabled";
import { useVisualPrefs } from "@/hooks/useVisualPrefs";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/** Recompute the slow age-based fade this often (ms) — no need for per-frame updates. */
const REFRESH_MS = 60_000;
/** Cap on the raw live-appended buffer before dedupe/cap runs (generous headroom over MAX_SCARS). */
const LIVE_BUFFER_CAP = MAX_SCARS * 3;

function SingleScar({
  pos, captured, color, opacity, size,
}: {
  pos: THREE.Vector3;
  captured: boolean;
  color: string;
  opacity: number;
  size: number;
}) {
  const lookAt = useMemo(() => pos.clone().multiplyScalar(2), [pos]);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    groupRef.current?.lookAt(lookAt);
  }, [lookAt]);

  const scale = 0.6 + size * 0.8;
  return (
    <group ref={groupRef} position={pos} scale={scale}>
      {captured ? (
        // Scorch ring — a capture happened here.
        <mesh>
          <ringGeometry args={[0.045, 0.075, 28]} />
          <meshBasicMaterial color={color} transparent opacity={opacity * 0.5} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ) : (
        // Shield glint — the defense held here.
        <mesh>
          <ringGeometry args={[0.03, 0.045, 24]} />
          <meshBasicMaterial color={color} transparent opacity={opacity * 0.6} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

interface GlobeBattleScarsProps {
  seedRecords: BattleScarRecord[];
  parcels: (LandParcel | SlimParcel)[];
}

export function GlobeBattleScars({ seedRecords, parcels }: GlobeBattleScarsProps) {
  const play = shouldPlayBattleCinematics(useVisualPrefs().battleCinematics, usePrefersReducedMotion());
  const [liveRecords, setLiveRecords] = useState<BattleScarRecord[]>([]);
  const [tick, setTick] = useState(0);

  // The fade curve spans hours, so a slow periodic recompute (rather than a
  // per-frame one) is enough to keep long-idle sessions from looking stale.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const unsub = onBattleResolved((event: BattleResolvedEvent) => {
      const captured = event.outcome === "attacker_wins";
      const color = captured
        ? factionColor(event.attackerName)
        : factionColor(event.defenderName === "Unclaimed" ? null : event.defenderName);
      const rec: BattleScarRecord = {
        battleId: event.battleId,
        plotId: event.plotId,
        outcome: event.outcome,
        attackerPower: event.attackerPower,
        defenderPower: event.defenderPower,
        resolvedAt: event.timestamp ?? Date.now(),
        color,
      };
      setLiveRecords((prev) => [...prev, rec].slice(-LIVE_BUFFER_CAP));
    });
    return () => unsub();
  }, []);

  const parcelByPlotId = useMemo(() => {
    const m = new Map<number, { lat: number; lng: number }>();
    for (const p of parcels) m.set(p.plotId, { lat: p.lat, lng: p.lng });
    return m;
  }, [parcels]);

  const scars = useMemo(() => {
    void tick; // periodic tick forces re-derivation as scars age out — see REFRESH_MS above
    return deriveBattleScars([...seedRecords, ...liveRecords], Date.now());
  }, [seedRecords, liveRecords, tick]);

  if (!play || scars.length === 0) return null;
  return (
    <group>
      {scars.map((s) => {
        const coord = parcelByPlotId.get(s.plotId);
        if (!coord) return null;
        return (
          <SingleScar
            key={s.battleId}
            pos={latLngToVec3(coord.lat, coord.lng, GLOBE_RADIUS * 1.008)}
            captured={s.captured}
            color={s.color}
            opacity={s.opacity}
            size={s.size}
          />
        );
      })}
    </group>
  );
}
