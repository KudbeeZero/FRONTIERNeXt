/**
 * client/src/pages/MissionControl.tsx
 *
 * Internal Mission Control dashboard — one place to see repo health, workflow
 * status, memory layer state, latest merges, the active engineering lane,
 * blockers, owner actions, and launch readiness.
 *
 * Informational only. Data is the union of a build-time-generated file
 * (`components/mission-control/generated.ts`) and a small hand-curated
 * section in `missionControlData.ts` — no API, no backend, no database, no
 * polling, no blockchain, no wallet context. Mounted the same way as
 * /admin and /university: outside the shared WalletProvider in App.tsx.
 *
 * Phase 1 introduced a static 7-panel dashboard. Phase 2 ("repository
 * intelligence") reorganises the dashboard around four auto-derived
 * sections — repository metadata, workflow status, build information,
 * health indicators — plus the hand-curated priorities / owner actions /
 * branches sections Phase 1 already had.
 */
import { Link } from "wouter";
import { missionControlData, BUILD_ENV, DEPLOY_MODE, APP_VERSION_GENERATED } from "@/components/mission-control/missionControlData";
import { StatusChip } from "@/components/mission-control/StatusChip";
import {
  MissionControlSection,
  Row,
} from "@/components/mission-control/MissionControlSection";

function formatDate(iso: string | null): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toISOString().replace("T", " ").slice(0, 19) + "Z" : "unknown";
}

function formatRelative(iso: string | null): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "unknown";
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

