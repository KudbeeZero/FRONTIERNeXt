/**
 * client/src/components/mission-control/missionControlData.ts
 *
 * Mission Control dashboard data — the public shape the page renders.
 *
 * Phase 1 was fully hand-maintained. Phase 2 ("Repository Intelligence")
 * moved most values to a build-time generator
 * (`scripts/generate-mission-control-data.mjs`) that writes
 * `client/src/components/mission-control/generated.ts`. That file is the
 * single source of truth for anything that can be derived from the local
 * git state, package metadata, session notes, or the .github/workflows
 * directory.
 *
 * The hand-curated sections that remain here are the things a generator
 * can't honestly derive: which engineering lane is active, what the
 * owner's next manual actions are, and which GitHub integrations are
 * enabled vs disabled. Update them by hand; the rest auto-refreshes on
 * every `prebuild` / `pretest` / `precheck`.
 *
 * The dashboard is informational only — no API, no backend, no polling,
 * no database, no GitHub auth.
 */
import { generated } from "./generated";

export type StatusLevel =
  | "healthy"
  | "warning"
  | "manual"
  | "disabled"
  | "unknown";

export type DeployMode = "local" | "cloudflare-pages" | "fly.io" | "vercel";
export type NodeEnv = "development" | "production" | "test";

export interface RepoStatus {
  mainHeadSha: string;
  branch: string;
  remoteUrl: string;
  commitTimestampIso: string;
  commitSubject: string;
  latestMergedPr: {
    number: number;
    title: string;
    mergedSha: string | null;
    mergedAt: string | null;
  };
  releaseStatus: string;
  syncStatus: StatusLevel;
}

export interface WorkflowItem {
  name: string;
  status: StatusLevel;
  note: string;
}

export interface PriorityItem {
  activeLane: string;
  nextLane: string;
  blockers: string[];
  deferred: string[];
}

export interface BuildItem {
  name: string;
  status: StatusLevel;
  note: string;
  detail?: string;
}

export interface OwnerAction {
  label: string;
  status: StatusLevel;
  note: string;
}

export interface MemoryLayerItem {
  latestSessionLog: {
    date: string | null;
    title: string | null;
    mergeSha: string | null;
  };
  latestMergedPr: {
    number: number;
    title: string;
  };
  latestCompletedLane: string | null;
  batonState: string;
  memoryLayerHeadSha: string | null;
}

export interface HealthIndicator {
  name: string;
  status: StatusLevel;
  note: string;
}

export interface BranchHygieneItem {
  activeFeatureBranches: string[];
  staleBranches: string[];
  localOnlyBranches: string[];
}

export interface MissionControlData {
  generatedAt: string;
  repository: RepoStatus;
  workflows: WorkflowItem[];
  priorities: PriorityItem;
  build: BuildItem[];
  ownerActions: OwnerAction[];
  workflow: MemoryLayerItem;
  health: HealthIndicator[];
  branches: BranchHygieneItem;
}

// --- Hand-curated sections -------------------------------------------------
// These are the things a generator cannot honestly derive — the owner curates
// them. Keep them short and honest. If a value is "unknown", say "unknown".

const HAND_CURATED = {
  releaseStatus: "Pre-mainnet (TestNet)",
  priorities: {
    activeLane:
      "Phase 25 — Mission Control repository intelligence (internal tooling)",
    nextLane:
      "Phase 25 — remaining 3-month unit queue (per docs/FRONTIER_MASTER_ROADMAP.md)",
    blockers: [
      "Owner review of Mission Control Phase 1 (PR #273) + Phase 2 PR pending",
    ],
    deferred: [
      "Economy work (Phase 26 NFT/on-chain completeness) — explicitly deferred per stop condition",
      "Backend automation — out of scope for this internal tool",
    ],
  },
  ownerActions: [
    {
      label: "Fly activation",
      status: "manual" as const,
      note: "Production app host (Fly) — activate when ready to go live.",
    },
    {
      label: "TestNet wallet funding",
      status: "warning" as const,
      note: "Treasury/admin wallet may need TestNet ALGO top-up before QA.",
    },
    {
      label: "Branch pruning",
      status: "manual" as const,
      note: "Clean merged + stale feature branches after each review cycle.",
    },
    {
      label: "Mobile QA tasks",
      status: "manual" as const,
      note: "On-device iPhone portrait/landscape checks (wallets only testable on-device).",
    },
  ],
  batonState:
    "Current unit: Mission Control Phase 2 (repository intelligence). NEXT: remaining Phase 25 queue.",
} as const;

// --- Helpers ---------------------------------------------------------------

// `generated` is `as const` so the literal types it carries (deploy mode,
// env, branch list) are exact — the data flow in this file widens them to
// the public union types so the rest of the app sees a stable contract.
function deployMode(): DeployMode {
  return (generated.build.deploy.mode as DeployMode) ?? "local";
}

function buildEnv(): NodeEnv {
  return (generated.build.env as NodeEnv) ?? "development";
}

// --- Derived from generated ------------------------------------------------

function toRepoStatus(): RepoStatus {
  return {
    mainHeadSha: generated.repository.headSha ?? "unknown",
    branch: generated.repository.branch ?? "unknown",
    remoteUrl: generated.repository.remoteUrl ?? "unknown",
    commitTimestampIso: generated.repository.commitTimestampIso ?? "",
    commitSubject: generated.repository.commitSubject ?? "",
    latestMergedPr: {
      number: generated.workflow.lastMergedPr.number,
      title: generated.workflow.lastMergedPr.title,
      mergedSha: generated.workflow.lastMergedPr.mergedSha,
      mergedAt: generated.workflow.lastMergedPr.mergedAt,
    },
    releaseStatus: HAND_CURATED.releaseStatus,
    syncStatus: "healthy",
  };
}

