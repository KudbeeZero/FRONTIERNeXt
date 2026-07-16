/**
 * client/src/components/mission-control/missionControlData.ts
 *
 * Static, informational-only data for the Mission Control dashboard.
 *
 * This file is the single source of truth for what the dashboard renders.
 * It is hand-maintained (no API, no backend, no polling, no database). The
 * owner updates these values when state changes — the dashboard itself never
 * fetches anything. Keep it honest: if a value is "unknown", say "unknown".
 */

export type StatusLevel = "healthy" | "warning" | "manual" | "disabled" | "unknown";

export interface RepoStatus {
  mainHeadSha: string;
  latestMergedPr: {
    number: number;
    title: string;
    mergedAt: string;
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
}

export interface OwnerAction {
  label: string;
  status: StatusLevel;
  note: string;
}

export interface MemoryLayerItem {
  latestSessionLog: {
    date: string;
    title: string;
  };
  latestMergedPr: {
    number: number;
    title: string;
  };
  latestCompletedLane: string;
  batonState: string;
}

export interface BranchHygieneItem {
  activeFeatureBranches: string[];
  staleBranches: string[];
  openDrafts: string[];
  supersededWork: string[];
}

export interface MissionControlData {
  generatedAt: string;
  repo: RepoStatus;
  workflows: WorkflowItem[];
  priorities: PriorityItem;
  build: BuildItem[];
  ownerActions: OwnerAction[];
  memory: MemoryLayerItem;
  branches: BranchHygieneItem;
}

export const missionControlData: MissionControlData = {
  generatedAt: "2026-07-16T00:00:00Z",
  repo: {
    mainHeadSha: "0913ac4",
    latestMergedPr: {
      number: 272,
      title: "fix(mobile): safe-area insets, larger touch targets, drop duplicate render timer",
      mergedAt: "2026-07-15",
    },
    releaseStatus: "Pre-mainnet (TestNet)",
    syncStatus: "healthy",
  },
  workflows: [
    {
      name: "Summary workflow",
      status: "healthy",
      note: "Runs on every merge; produces the daily summary + baton resync.",
    },
    {
      name: "Session updater",
      status: "healthy",
      note: "Appends dated session notes at close-out.",
    },
    {
      name: "Memory index",
      status: "healthy",
      note: "State index + baton kept in sync with merges.",
    },
    {
      name: "Perplexity integration",
      status: "manual",
      note: "Used on demand for research; not wired to CI.",
    },
    {
      name: "Notion integration",
      status: "disabled",
      note: "Disabled — owner tracks work in-repo (docs + session-notes).",
    },
  ],
  priorities: {
    activeLane: "Phase 25 — Mission Control dashboard (internal tooling)",
    nextLane: "Phase 25 — remaining 3-month unit queue (per docs/FRONTIER_MASTER_ROADMAP.md)",
    blockers: ["Review of open Mission Control PR pending owner sign-off"],
    deferred: [
      "Economy work (Phase 26 NFT/on-chain completeness) — explicitly deferred per stop condition",
      "Backend automation — out of scope for this internal tool",
    ],
  },
  build: [
    { name: "Client tests", status: "healthy", note: "pnpm run test — green" },
    { name: "Server tests", status: "healthy", note: "test:server — 244/244 green" },
    { name: "Build", status: "healthy", note: "pnpm run build — Vite + esbuild green" },
    { name: "Typecheck", status: "healthy", note: "pnpm run check — tsc clean" },
    { name: "Cloudflare Pages", status: "healthy", note: "Deploys on merge to main" },
  ],
  ownerActions: [
    {
      label: "Fly activation",
      status: "manual",
      note: "Production app host (Fly) — activate when ready to go live.",
    },
    {
      label: "TestNet wallet funding",
      status: "warning",
      note: "Treasury/admin wallet may need TestNet ALGO top-up before QA.",
    },
    {
      label: "Branch pruning",
      status: "manual",
      note: "Clean merged + stale feature branches after each review cycle.",
    },
    {
      label: "Mobile QA tasks",
      status: "manual",
      note: "On-device iPhone portrait/landscape checks (wallets only testable on-device).",
    },
  ],
  memory: {
    latestSessionLog: {
      date: "2026-07-15",
      title: "Mobile safe-area + touch-target hardening (PR #272)",
    },
    latestMergedPr: {
      number: 272,
      title: "fix(mobile): safe-area insets, larger touch targets, drop duplicate render timer",
    },
    latestCompletedLane: "Mobile UX hardening (Phase 25)",
    batonState: "Current unit: Mission Control dashboard. NEXT: remaining Phase 25 queue.",
  },
  branches: {
    activeFeatureBranches: ["feat/mission-control-dashboard"],
    staleBranches: ["wip/atomic-purchase (off-limits — do not touch)"],
    openDrafts: [],
    supersededWork: ["legacy /landing default route (moved to /landing, not deleted)"],
  },
};
