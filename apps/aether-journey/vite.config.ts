import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Aether's Journey is a self-contained client-only prototype.
// `base: "./"` keeps the built bundle portable (works from any static host / subpath).
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // three.js's core is ~690 kB and can't be split smaller without lazy-loading
    // the whole 3D scene (a Phase 2 task). Raise the warning past that known,
    // independently-cached vendor chunk so the build output stays clean.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split the heavy 3D vendor graph out of the app chunk so the engine
        // (three/drei/postprocessing) is cached independently of app code and
        // the main bundle no longer trips the 500 kB warning.
        manualChunks: {
          three: ["three"],
          r3f: ["@react-three/fiber", "@react-three/drei", "@react-three/postprocessing"],
        },
      },
    },
  },
});
