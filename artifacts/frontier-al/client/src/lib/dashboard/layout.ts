/**
 * Dashboard widget layout engine — PURE geometry + persistence.
 *
 * The in-game HUD historically jammed every panel into two fixed side rails and
 * a few hard-coded corners, so on desktop they overlapped ("all bunched
 * together"). This module is the foundation for a draggable, snap-to-grid widget
 * dashboard: a 12-column grid where each panel is a freely positioned widget the
 * player can move, resize, minimize, hide, and have their layout persisted.
 *
 * Everything here is framework-free and side-effect-free (except the localStorage
 * helpers, which fail closed) so the snap math and persistence are unit-pinned
 * without a DOM. The React layer (DashboardCanvas / Widget) consumes these.
 */

export interface GridConfig {
  /** Number of columns the canvas is divided into. */
  cols: number;
  /** Height of a single row unit, in pixels. */
  rowHeight: number;
  /** Gap between cells, in pixels (applies between columns and rows). */
  gap: number;
  /** Outer margin around the grid, in pixels. */
  margin: number;
}

/** Sensible desktop default: a 12-col grid, comfortable row height. */
export const DEFAULT_GRID: GridConfig = {
  cols: 12,
  rowHeight: 40,
  gap: 8,
  margin: 12,
};

export interface WidgetLayout {
  /** Stable widget id (matches a panel key). */
  id: string;
  /** Column index of the top-left cell (0-based). */
  x: number;
  /** Row index of the top-left cell (0-based). */
  y: number;
  /** Width in columns. */
  w: number;
  /** Height in rows. */
  h: number;
  /** Collapsed to just its title bar. */
  minimized?: boolean;
  /** Removed from the canvas (still known, can be re-added). */
  hidden?: boolean;
  /** Stacking order; higher renders on top. */
  z?: number;
}

export type DashboardLayout = Record<string, WidgetLayout>;

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Persisted blob shape — versioned so we can evolve the schema safely. */
export interface PersistedLayout {
  version: number;
  layout: DashboardLayout;
}

export const LAYOUT_VERSION = 1;
export const LAYOUT_STORAGE_KEY = "frontier_dashboard_layout_v1";

