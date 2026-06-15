import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ElementType } from "react";

export interface DockItem {
  id: string;
  label: string;
  icon: ElementType;
  badge?: number;
  active?: boolean;
  onSelect: () => void;
  "data-testid"?: string;
}

interface DockProps {
  items: DockItem[];
  /** Optional id of the item the indicator should sit under (defaults to the `active` item). */
  className?: string;
  "data-testid"?: string;
}

/** useLayoutEffect on the client, useEffect on the server — avoids the SSR warning. */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The v11 bottom dock: frosted bar, animated sliding indicator under the active
 * item, badges, a click pulse, and a file-cabinet reveal/collapse handle. All
 * interaction is local (refs + a ResizeObserver) — no global `window` pointer
 * listeners and no canvas/particle FX from the prototype were ported.
 */
export function Dock({ items, className, ...rest }: DockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const itemsRef = useRef<HTMLDivElement | null>(null);
  const indRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const activeId = items.find((i) => i.active)?.id ?? null;

  const moveIndicator = () => {
    const ind = indRef.current;
    const el = activeId ? btnRefs.current.get(activeId) : null;
    if (!ind || !el) return;
    const w = Math.min(64, el.offsetWidth - 22);
    ind.style.width = `${w}px`;
    ind.style.transform = `translateX(${el.offsetLeft + el.offsetWidth / 2 - w / 2}px)`;
  };

  useIsomorphicLayoutEffect(() => {
    moveIndicator();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, items.length, collapsed, revealKey]);

  useEffect(() => {
    const node = itemsRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => moveIndicator());
    ro.observe(node);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pulse = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    btn.classList.remove("click");
    // force reflow so the animation can replay on rapid taps
    void btn.offsetWidth;
    btn.classList.add("click");
  };

  const expand = () => {
    setCollapsed(false);
    setRevealKey((k) => k + 1); // remount items so the cabinet flip replays
  };

  return (
    <>
      <nav
        className={`hud-dock${collapsed ? " is-collapsed" : ""}${className ? ` ${className}` : ""}`}
        data-testid={rest["data-testid"] ?? "bottom-nav"}
        aria-label="Primary"
      >
        <div className="hud-dock-line" aria-hidden="true" />
        <div className="hud-dock-ind" ref={indRef} aria-hidden="true" />
        <div className="hud-dock-items hud-dock--cabinet" ref={itemsRef} key={revealKey}>
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                ref={(el) => {
                  if (el) btnRefs.current.set(item.id, el);
                  else btnRefs.current.delete(item.id);
                }}
                className={`hud-di${item.active ? " on" : ""}`}
                style={{ animationDelay: `${i * 45}ms` }}
                aria-current={item.active ? "page" : undefined}
                data-testid={item["data-testid"] ?? `nav-tab-${item.id}`}
                onClick={(e) => {
                  pulse(e);
                  item.onSelect();
                }}
              >
                <Icon />
                <span>{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="hud-badge" data-testid={`nav-badge-${item.id}`}>
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      <button
        type="button"
        className={`hud-dock-handle${collapsed ? "" : " is-lifted"}`}
        onClick={() => (collapsed ? expand() : setCollapsed(true))}
        aria-label={collapsed ? "Show navigation" : "Hide navigation"}
        aria-expanded={!collapsed}
        data-testid="hud-dock-handle"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 15l6-6 6 6" />
        </svg>
      </button>
    </>
  );
}
