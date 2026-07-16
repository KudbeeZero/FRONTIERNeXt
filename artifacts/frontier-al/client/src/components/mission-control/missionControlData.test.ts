/**
 * client/src/components/mission-control/missionControlData.test.ts
 *
 * The dashboard is static/informational. This test guards the data contract:
 * every section the page renders must be present and well-formed so the
 * dashboard never silently renders an empty panel after a hand-edit.
 */
import { describe, it, expect } from "vitest";
import { missionControlData, type StatusLevel } from "./missionControlData";

const VALID_STATUSES: StatusLevel[] = ["healthy", "warning", "manual", "disabled", "unknown"];

describe("missionControlData", () => {
  it("has a main HEAD SHA and latest merged PR", () => {
    expect(missionControlData.repo.mainHeadSha).toBeTruthy();
    expect(missionControlData.repo.latestMergedPr.number).toBeGreaterThan(0);
  });

  it("has all workflow and build items with valid statuses", () => {
    for (const w of missionControlData.workflows) {
      expect(VALID_STATUSES).toContain(w.status);
    }
    for (const b of missionControlData.build) {
      expect(VALID_STATUSES).toContain(b.status);
    }
  });

  it("has priorities, owner actions, memory, and branch hygiene populated", () => {
    expect(missionControlData.priorities.activeLane).toBeTruthy();
    expect(missionControlData.ownerActions.length).toBeGreaterThan(0);
    expect(missionControlData.memory.batonState).toBeTruthy();
    expect(missionControlData.branches.activeFeatureBranches.length).toBeGreaterThan(0);
  });
});
