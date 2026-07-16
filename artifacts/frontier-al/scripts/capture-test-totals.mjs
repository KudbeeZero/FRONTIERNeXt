#!/usr/bin/env node
/**
 * scripts/capture-test-totals.mjs
 *
 * Runs `pnpm run test` and `pnpm run test:server`, parses the vitest summary
 * line out of each, and writes a small JSON snapshot that the Mission
 * Control generator reads at prebuild time:
 *
 *   client/src/components/mission-control/testTotals.json
 *
 * Why a separate script? Because spawning vitest from inside the generator
 * under `execFileSync` can leak worker processes and hang the build. The
 * generator stays simple (it just reads a file), and this script is the
 * one place that touches the test runner.
 *
 * Invoked by pnpm `posttest` and `posttest:server` so the snapshot is
 * refreshed every time the test suites run. Best-effort: a non-zero exit
 * from vitest doesn't fail the script — the dashboard just shows the
 * existing snapshot.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const TOTALS_PATH = path.join(
  appRoot,
  "client",
  "src",
  "components",
  "mission-control",
  "testTotals.json",
);

const SUITE = process.argv[2] === "server" ? "server" : "client";

function runVitest() {
  // Call vitest's binary directly (via node) rather than through pnpm.
  // Routing through `pnpm run test` from inside an `posttest` hook caused
  // pnpm to re-run the workspace install in some versions; bypassing pnpm
  // here keeps the hook idempotent and quick.
  const isServer = SUITE === "server";
  const configFlag = isServer ? "--config" : "";
  const configPath = isServer
    ? path.join(appRoot, "vitest.server.config.ts")
    : "";
  const args = [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--reporter=default",
  ];
  if (configFlag) {
    args.push(configFlag, configPath);
  }
  try {
    const stdout = execFileSync("node", args, {
      cwd: appRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    });
    return { stdout, exitCode: 0 };
  } catch (err) {
    return {
      stdout: (err.stdout || "") + (err.stderr || ""),
      exitCode: typeof err.status === "number" ? err.status : 1,
    };
  }
}

// Parses "Test Files  77 passed (77)" / "Tests  526 passed (526)" lines
// produced by vitest's default reporter. Also handles the "X passed | Y
// skipped" variant for suites that skip tests.
function parseTotals(stdout) {
  const filesMatch =
    /Test Files\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+skipped)?(?:\s*\(\d+\))?/i.exec(
      stdout,
    );
  const testsMatch =
    /Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+skipped)?(?:\s*\(\d+\))?/i.exec(
      stdout,
    );
  if (!filesMatch && !testsMatch) {
    return null;
  }
  return {
    files: filesMatch ? Number(filesMatch[1]) : 0,
    tests: testsMatch ? Number(testsMatch[1]) : 0,
    skipped: testsMatch && testsMatch[2] ? Number(testsMatch[2]) : 0,
  };
}

function readSnapshot() {
  if (!existsSync(TOTALS_PATH)) {
    return { client: null, server: null, captured: false };
  }
  try {
    return JSON.parse(readFileSync(TOTALS_PATH, "utf-8"));
  } catch {
    return { client: null, server: null, captured: false };
  }
}

function writeSnapshot(snapshot) {
  writeFileSync(TOTALS_PATH, JSON.stringify(snapshot, null, 2) + "\n");
}

const result = runVitest();
const totals = parseTotals(result.stdout);
if (!totals) {
  console.error(
    `[mission-control] could not parse ${SUITE} test totals; leaving snapshot as-is`,
  );
  process.exit(0);
}

const snapshot = readSnapshot();
snapshot[SUITE] = totals;
snapshot.captured = Boolean(snapshot.client || snapshot.server);
snapshot.lastUpdatedIso = new Date().toISOString();
writeSnapshot(snapshot);
console.log(
  `[mission-control] ${SUITE} test totals: ${totals.files} files / ${totals.tests} tests / ${totals.skipped} skipped`,
);
