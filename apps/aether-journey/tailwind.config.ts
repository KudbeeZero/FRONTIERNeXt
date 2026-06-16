import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Cockpit UI typeface stack — falls back gracefully offline.
        display: ["Orbitron", "Rajdhani", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        // Aether's holographic palette.
        aether: {
          core: "#7fe7ff",
          deep: "#2a9fd6",
          warm: "#ffd9a0",
          alert: "#ff5a5a",
          void: "#03070f",
        },
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "1" },
          "41%": { opacity: "1" },
          "42%": { opacity: "0.4" },
          "43%": { opacity: "1" },
          "78%": { opacity: "0.85" },
          "79%": { opacity: "0.35" },
          "80%": { opacity: "1" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        flicker: "flicker 4s linear infinite",
        scan: "scan 6s linear infinite",
        breathe: "breathe 3.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
