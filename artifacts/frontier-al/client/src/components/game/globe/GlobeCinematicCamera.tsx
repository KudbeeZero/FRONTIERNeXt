/**
 * GlobeCinematicCamera — gently follow YOUR battles.
 *
 * Mount INSIDE the <Canvas> scene. Subscribes to the cinematic bus and, for a
 * battle the current player is in, eases the OrbitControls *target* along the
 * strike's arc — anticipate the launch, follow the strike across the globe, hold
 * on the contested plot through impact, then let go. It only ever nudges the
 * look-at point (never the zoom), scaled by the pure director's weight, so it
 * guides the eye without wresting control away.
 *
 * Opt-in (`cinematicCamera` pref, off by default) and gated by the cinematics
 * toggle + OS reduced-motion. Pure timing is the tested `cameraDirectorAt`; this
 * is a thin renderer. (R3F — not browser-verified in CI.)
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { onCinematic, type CinematicHandle } from "@/lib/battle/cinematicBus";
import { cameraDirectorAt } from "@/lib/battle/cameraDirector";
import { GLOBE_RADIUS } from "@/lib/globe/globeConstants";
import { latLngToVec3, buildArcCurve } from "@/lib/globe/globeUtils";
import { shouldPlayBattleCinematics } from "@/lib/battle/cinematicsEnabled";
import { useVisualPrefs } from "@/hooks/useVisualPrefs";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/** Per-frame easing toward the focus point, scaled by the director's weight. */
const LERP = 0.06;

export function GlobeCinematicCamera({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl> }) {
  const prefs = useVisualPrefs();
  const reduced = usePrefersReducedMotion();
  const enabled = prefs.cinematicCamera && shouldPlayBattleCinematics(prefs.battleCinematics, reduced);

  const active = useRef<{ handle: CinematicHandle; curve: THREE.QuadraticBezierCurve3 } | null>(null);
  const focus = useRef(new THREE.Vector3());

  useEffect(() => {
    const unsub = onCinematic((handle) => {
      if (!enabled || !handle.involvesPlayer) return;
      const from = latLngToVec3(handle.seq.source.lat, handle.seq.source.lng, GLOBE_RADIUS);
      const to = latLngToVec3(handle.seq.target.lat, handle.seq.target.lng, GLOBE_RADIUS);
      active.current = { handle, curve: buildArcCurve(from, to) };
    });
    return () => unsub();
  }, [enabled]);

  useFrame(() => {
    const a = active.current;
    const controls = controlsRef.current;
    if (!a || !controls) return;
    const d = cameraDirectorAt(a.handle.seq, Date.now() - a.handle.startMs);
    if (!d.active) {
      active.current = null; // released; hand control back to the user
      return;
    }
    a.curve.getPoint(d.arcT, focus.current);
    focus.current.setLength(GLOBE_RADIUS); // keep the look-at on the surface
    controls.target.lerp(focus.current, LERP * d.weight);
    controls.update();
  });

  return null;
}
