/**
 * client/src/components/mission-control/generated.ts
 *
 * AUTO-GENERATED at build time by
 *   artifacts/frontier-al/scripts/generate-mission-control-data.mjs
 *
 * DO NOT EDIT BY HAND — edits will be overwritten on the next prebuild /
 * pretest / precheck run. To change the schema, edit the generator.
 *
 * The data here is the source for the Mission Control dashboard's
 * repository-intelligence panels (Phase 2). All values are derived from
 * local git state, package metadata, session notes, and the .github
 * workflows directory. There is no API, no backend, no polling, no
 * database, no GitHub auth.
 */

/* eslint-disable */
// @ts-nocheck — generated file; the generator enforces the shape and the
// data-contract test (generated.test.ts) catches drift.

export const generated = {
  "schemaVersion": 1,
  "generatedAt": "2026-07-16T17:16:06.965Z",
  "repository": {
    "headSha": "573d516",
    "headShaFull": "573d516a5e51eca9fe0bd4e31bdc71cdabd3726a",
    "branch": "fix/mission-control-strip-remote-token",
    "remoteUrl": "github.com/KudbeeZero/FRONTIERNeXt",
    "commitTimestampIso": "2026-07-16T17:14:51Z",
    "commitSubject": "docs: preserve ASA draft + live session progress log (info-preservation) [skip ci]"
  },
  "build": {
    "appVersion": "2.0.1",
    "env": "development",
    "mode": "production",
    "builtAtIso": "2026-07-16T17:16:06.965Z",
    "testTotals": {
      "client": {
        "files": 1,
        "tests": 9,
        "skipped": 0
      },
      "server": {
        "files": 73,
        "tests": 706,
        "skipped": 26
      },
      "captured": true
    },
    "deploy": {
      "mode": "local",
      "url": null
    }
  },
  "workflow": {
    "lastMergedPr": {
      "number": 277,
      "title": "fix(weapons): EngagementStore.settle() + active() impacted handling (C-1)",
      "mergedSha": "0e16e56",
      "mergedAt": "2026-07-16T17:04:30Z"
    },
    "lastSessionNote": {
      "date": "2026-07-16",
      "title": "salvage weapons settle and ci unblock",
      "filename": "2026-07-16-salvage-weapons-settle-and-ci-unblock.md"
    },
    "lastSessionLog": {
      "prNumber": "277",
      "prTitle": "fix(weapons): EngagementStore.settle() + active() impacted handling (C-1)",
      "mergeSha": "0e16e56763406c70815c03cd78f2aa4e8b5b0e23",
      "date": "2026-07-16T17:04:30Z",
      "filesChanged": "artifacts/frontier-al/client/src/components/mission-control/generated.ts,artifacts/frontier-al/client/src/components/mission-control/missionControlData.test.ts,artifacts/frontier-al/scripts/generate-mission-control-data.mjs,artifacts/frontier-al/server/weapons/engagementStore.spec.ts,artifacts/frontier-al/server/weapons/engagementStore.ts,docs/audits/fix-weapons-engagement-settle.md"
    },
    "latestCompletedLane": "mobile-globe-touch-regression",
    "memoryLayerHeadSha": "573d516",
    "workflows": [
      {
        "name": "ci",
        "status": "healthy",
        "note": "present at .github/workflows/ci.yml"
      },
      {
        "name": "db-push",
        "status": "healthy",
        "note": "present at .github/workflows/db-push.yml"
      },
      {
        "name": "fly-deploy",
        "status": "healthy",
        "note": "present at .github/workflows/fly-deploy.yml"
      },
      {
        "name": "frontier-db-diagnose",
        "status": "healthy",
        "note": "present at .github/workflows/frontier-db-diagnose.yml"
      },
      {
        "name": "memory-session-check",
        "status": "healthy",
        "note": "present at .github/workflows/memory-session-check.yml"
      },
      {
        "name": "session-log",
        "status": "healthy",
        "note": "present at .github/workflows/session-log.yml"
      }
    ]
  },
  "branches": {
    "activeFeatureBranches": [
      "fix/mission-control-strip-remote-token",
      "session/agent_57a3587c-f202-4b0f-b716-0639f72c9105"
    ],
    "staleBranches": [],
    "localOnlyBranches": []
  }
} as const;

export default generated;