function CopyShaButton({ sha }: { sha: string | null }) {
  const copy = () => {
    if (navigator.clipboard && sha && sha !== "unknown") {
      void navigator.clipboard.writeText(sha);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700"
      title={sha ? `Copy ${sha}` : "SHA unavailable"}
    >
      {sha ?? "unknown"} ⧉
    </button>
  );
}

export default function MissionControlPage() {
  const d = missionControlData;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <span className="text-sm font-bold tracking-widest text-violet-300">
          FRONTIER · MISSION CONTROL
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500" title={d.generatedAt}>
            generated {formatRelative(d.generatedAt)} · {formatDate(d.generatedAt)}
          </span>
          <Link href="/game" className="text-xs text-slate-400 hover:text-slate-200">
            ← Back to globe
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        {/* 1. Repository Metadata — auto-derived from git + package.json */}
        <MissionControlSection title="Repository Metadata">
          <Row label="Head SHA">
            <CopyShaButton sha={d.repository.mainHeadSha} />
          </Row>
          <Row label="Branch">
            <span className="text-[11px]">{d.repository.branch}</span>
          </Row>
          <Row label="Commit subject">
            <span className="text-[11px]">{d.repository.commitSubject || "unknown"}</span>
          </Row>
          <Row label="App version">
            <span className="text-[11px]">v{APP_VERSION_GENERATED}</span>
          </Row>
          <Row label="Environment">
            <span className="text-[11px]">
              {BUILD_ENV}
              {BUILD_ENV === "production" ? (
                <span className="ml-2 text-emerald-300">●</span>
              ) : (
                <span className="ml-2 text-sky-300">●</span>
              )}
            </span>
          </Row>
          <Row label="Deploy mode">
            <span className="text-[11px]">{DEPLOY_MODE}</span>
          </Row>
        </MissionControlSection>

        {/* 2. Workflow Status — auto-derived */}
        <MissionControlSection title="Workflow Status">
          <Row label="Last merged PR">
            <span className="text-[11px]">
              #{d.repository.latestMergedPr.number} · {d.repository.latestMergedPr.title}
            </span>
          </Row>
          <Row label="Last session log">
            <span className="text-[11px]">
              {d.workflow.latestSessionLog.date
                ? `${d.workflow.latestSessionLog.date} · ${d.workflow.latestSessionLog.title ?? "(no title)"}`
                : "unknown"}
            </span>
          </Row>
          <Row label="Latest completed lane">
            <span className="text-[11px]">{d.workflow.latestCompletedLane ?? "unknown"}</span>
          </Row>
          <Row label="Memory layer HEAD">
            <CopyShaButton sha={d.workflow.memoryLayerHeadSha} />
          </Row>
        </MissionControlSection>

        {/* 3. Build Information — auto-derived */}
        <MissionControlSection title="Build Information">
          {d.build.map((b) => (
            <Row key={b.name} label={b.name}>
              <span className="flex flex-col items-end gap-0.5">
                <StatusChip status={b.status} />
                <span className="text-[10px] text-slate-500">{b.note}</span>
              </span>
            </Row>
          ))}
        </MissionControlSection>

        {/* 4. Health Indicators — auto-derived rollup */}
        <MissionControlSection title="Health Indicators">
          {d.health.map((h) => (
            <Row key={h.name} label={h.name}>
              <span className="flex flex-col items-end gap-0.5">
                <StatusChip status={h.status} />
                <span className="text-[10px] text-slate-500">{h.note}</span>
              </span>
            </Row>
          ))}
        </MissionControlSection>

        {/* 5. Workflows (CI presence + status) */}
        <MissionControlSection title="Workflows">
          {d.workflows.map((w) => (
            <Row key={w.name} label={w.name}>
              <span className="flex flex-col items-end gap-0.5">
                <StatusChip status={w.status} />
                <span className="text-[10px] text-slate-500">{w.note}</span>
              </span>
            </Row>
          ))}
        </MissionControlSection>

        {/* 6. Current Priorities — hand-curated */}
        <MissionControlSection title="Current Priorities">
          <Row label="Active lane">
            <span className="text-[11px]">{d.priorities.activeLane}</span>
          </Row>
          <Row label="Next lane">
            <span className="text-[11px]">{d.priorities.nextLane}</span>
          </Row>
          <Row label="Blockers">
            <ul className="space-y-0.5">
              {d.priorities.blockers.map((b) => (
                <li key={b} className="text-[11px] text-amber-300">
                  {b}
                </li>
              ))}
            </ul>
          </Row>
          <Row label="Deferred">
            <ul className="space-y-0.5">
              {d.priorities.deferred.map((b) => (
                <li key={b} className="text-[11px] text-slate-400">
                  {b}
                </li>
              ))}
            </ul>
          </Row>
        </MissionControlSection>

        {/* 7. Owner Actions — hand-curated */}
        <MissionControlSection title="Owner Actions">
          {d.ownerActions.map((a) => (
            <Row key={a.label} label={a.label}>
              <span className="flex flex-col items-end gap-0.5">
                <StatusChip status={a.status} />
                <span className="text-[10px] text-slate-500">{a.note}</span>
              </span>
            </Row>
          ))}
        </MissionControlSection>

        {/* 8. Memory Layer — auto-derived */}
        <MissionControlSection title="Memory Layer">
          <Row label="Latest session log">
            <span className="text-[11px]">
              {d.workflow.latestSessionLog.date
                ? `${d.workflow.latestSessionLog.date} · ${d.workflow.latestSessionLog.title ?? "(no title)"}`
                : "unknown"}
            </span>
          </Row>
          <Row label="Latest merged PR">
            <span className="text-[11px]">
              #{d.workflow.latestMergedPr.number} · {d.workflow.latestMergedPr.title}
            </span>
          </Row>
          <Row label="Latest completed lane">
            <span className="text-[11px]">{d.workflow.latestCompletedLane ?? "unknown"}</span>
          </Row>
          <Row label="Baton state">
            <span className="text-[11px] text-violet-300">{d.workflow.batonState}</span>
          </Row>
        </MissionControlSection>

        {/* 9. Branch Hygiene — auto-derived */}
        <MissionControlSection title="Branch Hygiene" defaultOpen={false}>
          <Row label="Active feature">
            <ul className="space-y-0.5">
              {d.branches.activeFeatureBranches.map((b) => (
                <li key={b} className="text-[11px] text-emerald-300">
                  {b}
                </li>
              ))}
            </ul>
          </Row>
          <Row label="Stale">
            <ul className="space-y-0.5">
              {d.branches.staleBranches.map((b) => (
                <li key={b} className="text-[11px] text-amber-300">
                  {b}
                </li>
              ))}
            </ul>
          </Row>
          <Row label="Local-only">
            <span className="text-[11px] text-slate-400">
              {d.branches.localOnlyBranches.length
                ? d.branches.localOnlyBranches.join(", ")
                : "none"}
            </span>
          </Row>
        </MissionControlSection>
      </main>
    </div>
  );
}
