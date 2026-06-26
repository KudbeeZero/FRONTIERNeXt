/**
 * client/src/components/game/IntroCinematic.tsx
 *
 * Short entry cinematic that replaces the old launch counter: a deep-space
 * ignition → orbital push-in on the planet → "AI BATTLE TEST" title card, then it
 * hands off to the faction-select gate beneath it. Page-level overlay (highest
 * z-index) — never touches the globe/combat canvas. Plays once per browser and is
 * skippable. All timing comes from the tested pure helpers in lib/introCinematic.
 */
import { useEffect, useRef, useState } from "react";
import {
  introPhaseAt,
  introProgress,
  introSeen,
  markIntroSeen,
  INTRO_DURATION_MS,
} from "@/lib/introCinematic";

export function IntroCinematic() {
  const [visible, setVisible] = useState(() => !introSeen());
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const finish = () => {
    markIntroSeen();
    setVisible(false);
  };

  useEffect(() => {
    if (!visible) return;
    const tick = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const e = t - startRef.current;
      setElapsed(e);
      if (e >= INTRO_DURATION_MS) {
        finish();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const phase = introPhaseAt(elapsed);
  const p = introProgress(elapsed);

  // Planet rushes up: small + low in the ignition phase, filling the frame by the
  // title card. Eased so the approach feels like deceleration into orbit.
  const eased = 1 - Math.pow(1 - p, 3);
  const planetScale = 0.35 + eased * 1.9;
  const planetY = 120 - eased * 120;
  const titleOn = phase === "title";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300, overflow: "hidden",
        background: "radial-gradient(circle at 50% 120%, #0a1230 0%, #050818 55%, #01030a 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Courier New', 'SF Mono', monospace", color: "#e0eaff",
      }}
    >
      {/* Starfield drift */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.5,
        background:
          "radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 40%, #cde, transparent), radial-gradient(1px 1px at 40% 70%, #fff, transparent), radial-gradient(1px 1px at 85% 75%, #bdf, transparent), radial-gradient(1px 1px at 55% 20%, #fff, transparent)",
        transform: `scale(${1 + eased * 0.4})`,
      }} />

      {/* Planet — pushes in toward orbit */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        width: 240, height: 240, borderRadius: "50%",
        transform: `translate(-50%, calc(-50% + ${planetY}px)) scale(${planetScale})`,
        background: "radial-gradient(circle at 35% 32%, #2f55a0 0%, #1c2f60 32%, #0e1a3e 58%, #060e22 82%, #02050c 100%)",
        boxShadow: "0 0 80px 18px rgba(50,90,210,0.35), inset -26px -18px 50px rgba(0,0,0,0.65), inset 12px 12px 34px rgba(70,110,210,0.12)",
      }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "radial-gradient(circle at 30% 28%, rgba(120,170,255,0.16) 0%, transparent 60%)",
        }} />
      </div>

      {/* Title card */}
      <div style={{
        position: "relative", zIndex: 2, textAlign: "center",
        opacity: titleOn ? 1 : 0, transform: `translateY(${titleOn ? 0 : 16}px)`,
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}>
        <div style={{ fontSize: 11, letterSpacing: "0.4em", color: "rgba(120,170,255,0.7)", textTransform: "uppercase", marginBottom: 10 }}>
          ⬡ Frontier
        </div>
        <div style={{
          fontSize: "clamp(28px, 6vw, 52px)", fontWeight: 800, letterSpacing: "0.06em", color: "#fff",
          textShadow: "0 0 26px rgba(80,130,255,0.5)",
        }}>
          AI BATTLE TEST
        </div>
        <div style={{ fontSize: 12, color: "rgba(170,200,255,0.7)", marginTop: 8, letterSpacing: "0.12em" }}>
          Choose a faction. Take the frontier.
        </div>
      </div>

      {/* Bottom progress + skip */}
      <div style={{ position: "absolute", bottom: 26, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ width: 200, height: 2, background: "rgba(70,90,150,0.3)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.round(p * 100)}%`, background: "linear-gradient(90deg,#4fc3f7,#a78bfa)" }} />
        </div>
        <button
          onClick={finish}
          style={{
            background: "transparent", border: "1px solid rgba(120,150,210,0.4)", borderRadius: 7,
            padding: "6px 16px", color: "rgba(180,205,255,0.8)", fontSize: 11, letterSpacing: "0.14em",
            textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Skip ▶
        </button>
      </div>
    </div>
  );
}
