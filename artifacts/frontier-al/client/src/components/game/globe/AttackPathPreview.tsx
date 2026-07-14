/**
 * AttackPathPreview — Visual planning aid for Battle Planner.
 * Renders a dashed arc from origin to target parcel with pulsing markers.
 * Purely presentational, no gameplay logic, no pointer interactions.
 */

import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { LandParcel } from "@shared/schema";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";
import { latLngToVec3, buildArcCurve } from "@/lib/globe/globeUtils";

interface AttackPathPreviewProps {
  originParcel: LandParcel | null;
  targetParcel: LandParcel | null;
}

export function AttackPathPreview({ originParcel, targetParcel }: AttackPathPreviewProps) {
  const tubeRef = useRef<THREE.Mesh>(null!);
  const originMarkerRef = useRef<THREE.Mesh>(null!);
  const targetMarkerRef = useRef<THREE.Mesh>(null!);
  const pulseRef = useRef(0);

  // Memoize geometry — only rebuild when parcels change
  const { fromVec, toVec, curve, tubeGeo } = useMemo(() => {
    if (!originParcel || !targetParcel) {
      return { fromVec: null, toVec: null, curve: null, tubeGeo: null };
    }
    const fromVec = latLngToVec3(originParcel.lat, originParcel.lng, GLOBE_RADIUS * 1.01);
    const toVec = latLngToVec3(targetParcel.lat, targetParcel.lng, GLOBE_RADIUS * 1.01);
    const curve = buildArcCurve(fromVec, toVec);
    const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.008, 6, false);
    return { fromVec, toVec, curve, tubeGeo };
  }, [originParcel, targetParcel]);

  // Pulse animation — subtle opacity modulation
  useFrame((_, delta) => {
    pulseRef.current = (pulseRef.current + delta * 1.5) % (Math.PI * 2);
    const pulse = 0.4 + Math.sin(pulseRef.current) * 0.2;

    if (tubeRef.current) {
      (tubeRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
    if (originMarkerRef.current) {
      (originMarkerRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(pulseRef.current) * 0.3;
    }
    if (targetMarkerRef.current) {
      (targetMarkerRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(pulseRef.current) * 0.3;
    }
  });

  // Return null if either parcel is missing
  if (!originParcel || !targetParcel || !fromVec || !toVec || !tubeGeo) return null;

  // Distinct cyan/teal color for planning (different from battle arcs)
  const pathColor = "#00d9ff";

  return (
    <group>
      {/* Arc tube */}
      <mesh ref={tubeRef} geometry={tubeGeo}>
        <meshBasicMaterial color={pathColor} transparent opacity={0.5} depthWrite={false} />
      </mesh>

      {/* Origin marker — pulsing ring */}
      <mesh ref={originMarkerRef} position={fromVec}>
        <ringGeometry args={[0.025, 0.035, 16]} />
        <meshBasicMaterial color={pathColor} transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Target marker — crosshair diamond */}
      <mesh ref={targetMarkerRef} position={toVec}>
        <ringGeometry args={[0.03, 0.04, 4]} />
        <meshBasicMaterial color="#ff6b6b" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