/** Width of a single grid column, in pixels, for a given container width. */
export function columnWidth(grid: GridConfig, containerWidth: number): number {
  const usable = containerWidth - grid.margin * 2 - grid.gap * (grid.cols - 1);
  return usable / grid.cols;
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Convert a pixel position (relative to the canvas top-left) to the nearest grid
 * cell. Used while dragging to snap a widget to the grid.
 */
export function pixelToCell(
  px: number,
  py: number,
  grid: GridConfig,
  containerWidth: number,
): { x: number; y: number } {
  const colW = columnWidth(grid, containerWidth);
  const stepX = colW + grid.gap;
  const stepY = grid.rowHeight + grid.gap;
  const x = Math.round((px - grid.margin) / stepX);
  const y = Math.round((py - grid.margin) / stepY);
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

/**
 * Convert a pixel size (a widget's dragged width/height) to the nearest whole
 * number of grid cells. Inverse of the size half of {@link cellToPixels}; floors
 * at 1×1 so a widget never collapses to nothing.
 */
export function pixelToSize(
  pxW: number,
  pxH: number,
  grid: GridConfig,
  containerWidth: number,
): { w: number; h: number } {
  const stepX = columnWidth(grid, containerWidth) + grid.gap;
  const stepY = grid.rowHeight + grid.gap;
  const w = Math.max(1, Math.round((pxW + grid.gap) / stepX));
  const h = Math.max(1, Math.round((pxH + grid.gap) / stepY));
  return { w, h };
}

/**
 * Convert a widget's grid layout to an absolute pixel rect for rendering.
 * Inverse of {@link pixelToCell} for the cell origin.
 */
export function cellToPixels(
  item: Pick<WidgetLayout, "x" | "y" | "w" | "h">,
  grid: GridConfig,
  containerWidth: number,
): PixelRect {
  const colW = columnWidth(grid, containerWidth);
  const left = grid.margin + item.x * (colW + grid.gap);
  const top = grid.margin + item.y * (grid.rowHeight + grid.gap);
  const width = item.w * colW + (item.w - 1) * grid.gap;
  const height = item.h * grid.rowHeight + (item.h - 1) * grid.gap;
  return { left, top, width, height };
}

/**
 * Keep a widget fully inside the grid horizontally: width never exceeds the
 * column count and x is pulled back so x+w fits. Vertical growth is unbounded
 * (the canvas scrolls), so y is only floored at 0.
 */
export function clampToGrid(item: WidgetLayout, grid: GridConfig): WidgetLayout {
  const w = clamp(item.w, 1, grid.cols);
  const x = clamp(item.x, 0, grid.cols - w);
  const y = Math.max(0, item.y);
  return { ...item, w, x, y };
}

/** Move a widget to a new cell, clamped into the grid. Returns a new object. */
export function moveWidget(
  item: WidgetLayout,
  x: number,
  y: number,
  grid: GridConfig,
): WidgetLayout {
  return clampToGrid({ ...item, x, y }, grid);
}

/**
 * Merge a saved layout with the canonical defaults: every default widget is
 * present (so newly-added panels show up even for players with an old saved
 * layout), but saved positions/sizes/flags win for widgets that exist in both.
 * Unknown saved ids (panels that no longer exist) are dropped.
 */
export function mergeWithDefaults(
  saved: DashboardLayout | null | undefined,
  defaults: DashboardLayout,
): DashboardLayout {
  const out: DashboardLayout = {};
  for (const id of Object.keys(defaults)) {
    const def = defaults[id];
    const prev = saved?.[id];
    out[id] = prev ? { ...def, ...prev, id } : { ...def };
  }
  return out;
}

/** Bring a widget to the front by giving it the highest z. Returns a new map. */
export function bringToFront(layout: DashboardLayout, id: string): DashboardLayout {
  if (!layout[id]) return layout;
  const maxZ = Object.values(layout).reduce((m, w) => Math.max(m, w.z ?? 0), 0);
  return { ...layout, [id]: { ...layout[id], z: maxZ + 1 } };
}

/** Serialize a layout to a versioned JSON string for persistence. */
export function serializeLayout(layout: DashboardLayout): string {
  const blob: PersistedLayout = { version: LAYOUT_VERSION, layout };
  return JSON.stringify(blob);
}

/**
 * Parse a persisted layout string. Returns null on anything unexpected (bad
 * JSON, wrong version, wrong shape) so a corrupt blob falls back to defaults
 * instead of throwing.
 */
export function deserializeLayout(raw: string | null | undefined): DashboardLayout | null {
  if (!raw) return null;
  try {
    const blob = JSON.parse(raw) as Partial<PersistedLayout>;
    if (!blob || blob.version !== LAYOUT_VERSION || typeof blob.layout !== "object" || !blob.layout) {
      return null;
    }
    const out: DashboardLayout = {};
    for (const [id, w] of Object.entries(blob.layout)) {
      if (
        w &&
        typeof w.x === "number" &&
        typeof w.y === "number" &&
        typeof w.w === "number" &&
        typeof w.h === "number"
      ) {
        out[id] = { id, x: w.x, y: w.y, w: w.w, h: w.h, minimized: w.minimized, hidden: w.hidden, z: w.z };
      }
    }
    return out;
  } catch {
    return null;
  }
}

/** Load a saved layout from localStorage (fail-closed → null). */
export function loadLayout(): DashboardLayout | null {
  if (typeof window === "undefined") return null;
  try {
    return deserializeLayout(window.localStorage.getItem(LAYOUT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Persist a layout to localStorage (best-effort; swallows quota/SSR errors). */
export function saveLayout(layout: DashboardLayout): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, serializeLayout(layout));
  } catch {
    /* storage unavailable — best-effort */
  }
}

/** Clear any persisted layout (used by "reset layout"). */
export function clearLayout(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}
