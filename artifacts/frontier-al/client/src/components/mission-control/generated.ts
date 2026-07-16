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
  "generatedAt": "2026-07-16T16:02:03.392Z",
  "repository": {
    "headSha": "6603a13",
    "headShaFull": "6603a13c0e561b33708932aae01be448b09ea237",
    "branch": "feat/memory-layer-kilo-runner",
    "remoteUrl": "https://x-access-token:kgh2.JDKJWCxXrcSu6Ud8RU3wQQ%3D%3D%3AHFvartdrK0zzEPwtL7jlsA%3D%3D%3ALyFAhloSsWQEbbQeDi84qx85NwDogJwqopJJ%2FQZw85SP6fx+2NbD5cbFCVBfcwu+B4dAT4ugtgk5uTDFfAF+yYLKGxd4qJujr4670G0I064hmGaBGHCY9sq4ziDYw+2tmTvWXqnvGdunccWjkMKO9+zC2TTCFliadj+su5y59jbB0CsKFuRC8Kj%2F60QozeJagS5PW3%2FDwym60fF0PYJNEo4SmmiTu7QtUQXQOsAZZ6EM7KqZuhz750PEFiXZnGfqwqGS5xqvfzF4OobvqH3NoaMAK6nO2qYBKUwCkzIpk74aTFTCC8RVAATWjuIilpqu2GrKcRPOjgyCJUKmRpTDjENcLLGmovLTpHO5wDIF0piUzhBUw9UaZh4ssLH2REbkZYb7bfDta7BKuQb9rqhNHnZdqzKHmYksLXWC7HELO3owH1K1pXZry+K6tYkfKsnru67cA5eKdi0Ijegu0djOVkgEsccaA2FxXOyRe9%2F7L1g1XAkE1XotsDerV%2FvlWp69qphpOWcYzUXOYikEKHQRuRk+P2W6d9RTvSImD0hN9%2FNtK7AzoDklE8dlXX7jBCvdicZ12XPChbYN9f0SsOrkclDW%2FEXoXy0hYZZfuAmL7WybrrJq%2FBhsJLgvu3IIpU8dBgdeDNPtGVsO4fz%2FDjhefYBDAA+i81MyJFVnvtsi9lDBfd3pb40Ewr28F+Ad%2F%2F8D1q9ilwemNuOiqtYmWEuPPIrW2OZTT4wTdB8tm4MbzCdzmj40k2MUKaNTDqXD+Dqghjk%3D@github.com/KudbeeZero/FRONTIERNeXt.git",
    "commitTimestampIso": "2026-07-16T15:58:19Z",
    "commitSubject": "build(mission-control): update generated repository intelligence metadata"
  },
  "build": {
    "appVersion": "2.0.1",
    "env": "development",
    "mode": "production",
    "builtAtIso": "2026-07-16T16:02:03.392Z",
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
      "number": 274,
      "title": "feat(mission-control): Phase 2 — repository intelligence via build-time generator",
      "mergedSha": "dd91980",
      "mergedAt": "2026-07-16T15:40:14Z"
    },
    "lastSessionNote": {
      "date": "2026-07-16",
      "title": "mission control phase 2",
      "filename": "2026-07-16-mission-control-phase-2.md"
    },
    "lastSessionLog": {
      "prNumber": "274",
      "prTitle": "feat(mission-control): Phase 2 — repository intelligence via build-time generator",
      "mergeSha": "dd91980880b1ce5d1e9d167977e99392ee385bf6",
      "date": "2026-07-16T15:40:14Z",
      "filesChanged": "artifacts/frontier-al/client/src/components/mission-control/generated.ts,artifacts/frontier-al/client/src/components/mission-control/missionControlData.test.ts,artifacts/frontier-al/client/src/components/mission-control/missionControlData.ts,artifacts/frontier-al/client/src/components/mission-control/testTotals.json,artifacts/frontier-al/client/src/pages/MissionControl.tsx,artifacts/frontier-al/package.json,artifacts/frontier-al/scripts/capture-test-totals.mjs,artifacts/frontier-al/scripts/generate-mission-control-data.mjs,artifacts/frontier-al/session-notes/2026-07-16-mission-control-phase-2.md"
    },
    "latestCompletedLane": "mobile-globe-touch-regression",
    "memoryLayerHeadSha": "6603a13",
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
      "feat/memory-layer-kilo-runner",
      "feat/memory-layer-runner-workflow",
      "session/agent_091033b4-09e3-4148-9664-1bea220e13cc"
    ],
    "staleBranches": [],
    "localOnlyBranches": []
  }
} as const;

export default generated;
