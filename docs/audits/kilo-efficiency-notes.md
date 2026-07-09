# Kilo Efficiency Notes

## What slowed the agent down
- session folder looked like non-repo but was repo root; initial pwd showed a path deep in the agent scaffold rather than the monorepo root
- rg not available in this environment; had to fall back to grep/find
- temp path writes blocked in some cases; workspace edits had to be used carefully
- node_modules missing caused `tsc: not found` on first typecheck attempt
- grep found bundled/session-note noise; had to use `--exclude-dir` filters
- suggest tool mentioned but unavailable; could not offer local code review via /local-review-uncommitted

## What worked
- `git rev-parse --show-toplevel` quickly confirmed repo root after initial confusion
- `gh pr checkout 235` cleanly switched to the PR branch
- grep/find fallback worked for scanning all `tsconfig*.json` files and their key properties
- `pnpm install --frozen-lockfile` solved the missing `tsc` issue cleanly
- workspace edit plus targeted root typecheck worked for config experiments (temp moduleResolution test in api-server)
- one-lane PR discipline kept scope tight and prevented drift toward auth/WebGL/on-chain tangents

## Future prompt upgrades
- include Kilo repo-root rule (use `git rev-parse` before `pwd` when git is present)
- include grep fallback for `rg`-missing environments
- include frozen install rule (`pnpm install --frozen-lockfile` is safe if lockfile is present)
- exclude bundled/generated/session-note noise from grep searches
- allow one same-lane adjacent fix only if proven green with no source edits
- require revert-on-fail for config experiments (revert if `module` + `moduleResolution` pairing causes failures)
- require Asked / Done / Needs you closeout block in final response

## Best run-window tracking
- Current local time: 2026-07-09 11:04 UTC
- Kilo felt speed: normal
- Commands stalled: no significant stalls; `pnpm install` and vitest suites both completed within expectations
- Recommendation: continue scheduling during normal demand windows; no strong evidence yet that lower-demand windows are needed for free-tier containers
