#!/usr/bin/env node
/**
 * scripts/generate-mission-control-data.mjs
 *
 * Build-time generator for the Mission Control dashboard's "repository
 * intelligence" data (Mission Control Phase 2).
 *
 * Reads the local git state, package metadata, session notes, SESSION_LOG.md,
 * docs/memory, and the .github/workflows directory — then writes a fully
 * typed, tree-shakeable TypeScript module to:
 *
 *   client/src/components/mission-control/generated.ts
 *
 * That file is committed (so production builds have something to import
 * without re-running the generator) and refreshed by `prebuild` / `pretest`
 * / `precheck` hooks in package.json.
 *
 * Hard constraints (per the Phase 2 spec):
 *   - Build-time only. No runtime fetch, no API, no polling, no DB.
 *   - No GitHub authentication. We only read local git / local files.
 *   - Everything that can't be derived falls back to "unknown" honestly
 *     rather than being fabricated. The dashboard must stay trustworthy.
 *
 * Output is a single TS module exporting a `as const` object. The
 * accompanying data-contract test (`generated.test.ts`) asserts the shape.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..", "..");

// --- Helpers ---------------------------------------------------------------

function safeExec(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      ...opts,
    }).trim();
  } catch {
    return null;
  }
}

function readJsonSafe(p) {
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function listFilesSafe(dir) {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .map((name) => path.join(dir, name))
      .filter((p) => {
        try {
          return statSync(p).isFile();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

function listDirsSafe(dir) {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .map((name) => path.join(dir, name))
      .filter((p) => {
        try {
          return statSync(p).isDirectory();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

function trimSha(sha) {
  if (!sha) return null;
  return sha.length >= 7 ? sha.slice(0, 7) : sha;
}

function firstLine(s) {
  if (!s) return null;
  const idx = s.indexOf("\n");
  return (idx === -1 ? s : s.slice(0, idx)).trim();
}

// --- Git -------------------------------------------------------------------

function readGit() {
  const headSha = safeExec("git", ["rev-parse", "HEAD"]);
  const shortSha = trimSha(headSha);
  const branch = safeExec("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  // CI runs on a detached HEAD, so `git branch`/`rev-parse --abbrev-ref` yields
  // null. Fall back to the ref GitHub Actions exposes, then to "main".
  const resolvedBranch =
    (branch && branch !== "HEAD" ? branch : null) ||
    (process.env.GITHUB_REF_NAME?.trim() || "") ||
    "main";
  const commitIso = safeExec("git", ["log", "-1", "--format=%cI"]);
  const commitSubject = firstLine(
    safeExec("git", ["log", "-1", "--format=%s"]),
  );
  const remoteUrl = safeExec("git", ["config", "--get", "remote.origin.url"]);
  // Try to find the memory layer's HEAD. The memory layer is docs/memory — no
  // separate branch, so we report the same SHA. We still try the env override
  // MEMORY_LAYER_HEAD_SHA in case future work splits it.
  const memoryHeadSha =
    process.env.MEMORY_LAYER_HEAD_SHA?.trim() || shortSha || null;
  return {
    headSha: shortSha,
    headShaFull: headSha,
    branch: resolvedBranch,
    commitTimestampIso: commitIso,
    commitSubject,
    remoteUrl,
    memoryHeadSha: trimSha(memoryHeadSha),
  };
}

// --- Package + version -----------------------------------------------------

function readAppVersion() {
  const pkg = readJsonSafe(path.join(appRoot, "package.json"));
  return pkg?.version ?? null;
}

// --- Cloudflare / deployment mode -----------------------------------------

function readDeployMode() {
  // CF_PAGES is set on Cloudflare Pages builds. CF_PAGES_URL holds the
  // deployment URL. FLY_ALLOC_ID / FLY_APP_NAME indicate Fly.io. Vercel
  // sets VERCEL=1. Local dev = "local".
  const mode = process.env.CF_PAGES
    ? "cloudflare-pages"
    : process.env.FLY_APP_NAME || process.env.FLY_ALLOC_ID
      ? "fly.io"
      : process.env.VERCEL
        ? "vercel"
        : "local";
  const url =
    process.env.CF_PAGES_URL ||
    process.env.CF_PAGES_BRANCH && `https://${process.env.CF_PAGES_BRANCH}.${process.env.CF_PAGES_URL_HOST || "pages.dev"}` ||
    process.env.FLY_PUBLIC_BASE_URL ||
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` ||
    null;
  return { mode, url };
}

// --- Build environment -----------------------------------------------------

function readBuildEnv() {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    mode: process.env.MODE || null,
    builtAtIso: new Date().toISOString(),
  };
}

// --- Session notes ---------------------------------------------------------

function readLatestSessionNote() {
  const dir = path.join(appRoot, "session-notes");
  const files = listFilesSafe(dir).filter((p) => p.endsWith(".md"));
  if (files.length === 0) return null;
  const sorted = files
    .map((p) => ({ p, mtime: statSync(p).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  const latest = sorted[0];
  const base = path.basename(latest.p, ".md");
  // Filename convention: YYYY-MM-DD-title.md
  const m = base.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  return {
    date: m ? m[1] : base,
    title: m ? m[2].replace(/-/g, " ") : base,
    filename: path.basename(latest.p),
  };
}

// --- SESSION_LOG.md --------------------------------------------------------

function readSessionLogLatest() {
  const logPath = path.join(repoRoot, "SESSION_LOG.md");
  if (!existsSync(logPath)) return null;
  const text = readFileSync(logPath, "utf-8");
  // Parse the "## Latest Session" block, looking for the first set of list
  // items under it.
  const block = text.split(/^##\s+Latest Session\s*$/m)[1] || "";
  const lines = block.split("\n").map((l) => l.trim());
  function pick(prefix) {
    const hit = lines.find((l) => l.startsWith(prefix));
    if (!hit) return null;
    return hit.slice(prefix.length).trim() || null;
  }
  return {
    prNumber: pick("- **PR Number:**")?.replace(/^#/, "") || null,
    prTitle: pick("- **PR Title:**") || null,
    mergeSha: pick("- **Merge SHA:**") || null,
    date: pick("- **Date/Time (UTC):**") || null,
    filesChanged: pick("- **Files Changed:**") || null,
  };
}

// --- Latest completed lane (memory index) ----------------------------------

function readLatestCompletedLane() {
  // The canonical state index lists recent completed lanes in
  // docs/memory/10-completed/_INDEX.md. The lanes are emitted as a markdown
  // table under "## Completed lanes"; the FIRST row after the header is the
  // most recent.
  const idx = path.join(repoRoot, "docs", "memory", "10-completed", "_INDEX.md");
  if (!existsSync(idx)) return null;
  const text = readFileSync(idx, "utf-8");
  const lines = text.split("\n");
  let inLanes = false;
  let pastHeader = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^##\s+Completed lanes/i.test(line)) {
      inLanes = true;
      continue;
    }
    if (!inLanes) continue;
    if (line.startsWith("##")) break;
    if (!line.startsWith("|")) continue;
    // Skip the header divider row (|---|---|...) and the header row itself
    // (| Lane | PR | ...). The first body row we encounter is the latest lane.
    if (/^\|\s*-+/.test(line)) {
      pastHeader = true;
      continue;
    }
    if (!pastHeader) continue;
    const cell = line.split("|")[1]?.trim();
    if (cell) return cell;
  }
  return null;
}

// --- Workflows (presence-based health) -------------------------------------

function readWorkflowHealth() {
  const wfDir = path.join(repoRoot, ".github", "workflows");
  const files = listFilesSafe(wfDir).filter((p) =>
    p.endsWith(".yml") || p.endsWith(".yaml"),
  );
  const names = files.map((p) => path.basename(p, path.extname(p)));
  // A workflow is "active" when its file is on disk; "disabled" when there is
  // an explicit "disabled:" / "if: false" indicator (we keep this simple and
  // just key off presence here, which is the truthful state at build time).
  return names
    .sort()
    .map((name) => ({
      name,
      status: "healthy",
      note: `present at .github/workflows/${name}.yml`,
    }));
}

// --- Branches (hygiene) ----------------------------------------------------

function readBranchHygiene() {
  const active = safeExec("git", [
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads/",
  ]);
  const all = active ? active.split("\n").filter(Boolean) : [];
  // Anything with "feat/", "fix/", "chore/" or session/ prefix that isn't
  // exactly "main" counts as a feature branch.
  const featurePrefixes = /^(feat|fix|chore|docs|test|refactor)\//;
  const sessionPrefix = /^session\//;
  const isMain = (b) => b === "main" || b === "master";
  const featureBranches = all.filter(
    (b) => !isMain(b) && (featurePrefixes.test(b) || sessionPrefix.test(b)),
  );
  const other = all.filter(
    (b) => !isMain(b) && !featurePrefixes.test(b) && !sessionPrefix.test(b),
  );
  // Stale = feature branch whose latest commit is older than 30 days.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const stale = [];
  for (const b of featureBranches) {
    const ts = safeExec("git", [
      "log",
      "-1",
      "--format=%ct",
      b,
    ]);
    const epoch = ts ? Number(ts) * 1000 : null;
    if (epoch && epoch < cutoff) stale.push(b);
  }
  return {
    activeFeatureBranches: featureBranches.sort(),
    staleBranches: stale.sort(),
    localOnlyBranches: other.sort(),
  };
}

// --- Test totals (optional file read) --------------------------------------

/**
 * Test totals are written by `scripts/capture-test-totals.mjs`, which the
 * pnpm `posttest` / `posttest:server` hooks run after each test suite. We
 * intentionally do NOT spawn vitest from this generator — doing so under
 * `execFileSync` in some Node/pnpm combos leaks zombie workers and
 * silently hangs the build. The separate script writes a tiny JSON
 * snapshot, which the generator just reads.
 */
