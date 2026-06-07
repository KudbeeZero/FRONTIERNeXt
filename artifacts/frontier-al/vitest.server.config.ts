import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dedicated Vitest config for server-side unit tests (pure logic — no DB, no
// browser). Kept separate from vite.config.ts, which roots at `client/` for the
// frontend test/build. Run with: npm run test:server
export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  test: {
    root: __dirname,
    include: ["server/**/*.{test,spec}.ts", "shared/**/*.{test,spec}.ts"],
    environment: "node",
  },
});
