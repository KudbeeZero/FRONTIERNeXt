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
  "generatedAt": "2026-07-20T02:39:24.443Z",
  "repository": {
    "headSha": "c7a647d",
    "headShaFull": "c7a647d2125273bc77fc06ae7f84f28fa132a0ad",
    "branch": "feat/frontier-halt-db-kill-switch",
    "remoteUrl": "github.com/KudbeeZero/FRONTIERNeXt",
    "commitTimestampIso": "2026-07-17T19:28:13Z",
    "commitSubject": "docs: update session log [skip ci]"
  },
  "build": {
    "appVersion": "2.0.1",
    "env": "development",
    "mode": "production",
    "builtAtIso": "2026-07-20T02:39:24.443Z",
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
      "number": 0,
      "title": "Create defender-for-devops.yml",
      "mergedSha": "fba717d",
      "mergedAt": "2026-07-17T19:28:12Z"
    },
    "lastSessionNote": {
      "date": "2026-07-08",
      "title": "mobile plot panel gate and hud overlap",
      "filename": "2026-07-08-mobile-plot-panel-gate-and-hud-overlap.md"
    },
    "lastSessionLog": {
      "prNumber": "N/A",
      "prTitle": "Create defender-for-devops.yml",
      "mergeSha": "fba717d0c383fc9ab3cda033e36cf6b60872e508",
      "date": "2026-07-17T19:28:12Z",
      "filesChanged": ".github/workflows/defender-for-devops.yml"
    },
    "latestCompletedLane": "mobile-globe-touch-regression",
    "memoryLayerHeadSha": "c7a647d",
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
      "feat/frontier-halt-db-kill-switch",
      "session/agent_8bf07fda-60a2-499e-b91b-b498e2317aec"
    ],
    "staleBranches": [],
    "localOnlyBranches": []
  }
} as const;

export default generated;
