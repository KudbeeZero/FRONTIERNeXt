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
  "generatedAt": "2026-07-16T16:57:35.056Z",
  "repository": {
    "headSha": "bacd73b",
    "headShaFull": "bacd73be500e76e443428651cb61891623fd4b31",
    "branch": "fix/weapons-engagement-settle",
    "remoteUrl": "https://x-access-token:kgh2.ZdmyYDPzZkpxtUf7scOEtw%3D%3D%3A2BNELdI+v%2FJgUl7Lc853+g%3D%3D%3AN2EfTppkUc6KdviWDXzHvnBypUZsgt44%2F1dHz8MPs4J5tuHk6SZwAv19teC8ydoo2FjsajczCz5qLI7DZ+v5H39LyjghsFOLC2vJ17h7A6ZErkhmEl5uGohx8AdEFbos6FEFhp+3O++rcpK1EDp7fSbjwhjDqIHfbyqDsOsXR4rJytRX8XJdOfCtWbvRes6hL1MQHgIJDD9gZ6XXlrVUyzHOTdf52R2LTQRUX4ONYT7lUPTHUlOwXbqug%2FrQF02t4SoetYWQ5rM1sS%2Fm88yT4po30lg+zo2D7tCI8XXC3WqvH67ws6S1LhmBxfuLwsvi6x0G7Rj8d8ZBJvHx5JvC0PpitlhZlAHx%2F+63FuAo0GdkA27fn3eVBpxm62KyA+IQWHPw0eTZiR+yYqMTifk%2FqHPCcFXUmHyESFOVyUSs2RIzO3TXho4z74kkWzoWr9mxAQqYKmfJ3x0Msi85EoeNOkf2q379OoVHpGm+XEUttKWIN0g8KTiT8V0OPT0TT3hEZOqsmZV0eGaV+66kqj4Z3sAAWX1%2FI3XP8QWRssQu1pruIsJpSM+mc9H4YhMTW24JFXW%2FHMF9c7D8OZNopTodRx4gPqZBsLHt51ul+mPUhkyGNQxWDJ1s33AcPN6PSpcisKNQc0BW3FEahToRWafY7USpPicb97j0XEdhEfRAYP+sIR%2Fouel+ktc2qOhIsCa3ivRL7Lc3zXclSzgImvigCXuLIHGBqsxBdPNCvk5o1dYj7NTHw0JYkiNGCEKKzbXL5v8%3D@github.com/KudbeeZero/FRONTIERNeXt.git",
    "commitTimestampIso": "2026-07-16T16:52:42Z",
    "commitSubject": "fix(weapons): add EngagementStore.settle() + active() impacted handling (C-1)"
  },
  "build": {
    "appVersion": "2.0.1",
    "env": "development",
    "mode": "production",
    "builtAtIso": "2026-07-16T16:57:35.056Z",
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
      "number": 0,
      "title": "session-note: Battle Planner route + page shell (2026-07-16)",
      "mergedSha": "6119872",
      "mergedAt": "2026-07-16T16:34:02Z"
    },
    "lastSessionNote": {
      "date": "2026-07-12",
      "title": "phase a merge and phase b persistence",
      "filename": "2026-07-12-phase-a-merge-and-phase-b-persistence.md"
    },
    "lastSessionLog": {
      "prNumber": "N/A",
      "prTitle": "session-note: Battle Planner route + page shell (2026-07-16)",
      "mergeSha": "61198725a4b1a9d91572f9d39d45c47e324d95ee",
      "date": "2026-07-16T16:34:02Z",
      "filesChanged": "artifacts/frontier-al/session-notes/2026-07-16-battle-planner-route.md"
    },
    "latestCompletedLane": "mobile-globe-touch-regression",
    "memoryLayerHeadSha": "bacd73b",
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
      "fix/weapons-engagement-settle",
      "session/agent_57a3587c-f202-4b0f-b716-0639f72c9105"
    ],
    "staleBranches": [],
    "localOnlyBranches": []
  }
} as const;

export default generated;
