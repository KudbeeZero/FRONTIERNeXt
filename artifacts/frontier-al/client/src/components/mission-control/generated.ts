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
  "generatedAt": "2026-07-17T05:07:18.050Z",
  "repository": {
    "headSha": "554a84c",
    "headShaFull": "554a84c6f4774b5007fe5e463cab5c7c300e5d5b",
    "branch": "session/agent_0436e198-0b32-430b-aba2-38ffe8eaaf28",
    "remoteUrl": "github.com/KudbeeZero/FRONTIERNeXt",
    "commitTimestampIso": "2026-07-16T17:25:05Z",
    "commitSubject": "docs: baton + session note for remoteUrl secret fix (PR #278); flag OWNER token rotation [skip ci]"
  },
  "build": {
    "appVersion": "2.0.1",
    "env": "development",
    "mode": "production",
    "builtAtIso": "2026-07-17T05:07:18.050Z",
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
      "date": "README",
      "title": "README",
      "filename": "README.md"
    },
    "lastSessionLog": {
      "prNumber": "277",
      "prTitle": "fix(weapons): EngagementStore.settle() + active() impacted handling (C-1)",
      "mergeSha": "0e16e56763406c70815c03cd78f2aa4e8b5b0e23",
      "date": "2026-07-16T17:04:30Z",
      "filesChanged": "artifacts/frontier-al/client/src/components/mission-control/generated.ts,artifacts/frontier-al/client/src/components/mission-control/missionControlData.test.ts,artifacts/frontier-al/scripts/generate-mission-control-data.mjs,artifacts/frontier-al/server/weapons/engagementStore.spec.ts,artifacts/frontier-al/server/weapons/engagementStore.ts,docs/audits/fix-weapons-engagement-settle.md"
    },
    "latestCompletedLane": "mobile-globe-touch-regression",
    "memoryLayerHeadSha": "554a84c",
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
      "session/agent_0436e198-0b32-430b-aba2-38ffe8eaaf28"
    ],
    "staleBranches": [],
    "localOnlyBranches": []
  }
} as const;

export default generated;