function toMemoryLayer(): MemoryLayerItem {
  return {
    latestSessionLog: {
      date: generated.workflow.lastSessionLog?.date ?? null,
      title: generated.workflow.lastSessionLog?.prTitle ?? null,
      mergeSha: generated.workflow.lastSessionLog?.mergeSha ?? null,
    },
    latestMergedPr: {
      number: generated.workflow.lastMergedPr.number,
      title: generated.workflow.lastMergedPr.title,
    },
    latestCompletedLane: generated.workflow.latestCompletedLane,
    batonState: HAND_CURATED.batonState,
    memoryLayerHeadSha: generated.workflow.memoryLayerHeadSha,
  };
}

function toBuildItems(): BuildItem[] {
  const t = generated.build.testTotals;
  const captured = t.captured;
  const totalsNote = captured
    ? `client ${t.client.files}/${t.client.tests} tests; server ${t.server.files}/${t.server.tests} tests (${t.server.skipped} skipped)`
    : "test totals not captured (run with CAPTURE_TEST_TOTALS=1 or via prebuild)";
  const mode = deployMode();
  return [
    {
      name: "Commit timestamp",
      status: "healthy",
      note: generated.repository.commitTimestampIso
        ? new Date(generated.repository.commitTimestampIso).toISOString()
        : "unknown",
    },
    {
      name: "Build timestamp",
      status: "healthy",
      note: generated.build.builtAtIso,
    },
    {
      name: "Test totals",
      status: captured ? "healthy" : "manual",
      note: totalsNote,
    },
    {
      name: "Cloudflare Pages",
      status: mode === "cloudflare-pages" ? "healthy" : "manual",
      note:
        mode === "cloudflare-pages"
          ? `Live at ${generated.build.deploy.url ?? "(url unknown)"}`
          : `Deploy mode: ${mode} (${generated.build.deploy.url ?? "no url"})`,
    },
  ];
}

function toHealthIndicators(): HealthIndicator[] {
  // Health is the at-a-glance rollup: each row combines one fact about the
  // build into a single status the owner can scan in 5 seconds.
  const buildAgeMs =
    Date.parse(generated.build.builtAtIso) > 0
      ? Date.now() - Date.parse(generated.build.builtAtIso)
      : null;
  const buildAgeHours =
    buildAgeMs !== null ? Math.round(buildAgeMs / (60 * 60 * 1000)) : null;
  const buildAgeStatus: StatusLevel =
    buildAgeHours === null
      ? "unknown"
      : buildAgeHours <= 24
        ? "healthy"
        : buildAgeHours <= 168
          ? "warning"
          : "manual";
  const buildAgeNote =
    buildAgeHours === null
      ? "build timestamp unparseable"
      : `last generated ${buildAgeHours}h ago`;

  const mode = deployMode();
  const deployStatus: StatusLevel =
    mode === "cloudflare-pages"
      ? "healthy"
      : mode === "local"
        ? "manual"
        : "warning";
  const deployNote = `Deploy mode: ${mode}`;

  const staleCount = generated.branches.staleBranches.length;
  const branchesStatus: StatusLevel =
    staleCount === 0 ? "healthy" : staleCount <= 2 ? "warning" : "manual";
  const branchesNote =
    staleCount === 0
      ? "no stale feature branches"
      : `${staleCount} stale feature branch${staleCount === 1 ? "" : "es"} (>30d)`;

  return [
    { name: "Build freshness", status: buildAgeStatus, note: buildAgeNote },
    { name: "Deployment", status: deployStatus, note: deployNote },
    { name: "Branch hygiene", status: branchesStatus, note: branchesNote },
  ];
}

function toBranchHygiene(): BranchHygieneItem {
  return {
    activeFeatureBranches: [...generated.branches.activeFeatureBranches],
    staleBranches: [...generated.branches.staleBranches],
    localOnlyBranches: [...generated.branches.localOnlyBranches],
  };
}

function toWorkflows(): WorkflowItem[] {
  return generated.workflow.workflows.map((w) => ({
    name: w.name,
    status: w.status as StatusLevel,
    note: w.note,
  }));
}

function toPriorities(): PriorityItem {
  return {
    activeLane: HAND_CURATED.priorities.activeLane,
    nextLane: HAND_CURATED.priorities.nextLane,
    blockers: [...HAND_CURATED.priorities.blockers],
    deferred: [...HAND_CURATED.priorities.deferred],
  };
}

// --- Public aggregate -----------------------------------------------------

export const missionControlData: MissionControlData = {
  generatedAt: generated.generatedAt,
  repository: toRepoStatus(),
  workflows: toWorkflows(),
  priorities: toPriorities(),
  build: toBuildItems(),
  ownerActions: HAND_CURATED.ownerActions.map((a) => ({
    label: a.label,
    status: a.status as StatusLevel,
    note: a.note,
  })),
  workflow: toMemoryLayer(),
  health: toHealthIndicators(),
  branches: toBranchHygiene(),
};

/** Re-export the raw generated block so the page can render raw values
 *  (commit subject, env label, deploy URL) without going through the
 *  hand-curated contract. */
export { generated };

/** App version (read at build time from the app's package.json). */
export const APP_VERSION_GENERATED: string =
  generated.build.appVersion ?? "unknown";

/** NODE_ENV at build time. */
export const BUILD_ENV: NodeEnv = buildEnv();

/** Cloudflare Pages? (informational; the page renders this as the env row.) */
export const DEPLOY_MODE: DeployMode = deployMode();
