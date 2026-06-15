import { useEffect, useRef, useState } from "react";
import { corrupt } from "../lib/glitch";

// ---------------------------------------------------------------------------
// Live, re-rolling text corruption for Aether's damaged speech.
//
// While `severity > 0`, the text is periodically re-glitched (dropped/swapped
// glyphs) and given an occasional chromatic-split shadow, so a line visibly
// fractures and re-forms as it's spoken. At severity 0 it renders clean.
// ---------------------------------------------------------------------------

interface GlitchTextProps {
  text: string;
  severity: number;
  className?: string;
}

export function GlitchText({ text, severity, className }: GlitchTextProps) {
  const [display, setDisplay] = useState(text);
  const [split, setSplit] = useState(false);
  const raf = useRef<number | null>(null);
  const last = useRef(0);

  useEffect(() => {
    if (severity <= 0.02) {
      setDisplay(text);
      setSplit(false);
      return;
    }
    // Re-roll the corruption on a coarse interval for a flicker cadence.
    const tick = (t: number) => {
      if (t - last.current > 70 + Math.random() * 60) {
        last.current = t;
        setDisplay(corrupt(text, severity));
        setSplit(Math.random() < severity * 0.4);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [text, severity]);

  return (
    <span
      className={className}
      style={
        split
          ? {
              textShadow:
                "1.5px 0 rgba(255,80,80,0.7), -1.5px 0 rgba(80,200,255,0.7)",
            }
          : undefined
      }
    >
      {display}
    </span>
  );
}
