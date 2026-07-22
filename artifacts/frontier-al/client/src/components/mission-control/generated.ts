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
  "generatedAt": "2026-07-22T02:22:32.128Z",
  "repository": {
    "headSha": "f32337e",
    "headShaFull": "f32337eff2baea088c1ae7efc8a54cff60339e4a",
    "branch": "ops/frontier-halt-db-deploy",
    "remoteUrl": "github.com/KudbeeZero/FRONTIERNeXt",
    "commitTimestampIso": "2026-07-20T03:09:16Z",
    "commitSubject": "docs: update session log [skip ci]"
  },
  "build": {
    "appVersion": "2.0.1",
    "env": "development",
    "mode": "production",
    "builtAtIso": "2026-07-22T02:22:32.128Z",
    "testTotals": {
      "client": {
        "files": 1,
        "tests": 10,
        "skipped": 0
      },
      "server": {
        "files": 76,
        "tests": 719,
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
      "number": 279,
      "title": "feat(server): add database kill switch (HALT_DB)",
      "mergedSha": "d320179",
      "mergedAt": "2026-07-20T03:09:15Z"
    },
    "lastSessionNote": {
      "date": "2026-07-07",
      "title": "ascend satellites lootbox armory",
      "filename": "2026-07-07-ascend-satellites-lootbox-armory.md"
    },
    "lastSessionLog": {
      "prNumber": "279",
      "prTitle": "feat(server): add database kill switch (HALT_DB)",
      "mergeSha": "d320179ad64709d12b9b8a20650490142bebb8f9",
      "date": "2026-07-20T03:09:15Z",
      "filesChanged": "artifacts/frontier-al/session-notes/2026-07-20-db-kill-switch.md,docs/HANDOFF.md,docs/audits/feat/frontier-halt-db-kill-switch.md"
    },
    "latestCompletedLane": "mobile-globe-touch-regression",
    "memoryLayerHeadSha": "f32337e",
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
        "name": "defender-for-devops",
        "status": "healthy",
        "note": "present at .github/workflows/defender-for-devops.yml"
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
      "session/agent_94a08a74-315f-40c7-a494-3b45cb91d0d9"
    ],
    "staleBranches": [],
    "localOnlyBranches": [
      "ops/frontier-halt-db-deploy"
    ]
  }
} as const;

export default generated;
