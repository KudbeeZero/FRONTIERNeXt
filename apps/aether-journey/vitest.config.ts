import { defineConfig } from "vitest/config";

// Pure-logic unit tests only (puzzle + decision selectors). Node env, no React/JSDOM —
// keeps the suite fast and independent of the R3F/Vite app config.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
