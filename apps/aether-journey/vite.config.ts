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
  },
});
