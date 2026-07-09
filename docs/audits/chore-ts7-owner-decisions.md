# TS7 Owner Decisions

## Purpose
Summarize the owner decisions required before starting actual TypeScript 7 migration.

## Decision 1 — TypeScript release-age policy
Current finding:
- minimumReleaseAge: 1440
- TypeScript is not in minimumReleaseAgeExclude
Options:
- Wait until TS7 package age passes policy
- Add TypeScript to release-age exception
Recommendation:
- Prefer waiting unless owner explicitly approves exception

## Decision 2 — Node types alignment
Current finding:
- catalog @types/node: ^25.3.3
- frontier-al @types/node: 20.19.33
Options:
- Keep package-specific Node types
- Align packages to catalog
- Align catalog down to stable project baseline
Recommendation:
- Do not change until package test matrix is run

## Decision 3 — esbuild bump policy
Current finding:
- esbuild pinned 0.27.3 may interact with Vite/TS7
Options:
- Keep pinned
- Bump only if TS7 migration requires it
- Bump proactively in separate PR
Recommendation:
- Keep pinned during first TS7 attempt; bump only if failure proves need

## Decision 4 — Vite target mismatch
Current finding:
- Vite build target es2020
- tsconfig target ES2022
Options:
- Leave as-is
- Align Vite target to ES2022 in separate config PR
Recommendation:
- Document only; do not change inside TS7 migration unless needed

## Decision 5 — allowed package install policy
Current finding:
- read-only scan could not measure timing because node_modules absent
Options:
- Allow pnpm install --frozen-lockfile in migration lane
- Require CI-only timing
Recommendation:
- Allow frozen install in actual migration lane, but never lockfile edits unless expected

## Go / No-Go
Go only if owner approves:
- TypeScript release-age path
- Node types strategy
- esbuild strategy
- frozen install policy

No-Go if:
- migration requires protected source edits
- package lock changes are unexpected
- tests fail in auth/funds/chain/game paths
- migration needs broad import churn

## Next Lane
Recommended branch:
- chore/ts7-migration

Recommended first command:
- git checkout -B chore/ts7-migration origin/main
