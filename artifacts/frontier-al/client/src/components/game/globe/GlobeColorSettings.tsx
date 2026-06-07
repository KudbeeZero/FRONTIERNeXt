/**
 * GlobeColorSettings — small popover letting players recolour their own /
 * enemy territory. Pure client: writes to the localStorage-backed visualPrefs
 * store, which the globe consumes via the plot fingerprint (instant re-paint).
 */

import { useState } from "react";
import { useVisualPrefs } from "@/hooks/useVisualPrefs";
import { setVisualPref, resetVisualPrefs } from "@/lib/globe/visualPrefs";

export function GlobeColorSettings() {
  const prefs = useVisualPrefs();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "absolute", left: 12, bottom: 24, zIndex: 30 }}>
      {open && (
        <div
          style={{
            position: "absolute", left: 0, bottom: 40, width: 208,
            background: "rgba(4,8,20,0.92)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(79,195,247,0.25)", borderRadius: 10,
            padding: "14px 14px 12px", fontFamily: "monospace",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(0,229,255,0.8)", textTransform: "uppercase", marginBottom: 12 }}>
            Territory Colors
          </div>

          {[
            { label: "Your Territory", key: "territoryColor" as const, value: prefs.territoryColor },
            { label: "Enemy Territory", key: "enemyColor" as const, value: prefs.enemyColor },
          ].map(({ label, key, value }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "rgba(180,210,255,0.8)" }}>{label}</span>
              <input
                type="color"
                value={value}
                onChange={(e) => setVisualPref(key, e.target.value)}
                aria-label={label}
                style={{
                  width: 34, height: 24, padding: 0, border: "1px solid rgba(79,195,247,0.3)",
                  borderRadius: 4, background: "transparent", cursor: "pointer",
                }}
              />
            </div>
          ))}

          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 0 8px", cursor: "pointer" }}>
            <span style={{ fontSize: 11, color: "rgba(180,210,255,0.8)" }}>Fog of War</span>
            <input
              type="checkbox"
              checked={prefs.fogOfWar}
              onChange={(e) => setVisualPref("fogOfWar", e.target.checked)}
              aria-label="Fog of War"
              style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#00e5ff" }}
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 10px", cursor: "pointer" }}>
            <span style={{ fontSize: 11, color: "rgba(180,210,255,0.8)" }} title="Zoom out to look into the past">Observer Mode</span>
            <input
              type="checkbox"
              checked={prefs.observerMode}
              onChange={(e) => setVisualPref("observerMode", e.target.checked)}
              aria-label="Observer Mode"
              style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#00e5ff" }}
            />
          </label>

          <button
            onClick={() => resetVisualPrefs()}
            style={{
              width: "100%", marginTop: 4, padding: "7px 0",
              background: "rgba(79,195,247,0.1)", border: "1px solid rgba(79,195,247,0.25)",
              borderRadius: 6, color: "rgba(0,229,255,0.85)", fontSize: 10,
              letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
              fontFamily: "monospace",
            }}
          >
            Reset
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        title="Territory colors"
        style={{
          width: 32, height: 32, background: "rgba(4,8,20,0.7)",
          border: "1px solid rgba(79,195,247,0.3)", borderRadius: 6,
          color: "rgba(0,229,255,0.85)", fontSize: 15, lineHeight: 1, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        🎨
      </button>
    </div>
  );
}