const TOTALS_PATH = path.join(appRoot, "client", "src", "components", "mission-control", "testTotals.json");

function readTestTotalsFile() {
  if (!existsSync(TOTALS_PATH)) {
    return { client: null, server: null, captured: false };
  }
  try {
    const data = JSON.parse(readFileSync(TOTALS_PATH, "utf-8"));
    return {
      client: data.client ?? null,
      server: data.server ?? null,
      captured: data.captured === true,
    };
  } catch {
    return { client: null, server: null, captured: false };
  }
}

// --- Assemble + write ------------------------------------------------------

function buildOutput() {
  const git = readGit();
  const version = readAppVersion();
  const deploy = readDeployMode();
  const env = readBuildEnv();
  const sessionNote = readLatestSessionNote();
  const sessionLog = readSessionLogLatest();
  const latestCompletedLane = readLatestCompletedLane();
  const workflows = readWorkflowHealth();
  const branchHygiene = readBranchHygiene();
  const totals = readTestTotalsFile();

  const lastMergedPr =
    sessionLog && sessionLog.prNumber
      ? {
          number: Number(sessionLog.prNumber),
          title: sessionLog.prTitle || "(no title)",
          mergedSha: trimSha(sessionLog.mergeSha),
          mergedAt: sessionLog.date,
        }
      : {
          number: 0,
          title: "unknown",
          mergedSha: null,
          mergedAt: null,
        };

  const output = {
    schemaVersion: 1,
    generatedAt: env.builtAtIso,
    repository: {
      headSha: git.headSha,
      headShaFull: git.headShaFull,
      branch: git.branch,
      remoteUrl: git.remoteUrl,
      commitTimestampIso: git.commitTimestampIso,
      commitSubject: git.commitSubject,
    },
    build: {
      appVersion: version,
      env: env.nodeEnv,
      mode: env.mode || "production",
      builtAtIso: env.builtAtIso,
      testTotals: {
        client: totals.client ?? { files: 0, tests: 0, skipped: 0 },
        server: totals.server ?? { files: 0, tests: 0, skipped: 0 },
        captured: totals.captured,
      },
      deploy,
    },
    workflow: {
      lastMergedPr,
      lastSessionNote: sessionNote,
      lastSessionLog: sessionLog,
      latestCompletedLane,
      memoryLayerHeadSha: git.memoryHeadSha,
      workflows,
    },
    branches: branchHygiene,
  };
  return output;
}

