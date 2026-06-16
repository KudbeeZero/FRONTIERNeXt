import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Aether's Journey is a self-contained client-only prototype.
// `base: "./"` keeps the built bundle portable (works from any static host / subpath).
export default defineConfig({
  plugins: [
    react(),
    // The on-chain claim step (Pera Wallet + algosdk) expects Node globals
    // (Buffer/global/process) and a few core modules in the browser. Mirror the
    // same polyfill set the main FRONTIER-AL client uses so wallet signing works.
    nodePolyfills({
      include: ["buffer", "crypto", "stream", "events", "util", "process"],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  base: "./",
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Two known, independently-cached vendor chunks exceed the default warning:
    // three.js core (~690 kB) and the Algorand wallet stack (~1.1 MB, algosdk +
    // Pera). The wallet chunk is dynamically imported only at the claim step, so
    // it never weighs on initial load. Raise the limit past both to keep output clean.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Split the heavy 3D vendor graph out of the app chunk so the engine
        // (three/drei/postprocessing) is cached independently of app code and
        // the main bundle no longer trips the 500 kB warning.
        manualChunks: {
          three: ["three"],
          r3f: ["@react-three/fiber", "@react-three/drei", "@react-three/postprocessing"],
          // Algorand wallet/signing stack — only pulled in at the claim step,
          // kept in its own cached chunk away from the app + 3D engine.
          wallet: ["algosdk", "@perawallet/connect"],
        },
      },
    },
  },
});
