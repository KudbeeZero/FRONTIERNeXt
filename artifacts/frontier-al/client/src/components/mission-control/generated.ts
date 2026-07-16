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
  "generatedAt": "2026-07-16T14:46:50.477Z",
  "repository": {
    "headSha": "5e4c1a3",
    "headShaFull": "5e4c1a308aa11c37386aa18dd1879d500788b5a6",
    "branch": "feat/mission-control-repo-intelligence",
    "remoteUrl": "https://x-access-token:kgh2.Hw+RIq79SsKfBvgVyMe4Sg%3D%3D%3AeJXsoOOvmm1P4mr%2F+DfXBg%3D%3D%3A%2F43VgIh8deljQwatYY6G%2F2RGn4BxlbLOKN+BRcLguh42BYihL1wV9L+1DxjGtMwC0vqaddsJ6i404NyZ6gOjcWMB%2Fus1g0M3RgyoiLu5cFZc91CewVd9MnGcr+DejeE1S9wjmecOZYVu7cxAibEIoUIrVcpg33OVgEKt+befEEWTcM5FYr61mmoHN8cFBKtGjReqRl%2FgZ%2FvSmXKm72ScCDZpbAbmumVG8RiFVyao6M5Kxt4pz2R6NixYir65Pi+UPLKhn4w0W4vfdi0D7pbejxPjmvsXyKDBQOc2kfwEWFuW5jnKzfNCCx4tdF3gnyWuyWDG0Y8bAETVGE5p9ypfRftxe1s6OErcwGs5kNnWhWj%2F4sWOdV%2FeFPI0s8P5BPrh5n+I8VX2ewIbX+pKcaHKjGx3BOm73ZKDjwHk+dT1NxZe5BhWaTNdSpGGeygFtxApo1BPoJj+GPYpdX4GUS2Bumw1OSvwgAWtgvEpSk5NZM5zbwrCfypARzbXHNRpbCJuXZ5QTvLSvsv7TjP9FMx2jgVH1noQZqeA4QJoPEp692ELKpwGDGM2BLivZ3DxwuHIuzriOKRRarI1igwjvkST8aabFABmqU9K47n%2Fn4YyP3yj77BNfYkt%2FYPsYZVOkZmh5oPvJFjezhKvJxHZLAa0c7%2Ft+fX1m2VwtyrH%2FOoxAEn7mkM8FZ4JnzaNS%2FRbMFaGGMJJ1kMVWrMjL1CcVJj7R+ARInnuk0QDhECnnHbG+IBxbisso%2FbDRXO1pzBkiij4czI%3D@github.com/KudbeeZero/FRONTIERNeXt.git",
    "commitTimestampIso": "2026-07-16T14:45:06Z",
    "commitSubject": "feat(mission-control): Phase 2 — repository intelligence via build-time generator"
  },
  "build": {
    "appVersion": "2.0.1",
    "env": "development",
    "mode": "production",
    "builtAtIso": "2026-07-16T14:46:50.477Z",
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
      "number": 273,
      "title": "feat(mission-control): internal dashboard at /mission-control",
      "mergedSha": "b82ff23",
      "mergedAt": "2026-07-16T11:19:09Z"
    },
    "lastSessionNote": {
      "date": "2026-07-16",
      "title": "mission control phase 2",
      "filename": "2026-07-16-mission-control-phase-2.md"
    },
    "lastSessionLog": {
      "prNumber": "273",
      "prTitle": "feat(mission-control): internal dashboard at /mission-control",
      "mergeSha": "b82ff2328c70e9b69465c29e998a9ad7b1883b49",
      "date": "2026-07-16T11:19:09Z",
      "filesChanged": "artifacts/frontier-al/client/src/App.tsx,artifacts/frontier-al/client/src/components/mission-control/MissionControlSection.tsx,artifacts/frontier-al/client/src/components/mission-control/StatusChip.tsx,artifacts/frontier-al/client/src/components/mission-control/missionControlData.test.ts,artifacts/frontier-al/client/src/components/mission-control/missionControlData.ts,artifacts/frontier-al/client/src/pages/MissionControl.tsx,artifacts/frontier-al/session-notes/2026-07-16-mission-control-dashboard.md,artifacts/frontier-al/vitest.config.ts,docs/HANDOFF.md"
    },
    "latestCompletedLane": "mobile-globe-touch-regression",
    "memoryLayerHeadSha": "5e4c1a3",
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
      "feat/mission-control-repo-intelligence",
      "session/agent_3d6000eb-b7ed-4249-8526-d8d1a79cf529"
    ],
    "staleBranches": [],
    "localOnlyBranches": []
  }
} as const;

export default generated;