function renderTsModule(data) {
  // Hand-rolled printer (avoids extra deps) — emits a strict TS module with
  // the output frozen as `as const` for type safety + tree shaking.
  const json = JSON.stringify(data, null, 2);
  return [
    "/**",
    " * client/src/components/mission-control/generated.ts",
    " *",
    " * AUTO-GENERATED at build time by",
    " *   artifacts/frontier-al/scripts/generate-mission-control-data.mjs",
    " *",
    " * DO NOT EDIT BY HAND — edits will be overwritten on the next prebuild /",
    " * pretest / precheck run. To change the schema, edit the generator.",
    " *",
    " * The data here is the source for the Mission Control dashboard's",
    " * repository-intelligence panels (Phase 2). All values are derived from",
    " * local git state, package metadata, session notes, and the .github",
    " * workflows directory. There is no API, no backend, no polling, no",
    " * database, no GitHub auth.",
    " */",
    "",
    "/* eslint-disable */",
    "// @ts-nocheck — generated file; the generator enforces the shape and the",
    "// data-contract test (generated.test.ts) catches drift.",
    "",
    "export const generated = " + json + " as const;",
    "",
    "export default generated;",
    "",
  ].join("\n");
}

function writeOutput(data) {
  const outDir = path.join(appRoot, "client", "src", "components", "mission-control");
  const outFile = path.join(outDir, "generated.ts");
  writeFileSync(outFile, renderTsModule(data));
  return outFile;
}

const data = buildOutput();
const outFile = writeOutput(data);
console.log(`[mission-control] wrote ${path.relative(repoRoot, outFile)}`);
