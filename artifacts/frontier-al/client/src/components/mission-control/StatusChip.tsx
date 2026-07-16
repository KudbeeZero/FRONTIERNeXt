/**
 * client/src/components/mission-control/StatusChip.tsx
 *
 * Color-coded status chip used across the Mission Control dashboard.
 * Pure presentational — takes a StatusLevel and renders a colored pill.
 */
import { cn } from "@/lib/utils";

import type { StatusLevel } from "./missionControlData";

const STATUS_STYLES: Record<StatusLevel, string> = {
  healthy: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  manual: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  disabled: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  unknown: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const STATUS_LABEL: Record<StatusLevel, string> = {
  healthy: "Healthy",
  warning: "Warning",
  manual: "Manual",
  disabled: "Disabled",
  unknown: "Unknown",
};

export function StatusChip({ status, className }: { status: StatusLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
