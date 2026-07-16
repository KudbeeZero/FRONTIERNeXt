/**
 * client/src/pages/MissionControl.tsx
 *
 * Internal Mission Control dashboard — one place to see repo health, workflow
 * status, memory layer state, latest merges, the active engineering lane,
 * blockers, owner actions, and launch readiness.
 *
 * Informational only. Static data (missionControlData) — no API, no backend,
 * no database, no polling, no blockchain, no wallet context. Mounted the same
 * way as /admin and /university: outside the shared WalletProvider in App.tsx.
 */
import { Link } from "wouter";
import { missionControlData } from "@/components/mission-control/missionControlData";
import { StatusChip } from "@/components/mission-control/StatusChip";
import { MissionControlSection, Row } from "@/components/mission-control/MissionControlSection";

export default function MissionControlPage() {
  const d = missionControlData;

  const copySha = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(d.repo.mainHeadSha);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <span className="text-sm font-bold tracking-widest text-violet-300">
          FRONTIER · MISSION CONTROL
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500">
            snapshot {new Date(d.generatedAt).toISOString().slice(0, 10)}
          </span>
          <Link href="/game" className="text-xs text-slate-400 hover:text-slate-200">
            ← Back to globe
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        {/* 1. System Status */}
        <MissionControlSection title="System Status">
          <Row label="main HEAD">
            <button
              type="button"
              onClick={copySha}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700"
              title="Copy SHA"
            >
              {d.repo.mainHeadSha} ⧉
            </button>
          </Row>
          <Row label="Latest merged PR">
            <span className="text-[11px]">
              #{d.repo.latestMergedPr.number} · {d.repo.latestMergedPr.title}
            </span>
          </Row>
          <Row label="Release status">{d.repo.releaseStatus}</Row>
          <Row label="Repo synced">
            <StatusChip status={d.repo.syncStatus} />
          </Row>
        </MissionControlSection>

        {/* 2. Workflow Health */}
        <MissionControlSection title="Workflow Health">
          {d.workflows.map((w) => (
            <Row key={w.name} label={w.name}>
              <span className="flex flex-col items-end gap-0.5">
                <StatusChip status={w.status} />
                <span className="text-[10px] text-slate-500">{w.note}</span>
              </span>
            </Row>
          ))}
        </MissionControlSection>

        {/* 3. Current Priorities */}
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

        {/* 4. Build Health */}
        <MissionControlSection title="Build Health">
          {d.build.map((b) => (
            <Row key={b.name} label={b.name}>
              <span className="flex flex-col items-end gap-0.5">
                <StatusChip status={b.status} />
                <span className="text-[10px] text-slate-500">{b.note}</span>
              </span>
            </Row>
          ))}
        </MissionControlSection>

        {/* 5. Owner Actions */}
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

        {/* 6. Memory Layer */}
        <MissionControlSection title="Memory Layer">
          <Row label="Latest session log">
            <span className="text-[11px]">
              {d.memory.latestSessionLog.date} · {d.memory.latestSessionLog.title}
            </span>
          </Row>
          <Row label="Latest merged PR">
            <span className="text-[11px]">
              #{d.memory.latestMergedPr.number} · {d.memory.latestMergedPr.title}
            </span>
          </Row>
          <Row label="Latest completed lane">{d.memory.latestCompletedLane}</Row>
          <Row label="Baton state">
            <span className="text-[11px] text-violet-300">{d.memory.batonState}</span>
          </Row>
        </MissionControlSection>

        {/* 7. Branch Hygiene */}
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
          <Row label="Open drafts">
            <span className="text-[11px] text-slate-400">
              {d.branches.openDrafts.length ? d.branches.openDrafts.join(", ") : "none"}
            </span>
          </Row>
          <Row label="Superseded">
            <ul className="space-y-0.5">
              {d.branches.supersededWork.map((b) => (
                <li key={b} className="text-[11px] text-slate-400">
                  {b}
                </li>
              ))}
            </ul>
          </Row>
        </MissionControlSection>
      </main>
    </div>
  );
}
