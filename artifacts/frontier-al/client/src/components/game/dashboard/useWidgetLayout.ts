/**
 * Stateful React wrapper around the pure dashboard layout engine
 * (`@/lib/dashboard/layout`). Owns the live `DashboardLayout`, persists every
 * change to localStorage, and exposes intent-named mutators. All geometry lives
 * in the pure module; this hook is just state + persistence glue.
 */
import { useCallback, useState } from "react";
import {
  type DashboardLayout,
  type GridConfig,
  DEFAULT_GRID,
  bringToFront,
  clampToGrid,
  loadLayout,
  mergeWithDefaults,
  moveWidget,
  saveLayout,
  clearLayout,
} from "@/lib/dashboard/layout";

export interface UseWidgetLayout {
  layout: DashboardLayout;
  grid: GridConfig;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, w: number, h: number) => void;
  setMinimized: (id: string, minimized: boolean) => void;
  setHidden: (id: string, hidden: boolean) => void;
  focus: (id: string) => void;
  reset: () => void;
}

export function useWidgetLayout(
  defaults: DashboardLayout,
  grid: GridConfig = DEFAULT_GRID,
): UseWidgetLayout {
  const [layout, setLayout] = useState<DashboardLayout>(() =>
    mergeWithDefaults(loadLayout(), defaults),
  );

  const commit = useCallback((next: DashboardLayout) => {
    setLayout(next);
    saveLayout(next);
  }, []);

  const move = useCallback(
    (id: string, x: number, y: number) => {
      setLayout((prev) => {
        const item = prev[id];
        if (!item) return prev;
        const next = { ...prev, [id]: moveWidget(item, x, y, grid) };
        saveLayout(next);
        return next;
      });
    },
    [grid],
  );

  const resize = useCallback(
    (id: string, w: number, h: number) => {
      setLayout((prev) => {
        const item = prev[id];
        if (!item) return prev;
        const next = { ...prev, [id]: clampToGrid({ ...item, w, h }, grid) };
        saveLayout(next);
        return next;
      });
    },
    [grid],
  );

  const patch = useCallback(
    (id: string, partial: Partial<{ minimized: boolean; hidden: boolean }>) => {
      setLayout((prev) => {
        const item = prev[id];
        if (!item) return prev;
        const next = { ...prev, [id]: clampToGrid({ ...item, ...partial }, grid) };
        saveLayout(next);
        return next;
      });
    },
    [grid],
  );

  const setMinimized = useCallback((id: string, minimized: boolean) => patch(id, { minimized }), [patch]);
  const setHidden = useCallback((id: string, hidden: boolean) => patch(id, { hidden }), [patch]);

  const focus = useCallback((id: string) => {
    setLayout((prev) => {
      const next = bringToFront(prev, id);
      if (next !== prev) saveLayout(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    clearLayout();
    commit(mergeWithDefaults(null, defaults));
  }, [commit, defaults]);

  return { layout, grid, move, resize, setMinimized, setHidden, focus, reset };
}
