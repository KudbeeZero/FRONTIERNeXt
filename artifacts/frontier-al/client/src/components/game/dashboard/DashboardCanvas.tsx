/**
 * The draggable snap-grid canvas. Hosts widgets as absolutely-positioned frames
 * over a (transparent) full-area surface, translating drag gestures into grid
 * moves via the pure layout engine. Default-off behind the dashboard flag — the
 * parent decides whether to mount this.
 *
 * Each child is keyed by widget id; only ids present in BOTH `layout` and
 * `widgets` render, so the canvas degrades gracefully if a panel is missing.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { RotateCcw } from "lucide-react";
import { cellToPixels, pixelToCell, pixelToSize, type GridConfig } from "@/lib/dashboard/layout";
import type { UseWidgetLayout } from "./useWidgetLayout";
import { Widget } from "./Widget";

export interface DashboardCanvasProps {
  controller: UseWidgetLayout;
  /** Widget id → { title, content } for everything that can be shown. */
  widgets: Record<string, { title: string; content: ReactNode }>;
  className?: string;
}

function measureWidth(el: HTMLElement | null): number {
  return el?.clientWidth ?? 0;
}

export function DashboardCanvas({ controller, widgets, className }: DashboardCanvasProps) {
  const { layout, grid, move, resize, setMinimized, setHidden, focus, reset } = controller;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // Track the canvas width so grid<->pixel math matches the rendered surface.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    setWidth(measureWidth(el));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(measureWidth(el)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A small activation distance so clicks inside a widget don't start a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (event: DragEndEvent) => {
    const id = String(event.active.id);
    const item = layout[id];
    if (!item || width <= 0) return;
    const rect = cellToPixels(item, grid as GridConfig, width);
    const nextLeft = rect.left + event.delta.x;
    const nextTop = rect.top + event.delta.y;
    const cell = pixelToCell(nextLeft, nextTop, grid as GridConfig, width);
    move(id, cell.x, cell.y);
  };

  const visible = Object.values(layout).filter((w) => !w.hidden && widgets[w.id]);
  const hidden = Object.values(layout).filter((w) => w.hidden && widgets[w.id]);

  return (
    <div className={className}>
      <DndContext sensors={sensors} modifiers={[restrictToParentElement]} onDragEnd={onDragEnd}>
        <div ref={surfaceRef} className="relative w-full h-full" data-testid="dashboard-surface">
          {width > 0 &&
            visible.map((w) => (
              <Widget
                key={w.id}
                id={w.id}
                title={widgets[w.id].title}
                rect={cellToPixels(w, grid as GridConfig, width)}
                z={w.z}
                minimized={w.minimized}
                onMinimize={setMinimized}
                onHide={(id) => setHidden(id, true)}
                onFocus={focus}
                onResize={(id, pxW, pxH) => {
                  const size = pixelToSize(pxW, pxH, grid as GridConfig, width);
                  resize(id, size.w, size.h);
                }}
              >
                {widgets[w.id].content}
              </Widget>
            ))}
        </div>
      </DndContext>

      {/* Tray: restore hidden widgets + reset the layout. */}
      <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1.5 rounded-full border border-primary/25 bg-background/90 backdrop-blur px-2 py-1 shadow-lg">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded"
          title="Reset layout"
          data-testid="dashboard-reset"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
        {hidden.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setHidden(w.id, false)}
            className="text-[10px] uppercase tracking-wide text-primary/80 hover:text-primary px-1.5 py-0.5 rounded border border-primary/20"
            title={`Show ${widgets[w.id].title}`}
            data-testid={`dashboard-restore-${w.id}`}
          >
            + {widgets[w.id].title}
          </button>
        ))}
      </div>
    </div>
  );
}
