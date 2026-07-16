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
  "generatedAt": "2026-07-16T15:57:07.962Z",
  "repository": {
    "headSha": "3b8f50a",
    "headShaFull": "3b8f50a7850f8f2150e1ef7943d289bdffe8897f",
    "branch": "feat/memory-layer-kilo-runner",
    "remoteUrl": "https://x-access-token:kgh2.87dY7QlSviZB08XuDYhTMg%3D%3D%3AkoI4eLWIfrTtP2CJrMW6%2FA%3D%3D%3AEPwIXwIQcPBA17bdidLcOVh67a3d6bIcaf%2FAnJOKFKSvDrsVis5%2FG3hubMwJ5tx49O0D99KVZq2SQdcRePL21bvkdRnbeIfNAY883mKnBZa256FMs2fVKw6NauDrMqpmgP3WW2VJGrJ0JKCZxO2WoCumkWnjab%2FI449XNOjljnoGC+zswyN%2FyPmYIWh9YCCYrXvXnlRASMskD9qXTZMKAPUnAIrVTuZS9YJIaFaqfGHA0M+L1Jo0MDXh7YodafRQDZPzM2qkZe8le6yZe0YQPv+LA7ezg+ntzFXlU31hTtBkdkBrUgAjmhvZZtVxSLRM4VE6oPOyrR2yKUKgqCySqk7dY6UzlUu2k7DU3FyzsfKNTqFCAqUDGkre30EyCUvNHEXcMlZZ4HKJuLNQAOubtJxoQ+7u5n1GiZ9OydGb90iG3UBZZtKBtrc+Gqn8kDB5tfuMoCtLcCb2709Ep3TwRw5mPyBEleLMhKzd2Pd%2Fk0blarMVMwXCoyjxYnidnMKKK1eGYWwjLSNMyAh8hG3UHRRThG5qfY%2Fy2%2FkDyjQ%2FBWP2MNEVUZqbryKXJnOjz7PxdXfj%2Fz32M2eExa%2F5Dm7CCOHVzNbxveK6C1KHGeaYvQ2ENV71ZhT3KDIqmyxG43YNtjj8P23nXNzfg3ooy29B0x3Pt8aLSF21xSMrWvJOXwozOxihyMwYM2SO8ggI7OkTLBkxMtxOlNLfvrg3dxaCX%2FzbgE5aiW3MhQ+bnm9acrDD6CER6rlMz4+UYhij6KG6Iuo%3D@github.com/KudbeeZero/FRONTIERNeXt.git",
    "commitTimestampIso": "2026-07-16T15:54:48Z",
    "commitSubject": "docs(memory): port KILO runner prompt + session updater workflow"
  },
  "build": {
    "appVersion": "2.0.1",
    "env": "development",
    "mode": "production",
    "builtAtIso": "2026-07-16T15:57:07.962Z",
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
    "memoryLayerHeadSha": "3b8f50a",
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
