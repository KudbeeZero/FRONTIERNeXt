/**
 * client/tests/hud-shell.spec.tsx
 *
 * Coverage for the v11 HUD shell (the BottomNav replacement). Same SSR harness
 * the rest of the client suite uses (`react-dom/server` `renderToStaticMarkup`,
 * no jsdom): asserts the dock renders its load-bearing markup/testids so it stays
 * a true drop-in for <BottomNav> (the connected-shell spec depends on the
 * `bottom-nav` testid). Effect-driven behavior (the sliding indicator measured
 * via layout effects + ResizeObserver, the collapse handle, drawer open/close
 * transitions) is NOT exercised here — that needs a DOM harness and is a
 * documented follow-up; nothing interactive is claimed as covered.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HudShell } from "@/components/game/hud/HudShell";
import type { NavTab } from "@/components/game/BottomNav";

function render(props: { activeTab: NavTab; battleCount?: number }): string {
  return renderToStaticMarkup(
    <HudShell activeTab={props.activeTab} onTabChange={() => {}} battleCount={props.battleCount} />,
  );
}

describe("HudShell (v11 dock — BottomNav drop-in)", () => {
  it("preserves the load-bearing bottom-nav testid (connected-shell contract)", () => {
    expect(render({ activeTab: "map" })).toContain('data-testid="bottom-nav"');
  });

  it("renders every primary tab plus the MORE overflow trigger", () => {
    const html = render({ activeTab: "map" });
    for (const id of ["map", "battles", "armory", "inventory", "commander", "more"]) {
      expect(html).toContain(`data-testid="nav-tab-${id}"`);
    }
  });

  it("renders the overflow tabs inside the drawer", () => {
    const html = render({ activeTab: "map" });
    for (const id of ["intel", "factions", "leaderboard", "economics", "trade", "markets"]) {
      expect(html).toContain(`data-testid="nav-tab-${id}"`);
    }
    expect(html).toContain('data-testid="hud-overflow-drawer"');
  });

  it("shows the battle count badge only when there are active battles", () => {
    const withBattles = render({ activeTab: "map", battleCount: 3 });
    expect(withBattles).toContain('data-testid="nav-badge-battles"');
    expect(withBattles).toContain(">3<");

    const none = render({ activeTab: "map", battleCount: 0 });
    expect(none).not.toContain('data-testid="nav-badge-battles"');
  });

  it("marks the active primary tab and leaves the drawer inactive", () => {
    const html = render({ activeTab: "commander" });
    expect(html).toContain('class="hud-di on"');
    // no overflow tab is active → no drawer item carries the active class
    expect(html).not.toContain("hud-drawer-item on");
  });

  it("marks the MORE trigger active and highlights the drawer item for an overflow tab", () => {
    const html = render({ activeTab: "intel" });
    // the MORE dock item is the active one when an overflow tab is selected
    expect(html).toContain('class="hud-di on"');
    expect(html).toContain("hud-drawer-item on");
  });
});
