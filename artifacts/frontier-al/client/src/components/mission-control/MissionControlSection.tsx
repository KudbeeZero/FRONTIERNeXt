/**
 * client/src/components/mission-control/MissionControlSection.tsx
 *
 * Reusable collapsible section card used to lay out each dashboard panel.
 * Sections collapse on mobile (and are open by default on larger screens).
 */
import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function MissionControlSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between bg-slate-900/60 px-4 py-3 text-left"
      >
        <span className="font-display text-xs uppercase tracking-widest text-primary">{title}</span>
        <span className="text-[10px] text-slate-500 lg:hidden">{open ? "hide" : "show"}</span>
      </button>
      <div className={cnOpen(open)}>{children}</div>
    </Card>
  );
}

function cnOpen(open: boolean) {
  return open ? "block p-4" : "hidden";
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-800/60 py-2 text-xs last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-mono text-slate-200">{children}</span>
    </div>
  );
}
