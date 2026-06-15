import type { ReactNode } from "react";

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  className?: string;
  "data-testid"?: string;
  children: ReactNode;
}

/**
 * The v11 slide-up drawer: a frosted sheet anchored above the dock with a thin
 * "track" connector. Open/close is driven by the `open` prop (CSS transitions
 * handle the motion and are gated by `prefers-reduced-motion` in hud.css). On
 * mobile it becomes a full-width bottom sheet (see the media query in hud.css).
 */
export function Drawer({ open, title, onClose, className, children, ...rest }: DrawerProps) {
  return (
    <>
      <div className={`hud-drawer-track${open ? " open" : ""}`} aria-hidden="true" />
      <div
        className={`hud-drawer${open ? " open" : ""}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="false"
        aria-hidden={!open}
        aria-label={title}
        data-testid={rest["data-testid"]}
      >
        <div className="hud-dh">
          <span className="dot" aria-hidden="true" />
          <span className="tt">{title}</span>
          <button type="button" className="x" onClick={onClose} aria-label="Close" data-testid="hud-drawer-close">
            ✕
          </button>
        </div>
        <div className="hud-db">{children}</div>
      </div>
    </>
  );
}
