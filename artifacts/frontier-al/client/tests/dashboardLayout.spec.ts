/**
 * Pins the dashboard widget layout engine: snap math, pixel<->cell round-trips,
 * grid clamping, default-merge, and versioned persistence. This is the
 * foundation for the draggable snap-grid HUD that replaces the old "bunched"
 * fixed rails — so the geometry and the corrupt-blob fallbacks are tested
 * without a DOM.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_GRID,
  columnWidth,
  clamp,
  pixelToCell,
  cellToPixels,
  clampToGrid,
  pixelToSize,
  moveWidget,
  mergeWithDefaults,
  bringToFront,
  serializeLayout,
  deserializeLayout,
  LAYOUT_VERSION,
  type DashboardLayout,
  type WidgetLayout,
} from "@/lib/dashboard/layout";

const w = (over: Partial<WidgetLayout> & { id: string }): WidgetLayout => ({
  x: 0, y: 0, w: 3, h: 4, ...over,
});

describe("clamp", () => {
  it("bounds a value and tolerates inverted ranges", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
    expect(clamp(5, 10, 0)).toBe(10); // max<min → min
  });
});

describe("columnWidth", () => {
  it("accounts for margins and inter-column gaps", () => {
    // 12 cols, gap 8, margin 12 → usable = 1000 - 24 - 11*8 = 888 → /12 = 74
    expect(columnWidth(DEFAULT_GRID, 1000)).toBeCloseTo(74, 5);
  });
});

describe("pixelToCell / cellToPixels", () => {
  it("round-trips a cell origin back to the same cell", () => {
    const grid = DEFAULT_GRID;
    const container = 1000;
    const item = { x: 4, y: 3, w: 3, h: 4 };
    const rect = cellToPixels(item, grid, container);
    const cell = pixelToCell(rect.left, rect.top, grid, container);
    expect(cell).toEqual({ x: 4, y: 3 });
  });

  it("snaps an off-grid pixel position to the nearest cell and never goes negative", () => {
    const grid = DEFAULT_GRID;
    const cell = pixelToCell(-50, -50, grid, 1000);
    expect(cell).toEqual({ x: 0, y: 0 });
  });
});

describe("pixelToSize", () => {
  it("is the inverse of the size half of cellToPixels", () => {
    const grid = DEFAULT_GRID;
    const container = 1000;
    const rect = cellToPixels({ x: 0, y: 0, w: 5, h: 6 }, grid, container);
    expect(pixelToSize(rect.width, rect.height, grid, container)).toEqual({ w: 5, h: 6 });
  });

  it("never collapses below 1×1", () => {
    expect(pixelToSize(0, 0, DEFAULT_GRID, 1000)).toEqual({ w: 1, h: 1 });
    expect(pixelToSize(-999, -999, DEFAULT_GRID, 1000)).toEqual({ w: 1, h: 1 });
  });
});

describe("clampToGrid", () => {
  it("pulls a widget back so x+w fits within the columns", () => {
    const clamped = clampToGrid(w({ id: "a", x: 11, w: 4 }), DEFAULT_GRID);
    expect(clamped.w).toBe(4);
    expect(clamped.x).toBe(DEFAULT_GRID.cols - 4); // 8
    expect(clamped.x + clamped.w).toBeLessThanOrEqual(DEFAULT_GRID.cols);
  });

  it("caps width at the column count and floors y at 0", () => {
    const clamped = clampToGrid(w({ id: "a", x: 0, y: -3, w: 99 }), DEFAULT_GRID);
    expect(clamped.w).toBe(DEFAULT_GRID.cols);
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0);
  });
});

describe("moveWidget", () => {
  it("moves to a new cell, clamped into the grid", () => {
    const moved = moveWidget(w({ id: "a", w: 3 }), 20, 5, DEFAULT_GRID);
    expect(moved.y).toBe(5);
    expect(moved.x).toBe(DEFAULT_GRID.cols - 3); // clamped from 20
  });
});

describe("mergeWithDefaults", () => {
  const defaults: DashboardLayout = {
    a: w({ id: "a", x: 0 }),
    b: w({ id: "b", x: 3 }),
  };

  it("keeps saved positions but adds newly-introduced default widgets", () => {
    const saved: DashboardLayout = { a: w({ id: "a", x: 9, y: 2 }) };
    const merged = mergeWithDefaults(saved, defaults);
    expect(merged.a.x).toBe(9); // saved wins
    expect(merged.a.y).toBe(2);
    expect(merged.b).toBeDefined(); // new default present
    expect(merged.b.x).toBe(3);
  });

  it("drops saved widgets that are no longer defaults", () => {
    const saved: DashboardLayout = { a: w({ id: "a" }), ghost: w({ id: "ghost" }) };
    const merged = mergeWithDefaults(saved, defaults);
    expect(merged.ghost).toBeUndefined();
  });

  it("falls back to all defaults when nothing is saved", () => {
    expect(Object.keys(mergeWithDefaults(null, defaults)).sort()).toEqual(["a", "b"]);
  });
});

describe("bringToFront", () => {
  it("gives the target the highest z", () => {
    const layout: DashboardLayout = {
      a: w({ id: "a", z: 1 }),
      b: w({ id: "b", z: 5 }),
    };
    const next = bringToFront(layout, "a");
    expect(next.a.z).toBeGreaterThan(next.b.z!);
  });

  it("is a no-op for an unknown id", () => {
    const layout: DashboardLayout = { a: w({ id: "a" }) };
    expect(bringToFront(layout, "nope")).toBe(layout);
  });
});

describe("serialize / deserialize", () => {
  it("round-trips a layout through the versioned blob", () => {
    const layout: DashboardLayout = { a: w({ id: "a", x: 2, y: 1, w: 4, h: 5, minimized: true }) };
    const back = deserializeLayout(serializeLayout(layout));
    expect(back).not.toBeNull();
    expect(back!.a).toMatchObject({ id: "a", x: 2, y: 1, w: 4, h: 5, minimized: true });
  });

  it("returns null for corrupt JSON, wrong version, or wrong shape", () => {
    expect(deserializeLayout("not json")).toBeNull();
    expect(deserializeLayout(null)).toBeNull();
    expect(deserializeLayout(JSON.stringify({ version: LAYOUT_VERSION + 99, layout: {} }))).toBeNull();
    expect(deserializeLayout(JSON.stringify({ version: LAYOUT_VERSION, layout: null }))).toBeNull();
  });

  it("skips malformed widget entries rather than throwing", () => {
    const raw = JSON.stringify({
      version: LAYOUT_VERSION,
      layout: { good: { x: 1, y: 1, w: 2, h: 2 }, bad: { x: "nope" } },
    });
    const back = deserializeLayout(raw);
    expect(back!.good).toBeDefined();
    expect(back!.bad).toBeUndefined();
  });
});
