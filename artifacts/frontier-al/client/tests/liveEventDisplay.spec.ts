/**
 * client/tests/liveEventDisplay.spec.ts
 *
 * Proves `liveEventDisplay` — the pure WorldEvent → telemetry-box mapping behind
 * the "living map" overlay: battle resolutions (win/loss/unknown), land claims,
 * and that already-visualized / coordless event types are skipped (null).
 */
import { describe, it, expect } from "vitest";
import { liveEventDisplay } from "../src/lib/globe/liveEventDisplay";
import type { WorldEvent } from "@shared/worldEvents";

function ev(over: Partial<WorldEvent>): WorldEvent {
  return {
    id: "e1",
    type: "battle_resolved",
    timestamp: 1000,
    plotId: 1234,
    lat: 10,
    lng: 20,
    metadata: {},
    ...over,
  };
}

describe("liveEventDisplay", () => {
  it("maps an attacker win to a VICTORY box", () => {
    const d = liveEventDisplay(ev({ type: "battle_resolved", metadata: { outcome: "attacker_wins" } }));
    expect(d).not.toBeNull();
    expect(d!.kind).toBe("victory");
    expect(d!.label).toBe("VICTORY #1234");
  });

  it("maps a defender win to a DEFENSE HELD box", () => {
    const d = liveEventDisplay(ev({ type: "battle_resolved", metadata: { outcome: "defender_wins" } }));
    expect(d!.kind).toBe("defense");
    expect(d!.label).toBe("DEFENSE HELD #1234");
  });

  it("falls back to a neutral resolved box when outcome is missing", () => {
    const d = liveEventDisplay(ev({ type: "battle_resolved", metadata: {} }));
    expect(d!.label).toBe("BATTLE RESOLVED #1234");
  });

  it("maps a land claim to a CLAIMED box", () => {
    const d = liveEventDisplay(ev({ type: "land_claimed", metadata: {} }));
    expect(d!.kind).toBe("claim");
    expect(d!.label).toBe("CLAIMED #1234");
  });

  it("omits the plot suffix when plotId is absent", () => {
    const d = liveEventDisplay(ev({ type: "land_claimed", plotId: undefined }));
    expect(d!.label).toBe("CLAIMED");
  });

  it("returns null for already-visualized / coordless event types", () => {
    for (const type of ["battle_started", "mine_action", "resource_pulse", "commander_deployed", "scan_ping"] as const) {
      expect(liveEventDisplay(ev({ type }))).toBeNull();
    }
  });

  it("each mapped kind carries a distinct color", () => {
    const v = liveEventDisplay(ev({ metadata: { outcome: "attacker_wins" } }))!.color;
    const h = liveEventDisplay(ev({ metadata: { outcome: "defender_wins" } }))!.color;
    const c = liveEventDisplay(ev({ type: "land_claimed" }))!.color;
    expect(new Set([v, h, c]).size).toBe(3);
  });
});
