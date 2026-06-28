/**
 * A single draggable dashboard widget: a titled, glassy frame the player can
 * drag by its header and minimize/close. Position/size come from the parent
 * canvas (absolute pixel rect derived from the grid); this component only owns
 * the drag transform and the header chrome.
 */
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Minus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PixelRect } from "@/lib/dashboard/layout";
import type { ReactNode } from "react";

export interface WidgetProps {
  id: string;
  title: string;
  rect: PixelRect;
  z?: number;
  minimized?: boolean;
  children: ReactNode;
  onMinimize: (id: string, minimized: boolean) => void;
  onHide: (id: string) => void;
  onFocus: (id: string) => void;
}

const HEADER_H = 32;

export function Widget({
  id,
  title,
  rect,
  z,
  minimized,
  children,
  onMinimize,
  onHide,
  onFocus,
}: WidgetProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const style: React.CSSProperties = {
    position: "absolute",
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: minimized ? HEADER_H : rect.height,
    zIndex: (z ?? 0) + 1,
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onPointerDownCapture={() => onFocus(id)}
      data-testid={`widget-${id}`}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-primary/25 bg-background/85 backdrop-blur-md shadow-lg shadow-black/40 transition-shadow",
        isDragging && "ring-2 ring-primary/60 shadow-primary/20",
      )}
    >
      <div
        className="flex items-center gap-1.5 px-2 h-8 shrink-0 border-b border-primary/20 bg-primary/10 cursor-grab active:cursor-grabbing select-none"
        {...attributes}
        {...listeners}
        data-testid={`widget-handle-${id}`}
      >
        <GripVertical className="w-3.5 h-3.5 text-primary/60 shrink-0" />
        <span className="font-display text-[11px] uppercase tracking-wider text-foreground/90 truncate flex-1">
          {title}
        </span>
        <button
          type="button"
          onClick={() => onMinimize(id, !minimized)}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-primary/20"
          title={minimized ? "Restore" : "Minimize"}
          data-testid={`widget-minimize-${id}`}
        >
          {minimized ? <Square className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        </button>
        <button
          type="button"
          onClick={() => onHide(id)}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/15"
          title="Hide"
          data-testid={`widget-hide-${id}`}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {!minimized && <div className="flex-1 min-h-0 overflow-auto">{children}</div>}
    </div>
  );
}
