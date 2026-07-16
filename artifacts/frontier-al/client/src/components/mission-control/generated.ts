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
  "generatedAt": "2026-07-16T08:40:52.434Z",
  "repository": {
    "headSha": "4ab5ce1",
    "headShaFull": "4ab5ce117d9d9bd0ea0b958b9b64de726227ccfd",
    "branch": "feat/mission-control-repo-intelligence",
    "remoteUrl": "https://github.com/KudbeeZero/FRONTIERNeXt.git",
    "commitTimestampIso": "2026-07-16T03:49:32Z",
    "commitSubject": "feat(mission-control): internal dashboard at /mission-control"
  },
  "build": {
    "appVersion": "2.0.1",
    "env": "development",
    "mode": "production",
    "builtAtIso": "2026-07-16T08:40:52.434Z",
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
      "number": 272,
      "title": "fix(mobile): safe-area insets, touch targets, drop duplicate render timer",
      "mergedSha": "e2c94bb",
      "mergedAt": "2026-07-16T03:36:30Z"
    },
    "lastSessionNote": {
      "date": "2026-07-16",
      "title": "mission control phase 2",
      "filename": "2026-07-16-mission-control-phase-2.md"
    },
    "lastSessionLog": {
      "prNumber": "272",
      "prTitle": "fix(mobile): safe-area insets, touch targets, drop duplicate render timer",
      "mergeSha": "e2c94bb4bba17118fe74613d78bac3f97969951a",
      "date": "2026-07-16T03:36:30Z",
      "filesChanged": "artifacts/frontier-al/client/src/components/game/BattlePlanner.tsx,artifacts/frontier-al/client/src/components/game/CommanderPanel.tsx,artifacts/frontier-al/client/src/components/game/GameLayout.tsx,artifacts/frontier-al/client/src/components/game/LandSheet.tsx,artifacts/frontier-al/client/src/components/game/MobilePlotSheet.tsx,artifacts/frontier-al/client/src/components/game/PlanetGlobe.tsx,artifacts/frontier-al/client/src/components/game/hud/hud.css,docs/memory/00-STATE-INDEX.md"
    },
    "latestCompletedLane": "mobile-globe-touch-regression",
    "memoryLayerHeadSha": "4ab5ce1",
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
      "feat/mission-control-repo-intelligence"
    ],
    "staleBranches": [],
    "localOnlyBranches": []
  }
} as const;

export default generated;
